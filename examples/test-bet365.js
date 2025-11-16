/**
 * Bet365 WebSocket Test
 * This script connects to Bet365 and logs all incoming messages
 */

import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const BET365_WS_URL =
  process.env.BET365_WS_URL || 'wss://premws-pt4.365lpodds.com/zap/?uid=8031745238855418';

console.log('🔌 Connecting to Bet365 WebSocket...');
console.log(`URL: ${BET365_WS_URL}\n`);

// Bet365 requires specific headers and protocol
const ws = new WebSocket(BET365_WS_URL, 'zap-protocol-v1', {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
    Origin: 'https://www.bet365.com',
    'Accept-Language': 'en-GB,en;q=0.5',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'websocket',
    'Sec-Fetch-Site': 'cross-site',
  },
  perMessageDeflate: true,
});

let messageCount = 0;

ws.on('open', () => {
  console.log('✅ CONNECTED to Bet365!\n');
  console.log('Listening for messages...\n');
  console.log('═'.repeat(80));
});

ws.on('message', data => {
  try {
    messageCount++;
    const timestamp = new Date().toLocaleTimeString();

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(data.toString());
      console.log(`\n[${timestamp}] 📦 MESSAGE #${messageCount}:`);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      // Not JSON, show raw (truncated if too long)
      const rawData = data.toString();
      console.log(`\n[${timestamp}] 📦 MESSAGE #${messageCount} (${rawData.length} bytes):`);
      if (rawData.length > 500) {
        console.log(rawData.substring(0, 500) + '...[truncated]');
      } else {
        console.log(rawData);
      }
    }

    console.log('─'.repeat(80));
  } catch (error) {
    console.error('Error processing message:', error.message);
  }
});

ws.on('error', error => {
  console.error('\n❌ ERROR:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 DISCONNECTED`);
  console.log(`Code: ${code}`);
  console.log(`Reason: ${reason || 'No reason provided'}`);
  console.log(`Total messages received: ${messageCount}`);
});

ws.on('ping', () => {
  console.log('\n💓 PING received');
  ws.pong();
});

// Keep alive for 2 minutes
setTimeout(() => {
  console.log('\n\n⏱️ Test duration completed (2 minutes)');
  console.log(`Total messages received: ${messageCount}`);
  console.log('Closing connection...');
  ws.close();
  process.exit(0);
}, 120000);

console.log('\n💡 Tip: Keep a live match open on Bet365 to see live updates');
console.log('💡 Press Ctrl+C to stop\n');
