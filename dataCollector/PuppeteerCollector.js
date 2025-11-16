import puppeteer from 'puppeteer';
import EventEmitter from 'events';
import zlib from 'zlib';
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

      // Launch browser with less automation detection
      this.browser = await puppeteer.launch({
        headless: this.options.headless,
        slowMo: this.options.slowMo,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      });

      this.page = await this.browser.newPage();

      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });

      // Set user agent
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Hide webdriver property to avoid detection
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        // Add chrome object
        window.chrome = { runtime: {} };
        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = parameters =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });

      // Intercept WebSocket connections
      await this.setupWebSocketInterception();

      // Navigate to bookmaker with relaxed waiting
      logger.info(`📡 Navigating to ${this.url}...`);
      try {
        // Use 'domcontentloaded' to avoid hanging on dynamic content
        await this.page.goto(this.url, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });

        // Wait for WebSockets to establish
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.warn(`Navigation warning: ${error.message}, continuing anyway...`);
      }

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

        // CDP returns opcode to identify frame type
        // opcode 1 = text, opcode 2 = binary
        // For binary frames, payloadData might be base64 encoded
        const isBinary = response.opcode === 2;

        // Log raw data info for debugging
        logger.debug(
          `WS Frame: opcode=${response.opcode}, mask=${response.mask}, len=${payloadData?.length}`
        );

        this.handleWebSocketMessage(requestId, payloadData, isBinary);
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
  handleWebSocketMessage(requestId, data, isBinary = false) {
    try {
      const connection = this.wsConnections.get(requestId);
      if (!connection) return;

      let parsed;
      let decodedData = data;

      // Try to parse/decompress the data
      try {
        // First, try JSON parsing directly (for text frames)
        if (!isBinary) {
          try {
            parsed = JSON.parse(data);
            logger.debug('Parsed as JSON text');
          } catch {
            // Not JSON, treat as plain text
            parsed = { type: 'text', content: data.substring(0, 500) };
          }
        } else {
          // Binary frame - need to decompress
          // CDP gives us the binary data as a UTF-8 string, which is incorrect encoding
          // We need to convert it to a proper buffer using 'latin1' or 'binary'
          const buffer = Buffer.from(data, 'binary'); // Use 'binary' encoding for 1:1 byte mapping

          logger.debug(
            `Binary frame: ${buffer.length} bytes, first bytes: ${buffer.slice(0, 10).toString('hex')}`
          );

          // Try different decompression methods
          let decompressed = false;

          // Try deflate/inflate (most common for Bet365)
          try {
            decodedData = zlib.inflateRawSync(buffer).toString('utf-8');
            logger.debug(
              `✓ Decompressed with inflateRaw: ${buffer.length} → ${decodedData.length} bytes`
            );
            decompressed = true;
          } catch (e1) {
            try {
              decodedData = zlib.inflateSync(buffer).toString('utf-8');
              logger.debug(
                `✓ Decompressed with inflate: ${buffer.length} → ${decodedData.length} bytes`
              );
              decompressed = true;
            } catch (e2) {
              try {
                decodedData = zlib.gunzipSync(buffer).toString('utf-8');
                logger.debug(
                  `✓ Decompressed with gunzip: ${buffer.length} → ${decodedData.length} bytes`
                );
                decompressed = true;
              } catch (e3) {
                logger.debug(`✗ Could not decompress: ${e1.message.substring(0, 50)}`);
              }
            }
          }

          if (decompressed) {
            // Try to parse decompressed data as JSON
            try {
              parsed = JSON.parse(decodedData);
              logger.debug('✓ Parsed decompressed data as JSON');
            } catch {
              // Not JSON, return as text
              parsed = { type: 'text', content: decodedData.substring(0, 500) };
              logger.debug('Decompressed data is not JSON');
            }
          } else {
            // Could not decompress
            parsed = {
              type: 'binary',
              encoding: 'unknown',
              length: buffer.length,
              hex: buffer.slice(0, 50).toString('hex'),
            };
          }
        }
      } catch (error) {
        logger.debug(`Message handling error: ${error.message}`);
        parsed = { type: 'error', error: error.message };
      }

      // Emit data event
      this.emit('data', {
        source: this.detectSource(connection.url),
        timestamp: Date.now(),
        wsUrl: connection.url,
        data: parsed,
        raw: data.substring(0, 100), // Truncate raw data
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

      // Use domcontentloaded instead of networkidle2 to avoid hanging
      await this.page.goto(matchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      // Wait for page to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      logger.info('✅ Navigation complete');
      return true;
    } catch (error) {
      logger.warn(`Navigation warning: ${error.message}, but continuing...`);
      return true; // Return true anyway since WebSockets might be working
    }
  }

  /**
   * Click on in-play/live matches section
   */
  async goToLiveMatches() {
    try {
      logger.info('🔍 Looking for In-Play/Live section...');

      // Try different selectors for the live/in-play button
      const selectors = [
        'a[href*="inplay"]',
        'a[href*="live"]',
        'a:has-text("In-Play")',
        'a:has-text("Live")',
        '.ip-ControlBar_Lnk',
      ];

      for (const selector of selectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          await this.page.click(selector);
          logger.info('✅ Clicked on Live section');

          // Wait for content to load
          await new Promise(resolve => setTimeout(resolve, 3000));
          return true;
        } catch {
          // Try next selector
          continue;
        }
      }

      logger.warn('Could not find Live section button, trying direct navigation...');

      // Try direct URL navigation to in-play
      const inPlayUrls = ['https://www.bet365.com/#/IP/', 'https://www.bet365.com/#/IP/B1'];

      for (const url of inPlayUrls) {
        try {
          await this.navigateToMatch(url);
          return true;
        } catch {
          continue;
        }
      }

      return false;
    } catch (error) {
      logger.error(`Failed to navigate to live matches: ${error.message}`);
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
