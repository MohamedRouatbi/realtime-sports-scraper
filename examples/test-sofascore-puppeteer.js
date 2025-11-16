/**
 * SofaScore WebSocket Test with Puppeteer
 * Uses browser automation to access SofaScore and capture WebSocket traffic
 */

import puppeteer from 'puppeteer';

console.log('🚀 Starting SofaScore WebSocket capture with Puppeteer...\n');

const browser = await puppeteer.launch({
  headless: false,
  defaultViewport: null,
  args: ['--start-maximized'],
});

const page = await browser.newPage();

// Setup CDP session to intercept WebSocket traffic
const client = await page.target().createCDPSession();
await client.send('Network.enable');

console.log('📡 Intercepting WebSocket traffic...\n');

// Listen for WebSocket frame events
client.on('Network.webSocketFrameReceived', ({ timestamp, response }) => {
  try {
    const message = response.payloadData;
    const time = new Date(timestamp * 1000).toLocaleTimeString();

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(message);
      console.log(`\n[${time}] 📦 JSON MESSAGE:`);
      console.log(JSON.stringify(parsed, null, 2));

      // Check for match events
      if (parsed.data) {
        const data = parsed.data;
        if (data.homeScore !== undefined || data.awayScore !== undefined) {
          console.log('🎯 SCORE UPDATE DETECTED!');
        }
        if (data.incidents) {
          console.log('🎯 INCIDENTS DETECTED:', data.incidents.length);
        }
      }
    } catch {
      // Not JSON, show raw (first 200 chars)
      const preview = message.length > 200 ? message.substring(0, 200) + '...' : message;
      console.log(`\n[${time}] 📦 RAW MESSAGE: ${preview}`);
    }

    console.log('─'.repeat(80));
  } catch (error) {
    console.error('Error processing message:', error.message);
  }
});

console.log('🌐 Navigating to SofaScore live matches...');
await page.goto('https://www.sofascore.com/football/livescore', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});

console.log('✅ Page loaded!\n');
console.log('═'.repeat(80));
console.log('💡 Instructions:');
console.log('   1. Click on any LIVE match in the browser window');
console.log('   2. Watch this console for WebSocket messages');
console.log('   3. You should see real-time score updates and events');
console.log('   4. Press Ctrl+C to stop');
console.log('═'.repeat(80));
console.log('\n⏳ Waiting for WebSocket messages...\n');

// Keep running for 10 minutes
setTimeout(() => {
  console.log('\n\n⏱️ Test duration completed (10 minutes)');
  browser.close();
  process.exit(0);
}, 600000);
