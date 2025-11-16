import WebSocket from 'ws';
import { BaseCollector } from './BaseCollector.js';
import { logger } from '../src/utils/logger.js';

/**
 * Bet365 WebSocket Collector
 * Connects to Bet365's real-time sports data feed
 * Note: Requires valid session UID from active browser session
 */
export class Bet365Collector extends BaseCollector {
  constructor(url, options = {}) {
    super(url, {
      ...options,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
        Origin: 'https://www.bet365.com',
        'Accept-Language': 'en-GB,en;q=0.5',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(options.headers || {}),
      },
      protocol: 'zap-protocol-v1',
    });
  }

  /**
   * Connect with browser-like headers
   */
  connect() {
    try {
      logger.info(`Connecting to Bet365: ${this.url}`);

      // Bet365 uses zap-protocol-v1
      this.ws = new WebSocket(this.url, this.options.protocol, {
        headers: this.options.headers,
        perMessageDeflate: true, // Bet365 uses permessage-deflate
        handshakeTimeout: 10000,
      });

      this.ws.on('open', this.onOpen.bind(this));
      this.ws.on('message', this.onMessage.bind(this));
      this.ws.on('error', this.onError.bind(this));
      this.ws.on('close', this.onClose.bind(this));
      this.ws.on('ping', this.onPing.bind(this));
    } catch (error) {
      logger.error(`Connection error: ${error.message}`);
      this.handleReconnect();
    }
  }

  /**
   * Subscribe to Bet365 events
   */
  subscribe() {
    // Bet365 usually sends data automatically once connected
    // If subscription is needed, it would go here
    logger.info('Connected to Bet365 feed, awaiting data...');
  }

  /**
   * Parse Bet365-specific message format
   */
  parseMessage(data) {
    try {
      const raw = data.toString();

      // Bet365 messages often start with special characters or identifiers
      // Try to parse as JSON first
      if (raw.startsWith('{') || raw.startsWith('[')) {
        const message = JSON.parse(raw);
        return this.normalizeEvent(message);
      }

      // Handle custom Bet365 format (pipe-separated or other format)
      // This needs to be adapted based on actual message structure
      return this.parseCustomFormat(raw);
    } catch (error) {
      logger.debug(`Bet365 parse error: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse custom Bet365 format
   */
  parseCustomFormat(raw) {
    // Bet365 often uses formats like:
    // "OV|matchId|eventType|data"
    // We'll need to adjust this based on actual data

    logger.debug('Raw Bet365 message:', raw.substring(0, 200));

    // For now, return raw data for analysis
    return {
      source: 'bet365',
      timestamp: Date.now(),
      raw: raw,
      needsParsing: true,
    };
  }

  /**
   * Normalize Bet365 event to standard format
   */
  normalizeEvent(event) {
    const timestamp = Date.now();

    // Standard event format
    const normalized = {
      source: 'bet365',
      timestamp,
      eventType: this.mapEventType(event.type || event.eventType),
      matchId: event.matchId || event.id || event.gameId,
      homeTeam: event.homeTeam || event.home,
      awayTeam: event.awayTeam || event.away,
      score: event.score || { home: 0, away: 0 },
      minute: event.minute || event.time,
      data: event,
      raw: event,
    };

    // Add event-specific data
    if (normalized.eventType === 'goal') {
      normalized.goalData = {
        team: event.team || event.scoringTeam,
        player: event.player || event.scorer,
        assistBy: event.assist,
        minute: event.minute,
        isOwnGoal: event.isOwnGoal || false,
        isPenalty: event.isPenalty || false,
      };
    }

    if (normalized.eventType === 'red_card' || normalized.eventType === 'yellow_card') {
      normalized.cardData = {
        team: event.team,
        player: event.player,
        minute: event.minute,
        reason: event.reason || '',
      };
    }

    return normalized;
  }

  /**
   * Map Bet365 event types to standard types
   */
  mapEventType(type) {
    const mapping = {
      goal: 'goal',
      'red-card': 'red_card',
      'yellow-card': 'yellow_card',
      redCard: 'red_card',
      yellowCard: 'yellow_card',
      // Add more mappings as we discover them
    };

    return mapping[type] || type;
  }
}
