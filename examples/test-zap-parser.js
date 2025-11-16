/**
 * Test ZAP Protocol Parser
 * Demonstrates parsing of captured Bet365 messages
 */

import { ZapParser } from '../dataCollector/ZapParser.js';
import { logger } from '../src/utils/logger.js';

// Example messages we've captured
const testMessages = [
  // Connection messages
  '101\u0002I1BRW41-LXBD4mJRPgQl\u0000',
  '100\u0002IR3UD05-frWresQhcevh\u0000',

  // Time update
  '\u0014__time\u0001F|IN;TI=20251116152627721;UF=55;|',

  // Session data
  '\u0014S_F0315357CC290B28A850B18B515FA47D000003\u0001F|ER;RT=2;IT=S_F0315357CC290B28A850B18B515FA47D000003;|',

  // Simulated goal event (example format)
  '\u0014M_12345678\u0001U|IT=M_12345678;SC=2-1;EV=G;TM=HOME;PL=Messi;MG=67;|',

  // Simulated red card event
  '\u0014M_12345678\u0001U|IT=M_12345678;EV=RC;TM=AWAY;PL=Ramos;MG=85;|',
];

logger.info('🧪 Testing ZAP Protocol Parser\n');
logger.info('═'.repeat(80));

testMessages.forEach((msg, index) => {
  logger.info(`\n📨 Message #${index + 1}:`);
  logger.info(`Raw: ${msg.substring(0, 100)}...`);

  const parsed = ZapParser.parse(msg);
  logger.info(`Parsed: ${ZapParser.format(parsed)}`);

  if (ZapParser.isMatchEvent(parsed)) {
    logger.info('🎯 THIS IS A MATCH EVENT!');
    const matchData = ZapParser.extractMatchData(parsed);
    logger.info('Match Data:', JSON.stringify(matchData, null, 2));
  }

  logger.info('─'.repeat(80));
});

logger.info('\n✅ Parser test complete!');
logger.info('\n💡 Next Steps:');
logger.info(
  '1. When you see a LIVE match in the browser, messages with SC (score), EV (event) will appear'
);
logger.info('2. The parser will extract: goals, red cards, yellow cards, scores');
logger.info('3. These will be sent to your Telegram bot as alerts');
