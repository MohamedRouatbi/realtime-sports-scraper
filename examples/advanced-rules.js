/**
 * Example: Advanced custom rules
 * This shows how to create sophisticated alert logic
 */

import { logger } from '../src/utils/logger.js';

/**
 * Track momentum shifts
 * Alerts when a team scores multiple goals in short time
 */
export const momentumShiftRule = (() => {
  const matchGoals = new Map();

  return event => {
    if (event.eventType !== 'goal') return null;

    const matchId = event.matchId;
    if (!matchGoals.has(matchId)) {
      matchGoals.set(matchId, []);
    }

    const goals = matchGoals.get(matchId);
    goals.push({
      team: event.goalData?.team,
      minute: event.minute,
      timestamp: Date.now(),
    });

    // Check for 2 goals from same team in 10 minutes
    const recent = goals.filter(g => event.minute - g.minute <= 10);
    const teamGoals = recent.filter(g => g.team === event.goalData?.team);

    if (teamGoals.length >= 2) {
      logger.info('🔥 Momentum shift detected!');
      return {
        type: 'momentum_shift',
        message: `🔥 MOMENTUM SHIFT! ${teamGoals.length} goals in 10 minutes!`,
        team: event.goalData?.team,
        goals: teamGoals.length,
      };
    }

    return null;
  };
})();

/**
 * High-scoring match detection
 */
export const highScoringMatchRule = event => {
  if (event.eventType !== 'goal') return null;

  const totalGoals = (event.score?.home || 0) + (event.score?.away || 0);

  if (totalGoals >= 5 && totalGoals % 2 === 1) {
    // Alert on 5, 7, 9 goals
    return {
      type: 'high_scoring',
      message: `🎯 HIGH SCORING! ${totalGoals} goals in the match!`,
      totalGoals,
    };
  }

  return null;
};

/**
 * Underdog comeback detection
 */
export const comebackRule = (() => {
  const matchState = new Map();

  return event => {
    if (event.eventType !== 'goal') return null;

    const matchId = event.matchId;
    const currentDiff = (event.score?.home || 0) - (event.score?.away || 0);

    if (!matchState.has(matchId)) {
      matchState.set(matchId, { maxDiff: currentDiff, alerts: [] });
      return null;
    }

    const state = matchState.get(matchId);
    const prevMaxDiff = Math.abs(state.maxDiff);
    const currDiff = Math.abs(currentDiff);

    // Update max difference
    if (Math.abs(currentDiff) > prevMaxDiff) {
      state.maxDiff = currentDiff;
    }

    // Detect comeback: was down by 2+, now down by 1 or tied
    if (prevMaxDiff >= 2 && currDiff <= 1 && event.minute > 60) {
      const alertKey = `${matchId}-comeback-${event.minute}`;
      
      if (!state.alerts.includes(alertKey)) {
        state.alerts.push(alertKey);
        
        return {
          type: 'comeback',
          message: '🔥 COMEBACK! Team fighting back!',
          previousDiff: prevMaxDiff,
          currentDiff: currDiff,
        };
      }
    }

    return null;
  };
})();

/**
 * Red card impact tracking
 */
export const redCardImpactRule = (() => {
  const redCards = new Map();

  return event => {
    const matchId = event.matchId;

    // Record red cards
    if (event.eventType === 'red_card') {
      if (!redCards.has(matchId)) {
        redCards.set(matchId, []);
      }
      redCards.get(matchId).push({
        team: event.cardData?.team,
        minute: event.minute,
      });
    }

    // Check goal after red card
    if (event.eventType === 'goal' && redCards.has(matchId)) {
      const cards = redCards.get(matchId);
      const recentRedCard = cards.find(
        card => 
          event.minute - card.minute <= 15 && 
          card.team !== event.goalData?.team
      );

      if (recentRedCard) {
        return {
          type: 'red_card_impact',
          message: '⚡ GOAL after red card! Man advantage paying off!',
          minutesSinceCard: event.minute - recentRedCard.minute,
        };
      }
    }

    return null;
  };
})();

/**
 * Critical moment detection (last 10 minutes)
 */
export const criticalMomentRule = event => {
  if (event.minute < 80) return null;

  if (event.eventType === 'goal') {
    const scoreDiff = Math.abs((event.score?.home || 0) - (event.score?.away || 0));
    
    if (scoreDiff <= 1) {
      return {
        type: 'critical_goal',
        message: '🚨 CRITICAL LATE GOAL! Match wide open!',
        minute: event.minute,
      };
    }
  }

  if (event.eventType === 'red_card' && event.minute >= 85) {
    return {
      type: 'critical_red_card',
      message: '🚨 LATE RED CARD! Match drama!',
      minute: event.minute,
    };
  }

  return null;
};

/**
 * Export all advanced rules
 */
export const advancedRules = {
  momentumShiftRule,
  highScoringMatchRule,
  comebackRule,
  redCardImpactRule,
  criticalMomentRule,
};

// Usage example:
/*
import { EventProcessor } from './eventProcessor/index.js';
import { advancedRules } from './examples/advanced-rules.js';

const processor = new EventProcessor();

// Add advanced rules
Object.entries(advancedRules).forEach(([name, rule]) => {
  processor.addRule(name, rule);
});

processor.on('alert', (alert) => {
  console.log('Advanced alert:', alert);
});
*/
