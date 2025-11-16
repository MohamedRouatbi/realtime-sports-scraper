import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../src/utils/logger.js';

/**
 * Telegram Notifier
 * Sends instant notifications to Telegram
 * Optimized for <200ms delivery time
 */
export class TelegramNotifier {
  constructor(token, options = {}) {
    this.token = token;
    this.chatId = options.chatId;
    this.bot = null;
    this.messageQueue = [];
    this.isProcessing = false;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.parseMode = options.parseMode || 'HTML';
  }

  /**
   * Initialize Telegram Bot
   */
  async initialize() {
    try {
      this.bot = new TelegramBot(this.token, { polling: false });

      // Test connection
      const me = await this.bot.getMe();
      logger.info(`Telegram bot initialized: @${me.username}`);

      return true;
    } catch (error) {
      logger.error(`Failed to initialize Telegram bot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send alert to Telegram
   */
  async sendAlert(alert, chatId = this.chatId) {
    const startTime = Date.now();

    try {
      if (!this.bot) {
        throw new Error('Telegram bot not initialized');
      }

      if (!chatId) {
        throw new Error('Chat ID not provided');
      }

      // Format message
      const message = this.formatAlert(alert);

      // Send message with retry logic
      const result = await this.sendWithRetry(chatId, message, {
        parse_mode: this.parseMode,
        disable_web_page_preview: true,
      });

      const deliveryTime = Date.now() - startTime;
      logger.info(`Alert sent in ${deliveryTime}ms`, {
        type: alert.type,
        chatId,
        messageId: result.message_id,
      });

      return result;
    } catch (error) {
      logger.error(`Failed to send alert: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Send message with retry logic
   */
  async sendWithRetry(chatId, message, options, attempt = 1) {
    try {
      return await this.bot.sendMessage(chatId, message, options);
    } catch (error) {
      if (attempt >= this.retryAttempts) {
        throw error;
      }

      logger.warn(`Retry attempt ${attempt} for message delivery`);
      await this.delay(this.retryDelay * attempt);

      return this.sendWithRetry(chatId, message, options, attempt + 1);
    }
  }

  /**
   * Format alert for Telegram
   */
  formatAlert(alert) {
    // Use pre-formatted message if available
    if (alert.message) {
      return this.escapeHtml(alert.message);
    }

    // Generate message based on alert type
    switch (alert.type) {
      case 'goal':
        return this.formatGoalAlert(alert);
      case 'red_card':
        return this.formatRedCardAlert(alert);
      case 'yellow_card':
        return this.formatYellowCardAlert(alert);
      default:
        return this.formatGenericAlert(alert);
    }
  }

  /**
   * Format goal alert
   */
  formatGoalAlert(alert) {
    const { data } = alert;
    let message = `⚽ <b>GOAL!</b>\n\n`;
    message += `${data.homeTeam} <b>${data.score.home}-${data.score.away}</b> ${data.awayTeam}\n`;
    message += `⏱️ ${data.minute}'`;

    if (data.player) {
      message += `\n⚽ ${this.escapeHtml(data.player)}`;
    }

    if (data.assistBy) {
      message += `\n🎯 Assist: ${this.escapeHtml(data.assistBy)}`;
    }

    if (data.isPenalty) {
      message += '\n🎯 <b>PENALTY</b>';
    }

    if (data.isOwnGoal) {
      message += '\n😱 <b>OWN GOAL</b>';
    }

    message += `\n\n📊 Source: ${alert.source}`;

    return message;
  }

  /**
   * Format red card alert
   */
  formatRedCardAlert(alert) {
    const { data } = alert;
    let message = `🟥 <b>RED CARD!</b>\n\n`;
    message += `${data.homeTeam} vs ${data.awayTeam}\n`;
    message += `⏱️ ${data.minute}'`;

    if (data.player) {
      message += `\n👤 ${this.escapeHtml(data.player)}`;
    }

    if (data.reason) {
      message += `\n📝 ${this.escapeHtml(data.reason)}`;
    }

    message += `\n\n📊 Source: ${alert.source}`;

    return message;
  }

  /**
   * Format yellow card alert
   */
  formatYellowCardAlert(alert) {
    const { data } = alert;
    let message = `🟨 <b>YELLOW CARD</b>\n\n`;
    message += `${data.homeTeam} vs ${data.awayTeam}\n`;
    message += `⏱️ ${data.minute}'`;

    if (data.player) {
      message += `\n👤 ${this.escapeHtml(data.player)}`;
    }

    if (data.reason) {
      message += `\n📝 ${this.escapeHtml(data.reason)}`;
    }

    message += `\n\n📊 Source: ${alert.source}`;

    return message;
  }

  /**
   * Format generic alert
   */
  formatGenericAlert(alert) {
    let message = `📢 <b>Alert: ${alert.type}</b>\n\n`;
    message += JSON.stringify(alert.data, null, 2);
    return message;
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Send message to multiple chats
   */
  async broadcast(alert, chatIds) {
    const results = [];

    for (const chatId of chatIds) {
      try {
        const result = await this.sendAlert(alert, chatId);
        results.push({ chatId, success: true, result });
      } catch (error) {
        logger.error(`Failed to send to ${chatId}: ${error.message}`);
        results.push({ chatId, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Send photo with caption
   */
  async sendPhoto(chatId, photo, caption, options = {}) {
    try {
      return await this.bot.sendPhoto(chatId, photo, {
        caption,
        parse_mode: this.parseMode,
        ...options,
      });
    } catch (error) {
      logger.error(`Failed to send photo: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send document
   */
  async sendDocument(chatId, document, options = {}) {
    try {
      return await this.bot.sendDocument(chatId, document, options);
    } catch (error) {
      logger.error(`Failed to send document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get bot info
   */
  async getBotInfo() {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }
    return await this.bot.getMe();
  }

  /**
   * Stop bot
   */
  stop() {
    if (this.bot) {
      this.bot.stopPolling();
      logger.info('Telegram bot stopped');
    }
  }
}
