import { logger } from '../src/utils/logger.js';

/**
 * Custom Rules for Event Processing
 * Add your own business logic here
 */

/**
 * Example: Early goal rule (goal in first 15 minutes)
 */
export const earlyGoalRule = event => {
  if (event.eventType === 'goal' && event.minute <= 15) {
    logger.info('🚀 Early goal detected!');
    return {
      type: 'early_goal',
      message: '🚀 EARLY GOAL!',
      minute: event.minute,
    };
  }
  return null;
};

/**
 * Example: Late goal rule (goal after 80 minutes)
 */
export const lateGoalRule = event => {
  if (event.eventType === 'goal' && event.minute >= 80) {
    logger.info('⏰ Late goal detected!');
    return {
      type: 'late_goal',
      message: '⏰ LATE GOAL!',
      minute: event.minute,
    };
  }
  return null;
};

/**
 * Example: Multiple cards in short time
 */
export const multipleCardsRule = (() => {
  const cardHistory = new Map();

  return event => {
    if (event.eventType !== 'yellow_card' && event.eventType !== 'red_card') {
      return null;
    }

    const matchId = event.matchId;
    if (!cardHistory.has(matchId)) {
      cardHistory.set(matchId, []);
    }

    const cards = cardHistory.get(matchId);
    cards.push({ minute: event.minute, type: event.eventType });

    // Check for 3+ cards in 10 minutes
    const recentCards = cards.filter(c => event.minute - c.minute <= 10);

    if (recentCards.length >= 3) {
      logger.info('🔥 Multiple cards detected!');
      return {
        type: 'card_storm',
        message: '🔥 CARD STORM! Multiple cards in short time',
        count: recentCards.length,
      };
    }

    return null;
  };
})();

/**
 * Example: Hat-trick detection
 */
export const hatTrickRule = (() => {
  const playerGoals = new Map();

  return event => {
    if (event.eventType !== 'goal' || !event.goalData?.player) {
      return null;
    }

    const key = `${event.matchId}:${event.goalData.player}`;
    const count = (playerGoals.get(key) || 0) + 1;
    playerGoals.set(key, count);

    if (count === 3) {
      logger.info('🎩 Hat-trick detected!');
      return {
        type: 'hat_trick',
        message: `🎩 HAT-TRICK! ${event.goalData.player}`,
        player: event.goalData.player,
      };
    }

    return null;
  };
})();

/**
 * Export all rules
 */
export const defaultRules = {
  earlyGoalRule,
  lateGoalRule,
  multipleCardsRule,
  hatTrickRule,
};
