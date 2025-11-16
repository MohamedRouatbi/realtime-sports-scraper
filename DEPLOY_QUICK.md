# Deploy to Fly.io (Quick Start)

## 1. Install Fly.io CLI

```powershell
# Windows PowerShell
iwr https://fly.io/install.ps1 -useb | iex
```

## 2. Authenticate

```bash
fly auth signup
# or
fly auth login
```

## 3. Set Secrets (IMPORTANT - Do this first!)

```bash
fly secrets set TELEGRAM_BOT_TOKEN="8461799920:AAGjm0qs0imiivf1Lnbyj4B39uxAWXd2YT0"
fly secrets set TELEGRAM_CHAT_ID="1990594477"
```

## 4. Deploy

```bash
# Launch (creates app)
fly launch --no-deploy

# Deploy
fly deploy
```

## 5. Monitor

```bash
# Watch logs
fly logs

# Check status
fly status

# SSH into machine
fly ssh console
```

## 🎯 What Happens After Deploy

1. Chrome runs in **headless mode** (no GUI)
2. Connects to SofaScore WebSocket
3. Monitors live matches automatically
4. Sends notifications to your Telegram bot

## 💰 Cost

- **Free trial**: 7 days
- **After trial**: ~$5/month (512MB VM)

## 🛑 Stop/Destroy

```bash
# Suspend (stop billing)
fly apps suspend realtime-sports-scraper

# Destroy completely
fly apps destroy realtime-sports-scraper
```

## ✅ Ready to Deploy!

Just run:
```bash
fly secrets set TELEGRAM_BOT_TOKEN="8461799920:AAGjm0qs0imiivf1Lnbyj4B39uxAWXd2YT0"
fly secrets set TELEGRAM_CHAT_ID="1990594477"
fly launch
```
