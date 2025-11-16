/**
 * Test Puppeteer with raw data capture
 * Saves WebSocket messages to file for analysis
 */

import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { logger } from '../src/utils/logger.js';

async function testRaw() {
  logger.info('🚀 Starting raw data capture...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');

  const messages = [];

  // Capture WebSocket frames
  client.on('Network.webSocketFrameReceived', ({ requestId, response, timestamp }) => {
    const msg = {
      requestId,
      timestamp,
      opcode: response.opcode,
      mask: response.mask,
      payloadLength: response.payloadData?.length || 0,
      payloadData: response.payloadData,
    };

    messages.push(msg);

    logger.info(`\n📨 Message #${messages.length}`);
    logger.info(
      `Opcode: ${response.opcode} (${response.opcode === 1 ? 'text' : response.opcode === 2 ? 'binary' : 'other'})`
    );
    logger.info(`Length: ${msg.payloadLength} bytes`);
    logger.info(`First 50 chars: ${response.payloadData?.substring(0, 50)}`);
    logger.info(
      `First 10 bytes (hex): ${Buffer.from(response.payloadData || '', 'utf-8')
        .toString('hex')
        .substring(0, 20)}`
    );
  });

  // Track connections
  client.on('Network.webSocketCreated', ({ url }) => {
    logger.info(`\n🔌 WebSocket created: ${url}`);
  });

  // Navigate to Bet365
  await page.goto('https://www.bet365.com', { waitUntil: 'networkidle2' });

  logger.info('\n📋 Instructions:');
  logger.info('1. Navigate to a live match');
  logger.info('2. Wait for some messages');
  logger.info('3. Press Ctrl+C to save and exit\n');

  process.on('SIGINT', async () => {
    logger.info('\n\n💾 Saving captured messages...');
    writeFileSync('websocket-messages.json', JSON.stringify(messages, null, 2));
    logger.info(`✅ Saved ${messages.length} messages to websocket-messages.json`);
    await browser.close();
    process.exit(0);
  });
}

testRaw();
