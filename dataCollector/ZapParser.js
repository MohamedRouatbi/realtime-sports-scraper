/**
 * Bet365 ZAP Protocol Parser
 * Parses Bet365's custom WebSocket protocol format
 */

export class ZapParser {
  /**
   * Parse a ZAP protocol message
   * Format: \u0014TOPIC\u0001TYPE|KEY1=VAL1;KEY2=VAL2;|
   */
  static parse(rawMessage) {
    try {
      // Check if message has the ZAP protocol markers
      if (!rawMessage.includes('\u0001') && !rawMessage.includes('|')) {
        return { type: 'unknown', raw: rawMessage };
      }

      // Split by \u0001 to separate topic from data
      const parts = rawMessage.split('\u0001');

      if (parts.length < 2) {
        return { type: 'connection', raw: rawMessage };
      }

      // Extract topic (remove leading control chars)
      // eslint-disable-next-line no-control-regex
      const topic = parts[0].replace(/[\u0000-\u001F]/g, '');

      // Extract data part (between | symbols)
      const dataPart = parts[1];
      const pipeMatch = dataPart.match(/\|([^|]+)\|/);

      if (!pipeMatch) {
        return { type: 'malformed', topic, raw: rawMessage };
      }

      const dataString = pipeMatch[1];

      // Parse key-value pairs
      const data = {};
      const pairs = dataString.split(';').filter(p => p.trim());

      pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value !== undefined) {
          data[key] = value;
        } else if (key) {
          data[key] = true; // Flag-style key
        }
      });

      // Get message type (F=Full, U=Update, D=Delete)
      const messageType = dataPart.charAt(0);

      return {
        type: 'zap',
        messageType,
        topic,
        data,
        raw: rawMessage,
      };
    } catch (error) {
      return {
        type: 'error',
        error: error.message,
        raw: rawMessage,
      };
    }
  }

  /**
   * Check if a message contains match event data
   */
  static isMatchEvent(parsed) {
    if (parsed.type !== 'zap') return false;

    // Match events usually have specific topics
    // Goals, cards, etc. will have event IDs
    const topic = parsed.topic?.toLowerCase() || '';

    // Time updates are not events
    if (topic.includes('time')) return false;

    // Session messages are not events
    if (topic.startsWith('I') || topic.startsWith('S_')) return false;

    // Check for event-related data keys
    const data = parsed.data || {};
    const eventKeys = ['EV', 'SC', 'GO', 'RC', 'YC', 'PS', 'MG']; // Event, Score, Goal, Red Card, Yellow Card, etc.

    return eventKeys.some(key => key in data);
  }

  /**
   * Extract match data from a ZAP message
   */
  static extractMatchData(parsed) {
    if (!parsed.data) return null;

    const data = parsed.data;
    const result = {
      topic: parsed.topic,
      timestamp: Date.now(),
    };

    // Extract common fields
    if (data.IT) result.matchId = data.IT; // Match ID
    if (data.NA) result.name = data.NA; // Name
    if (data.SC) result.score = data.SC; // Score
    if (data.TI) result.time = data.TI; // Time
    if (data.PS) result.period = data.PS; // Period (1st half, 2nd half, etc.)
    if (data.MG) result.minute = data.MG; // Match minute

    // Event types
    if (data.EV) {
      result.eventType = data.EV;

      // Goal event
      if (data.EV === 'G' || data.GO) {
        result.event = 'goal';
        result.team = data.TM; // Team
        result.player = data.PL; // Player
      }

      // Yellow card
      if (data.EV === 'YC' || data.YC) {
        result.event = 'yellow_card';
        result.team = data.TM;
        result.player = data.PL;
      }

      // Red card
      if (data.EV === 'RC' || data.RC) {
        result.event = 'red_card';
        result.team = data.TM;
        result.player = data.PL;
      }
    }

    return result;
  }

  /**
   * Format a parsed message for logging
   */
  static format(parsed) {
    if (parsed.type === 'zap') {
      return `[${parsed.messageType}] ${parsed.topic}: ${JSON.stringify(parsed.data)}`;
    }
    return `[${parsed.type}] ${parsed.raw?.substring(0, 50)}`;
  }
}
