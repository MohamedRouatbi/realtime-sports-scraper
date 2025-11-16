/**
 * SofaScore Data Collector
 * Uses Puppeteer to connect to SofaScore and capture real-time match events
 */

import puppeteer from 'puppeteer';
import EventEmitter from 'events';
import pino from 'pino';

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
  }

  async start() {
    try {
      logger.info('🚀 Starting SofaScore collector...');

      // Use headless mode in production (Fly.io), visible browser locally
      const isProduction = process.env.NODE_ENV === 'production';
      
      this.browser = await puppeteer.launch({
        headless: isProduction ? 'new' : false,
        defaultViewport: isProduction ? { width: 1920, height: 1080 } : null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--no-first-run',
          '--no-zygote',
          ...(isProduction ? [] : ['--start-maximized'])
        ],
        protocolTimeout: 180000, // 3 minutes timeout
      });

      this.page = await this.browser.newPage();

      // Setup CDP session for WebSocket interception
      this.cdpSession = await this.page.target().createCDPSession();
      await this.cdpSession.send('Network.enable');

      this.setupWebSocketInterception();

      // Navigate to live matches page
      logger.info('🌐 Navigating to SofaScore...');
      await this.page.goto('https://www.sofascore.com/football/livescore', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      this.isRunning = true;
      logger.info('✅ SofaScore collector started!');
      logger.info('💡 Click on any LIVE match in the browser to start receiving events');

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

    // Fetch match details if not cached
    if (!this.matchInfo.has(matchId)) {
      await this.fetchMatchDetails(matchId);
    }

    const matchDetails = this.matchInfo.get(matchId) || {};

    const event = {
      timestamp: new Date(timestamp * 1000).toISOString(),
      matchId,
      source: 'sofascore',
      homeTeam: matchDetails.homeTeam,
      awayTeam: matchDetails.awayTeam,
      tournament: matchDetails.tournament
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
          event.type = 'goal';
          event.team = 'home';
          event.teamName = matchDetails.homeTeam;
          event.score = `${currentScore.home}-${currentScore.away}`;
          event.minute = this.extractMinute(data);

          // Fetch incident details for player name
          await this.enrichGoalWithPlayerAPI(event, matchId);

          logger.info({ event }, '⚽ GOAL DETECTED!');
          this.emit('event', event);
        } else if (currentScore.away > previousScore.away) {
          event.type = 'goal';
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
        event.type = 'yellow_card';
        event.team = cardsCode[0] === '1' ? 'home' : 'away';
        event.teamName = event.team === 'home' ? matchDetails.homeTeam : matchDetails.awayTeam;
        event.minute = this.extractMinute(data);
        
        // Fetch card details for player name
        await this.enrichCardWithPlayer(event, matchId);
        
        logger.info({ event }, '🟨 YELLOW CARD DETECTED!');
        this.emit('event', event);
      }
      
      if (cardsCode.includes('2')) {
        event.type = 'red_card';
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

  async fetchMatchDetails(matchId) {
    try {
      logger.debug({ matchId }, 'Fetching match details from browser context');
      
      // Use Puppeteer's page.evaluate to make the fetch from browser context (has cookies)
      const matchData = await this.page.evaluate(async (id) => {
        const response = await fetch(`https://api.sofascore.com/api/v1/event/${id}`);
        if (!response.ok) return null;
        return response.json();
      }, matchId);

      if (!matchData || !matchData.event) {
        logger.warn({ matchId }, 'Failed to fetch match details');
        // Set fallback
        this.matchInfo.set(matchId, {
          homeTeam: 'Unknown',
          awayTeam: 'Unknown',
          tournament: '',
          homeTeamShort: 'Unknown',
          awayTeamShort: 'Unknown'
        });
        return;
      }

      const event = matchData.event;

      const matchDetails = {
        homeTeam: event.homeTeam?.name || 'Unknown',
        awayTeam: event.awayTeam?.name || 'Unknown',
        tournament: event.tournament?.name || event.tournament?.uniqueTournament?.name || '',
        homeTeamShort: event.homeTeam?.shortName || event.homeTeam?.name,
        awayTeamShort: event.awayTeam?.shortName || event.awayTeam?.name
      };

      this.matchInfo.set(matchId, matchDetails);
      logger.info({ matchId, teams: `${matchDetails.homeTeam} vs ${matchDetails.awayTeam}` }, '✅ Match details fetched');

    } catch (error) {
      logger.error({ error: error.message, matchId }, 'Error fetching match details');
      // Set fallback
      this.matchInfo.set(matchId, {
        homeTeam: 'Unknown',
        awayTeam: 'Unknown',
        tournament: '',
        homeTeamShort: 'Unknown',
        awayTeamShort: 'Unknown'
      });
    }
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

      const playerInfo = await this.page.evaluate(() => {
        // eslint-disable-next-line no-undef
        const doc = document;
        
        // Try to find the most recent goal incident
        const incidentSelectors = [
          '[class*="incident"]',
          '[class*="Incident"]', 
          '.event-incident',
          '[data-testid*="incident"]',
          '[class*="timeline"]',
          '.match-event'
        ];
        
        for (const selector of incidentSelectors) {
          const incidents = doc.querySelectorAll(selector);
          
          // Search from most recent (end) to oldest
          for (let i = incidents.length - 1; i >= 0; i--) {
            const incident = incidents[i];
            const text = incident.textContent || '';
            const html = incident.innerHTML || '';
            
            // Look for goal indicators
            if (text.includes('⚽') || html.includes('goal') || text.toLowerCase().includes('goal')) {
              // Try to extract player name - look for capitalized names
              const playerMatches = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g);
              
              if (playerMatches && playerMatches.length > 0) {
                // Filter out common non-player words
                const filtered = playerMatches.filter(name => 
                  !['Goal', 'Yellow', 'Red', 'Card', 'Min', 'Home', 'Away'].includes(name)
                );
                
                if (filtered.length > 0) {
                  return { player: filtered[0].trim() };
                }
              }
            }
          }
        }
        
        return null;
      }).catch((err) => {
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
      const incidentsData = await this.page.evaluate(async (id) => {
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
      const incidentsData = await this.page.evaluate(async (id) => {
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
}
