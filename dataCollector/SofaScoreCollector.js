/**
 * SofaScore Data Collector
 * Uses Puppeteer to connect to SofaScore and capture real-time match events
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import EventEmitter from 'events';
import pino from 'pino';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
});

export class SofaScoreCollector extends EventEmitter {
  constructor() {
    super();
    this.browser = null;
    this.page = null;
    this.cdpSession = null;
    this.isRunning = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.previousScores = new Map(); // Track scores to detect changes
    this.matchInfo = new Map(); // Cache match details (teams, players, etc.)
    this.refreshInterval = null; // Interval for refreshing live matches
  }

  async start() {
    try {
      logger.info('🚀 Starting SofaScore collector...');

      // Use headless mode in production (Fly.io), visible browser locally
      const isProduction = process.env.NODE_ENV === 'production';
      
      // On VPS, use headful mode with Xvfb to avoid bot detection
      const useHeadful = isProduction && process.env.USE_XVFB === 'true';

      this.browser = await puppeteer.launch({
        headless: useHeadful ? false : (isProduction ? 'new' : false),
        defaultViewport: { width: 1920, height: 1080 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          // Enable GPU and graphics features (anti-bot detection)
          ...(useHeadful ? [
            '--enable-webgl',
            '--enable-gpu',
            '--enable-gpu-rasterization',
            '--enable-zero-copy',
            '--ignore-gpu-blocklist',
            '--enable-accelerated-2d-canvas',
            '--disable-software-rasterizer',
          ] : [
            '--disable-gpu',
            '--disable-software-rasterizer',
          ]),
          // Use proxy if configured
          ...(process.env.PROXY_SERVER ? [`--proxy-server=${process.env.PROXY_SERVER}`] : []),
          ...(isProduction ? [] : ['--start-maximized'])
        ],
        protocolTimeout: 180000,
        ignoreHTTPSErrors: true,
        executablePath: process.env.CHROME_BIN || undefined,
      });

      this.page = await this.browser.newPage();

      // Set up proxy authentication if configured
      if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
        await this.page.authenticate({
          username: process.env.PROXY_USERNAME,
          password: process.env.PROXY_PASSWORD,
        });
        logger.info('🔐 Proxy authentication configured');
      }

      // Override navigator properties to hide automation
      await this.page.evaluateOnNewDocument(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Mock languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );

        // Mock chrome object
        window.chrome = {
          runtime: {},
        };
      });

      logger.info(`🌐 Browser launched | Headless: ${this.browser._process ? 'No (Xvfb)' : 'Yes'} | Proxy: ${process.env.PROXY_SERVER ? 'Yes' : 'No'}`);

      // Log browser console messages for debugging
      this.page.on('console', msg => {
        const text = msg.text();
        if (text.includes('Fetched match') || text.includes('API fetch')) {
          logger.info({ browserLog: text }, '🌐 Browser console');
        }
      });

      // Setup CDP session for WebSocket interception
      this.cdpSession = await this.page.target().createCDPSession();
      await this.cdpSession.send('Network.enable');

      this.setupWebSocketInterception();

      // Navigate to live matches page
      logger.info('🌐 Navigating to SofaScore...');
      await this.page.goto('https://www.sofascore.com/football/livescore', {
        waitUntil: 'networkidle2', // Wait for page to fully load
        timeout: 30000,
      });

      // Extract all live matches from the page DOM
      logger.info('📊 Extracting live match details from page...');
      await this.extractLiveMatches();

      // Refresh live matches every 5 minutes to catch newly started matches
      this.refreshInterval = setInterval(async () => {
        logger.info('🔄 Refreshing live matches...');
        await this.extractLiveMatches();
      }, 5 * 60 * 1000); // 5 minutes

      this.isRunning = true;
      logger.info('✅ SofaScore collector started!');
      logger.info('📡 Monitoring ALL live matches via WebSocket');

      this.emit('started');
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to start SofaScore collector');
      this.emit('error', error);
      throw error;
    }
  }

  setupWebSocketInterception() {
    this.cdpSession.on('Network.webSocketFrameReceived', ({ timestamp, response }) => {
      try {
        const message = response.payloadData;

        // Decode Base64 if needed
        let decoded;
        try {
          decoded = Buffer.from(message, 'base64').toString('utf-8');
        } catch {
          decoded = message;
        }

        // Skip PING/PONG messages
        if (decoded === 'PING\r\n' || decoded === 'PONG\r\n') {
          return;
        }

        // Parse SofaScore protocol: MSG sport.football <channel> <size>\n<json>\n
        if (decoded.startsWith('MSG sport.football')) {
          const lines = decoded.split('\n');
          if (lines.length >= 2) {
            try {
              const jsonData = JSON.parse(lines[1]);
              // Log if this is a goal/card event to see the structure
              if (jsonData['homeScore.current'] !== undefined || jsonData['awayScore.current'] !== undefined || 
                  jsonData.homeRedCards !== undefined || jsonData.awayRedCards !== undefined ||
                  jsonData.homeYellowCards !== undefined || jsonData.awayYellowCards !== undefined) {
                logger.debug({ sample: JSON.stringify(jsonData).substring(0, 500) }, '📦 WebSocket event data');
              }
              this.handleMatchUpdate(jsonData, timestamp);
            } catch (parseError) {
              logger.debug({ error: parseError.message }, 'Failed to parse JSON from message');
            }
          }
        }
      } catch (error) {
        logger.error({ error: error.message }, 'Error processing WebSocket message');
      }
    });

    this.cdpSession.on('Network.webSocketClosed', () => {
      logger.warn('WebSocket connection closed');
      this.emit('disconnected');
      this.handleReconnect();
    });
  }

  async handleMatchUpdate(data, timestamp) {
    const matchId = data.id;
    if (!matchId) return;

    // Log raw WebSocket data to see what's available
    if (!this.matchInfo.has(matchId)) {
      logger.debug({ matchId, sampleData: JSON.stringify(data).substring(0, 300) }, '📦 WebSocket data sample');
    }

    // Check if WebSocket data already contains team names
    if (data.homeTeam && data.awayTeam && !this.matchInfo.has(matchId)) {
      logger.info({ matchId, teams: `${data.homeTeam.name} vs ${data.awayTeam.name}` }, '✅ Team data from WebSocket');
      this.matchInfo.set(matchId, {
        homeTeam: data.homeTeam.name,
        awayTeam: data.awayTeam.name,
        tournament: data.tournament?.name || data.tournament?.uniqueTournament?.name || '',
        homeTeamShort: data.homeTeam.shortName || data.homeTeam.name,
        awayTeamShort: data.awayTeam.shortName || data.awayTeam.name,
      });
    }

    // Fetch match details if not cached
    if (!this.matchInfo.has(matchId)) {
      logger.info({ matchId }, '🔍 Match not in cache, attempting immediate fetch from API...');
      
      // Try to fetch this specific match from API immediately
      await this.fetchMatchDetailsFromAPI(matchId);
    }

    const matchDetails = this.matchInfo.get(matchId) || {};
    
    if (!matchDetails.homeTeam || matchDetails.homeTeam === 'Unknown') {
      logger.warn({ 
        matchId, 
        cachedMatches: Array.from(this.matchInfo.keys()).slice(0, 10),
        totalCached: this.matchInfo.size 
      }, '⚠️ Match details unknown - not in cache');
    }

    const event = {
      timestamp: new Date(timestamp * 1000).toISOString(),
      matchId,
      source: 'sofascore',
      homeTeam: matchDetails.homeTeam,
      awayTeam: matchDetails.awayTeam,
      tournament: matchDetails.tournament,
    };

    // Detect goal from score change
    if (data['homeScore.current'] !== undefined || data['awayScore.current'] !== undefined) {
      const currentScore = {
        home: data['homeScore.current'] ?? 0,
        away: data['awayScore.current'] ?? 0,
      };

      const previousScore = this.previousScores.get(matchId);

      if (previousScore) {
        // Check for goal
        if (currentScore.home > previousScore.home) {
          event.eventType = 'goal';
          event.team = 'home';
          event.teamName = matchDetails.homeTeam;
          event.score = `${currentScore.home}-${currentScore.away}`;
          event.minute = this.extractMinute(data);

          // Fetch incident details for player name
          await this.enrichGoalWithPlayerAPI(event, matchId);

          logger.info({ event }, '⚽ GOAL DETECTED!');
          this.emit('event', event);
        } else if (currentScore.away > previousScore.away) {
          event.eventType = 'goal';
          event.team = 'away';
          event.teamName = matchDetails.awayTeam;
          event.score = `${currentScore.home}-${currentScore.away}`;
          event.minute = this.extractMinute(data);

          // Fetch incident details for player name
          await this.enrichGoalWithPlayerAPI(event, matchId);

          logger.info({ event }, '⚽ GOAL DETECTED!');
          this.emit('event', event);
        }
      }

      // Update stored score
      this.previousScores.set(matchId, currentScore);
    }

    // Detect cards
    if (data.cardsCode) {
      const cardsCode = data.cardsCode.toString();

      // SofaScore cardsCode format: "XY" where X=home cards, Y=away cards
      // 0=no card, 1=yellow, 2=red
      if (cardsCode.includes('1')) {
        event.eventType = 'yellow_card';
        event.team = cardsCode[0] === '1' ? 'home' : 'away';
        event.teamName = event.team === 'home' ? matchDetails.homeTeam : matchDetails.awayTeam;
        event.minute = this.extractMinute(data);

        // Fetch card details for player name
        await this.enrichCardWithPlayer(event, matchId);

        logger.info({ event }, '🟨 YELLOW CARD DETECTED!');
        this.emit('event', event);
      }

      if (cardsCode.includes('2')) {
        event.eventType = 'red_card';
        event.team = cardsCode[0] === '2' ? 'home' : 'away';
        event.teamName = event.team === 'home' ? matchDetails.homeTeam : matchDetails.awayTeam;
        event.minute = this.extractMinute(data);

        // Fetch card details for player name
        await this.enrichCardWithPlayer(event, matchId);

        logger.info({ event }, '🟥 RED CARD DETECTED!');
        this.emit('event', event);
      }
    }

    // Detect match status changes
    if (data['status.type']) {
      if (data['status.type'] === 'inprogress' && data['status.code'] === 6) {
        logger.info({ matchId }, '🏁 Match started (1st half)');
      } else if (data['status.type'] === 'inprogress' && data['status.code'] === 7) {
        logger.info({ matchId }, '🏁 Match resumed (2nd half)');
      } else if (data['status.type'] === 'finished') {
        logger.info({ matchId }, '🏁 Match ended');
        this.previousScores.delete(matchId); // Clean up
      }
    }
  }

  extractMinute(data) {
    // Try to extract match minute from various fields
    if (data.statusDescription && /^\d+$/.test(data.statusDescription)) {
      return parseInt(data.statusDescription, 10);
    }

    if (data['time.currentPeriodStartTimestamp']) {
      const elapsed = Math.floor(Date.now() / 1000 - data['time.currentPeriodStartTimestamp']);
      const minutes = Math.floor(elapsed / 60);

      // Add 45 if in 2nd half
      if (data['status.code'] === 7) {
        return Math.min(45 + minutes, 90);
      }

      return Math.min(minutes, 45);
    }

    return null;
  }

  async fetchMatchDetailsFromAPI(matchId) {
    try {
      // Use browser context to fetch match details (inherits cookies/session)
      const matchData = await this.page.evaluate(async (id) => {
        try {
          const response = await fetch(`https://api.sofascore.com/api/v1/event/${id}`, {
            headers: {
              'Accept': 'application/json',
              'Accept-Language': 'en-US,en;q=0.9',
              'Origin': 'https://www.sofascore.com',
              'Referer': 'https://www.sofascore.com/',
            }
          });

          if (!response.ok) {
            console.log(`Match API failed: ${response.status}`);
            return null;
          }

          const data = await response.json();
          return data.event || null;
        } catch (error) {
          console.error('Match fetch error:', error.message);
          return null;
        }
      }, matchId);

      if (!matchData) {
        logger.warn({ matchId }, 'Failed to fetch match details from API');
        this.setFallbackMatchInfo(matchId);
        return;
      }

      const matchDetails = {
        homeTeam: matchData.homeTeam?.name || 'Unknown',
        awayTeam: matchData.awayTeam?.name || 'Unknown',
        tournament: matchData.tournament?.name || matchData.tournament?.uniqueTournament?.name || '',
        homeTeamShort: matchData.homeTeam?.shortName || matchData.homeTeam?.name,
        awayTeamShort: matchData.awayTeam?.shortName || matchData.awayTeam?.name,
        homeTeamId: matchData.homeTeam?.id,
        awayTeamId: matchData.awayTeam?.id,
        tournamentId: matchData.tournament?.id,
      };

      this.matchInfo.set(matchId, matchDetails);
      logger.info(
        { matchId, teams: `${matchDetails.homeTeam} vs ${matchDetails.awayTeam}` },
        '✅ Match details fetched from API'
      );
    } catch (error) {
      logger.error({ error: error.message, matchId }, 'Error fetching match details');
      this.setFallbackMatchInfo(matchId);
    }
  }

  async fetchMatchDetails(matchId) {
    // Legacy method - now redirects to the browser-based fetch
    return this.fetchMatchDetailsFromAPI(matchId);
  }

  setFallbackMatchInfo(matchId) {
    this.matchInfo.set(matchId, {
      homeTeam: 'Unknown',
      awayTeam: 'Unknown',
      tournament: '',
      homeTeamShort: 'Unknown',
      awayTeamShort: 'Unknown',
    });
  }

  async enrichGoalWithPlayer(event) {
    try {
      // Try to scrape player info from the page
      if (!this.page) {
        event.player = 'Unknown Player';
        return;
      }

      // Wait briefly for incident to appear on page
      await new Promise(resolve => setTimeout(resolve, 500));

      const playerInfo = await this.page
        .evaluate(() => {
          // eslint-disable-next-line no-undef
          const doc = document;

          // Try to find the most recent goal incident
          const incidentSelectors = [
            '[class*="incident"]',
            '[class*="Incident"]',
            '.event-incident',
            '[data-testid*="incident"]',
            '[class*="timeline"]',
            '.match-event',
          ];

          for (const selector of incidentSelectors) {
            const incidents = doc.querySelectorAll(selector);

            // Search from most recent (end) to oldest
            for (let i = incidents.length - 1; i >= 0; i--) {
              const incident = incidents[i];
              const text = incident.textContent || '';
              const html = incident.innerHTML || '';

              // Look for goal indicators
              if (
                text.includes('⚽') ||
                html.includes('goal') ||
                text.toLowerCase().includes('goal')
              ) {
                // Try to extract player name - look for capitalized names
                const playerMatches = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g);

                if (playerMatches && playerMatches.length > 0) {
                  // Filter out common non-player words
                  const filtered = playerMatches.filter(
                    name => !['Goal', 'Yellow', 'Red', 'Card', 'Min', 'Home', 'Away'].includes(name)
                  );

                  if (filtered.length > 0) {
                    return { player: filtered[0].trim() };
                  }
                }
              }
            }
          }

          return null;
        })
        .catch(err => {
          logger.debug({ error: err.message }, 'Error evaluating page for player');
          return null;
        });

      if (playerInfo?.player) {
        event.player = playerInfo.player;
        logger.info({ player: event.player }, '✅ Found player name');
      } else {
        event.player = 'Unknown';
        logger.debug('Could not extract player name from page');
      }
    } catch (error) {
      logger.debug({ error: error.message }, 'Error enriching goal with player');
      event.player = 'Unknown';
    }
  }

  async enrichGoalWithPlayerAPI(event, matchId) {
    try {
      // Use browser context to fetch incidents (has cookies)
      const incidentsData = await this.page.evaluate(async id => {
        const response = await fetch(`https://api.sofascore.com/api/v1/event/${id}/incidents`);
        if (!response.ok) return null;
        return response.json();
      }, matchId);

      if (!incidentsData) {
        logger.debug({ matchId }, 'API failed, falling back to page scraping');
        await this.enrichGoalWithPlayer(event);
        return;
      }

      const incidents = incidentsData.incidents || [];

      // Find the most recent goal for the scoring team
      const recentGoals = incidents
        .filter(inc => inc.incidentType === 'goal')
        .filter(inc => {
          const isHomeGoal = inc.isHome === true;
          return event.team === 'home' ? isHomeGoal : !isHomeGoal;
        })
        .sort((a, b) => b.id - a.id); // Most recent first

      if (recentGoals.length > 0) {
        const goal = recentGoals[0];
        event.player = goal.player?.name || 'Unknown';
        event.assistBy = goal.assist1?.name;
        event.minute = goal.time || event.minute;
        event.addedTime = goal.addedTime;

        logger.info({ player: event.player, minute: event.minute }, '✅ Goal details from API');
      } else {
        event.player = 'Unknown';
        logger.debug('No recent goal found in API, trying page scraping');
        await this.enrichGoalWithPlayer(event);
      }
    } catch (error) {
      logger.debug({ error: error.message }, 'API error, falling back to page scraping');
      await this.enrichGoalWithPlayer(event);
    }
  }

  async enrichCardWithPlayer(event, matchId) {
    try {
      // Use browser context to fetch incidents
      const incidentsData = await this.page.evaluate(async id => {
        const response = await fetch(`https://api.sofascore.com/api/v1/event/${id}/incidents`);
        if (!response.ok) return null;
        return response.json();
      }, matchId);

      if (!incidentsData) {
        logger.debug({ matchId }, 'Could not fetch incidents for card');
        event.player = 'Unknown';
        return;
      }

      const incidents = incidentsData.incidents || [];

      // Find the most recent card for the team
      const cardType = event.type === 'yellow_card' ? 'card' : 'redCard';
      const recentCards = incidents
        .filter(inc => inc.incidentType === cardType)
        .filter(inc => {
          const isHomeCard = inc.isHome === true;
          return event.team === 'home' ? isHomeCard : !isHomeCard;
        })
        .sort((a, b) => b.id - a.id);

      if (recentCards.length > 0) {
        const card = recentCards[0];
        event.player = card.player?.name || 'Unknown';
        event.minute = card.time || event.minute;
        event.addedTime = card.addedTime;

        logger.info({ player: event.player, minute: event.minute }, '✅ Card details from API');
      } else {
        event.player = 'Unknown';
        logger.debug('No recent card found in incidents');
      }
    } catch (error) {
      logger.debug({ error: error.message }, 'Error enriching card');
      event.player = 'Unknown';
    }
  }

  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      this.emit('error', new Error('Failed to reconnect to SofaScore'));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    logger.info({ attempt: this.reconnectAttempts, delay }, 'Attempting to reconnect...');

    setTimeout(async () => {
      try {
        await this.stop();
        await this.start();
        this.reconnectAttempts = 0;
      } catch (error) {
        logger.error({ error: error.message }, 'Reconnection failed');
        this.handleReconnect();
      }
    }, delay);
  }

  async stop() {
    logger.info('Stopping SofaScore collector...');
    this.isRunning = false;

    // Clear refresh interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    try {
      if (this.cdpSession) {
        await this.cdpSession.detach();
        this.cdpSession = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }

      logger.info('✅ SofaScore collector stopped');
      this.emit('stopped');
    } catch (error) {
      logger.error({ error: error.message }, 'Error stopping collector');
    }
  }

  async navigateToMatch(matchUrl) {
    if (!this.page) {
      throw new Error('Collector not started');
    }

    logger.info({ url: matchUrl }, 'Navigating to match');
    await this.page.goto(matchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
  }

  async extractLiveMatches() {
    try {
      // Fetch live matches from the API (the endpoint that shows 200 in network tab)
      const todayDate = new Date().toISOString().split('T')[0]; // Format: 2025-11-16
      
      const matches = await this.page.evaluate(async (date) => {
        try {
          // Use the same endpoint that works in the network tab
          const response = await fetch(`https://api.sofascore.com/api/v1/sport/football/scheduled-events/${date}`, {
            headers: {
              'Accept': 'application/json',
              'Accept-Language': 'en-US,en;q=0.9',
              'Origin': 'https://www.sofascore.com',
              'Referer': 'https://www.sofascore.com/',
            }
          });

          if (!response.ok) {
            console.log(`API fetch failed: ${response.status}`);
            return [];
          }

          const data = await response.json();
          console.log(`✅ Fetched ${data.events?.length || 0} matches from API`);
          
          const liveMatches = [];
          
          // Filter for live matches only (status.type === 'inprogress')
          if (data.events && Array.isArray(data.events)) {
            for (const event of data.events) {
              if (event.status?.type === 'inprogress') {
                // Extract current match time/minute
                let currentMinute = null;
                if (event.time?.currentPeriodStartTimestamp) {
                  const elapsed = Math.floor(Date.now() / 1000 - event.time.currentPeriodStartTimestamp);
                  const minutes = Math.floor(elapsed / 60);
                  // Add 45 if in 2nd half (status.code 7 = 2nd half)
                  if (event.status?.code === 7) {
                    currentMinute = Math.min(45 + minutes, 90);
                  } else {
                    currentMinute = Math.min(minutes, 45);
                  }
                } else if (event.status?.description) {
                  // Try to parse minute from status description (e.g., "45'", "72'")
                  const minuteMatch = event.status.description.match(/(\d+)/);
                  if (minuteMatch) {
                    currentMinute = parseInt(minuteMatch[1], 10);
                  }
                }

                liveMatches.push({
                  matchId: event.id.toString(),
                  homeTeam: event.homeTeam?.name || 'Unknown',
                  awayTeam: event.awayTeam?.name || 'Unknown',
                  homeTeamShort: event.homeTeam?.shortName || event.homeTeam?.name || 'Unknown',
                  awayTeamShort: event.awayTeam?.shortName || event.awayTeam?.name || 'Unknown',
                  homeTeamId: event.homeTeam?.id,
                  awayTeamId: event.awayTeam?.id,
                  tournament: event.tournament?.name || '',
                  tournamentId: event.tournament?.id,
                  homeScore: event.homeScore?.current || 0,
                  awayScore: event.awayScore?.current || 0,
                  currentMinute: currentMinute,
                  statusCode: event.status?.code,
                  statusDescription: event.status?.description,
                  startTimestamp: event.startTimestamp,
                });
              }
            }
          }
          
          return liveMatches;
        } catch (error) {
          console.error('API fetch error:', error.message);
          return [];
        }
      }, todayDate);

      // Store the extracted live matches and fetch additional details (lineups, etc.)
      for (const match of matches) {
        const isNew = !this.matchInfo.has(match.matchId);
        
        this.matchInfo.set(match.matchId, {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          tournament: match.tournament,
          homeTeamShort: match.homeTeamShort,
          awayTeamShort: match.awayTeamShort,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          tournamentId: match.tournamentId,
          currentMinute: match.currentMinute,
          statusCode: match.statusCode,
        });
        
        if (isNew) {
          logger.info({ 
            matchId: match.matchId, 
            teams: `${match.homeTeam} vs ${match.awayTeam}`,
            score: `${match.homeScore}-${match.awayScore}`,
            minute: match.currentMinute ? `${match.currentMinute}'` : 'N/A',
            tournament: match.tournament
          }, '✅ Live match found');

          // Fetch lineups for this match
          await this.fetchMatchLineups(match.matchId);
        }
      }

      logger.info({ count: matches.length }, `📊 Found ${matches.length} LIVE matches`);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to extract live matches from API');
    }
  }

  async fetchMatchLineups(matchId) {
    try {
      const lineups = await this.page.evaluate(async (id) => {
        try {
          const response = await fetch(`https://api.sofascore.com/api/v1/event/${id}/lineups`, {
            headers: {
              'Accept': 'application/json',
              'Accept-Language': 'en-US,en;q=0.9',
              'Origin': 'https://www.sofascore.com',
              'Referer': 'https://www.sofascore.com/',
            }
          });

          if (!response.ok) {
            console.log(`Lineups API failed: ${response.status}`);
            return null;
          }

          return response.json();
        } catch (error) {
          console.error('Lineups fetch error:', error.message);
          return null;
        }
      }, matchId);

      if (lineups && lineups.home && lineups.away) {
        const matchData = this.matchInfo.get(matchId);
        if (matchData) {
          // Store starting lineups
          matchData.homeLineup = {
            formation: lineups.home.formation,
            players: (lineups.home.players || []).map(p => ({
              id: p.player?.id,
              name: p.player?.name,
              shirtNumber: p.shirtNumber,
              position: p.position,
              substitute: p.substitute || false,
            }))
          };

          matchData.awayLineup = {
            formation: lineups.away.formation,
            players: (lineups.away.players || []).map(p => ({
              id: p.player?.id,
              name: p.player?.name,
              shirtNumber: p.shirtNumber,
              position: p.position,
              substitute: p.substitute || false,
            }))
          };

          this.matchInfo.set(matchId, matchData);
          
          const homeStarters = matchData.homeLineup.players.filter(p => !p.substitute).length;
          const awayStarters = matchData.awayLineup.players.filter(p => !p.substitute).length;
          
          logger.info({ 
            matchId, 
            homeFormation: matchData.homeLineup.formation,
            awayFormation: matchData.awayLineup.formation,
            homePlayers: homeStarters,
            awayPlayers: awayStarters
          }, '⚽ Lineups fetched');
        }
      }
    } catch (error) {
      logger.debug({ error: error.message, matchId }, 'Could not fetch lineups');
    }
  }

  async autoSelectLiveMatch() {
    try {
      // Wait for live matches to load
      await this.page.waitForTimeout(3000);

      // Find and click on the first LIVE match link
      const matchInfo = await this.page.evaluate(() => {
        // Look for live match indicators - SofaScore shows live matches with specific classes/attributes
        // Try multiple selectors for live matches
        const selectors = [
          '[class*="inprogress"]', // Common class for live matches
          '[class*="live"]',
          '[data-testid*="event_inprogress"]',
          '[class*="event"][class*="live"]',
        ];

        // Find elements that indicate a match is in progress
        let liveContainer = null;
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            liveContainer = elements[0];
            break;
          }
        }

        // If we found a live container, find the match link within it or near it
        if (liveContainer) {
          // Try to find a link within the container or its parent
          let matchLink = liveContainer.closest('a') || liveContainer.querySelector('a[href*="/match/"]');
          
          if (!matchLink) {
            // Try parent elements
            let parent = liveContainer.parentElement;
            for (let i = 0; i < 3 && parent; i++) {
              matchLink = parent.querySelector('a[href*="/match/"]');
              if (matchLink) break;
              parent = parent.parentElement;
            }
          }

          if (matchLink) {
            const href = matchLink.getAttribute('href');
            const fullUrl = href.startsWith('http') ? href : `https://www.sofascore.com${href}`;
            
            // Try to extract match name from the link text or nearby elements
            const matchName = matchLink.textContent?.trim() || 'Unknown Match';
            
            return { url: fullUrl, name: matchName };
          }
        }

        // Fallback: Just get any match link from the livescore page
        const allMatchLinks = Array.from(document.querySelectorAll('a[href*="/match/"]'));
        const validLinks = allMatchLinks.filter(link => {
          const href = link.getAttribute('href');
          return href && href.includes('/match/') && !href.includes('/standings') && !href.includes('/h2h');
        });

        if (validLinks.length > 0) {
          const href = validLinks[0].getAttribute('href');
          return {
            url: href.startsWith('http') ? href : `https://www.sofascore.com${href}`,
            name: 'Match from livescore page'
          };
        }
        return null;
      });

      if (matchInfo && matchInfo.url) {
        logger.info({ matchUrl: matchInfo.url, matchName: matchInfo.name }, '✅ Found live match, navigating...');
        await this.page.goto(matchInfo.url, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        logger.info('✅ Successfully navigated to live match');
      } else {
        logger.warn('⚠️ No live matches found, staying on livescore page');
        logger.info('💡 Will still receive events from WebSocket for all live matches');
      }
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to auto-select live match');
      logger.info('💡 Continuing with livescore page - will receive events from WebSocket');
      // Don't throw - just continue with livescore page
    }
  }
}
