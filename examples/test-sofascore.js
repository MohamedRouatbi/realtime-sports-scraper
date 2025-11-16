/**
 * SofaScore WebSocket Test
 * This script connects to SofaScore and logs all incoming messages
 * to help us understand their data format
 */

import WebSocket from 'ws';

const SOFASCORE_WS_URL = 'wss://ws.sofascore.com:9222/';

console.log('🔌 Connecting to SofaScore WebSocket...');
console.log(`URL: ${SOFASCORE_WS_URL}\n`);

const ws = new WebSocket(SOFASCORE_WS_URL);

ws.on('open', () => {
  console.log('✅ CONNECTED to SofaScore!\n');
  console.log('Listening for messages...\n');
  console.log('═'.repeat(80));
});

ws.on('message', (data) => {
  try {
    const timestamp = new Date().toLocaleTimeString();
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(data.toString());
      console.log(`\n[${timestamp}] 📦 JSON MESSAGE:`);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      // Not JSON, show raw
      console.log(`\n[${timestamp}] 📦 RAW MESSAGE:`);
      console.log(data.toString());
    }
    
    console.log('─'.repeat(80));
  } catch (error) {
    console.error('Error processing message:', error.message);
  }
});

ws.on('error', (error) => {
  console.error('\n❌ ERROR:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 DISCONNECTED`);
  console.log(`Code: ${code}`);
  console.log(`Reason: ${reason || 'No reason provided'}`);
});

ws.on('ping', () => {
  console.log('\n💓 PING received');
  ws.pong();
});

// Keep alive for 2 minutes to capture messages
setTimeout(() => {
  console.log('\n\n⏱️ Test duration completed (2 minutes)');
  console.log('Closing connection...');
  ws.close();
  process.exit(0);
}, 120000);

console.log('\n💡 Tip: Go to a live match on SofaScore website to trigger events');
console.log('💡 Press Ctrl+C to stop\n');
