import { BaseCollector } from './BaseCollector.js';
import { logger } from '../src/utils/logger.js';

/**
 * SofaScore WebSocket Collector
 * Connects to SofaScore's real-time sports data feed
 * Optimized for goals, cards, and live match events
 */
export class SofaScoreCollector extends BaseCollector {
  constructor(url, options = {}) {
    super(url, options);
    this.matchIds = options.matchIds || [];
  }

  /**
   * Subscribe to SofaScore events
   */
  subscribe() {
    // SofaScore subscription format (adjust based on actual API)
    const subscriptionMessage = {
      _tid: Date.now(),
      type: 'subscribe',
      data: {
        uniqueTournamentIds: [],
        matchIds: this.matchIds,
      },
    };

    logger.info('Subscribing to SofaScore matches', subscriptionMessage);
    this.send(subscriptionMessage);
  }

  /**
   * Parse SofaScore-specific message format
   */
  parseMessage(data) {
    try {
      const raw = data.toString();
      const message = JSON.parse(raw);

      // SofaScore uses different message structures
      if (message.data && message.data.event) {
        return this.normalizeEvent(message.data.event);
      }

      if (message.type === 'incident') {
        return this.normalizeIncident(message.data);
      }

      return message;
    } catch (error) {
      logger.error(`SofaScore parse error: ${error.message}`);
      return null;
    }
  }

  /**
   * Normalize SofaScore event to standard format
   */
  normalizeEvent(event) {
    const timestamp = Date.now();

    return {
      source: 'sofascore',
      timestamp,
      eventType: this.mapEventType(event.incidentType || event.type),
      matchId: event.id,
      homeTeam: event.homeTeam?.name,
      awayTeam: event.awayTeam?.name,
      score: {
        home: event.homeScore?.current || 0,
        away: event.awayScore?.current || 0,
      },
      minute: event.time || 0,
      data: event,
      raw: event,
    };
  }

  /**
   * Normalize SofaScore incident (goal, card, etc.)
   */
  normalizeIncident(incident) {
    const timestamp = Date.now();

    const normalized = {
      source: 'sofascore',
      timestamp,
      eventType: this.mapIncidentType(incident.incidentType),
      matchId: incident.id,
      minute: incident.time,
      data: incident,
      raw: incident,
    };

    // Add incident-specific data
    if (normalized.eventType === 'goal') {
      normalized.goalData = {
        team: incident.isHome ? 'home' : 'away',
        player: incident.player?.name,
        assistBy: incident.assist1?.name,
        minute: incident.time,
        addedTime: incident.addedTime || 0,
        isOwnGoal: incident.incidentClass === 'ownGoal',
        isPenalty: incident.incidentClass === 'penalty',
      };
    }

    if (normalized.eventType === 'red_card') {
      normalized.cardData = {
        team: incident.isHome ? 'home' : 'away',
        player: incident.player?.name,
        minute: incident.time,
        addedTime: incident.addedTime || 0,
        reason: incident.reason || '',
      };
    }

    if (normalized.eventType === 'yellow_card') {
      normalized.cardData = {
        team: incident.isHome ? 'home' : 'away',
        player: incident.player?.name,
        minute: incident.time,
        addedTime: incident.addedTime || 0,
        reason: incident.reason || '',
      };
    }

    return normalized;
  }

  /**
   * Map SofaScore incident types to standard types
   */
  mapIncidentType(type) {
    const mapping = {
      goal: 'goal',
      redCard: 'red_card',
      yellowCard: 'yellow_card',
      period: 'period_change',
      // Add more mappings as needed
    };

    return mapping[type] || type;
  }

  /**
   * Map SofaScore event types
   */
  mapEventType(type) {
    return this.mapIncidentType(type);
  }

  /**
   * Subscribe to specific match
   */
  subscribeToMatch(matchId) {
    const message = {
      _tid: Date.now(),
      type: 'subscribe',
      data: {
        matchIds: [matchId],
      },
    };
    this.send(message);
    logger.info(`Subscribed to SofaScore match: ${matchId}`);
  }

  /**
   * Unsubscribe from match
   */
  unsubscribeFromMatch(matchId) {
    const message = {
      _tid: Date.now(),
      type: 'unsubscribe',
      data: {
        matchIds: [matchId],
      },
    };
    this.send(message);
    logger.info(`Unsubscribed from SofaScore match: ${matchId}`);
  }
}
