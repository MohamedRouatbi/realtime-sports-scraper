import dotenv from 'dotenv';
import { logger } from './logger.js';

// Load environment variables
dotenv.config();

/**
 * Configuration management
 * Validates and provides typed access to environment variables
 */
class Config {
  constructor() {
    this.validateRequired();
  }

  /**
   * Validate required environment variables
   */
  validateRequired() {
    const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      logger.error(`Missing required environment variables: ${missing.join(', ')}`);
      logger.info('Please copy .env.example to .env and fill in the required values');
      // Don't throw in dev mode to allow partial testing
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }
    }
  }

  // Telegram Configuration
  get telegramBotToken() {
    return process.env.TELEGRAM_BOT_TOKEN;
  }

  get telegramChatId() {
    return process.env.TELEGRAM_CHAT_ID;
  }

  // WebSocket Configuration
  get bwinWsUrl() {
    return process.env.BWIN_WS_URL || 'wss://websocket.bwin.com/feed';
  }

  get sofascoreWsUrl() {
    return process.env.SOFASCORE_WS_URL || 'wss://www.sofascore.com/u';
  }

  // Application Settings
  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  }

  get logLevel() {
    return process.env.LOG_LEVEL || 'info';
  }

  get isDevelopment() {
    return this.nodeEnv === 'development';
  }

  get isProduction() {
    return this.nodeEnv === 'production';
  }

  // Performance Settings
  get reconnectDelay() {
    return parseInt(process.env.RECONNECT_DELAY || '3000', 10);
  }

  get maxReconnectAttempts() {
    return parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '10', 10);
  }

  get heartbeatInterval() {
    return parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10);
  }

  // Alert Settings
  get enableGoals() {
    return process.env.ENABLE_GOALS !== 'false';
  }

  get enableRedCards() {
    return process.env.ENABLE_RED_CARDS !== 'false';
  }

  get enableYellowCards() {
    return process.env.ENABLE_YELLOW_CARDS !== 'false';
  }

  /**
   * Get all configuration as object
   */
  toObject() {
    return {
      telegram: {
        botToken: this.telegramBotToken ? '***' : null,
        chatId: this.telegramChatId,
      },
      websocket: {
        bwinUrl: this.bwinWsUrl,
        sofascoreUrl: this.sofascoreWsUrl,
      },
      app: {
        nodeEnv: this.nodeEnv,
        logLevel: this.logLevel,
      },
      performance: {
        reconnectDelay: this.reconnectDelay,
        maxReconnectAttempts: this.maxReconnectAttempts,
        heartbeatInterval: this.heartbeatInterval,
      },
      alerts: {
        goals: this.enableGoals,
        redCards: this.enableRedCards,
        yellowCards: this.enableYellowCards,
      },
    };
  }

  /**
   * Log configuration (with sensitive data hidden)
   */
  logConfig() {
    logger.info('Configuration loaded:', this.toObject());
  }
}

export const config = new Config();
export default config;
