/**
 * Test Puppeteer Collector
 * This opens a real browser and captures WebSocket data from Bet365
 */

import { PuppeteerCollector } from '../dataCollector/PuppeteerCollector.js';
import { logger } from '../src/utils/logger.js';

async function testPuppeteer() {
  logger.info('🚀 Starting Puppeteer Test...\n');

  const collector = new PuppeteerCollector({
    url: 'https://www.bet365.com',
    headless: false, // Show browser window
  });

  // Listen for WebSocket connections
  collector.on('websocket-connected', ({ url }) => {
    logger.info('✅ NEW WEBSOCKET DETECTED:');
    logger.info(`URL: ${url}\n`);
  });

  // Listen for WebSocket messages
  let messageCount = 0;
  collector.on('data', ({ source, data }) => {
    messageCount++;
    logger.info(`\n📨 Message #${messageCount} from ${source}:`);

    // Show the parsed data
    const dataStr = JSON.stringify(data, null, 2);
    if (dataStr.length > 1000) {
      logger.info(dataStr.substring(0, 1000) + '... (truncated)');
    } else {
      logger.info(dataStr);
    }

    logger.info('─'.repeat(80));
  });

  try {
    // Start browser
    await collector.start();

    logger.info('\n📋 INSTRUCTIONS:');
    logger.info('1. The browser window is now open');
    logger.info('2. Attempting to navigate to live matches...');
    logger.info('3. WebSocket messages will appear below');
    logger.info('4. Press Ctrl+C to stop\n');
    logger.info('═'.repeat(80) + '\n');

    // Try to automatically navigate to live matches
    setTimeout(async () => {
      try {
        logger.info('🔄 Attempting automatic navigation to In-Play section...');
        const success = await collector.goToLiveMatches();
        if (success) {
          logger.info('✅ Successfully navigated to live matches!');
        } else {
          logger.warn(
            '⚠️ Could not auto-navigate. Please manually click "In-Play" or "Live" in the browser.'
          );
        }
      } catch (error) {
        logger.warn(`Auto-navigation failed: ${error.message}`);
        logger.info('💡 Please manually navigate to live matches in the browser window.');
      }
    }, 3000);

    // Keep running
    process.on('SIGINT', async () => {
      logger.info('\n\n⏹️ Stopping...');
      logger.info(`Total messages received: ${messageCount}`);
      await collector.stop();
      process.exit(0);
    });

    // Show status every 30 seconds
    setInterval(() => {
      const connections = collector.getConnections();
      logger.info(
        `\n📊 Status: ${connections.length} WebSocket(s) active, ${messageCount} messages received`
      );
      connections.forEach((conn, i) => {
        logger.info(`  ${i + 1}. ${conn.url} (${Math.floor(conn.uptime / 1000)}s)`);
      });
    }, 30000);
  } catch (error) {
    logger.error('Test failed:', error);
    await collector.stop();
    process.exit(1);
  }
}

// Run test
testPuppeteer();
