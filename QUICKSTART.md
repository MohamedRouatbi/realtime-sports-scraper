# 🚀 Quick Start Guide

Get your real-time sports data pipeline up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- A Telegram account
- 5 minutes of your time

## Step 1: Install Dependencies

```bash
npm install
```

This will install all required packages:
- `ws` - WebSocket client
- `node-telegram-bot-api` - Telegram integration
- `dotenv` - Configuration management
- `pino` - High-performance logging

## Step 2: Get Your Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the prompts
3. Copy the token you receive

**Need detailed help?** See [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)

## Step 3: Get Your Chat ID

**Quick method:**
1. Search for [@userinfobot](https://t.me/userinfobot) in Telegram
2. Start a conversation - it will send you your chat ID

**Alternative method:**
1. Message your new bot
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Look for `"chat":{"id":YOUR_ID}`

## Step 4: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required - Add your values here
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789

# WebSocket URLs (configure when you have them)
BWIN_WS_URL=wss://your-websocket-url
SOFASCORE_WS_URL=wss://your-websocket-url

# Optional - Leave defaults for now
ENABLE_GOALS=true
ENABLE_RED_CARDS=true
ENABLE_YELLOW_CARDS=true
```

## Step 5: Test Your Setup

```bash
npm test
```

This will:
- ✅ Test Telegram connection
- ✅ Test event processing
- ✅ Send test alerts to your Telegram

**You should receive test messages in Telegram!**

## Step 6: Configure WebSocket URLs

Once you have WebSocket endpoint URLs from your data provider:

1. Add them to `.env`:
   ```env
   BWIN_WS_URL=wss://your-actual-websocket-url
   SOFASCORE_WS_URL=wss://your-actual-websocket-url
   ```

2. The collectors will automatically connect when you start the app

## Step 7: Start the Pipeline

```bash
npm start
```

You should see:
```
🚀 Initializing Real-time Sports Data Pipeline
✅ Pipeline initialized successfully
📡 Connecting to data sources...
✅ Pipeline started successfully
📡 Pipeline is running. Press Ctrl+C to stop.
```

**You'll receive a startup notification in Telegram!**

## 🎯 What Happens Now?

The system is now:
- 📡 Connected to WebSocket data sources
- 👂 Listening for live match events
- 🧠 Processing events in real-time
- 📱 Sending instant alerts to Telegram

You'll receive Telegram notifications for:
- ⚽ Goals (with scorer, assist, score)
- 🟥 Red Cards (with player name)
- 🟨 Yellow Cards (with player name)

## 🔧 Common Issues

### "Missing required environment variables"
- Make sure you copied `.env.example` to `.env`
- Verify your bot token and chat ID are correct

### "Failed to initialize Telegram bot"
- Check your bot token is valid
- Ensure you have internet connection

### "No collectors initialized"
- This is normal if you haven't configured WebSocket URLs yet
- The system will work once you add valid WebSocket endpoints

### Test messages not received
- Make sure you started a chat with your bot (send /start)
- Verify your chat ID is correct (no quotes around it)
- Check you haven't blocked the bot

## 🎓 Next Steps

### Add Custom Rules

Create your own alert logic:

```javascript
// In src/index.js, after processor initialization:
processor.addRule('myRule', (event) => {
  if (event.eventType === 'goal' && event.minute < 10) {
    return {
      type: 'early_goal',
      message: '🚀 EARLY GOAL in first 10 minutes!',
    };
  }
  return null;
});
```

### Enable Advanced Rules

```javascript
import { advancedRules } from './examples/advanced-rules.js';

// Add all advanced rules
Object.entries(advancedRules).forEach(([name, rule]) => {
  processor.addRule(name, rule);
});
```

### Add More Data Sources

See [examples/custom-collector.js](examples/custom-collector.js) for how to add new WebSocket sources.

### Deploy to Production

See [deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md) for detailed deployment guides for:
- Fly.io (recommended for low latency)
- Hetzner Cloud
- DigitalOcean
- Heroku
- Docker

## 📊 Monitoring

Check the logs for real-time statistics:
- Events processed
- Alerts sent
- Performance metrics
- Connection status

Statistics are logged every minute.

## 🆘 Need Help?

1. Check [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md) for Telegram issues
2. See [deployment/API.md](deployment/API.md) for API documentation
3. Read [deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md) for deployment help
4. Open an issue on GitHub

## 🎉 Success!

If you received test notifications in Telegram, you're all set! 

Your real-time sports data pipeline is ready to process live match events and send instant alerts.

**Happy monitoring! ⚽📱**
