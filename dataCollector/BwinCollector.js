import { BaseCollector } from './BaseCollector.js';
import { logger } from '../src/utils/logger.js';

/**
 * Bwin WebSocket Collector
 * Connects to Bwin's real-time sports data feed
 * Optimized for goals, cards, and live events
 */
export class BwinCollector extends BaseCollector {
  constructor(url, options = {}) {
    super(url, options);
    this.subscriptions = options.subscriptions || [];
  }

  /**
   * Subscribe to specific matches or leagues
   */
  subscribe() {
    // Bwin subscription format (adjust based on actual API)
    const subscriptionMessage = {
      type: 'subscribe',
      channels: this.subscriptions.length > 0 ? this.subscriptions : ['live.football'],
      events: ['goal', 'card', 'match_start', 'match_end'],
    };

    logger.info('Subscribing to Bwin channels', subscriptionMessage);
    this.send(subscriptionMessage);
  }

  /**
   * Parse Bwin-specific message format
   */
  parseMessage(data) {
    try {
      const raw = data.toString();
      const message = JSON.parse(raw);

      // Normalize Bwin message to standard format
      if (message.type === 'event') {
        return this.normalizeEvent(message);
      }

      return message;
    } catch (error) {
      logger.error(`Bwin parse error: ${error.message}`);
      return null;
    }
  }

  /**
   * Normalize Bwin event to standard format
   */
  normalizeEvent(event) {
    const timestamp = Date.now();

    // Standard event format
    const normalized = {
      source: 'bwin',
      timestamp,
      eventType: this.mapEventType(event.eventType || event.type),
      matchId: event.matchId || event.gameId,
      homeTeam: event.homeTeam || event.home,
      awayTeam: event.awayTeam || event.away,
      score: event.score || { home: 0, away: 0 },
      minute: event.minute || event.matchTime,
      data: event.data || {},
      raw: event,
    };

    // Add event-specific data
    if (normalized.eventType === 'goal') {
      normalized.goalData = {
        team: event.team || event.scoringTeam,
        player: event.player || event.scorer,
        assistBy: event.assist || event.assistedBy,
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
   * Map Bwin event types to standard types
   */
  mapEventType(type) {
    const mapping = {
      goal: 'goal',
      redCard: 'red_card',
      yellowCard: 'yellow_card',
      matchStart: 'match_start',
      matchEnd: 'match_end',
      // Add more mappings as needed
    };

    return mapping[type] || type;
  }

  /**
   * Subscribe to specific match
   */
  subscribeToMatch(matchId) {
    const message = {
      type: 'subscribe',
      matchId,
    };
    this.send(message);
    logger.info(`Subscribed to match: ${matchId}`);
  }

  /**
   * Unsubscribe from match
   */
  unsubscribeFromMatch(matchId) {
    const message = {
      type: 'unsubscribe',
      matchId,
    };
    this.send(message);
    logger.info(`Unsubscribed from match: ${matchId}`);
  }
}
