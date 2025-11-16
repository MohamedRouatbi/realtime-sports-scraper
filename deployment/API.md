# API Documentation

## Architecture Overview

The system consists of three main components:

1. **Data Collector** - WebSocket connections to sports data providers
2. **Event Processor** - Business logic and rule engine
3. **Notification Dispatcher** - Telegram alert system

## Data Collector

### BaseCollector

Base class for all WebSocket collectors.

```javascript
import { BaseCollector } from './dataCollector/BaseCollector.js';

const collector = new BaseCollector(url, options);
```

**Options:**
- `reconnectDelay` (number): Delay between reconnection attempts (default: 3000ms)
- `maxReconnectAttempts` (number): Maximum reconnection attempts (default: 10)
- `heartbeatInterval` (number): Heartbeat check interval (default: 30000ms)

**Events:**
- `connected` - Emitted when WebSocket connects
- `disconnected` - Emitted when WebSocket disconnects
- `data` - Emitted when data is received
- `error` - Emitted on errors
- `maxReconnectReached` - Emitted when max reconnects reached

**Methods:**
- `connect()` - Establish WebSocket connection
- `disconnect()` - Close WebSocket connection
- `send(data)` - Send data through WebSocket
- `subscribe()` - Override to implement subscription logic

### BwinCollector

```javascript
import { BwinCollector } from './dataCollector/BwinCollector.js';

const bwin = new BwinCollector(url, {
  subscriptions: ['live.football'],
  reconnectDelay: 3000
});

bwin.on('data', (event) => {
  console.log(event);
});

bwin.connect();
```

### SofaScoreCollector

```javascript
import { SofaScoreCollector } from './dataCollector/SofaScoreCollector.js';

const sofascore = new SofaScoreCollector(url, {
  matchIds: [123456, 789012],
  reconnectDelay: 3000
});

sofascore.on('data', (event) => {
  console.log(event);
});

sofascore.connect();
```

## Event Processor

### EventProcessor

Processes events and generates alerts.

```javascript
import { EventProcessor } from './eventProcessor/EventProcessor.js';

const processor = new EventProcessor({
  cacheTimeout: 5000,
  enabledEvents: {
    goals: true,
    redCards: true,
    yellowCards: true
  }
});

processor.on('alert', (alert) => {
  console.log(alert);
});

await processor.process(event);
```

**Methods:**
- `process(event)` - Process an event
- `addRule(name, ruleFn)` - Add custom rule
- `removeRule(name)` - Remove rule
- `clearCache()` - Clear event cache
- `getCacheStats()` - Get cache statistics

### Custom Rules

```javascript
// Add a custom rule
processor.addRule('myRule', (event) => {
  if (event.eventType === 'goal' && event.minute < 5) {
    return {
      type: 'very_early_goal',
      message: 'Goal in first 5 minutes!',
      minute: event.minute
    };
  }
  return null;
});
```

## Notification Dispatcher

### TelegramNotifier

```javascript
import { TelegramNotifier } from './notificationDispatcher/TelegramNotifier.js';

const notifier = new TelegramNotifier(token, {
  chatId: 'your_chat_id',
  retryAttempts: 3,
  retryDelay: 1000,
  parseMode: 'HTML'
});

await notifier.initialize();
await notifier.sendAlert(alert);
```

**Methods:**
- `initialize()` - Initialize bot
- `sendAlert(alert, chatId)` - Send alert
- `broadcast(alert, chatIds)` - Send to multiple chats
- `sendPhoto(chatId, photo, caption)` - Send photo
- `getBotInfo()` - Get bot information
- `stop()` - Stop bot

## Event Format

### Normalized Event Structure

```javascript
{
  source: 'bwin',           // Data source
  timestamp: 1234567890,    // Unix timestamp
  eventType: 'goal',        // Event type
  matchId: '12345',         // Match ID
  homeTeam: 'Team A',       // Home team name
  awayTeam: 'Team B',       // Away team name
  score: {
    home: 1,
    away: 0
  },
  minute: 23,               // Match minute
  data: {},                 // Additional data
  raw: {}                   // Raw original event
}
```

### Goal Event

```javascript
{
  eventType: 'goal',
  goalData: {
    team: 'home',           // 'home' or 'away'
    player: 'John Doe',
    assistBy: 'Jane Smith',
    minute: 23,
    isOwnGoal: false,
    isPenalty: false
  }
}
```

### Card Events

```javascript
{
  eventType: 'red_card',    // or 'yellow_card'
  cardData: {
    team: 'away',
    player: 'John Doe',
    minute: 67,
    reason: 'Violent conduct'
  }
}
```

## Alert Format

```javascript
{
  type: 'goal',             // Alert type
  severity: 'high',         // 'high', 'medium', 'low'
  timestamp: 1234567890,
  matchId: '12345',
  source: 'bwin',
  data: {
    homeTeam: 'Team A',
    awayTeam: 'Team B',
    score: { home: 1, away: 0 },
    minute: 23,
    // Event-specific data
  },
  message: '⚽ GOAL! ...',  // Formatted message
  raw: {}                   // Original event
}
```

## Utilities

### Logger

```javascript
import { logger } from './src/utils/logger.js';

logger.info('Information message');
logger.warn('Warning message');
logger.error('Error message');
logger.debug('Debug message');
```

### Performance Monitor

```javascript
import { perfMonitor } from './src/utils/performance.js';

perfMonitor.start('operation');
// ... do work
perfMonitor.end('operation');

const metrics = perfMonitor.getAllMetrics();
console.log(metrics);
```

### Configuration

```javascript
import { config } from './src/utils/config.js';

console.log(config.telegramBotToken);
console.log(config.bwinWsUrl);
console.log(config.isDevelopment);
```

### Validation

```javascript
import { validateEvent, validateAlert } from './src/utils/validation.js';

const { valid, errors } = validateEvent(event);
if (!valid) {
  console.error('Validation errors:', errors);
}
```

## Examples

### Complete Setup

```javascript
import { BwinCollector } from './dataCollector/index.js';
import { EventProcessor } from './eventProcessor/index.js';
import { TelegramNotifier } from './notificationDispatcher/index.js';

// Setup collector
const collector = new BwinCollector('wss://...', {
  subscriptions: ['live.football']
});

// Setup processor
const processor = new EventProcessor({
  enabledEvents: { goals: true, redCards: true, yellowCards: true }
});

// Setup notifier
const notifier = new TelegramNotifier('bot_token', {
  chatId: 'chat_id'
});

await notifier.initialize();

// Connect components
collector.on('data', async (event) => {
  await processor.process(event);
});

processor.on('alert', async (alert) => {
  await notifier.sendAlert(alert);
});

// Start
collector.connect();
```

### Custom Rule Example

```javascript
// Detect comeback situations
processor.addRule('comeback', (event) => {
  if (event.eventType === 'goal' && event.score) {
    const diff = Math.abs(event.score.home - event.score.away);
    
    // If score difference reduced to 1 after being 2+
    if (diff === 1 && event.minute > 70) {
      return {
        type: 'comeback_alert',
        message: '🔥 COMEBACK ON! Game getting interesting!',
        score: event.score
      };
    }
  }
  return null;
});
```
