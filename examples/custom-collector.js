/**
 * Example: Custom collector for a new data source
 * This shows how to extend the system with a new WebSocket source
 */

import { BaseCollector } from '../dataCollector/BaseCollector.js';
import { logger } from '../src/utils/logger.js';

export class CustomCollector extends BaseCollector {
  constructor(url, options = {}) {
    super(url, options);
    this.customOptions = options.customOptions || {};
  }

  /**
   * Override subscribe method for your specific API
   */
  subscribe() {
    const subscriptionMessage = {
      type: 'subscribe',
      channels: ['football', 'basketball'],
      events: ['goal', 'card', 'point'],
    };

    logger.info('Subscribing to custom feed', subscriptionMessage);
    this.send(subscriptionMessage);
  }

  /**
   * Override parseMessage to handle your specific format
   */
  parseMessage(data) {
    try {
      const raw = data.toString();
      const message = JSON.parse(raw);

      // Your custom parsing logic
      if (message.event_type === 'match_event') {
        return this.normalizeEvent(message);
      }

      return message;
    } catch (error) {
      logger.error(`Custom parse error: ${error.message}`);
      return null;
    }
  }

  /**
   * Normalize to standard event format
   */
  normalizeEvent(event) {
    // Map your source's format to the standard format
    return {
      source: 'custom_source',
      timestamp: Date.now(),
      eventType: this.mapEventType(event.type),
      matchId: event.match_id,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      score: event.current_score,
      minute: event.match_minute,
      data: event.details || {},
      raw: event,
    };
  }

  /**
   * Map your event types to standard types
   */
  mapEventType(type) {
    const mapping = {
      GOAL: 'goal',
      RED_CARD: 'red_card',
      YELLOW_CARD: 'yellow_card',
      // Add your mappings
    };

    return mapping[type] || type;
  }
}

// Usage example:
/*
import { CustomCollector } from './examples/custom-collector.js';

const collector = new CustomCollector('wss://your-api.com/feed', {
  reconnectDelay: 3000,
  customOptions: {
    apiKey: 'your-api-key',
  },
});

collector.on('data', (event) => {
  console.log('Received event:', event);
});

collector.connect();
*/
