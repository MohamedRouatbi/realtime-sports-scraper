import EventEmitter from 'events';
import { logger } from '../src/utils/logger.js';

/**
 * Event Processor
 * Applies business rules and detects patterns in real-time sports data
 * Optimized for low-latency processing (<50ms overhead)
 */
export class EventProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.rules = new Map();
    this.eventCache = new Map(); // For deduplication
    this.cacheTimeout = options.cacheTimeout || 5000; // 5 seconds
    this.enabledEvents = options.enabledEvents || {
      goals: true,
      redCards: true,
      yellowCards: true,
    };
  }

  /**
   * Process incoming event
   * Main entry point for event processing
   */
  async process(event) {
    const startTime = Date.now();

    try {
      // Validate event
      if (!this.isValidEvent(event)) {
        logger.warn('Invalid event received', event);
        return;
      }

      // Check for duplicates
      if (this.isDuplicate(event)) {
        logger.debug('Duplicate event ignored', { matchId: event.matchId, type: event.eventType });
        return;
      }

      // Cache event for deduplication
      this.cacheEvent(event);

      // Process based on event type
      const alert = await this.processEventType(event);

      if (alert) {
        const processingTime = Date.now() - startTime;
        logger.info(`Event processed in ${processingTime}ms`, {
          type: event.eventType,
          matchId: event.matchId,
        });

        // Emit alert
        this.emit('alert', alert);
      }
    } catch (error) {
      logger.error(`Event processing error: ${error.message}`, error);
    }
  }

  /**
   * Validate event structure
   */
  isValidEvent(event) {
    return event && event.eventType && event.matchId && event.timestamp && event.source;
  }

  /**
   * Check if event is duplicate
   */
  isDuplicate(event) {
    const key = this.getEventKey(event);
    return this.eventCache.has(key);
  }

  /**
   * Generate unique event key for deduplication
   */
  getEventKey(event) {
    return `${event.source}:${event.matchId}:${event.eventType}:${event.minute}:${event.timestamp}`;
  }

  /**
   * Cache event to prevent duplicates
   */
  cacheEvent(event) {
    const key = this.getEventKey(event);
    this.eventCache.set(key, event);

    // Auto-cleanup after timeout
    setTimeout(() => {
      this.eventCache.delete(key);
    }, this.cacheTimeout);
  }

  /**
   * Process event based on type
   */
  async processEventType(event) {
    switch (event.eventType) {
      case 'goal':
        return this.enabledEvents.goals ? this.processGoal(event) : null;

      case 'red_card':
        return this.enabledEvents.redCards ? this.processRedCard(event) : null;

      case 'yellow_card':
        return this.enabledEvents.yellowCards ? this.processYellowCard(event) : null;

      default:
        logger.debug(`Unhandled event type: ${event.eventType}`);
        return null;
    }
  }

  /**
   * Process goal event
   */
  processGoal(event) {
    const { goalData = {}, homeTeam, awayTeam, score, minute, player, assistBy, teamName } = event;

    const alert = {
      type: 'goal',
      severity: 'high',
      timestamp: Date.now(),
      matchId: event.matchId,
      source: event.source,
      data: {
        homeTeam,
        awayTeam,
        score,
        minute,
        team: goalData.team || event.team,
        teamName: teamName,
        player: player || goalData.player,
        assistBy: assistBy || goalData.assistBy,
        isPenalty: goalData.isPenalty || false,
        isOwnGoal: goalData.isOwnGoal || false,
      },
      message: this.formatGoalMessage(event),
      raw: event,
    };

    logger.info('⚽ GOAL detected', {
      match: `${homeTeam} vs ${awayTeam}`,
      score: score,
      minute,
      player: player || goalData.player
    });

    return alert;
  }

  /**
   * Process red card event
   */
  processRedCard(event) {
    const { cardData = {}, homeTeam, awayTeam, minute, player, teamName } = event;

    const alert = {
      type: 'red_card',
      severity: 'high',
      timestamp: Date.now(),
      matchId: event.matchId,
      source: event.source,
      data: {
        homeTeam,
        awayTeam,
        minute,
        team: cardData.team || event.team,
        teamName: teamName,
        player: player || cardData.player,
        reason: cardData.reason,
      },
      message: this.formatRedCardMessage(event),
      raw: event,
    };

    logger.info('🟥 RED CARD detected', {
      match: `${homeTeam} vs ${awayTeam}`,
      player: player || cardData.player,
      minute,
    });

    return alert;
  }

  /**
   * Process yellow card event
   */
  processYellowCard(event) {
    const { cardData = {}, homeTeam, awayTeam, minute, player, teamName } = event;

    const alert = {
      type: 'yellow_card',
      severity: 'medium',
      timestamp: Date.now(),
      matchId: event.matchId,
      source: event.source,
      data: {
        homeTeam,
        awayTeam,
        minute,
        team: cardData.team || event.team,
        teamName: teamName,
        player: player || cardData.player,
        reason: cardData.reason,
      },
      message: this.formatYellowCardMessage(event),
      raw: event,
    };

    logger.info('🟨 YELLOW CARD detected', {
      match: `${homeTeam} vs ${awayTeam}`,
      player: player || cardData.player,
      minute,
    });

    return alert;
  }

  /**
   * Format goal message
   */
  formatGoalMessage(event) {
    const { goalData = {}, homeTeam, awayTeam, score, minute, player, assistBy, teamName, tournament } = event;

    let message = `⚽ <b>GOAL!</b>\n\n`;
    
    if (homeTeam && awayTeam) {
      message += `🏟️ ${homeTeam} vs ${awayTeam}\n`;
    }
    
    if (score) {
      message += `📊 Score: <b>${score}</b>\n`;
    }
    
    if (minute) {
      message += `⏱️ ${minute}'`;
      if (event.addedTime) {
        message += ` +${event.addedTime}`;
      }
      message += '\n';
    }

    if (player || goalData.player) {
      message += `⚽ <b>${player || goalData.player}</b>`;
      if (teamName) {
        message += ` (${teamName})`;
      }
      message += '\n';
    }

    if (assistBy || goalData.assistBy) {
      message += `🎯 Assist: ${assistBy || goalData.assistBy}\n`;
    }

    if (goalData.isPenalty) {
      message += '⚡ PENALTY GOAL\n';
    }

    if (goalData.isOwnGoal) {
      message += '😱 OWN GOAL\n';
    }

    if (tournament) {
      message += `\n🏆 ${tournament}`;
    }

    return message;
  }

  /**
   * Format red card message
   */
  formatRedCardMessage(event) {
    const { cardData = {}, homeTeam, awayTeam, minute, player, teamName, tournament } = event;

    let message = `🟥 <b>RED CARD!</b>\n\n`;
    
    if (homeTeam && awayTeam) {
      message += `🏟️ ${homeTeam} vs ${awayTeam}\n`;
    }
    
    if (minute) {
      message += `⏱️ ${minute}'`;
      if (event.addedTime) {
        message += ` +${event.addedTime}`;
      }
      message += '\n';
    }

    if (player || cardData.player) {
      message += `👤 <b>${player || cardData.player}</b>`;
      if (teamName) {
        message += ` (${teamName})`;
      }
      message += '\n';
    }

    if (cardData.reason) {
      message += `📝 ${cardData.reason}\n`;
    }

    if (tournament) {
      message += `\n🏆 ${tournament}`;
    }

    return message;
  }

  /**
   * Format yellow card message
   */
  formatYellowCardMessage(event) {
    const { cardData = {}, homeTeam, awayTeam, minute, player, teamName, tournament } = event;

    let message = `🟨 <b>YELLOW CARD!</b>\n\n`;
    
    if (homeTeam && awayTeam) {
      message += `🏟️ ${homeTeam} vs ${awayTeam}\n`;
    }
    
    if (minute) {
      message += `⏱️ ${minute}'`;
      if (event.addedTime) {
        message += ` +${event.addedTime}`;
      }
      message += '\n';
    }

    if (player || cardData.player) {
      message += `👤 <b>${player || cardData.player}</b>`;
      if (teamName) {
        message += ` (${teamName})`;
      }
      message += '\n';
    }

    if (cardData.reason) {
      message += `📝 ${cardData.reason}\n`;
    }

    if (tournament) {
      message += `\n🏆 ${tournament}`;
    }

    return message;
  }

  /**
   * Add custom rule
   */
  addRule(name, ruleFn) {
    this.rules.set(name, ruleFn);
    logger.info(`Rule added: ${name}`);
  }

  /**
   * Remove rule
   */
  removeRule(name) {
    this.rules.delete(name);
    logger.info(`Rule removed: ${name}`);
  }

  /**
   * Apply custom rules
   */
  async applyRules(event) {
    const results = [];

    for (const [name, ruleFn] of this.rules) {
      try {
        const result = await ruleFn(event);
        if (result) {
          results.push({ rule: name, result });
        }
      } catch (error) {
        logger.error(`Rule execution error: ${name}`, error);
      }
    }

    return results;
  }

  /**
   * Clear event cache
   */
  clearCache() {
    this.eventCache.clear();
    logger.info('Event cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.eventCache.size,
      timeout: this.cacheTimeout,
    };
  }
}
