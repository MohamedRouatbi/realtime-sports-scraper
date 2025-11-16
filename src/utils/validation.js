/**
 * Validation utilities
 */

/**
 * Validate event structure
 */
export function validateEvent(event) {
  const errors = [];

  if (!event) {
    errors.push('Event is null or undefined');
    return { valid: false, errors };
  }

  if (!event.eventType) {
    errors.push('Missing eventType');
  }

  if (!event.matchId) {
    errors.push('Missing matchId');
  }

  if (!event.timestamp) {
    errors.push('Missing timestamp');
  }

  if (!event.source) {
    errors.push('Missing source');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate alert structure
 */
export function validateAlert(alert) {
  const errors = [];

  if (!alert) {
    errors.push('Alert is null or undefined');
    return { valid: false, errors };
  }

  if (!alert.type) {
    errors.push('Missing alert type');
  }

  if (!alert.timestamp) {
    errors.push('Missing timestamp');
  }

  if (!alert.message && !alert.data) {
    errors.push('Missing message or data');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize string for safe output
 */
export function sanitizeString(str, maxLength = 1000) {
  if (!str) return '';
  
  let sanitized = String(str)
    .replace(/[<>]/g, '')
    .trim();
  
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }
  
  return sanitized;
}

/**
 * Validate URL
 */
export function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'ws:' || url.protocol === 'wss:' || 
           url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate WebSocket URL
 */
export function isValidWebSocketUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'ws:' || url.protocol === 'wss:';
  } catch {
    return false;
  }
}
