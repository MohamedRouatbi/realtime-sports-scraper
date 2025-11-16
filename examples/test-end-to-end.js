/**
 * End-to-End Test: SofaScore → EventProcessor → Telegram
 * This demonstrates the complete pipeline with REAL live match data
 */

import { SofaScoreCollector } from '../dataCollector/SofaScoreCollector.js';
import { EventProcessor } from '../eventProcessor/EventProcessor.js';
import { TelegramNotifier } from '../notificationDispatcher/TelegramNotifier.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('═'.repeat(80));
console.log('🚀 REAL-TIME SPORTS DATA PIPELINE - END-TO-END TEST');
console.log('═'.repeat(80));
console.log('');
console.log('📊 Pipeline Flow:');
console.log('   SofaScore (WebSocket) → Event Processor → Telegram Bot');
console.log('');
console.log('🎯 Events Monitored:');
console.log('   ⚽ Goals');
console.log('   🟥 Red Cards');
console.log('   🟨 Yellow Cards');
console.log('');
console.log('═'.repeat(80));
console.log('');

// Initialize components
const collector = new SofaScoreCollector();
const processor = new EventProcessor();
const notifier = new TelegramNotifier({
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
});

let eventCount = 0;

// Wire up the pipeline
collector.on('event', async rawEvent => {
  eventCount++;

  console.log(`\n📥 [${eventCount}] Raw event received from SofaScore:`);
  console.log(JSON.stringify(rawEvent, null, 2));

  try {
    // Process through EventProcessor
    const processedEvents = await processor.process({
      eventType: rawEvent.type, // EventProcessor expects 'eventType' not 'type'
      matchId: rawEvent.matchId,
      team: rawEvent.team,
      teamName: rawEvent.teamName,
      homeTeam: rawEvent.homeTeam,
      awayTeam: rawEvent.awayTeam,
      tournament: rawEvent.tournament,
      score: rawEvent.score,
      minute: rawEvent.minute,
      player: rawEvent.player,
      assistBy: rawEvent.assistBy,
      addedTime: rawEvent.addedTime,
      timestamp: rawEvent.timestamp,
      source: rawEvent.source,
    });

    if (processedEvents && processedEvents.length > 0) {
      console.log(`✅ Event validated and processed (${processedEvents.length} notifications)`);

      // Send to Telegram
      for (const message of processedEvents) {
        console.log(`📤 Sending to Telegram:\n${message}\n`);
        const result = await notifier.send(message);

        if (result.success) {
          console.log(`✅ Telegram notification sent successfully!`);
        } else {
          console.error(`❌ Failed to send Telegram notification: ${result.error}`);
        }
      }
    } else {
      console.log('⏭️  Event filtered (duplicate or disabled event type)');
    }
  } catch (error) {
    console.error('❌ Error processing event:', error.message);
  }

  console.log('─'.repeat(80));
});

collector.on('started', () => {
  console.log('✅ SofaScore collector connected');
  console.log('✅ EventProcessor initialized');
  console.log('✅ TelegramNotifier ready');
  console.log('');
  console.log('═'.repeat(80));
  console.log('💡 INSTRUCTIONS:');
  console.log('   1. A browser window should have opened with SofaScore');
  console.log('   2. Click on any LIVE match (look for matches in progress)');
  console.log('   3. Wait for goals or cards to happen in the match');
  console.log('   4. Watch this console for real-time event detection');
  console.log('   5. Check your Telegram for instant notifications');
  console.log('   6. Press Ctrl+C to stop');
  console.log('═'.repeat(80));
  console.log('');
  console.log('⏳ Waiting for match events...\n');
});

collector.on('error', error => {
  console.error('❌ Collector error:', error.message);
});

collector.on('disconnected', () => {
  console.log('⚠️  WebSocket disconnected, attempting to reconnect...');
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down...');
  console.log(`📊 Total events processed: ${eventCount}`);
  await collector.stop();
  process.exit(0);
});

// Start the pipeline
console.log('🔌 Connecting to SofaScore...\n');
await collector.start();
