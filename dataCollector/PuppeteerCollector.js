import puppeteer from 'puppeteer';
import EventEmitter from 'events';
import { logger } from '../src/utils/logger.js';

/**
 * Puppeteer Browser Manager
 * Manages a real browser instance to maintain WebSocket sessions
 * Automatically extracts WebSocket data from bookmaker websites
 */
export class PuppeteerCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    this.url = options.url || 'https://www.bet365.com';
    this.browser = null;
    this.page = null;
    this.wsConnections = new Map();
    this.isRunning = false;
    this.options = {
      headless: options.headless !== false, // Default: true (hidden browser)
      slowMo: options.slowMo || 0,
      ...options,
    };
  }

  /**
   * Start browser and navigate to bookmaker site
   */
  async start() {
    try {
      logger.info('🚀 Starting Puppeteer browser...');

      // Launch browser
      this.browser = await puppeteer.launch({
        headless: this.options.headless,
        slowMo: this.options.slowMo,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
        ],
      });

      this.page = await this.browser.newPage();

      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });

      // Set user agent
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Intercept WebSocket connections
      await this.setupWebSocketInterception();

      // Navigate to bookmaker
      logger.info(`📡 Navigating to ${this.url}...`);
      await this.page.goto(this.url, { waitUntil: 'networkidle2', timeout: 30000 });

      logger.info('✅ Browser ready!');
      this.isRunning = true;

      return true;
    } catch (error) {
      logger.error(`Failed to start browser: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup WebSocket interception to capture messages
   */
  async setupWebSocketInterception() {
    const client = await this.page.target().createCDPSession();
    await client.send('Network.enable');

    // Intercept WebSocket frames
    client.on('Network.webSocketFrameReceived', ({ requestId, response }) => {
      try {
        const payloadData = response.payloadData;
        this.handleWebSocketMessage(requestId, payloadData);
      } catch (error) {
        logger.debug('WebSocket frame error:', error.message);
      }
    });

    // Track WebSocket connections
    client.on('Network.webSocketCreated', ({ requestId, url }) => {
      logger.info(`🔌 WebSocket connected: ${url}`);
      this.wsConnections.set(requestId, { url, created: Date.now() });
      this.emit('websocket-connected', { requestId, url });
    });

    client.on('Network.webSocketClosed', ({ requestId }) => {
      const connection = this.wsConnections.get(requestId);
      if (connection) {
        logger.info(`🔌 WebSocket closed: ${connection.url}`);
        this.wsConnections.delete(requestId);
        this.emit('websocket-closed', { requestId });
      }
    });

    logger.info('✅ WebSocket interception enabled');
  }

  /**
   * Handle WebSocket message
   */
  handleWebSocketMessage(requestId, data) {
    try {
      const connection = this.wsConnections.get(requestId);
      if (!connection) return;

      // Try to parse as JSON
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        // Not JSON, use raw data
        parsed = { raw: data };
      }

      // Emit data event
      this.emit('data', {
        source: this.detectSource(connection.url),
        timestamp: Date.now(),
        wsUrl: connection.url,
        data: parsed,
        raw: data,
      });
    } catch (error) {
      logger.debug('Message handling error:', error.message);
    }
  }

  /**
   * Detect bookmaker source from URL
   */
  detectSource(url) {
    if (url.includes('bet365') || url.includes('365lpodds')) return 'bet365';
    if (url.includes('sofascore')) return 'sofascore';
    if (url.includes('bwin')) return 'bwin';
    return 'unknown';
  }

  /**
   * Navigate to a specific live match URL
   */
  async navigateToMatch(matchUrl) {
    try {
      logger.info(`📍 Navigating to match: ${matchUrl}`);
      await this.page.goto(matchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      return true;
    } catch (error) {
      logger.error(`Navigation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Click an element on the page
   */
  async click(selector) {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.click(selector);
      return true;
    } catch (error) {
      logger.warn(`Click failed: ${selector}`);
      return false;
    }
  }

  /**
   * Type text into an input
   */
  async type(selector, text) {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.type(selector, text);
      return true;
    } catch (error) {
      logger.warn(`Type failed: ${selector}`);
      return false;
    }
  }

  /**
   * Wait for selector
   */
  async waitFor(selector, timeout = 5000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute JavaScript in the page
   */
  async evaluate(fn, ...args) {
    try {
      return await this.page.evaluate(fn, ...args);
    } catch (error) {
      logger.error(`Evaluate error: ${error.message}`);
      return null;
    }
  }

  /**
   * Take screenshot (useful for debugging)
   */
  async screenshot(path = 'screenshot.png') {
    try {
      await this.page.screenshot({ path, fullPage: true });
      logger.info(`📸 Screenshot saved: ${path}`);
      return true;
    } catch (error) {
      logger.error(`Screenshot error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get current WebSocket connections
   */
  getConnections() {
    return Array.from(this.wsConnections.entries()).map(([id, conn]) => ({
      id,
      url: conn.url,
      uptime: Date.now() - conn.created,
    }));
  }

  /**
   * Stop browser
   */
  async stop() {
    try {
      logger.info('🛑 Stopping browser...');
      this.isRunning = false;

      if (this.page) {
        await this.page.close();
      }

      if (this.browser) {
        await this.browser.close();
      }

      logger.info('✅ Browser stopped');
    } catch (error) {
      logger.error(`Stop error: ${error.message}`);
    }
  }

  /**
   * Check if browser is running
   */
  isActive() {
    return this.isRunning && this.browser && this.browser.isConnected();
  }
}
