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
    logger.info(`📨 Message #${messageCount} from ${source}:`);
    
    if (data.raw && data.raw.length > 200) {
      logger.info(`Data (truncated): ${data.raw.substring(0, 200)}...`);
    } else {
      logger.info('Data:', JSON.stringify(data, null, 2).substring(0, 500));
    }
    
    logger.info('─'.repeat(80) + '\n');
  });

  try {
    // Start browser
    await collector.start();

    logger.info('\n📋 INSTRUCTIONS:');
    logger.info('1. The browser window is now open');
    logger.info('2. Navigate to a LIVE match on Bet365');
    logger.info('3. WebSocket messages will appear here');
    logger.info('4. Press Ctrl+C to stop\n');
    logger.info('═'.repeat(80) + '\n');

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
      logger.info(`\n📊 Status: ${connections.length} WebSocket(s) active, ${messageCount} messages received`);
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
