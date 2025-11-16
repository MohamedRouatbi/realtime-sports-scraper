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
const notifier = new TelegramNotifier(process.env.TELEGRAM_BOT_TOKEN, {
  chatId: process.env.TELEGRAM_CHAT_ID,
});

// Initialize Telegram bot
await notifier.initialize();

let eventCount = 0;

// Wire up EventProcessor alerts to Telegram
processor.on('alert', async alert => {
  try {
    console.log(`\n📤 Sending to Telegram (Chat ID: ${process.env.TELEGRAM_CHAT_ID}):\n${alert.message}\n`);
    const result = await notifier.sendAlert(alert);
    console.log(`✅ Telegram notification sent successfully!`);
    console.log(`   Chat ID: ${result.chat.id}`);
    console.log(`   Message ID: ${result.message_id}`);
  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    console.error('   Stack:', error.stack);
  }
  console.log('─'.repeat(80));
});

// Wire up the pipeline
collector.on('event', async rawEvent => {
  eventCount++;

  console.log(`\n📥 [${eventCount}] Raw event received from SofaScore:`);
  console.log(JSON.stringify(rawEvent, null, 2));

  try {
    // Process through EventProcessor (it will emit 'alert' if valid)
    await processor.process({
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
  } catch (error) {
    console.error('❌ Error processing event:', error.message);
  }
});

collector.on('started', () => {
  console.log('✅ SofaScore collector connected');
  console.log('✅ EventProcessor initialized');
  console.log('✅ TelegramNotifier ready');
  console.log('');
  console.log('═'.repeat(80));
  console.log('📡 Monitoring ALL live football matches');
  console.log('⚽ Will detect goals, red cards, and yellow cards');
  console.log('📲 Notifications will be sent to Telegram instantly');
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
