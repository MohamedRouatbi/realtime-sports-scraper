/**
 * Test file to verify the setup works correctly
 * Run with: node examples/test-setup.js
 */

import { TelegramNotifier } from '../notificationDispatcher/index.js';
import { EventProcessor } from '../eventProcessor/index.js';
import { logger, config } from '../src/utils/index.js';

async function testTelegramConnection() {
  logger.info('🧪 Testing Telegram connection...');

  try {
    const notifier = new TelegramNotifier(config.telegramBotToken, {
      chatId: config.telegramChatId,
    });

    await notifier.initialize();
    
    const testAlert = {
      type: 'test',
      severity: 'info',
      timestamp: Date.now(),
      message: '✅ Test message from Sports Data Pipeline\n\nIf you see this, your Telegram bot is configured correctly!',
      data: {
        test: true,
      },
    };

    await notifier.sendAlert(testAlert);
    logger.info('✅ Test message sent successfully!');
    
    return true;
  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    return false;
  }
}

async function testEventProcessing() {
  logger.info('🧪 Testing event processing...');

  try {
    const processor = new EventProcessor({
      enabledEvents: {
        goals: true,
        redCards: true,
        yellowCards: true,
      },
    });

    let alertReceived = false;

    processor.on('alert', (alert) => {
      logger.info('✅ Alert generated:', alert.type);
      alertReceived = true;
    });

    // Test goal event
    const testGoalEvent = {
      source: 'test',
      timestamp: Date.now(),
      eventType: 'goal',
      matchId: 'test-123',
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      score: { home: 1, away: 0 },
      minute: 23,
      goalData: {
        team: 'home',
        player: 'Test Player',
        assistBy: 'Test Assist',
        minute: 23,
        isOwnGoal: false,
        isPenalty: false,
      },
    };

    await processor.process(testGoalEvent);

    if (alertReceived) {
      logger.info('✅ Event processing works correctly!');
      return true;
    } else {
      logger.error('❌ No alert was generated');
      return false;
    }
  } catch (error) {
    logger.error('❌ Event processing test failed:', error.message);
    return false;
  }
}

async function testFullPipeline() {
  logger.info('🧪 Testing full pipeline (event -> process -> telegram)...');

  try {
    const processor = new EventProcessor({
      enabledEvents: { goals: true, redCards: true, yellowCards: true },
    });

    const notifier = new TelegramNotifier(config.telegramBotToken, {
      chatId: config.telegramChatId,
    });

    await notifier.initialize();

    // Connect processor to notifier
    processor.on('alert', async (alert) => {
      await notifier.sendAlert(alert);
    });

    // Test goal
    const goalEvent = {
      source: 'test',
      timestamp: Date.now(),
      eventType: 'goal',
      matchId: 'test-456',
      homeTeam: 'Manchester United',
      awayTeam: 'Liverpool',
      score: { home: 2, away: 1 },
      minute: 67,
      goalData: {
        team: 'home',
        player: 'Cristiano Ronaldo',
        assistBy: 'Bruno Fernandes',
        minute: 67,
        isOwnGoal: false,
        isPenalty: false,
      },
    };

    await processor.process(goalEvent);
    logger.info('✅ Full pipeline test completed! Check your Telegram.');
    
    // Test red card
    const redCardEvent = {
      source: 'test',
      timestamp: Date.now(),
      eventType: 'red_card',
      matchId: 'test-456',
      homeTeam: 'Manchester United',
      awayTeam: 'Liverpool',
      minute: 78,
      cardData: {
        team: 'away',
        player: 'Mohamed Salah',
        minute: 78,
        reason: 'Violent conduct',
      },
    };

    await processor.process(redCardEvent);
    logger.info('✅ Red card test sent! Check your Telegram.');

    return true;
  } catch (error) {
    logger.error('❌ Full pipeline test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  logger.info('🚀 Starting setup tests...\n');

  const results = {
    telegram: false,
    processing: false,
    pipeline: false,
  };

  // Test 1: Telegram connection
  results.telegram = await testTelegramConnection();
  logger.info('');

  // Test 2: Event processing
  results.processing = await testEventProcessing();
  logger.info('');

  // Test 3: Full pipeline
  if (results.telegram && results.processing) {
    results.pipeline = await testFullPipeline();
  } else {
    logger.warn('⚠️ Skipping full pipeline test due to previous failures');
  }

  // Summary
  logger.info('\n📊 Test Results:');
  logger.info(`Telegram Connection: ${results.telegram ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`Event Processing: ${results.processing ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`Full Pipeline: ${results.pipeline ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(r => r === true);

  if (allPassed) {
    logger.info('\n🎉 All tests passed! Your setup is ready to go.');
    logger.info('You can now run: npm start');
  } else {
    logger.error('\n⚠️ Some tests failed. Please check your configuration.');
    logger.info('Make sure you have:');
    logger.info('1. Copied .env.example to .env');
    logger.info('2. Added your TELEGRAM_BOT_TOKEN');
    logger.info('3. Added your TELEGRAM_CHAT_ID');
    logger.info('See TELEGRAM_SETUP.md for help getting your bot token and chat ID.');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests();
