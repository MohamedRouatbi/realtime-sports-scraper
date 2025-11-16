# 🚀 Deployment Guide - Fly.io

## Prerequisites

1. **Install Fly.io CLI**:

   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Create Fly.io account** (free trial - no credit card needed for 7 days):
   ```bash
   fly auth signup
   # or login if you have an account
   fly auth login
   ```

## Deploy Steps

### 1. **Set Telegram Secrets**

Your bot token and chat ID should NOT be in code. Set them as secrets:

```bash
fly secrets set TELEGRAM_BOT_TOKEN="8461799920:AAGjm0qs0imiivf1Lnbyj4B39uxAWXd2YT0"
fly secrets set TELEGRAM_CHAT_ID="1990594477"
fly secrets set NODE_ENV="production"
fly secrets set LOG_LEVEL="info"
```

### 2. **Launch the App**

```bash
# This will use the existing fly.toml configuration
fly launch --no-deploy

# Deploy
fly deploy
```

### 3. **Monitor Logs**

```bash
# See real-time logs
fly logs

# See app status
fly status

# SSH into the machine
fly ssh console
```

### 4. **Scale (if needed)**

```bash
# Check current scale
fly scale show

# Increase memory if Chrome crashes
fly scale memory 1024

# Add more VMs for redundancy
fly scale count 2
```

## 🎯 Testing Deployment

After deployment, you should see:

1. **Logs showing**:

   ```
   🚀 Starting SofaScore collector...
   🌐 Navigating to SofaScore...
   ✅ SofaScore collector started!
   ✅ Match details fetched
   ```

2. **Telegram notifications** when goals/cards happen in live matches

## 💰 Cost Estimation (Free Tier)

Fly.io free tier includes:

- **3 shared-cpu-1x VMs** (256MB RAM each)
- **160GB bandwidth/month**
- **7 days trial** then $5/month for Hobby plan

**Your app uses:**

- 1 VM with 512MB RAM = ~$2.50/month
- Bandwidth: Minimal (WebSocket + API calls)

## 🔧 Troubleshooting

### Issue: Chrome crashes with "Out of memory"

```bash
fly scale memory 1024
```

### Issue: Can't connect to WebSocket

Check logs:

```bash
fly logs
```

### Issue: Telegram not sending

Verify secrets are set:

```bash
fly secrets list
```

### Issue: App keeps restarting

```bash
# Check health
fly status

# View crash logs
fly logs --filter "error"
```

## 🛑 Stopping/Destroying

```bash
# Stop the app (keeps it but stops billing)
fly apps suspend realtime-sports-scraper

# Resume
fly apps resume realtime-sports-scraper

# Completely destroy (careful!)
fly apps destroy realtime-sports-scraper
```

## 📊 Alternative: Keep it Running 24/7

If you want continuous monitoring, consider:

1. **Run locally on your PC** (free, reliable)
2. **Use a VPS** like DigitalOcean ($4/month)
3. **Use Fly.io Hobby plan** ($5/month after trial)

## 🔐 Security Notes

- Never commit `.env` file to git
- Use `fly secrets` for sensitive data
- Rotate Telegram bot token if exposed
- Keep repository private on GitHub
