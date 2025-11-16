# 🚀 Deploy to Render.com (FREE - No Credit Card)

## Why Render?
- ✅ **100% FREE** (no credit card required)
- ✅ **750 hours/month** (enough for 24/7 operation)
- ✅ Supports Docker
- ✅ Auto-deploys from GitHub
- ✅ Easy setup (5 minutes)

## Prerequisites
1. Push your code to GitHub (if not already)
2. Create a free Render account

## Deployment Steps

### 1. **Push to GitHub** (if not already)

```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### 2. **Sign Up on Render**

1. Go to https://render.com
2. Click "Get Started for Free"
3. Sign up with GitHub (no credit card needed)

### 3. **Create New Web Service**

1. Click "New +" → "Web Service"
2. Connect your GitHub account
3. Select repository: `realtime-sports-scraper`
4. Click "Connect"

### 4. **Configure Settings**

**Basic Info:**
- **Name**: `realtime-sports-scraper`
- **Region**: Select closest to you (Frankfurt for Europe)
- **Branch**: `main`

**Build Settings:**
- **Runtime**: Docker
- **Dockerfile Path**: `./Dockerfile`

**Plan:**
- Select **"Free"** plan

### 5. **Set Environment Variables**

Click "Advanced" → Add Environment Variables:

```
NODE_ENV = production
TELEGRAM_BOT_TOKEN = 8461799920:AAGjm0qs0imiivf1Lnbyj4B39uxAWXd2YT0
TELEGRAM_CHAT_ID = 1990594477
```

### 6. **Deploy**

Click "Create Web Service"

Render will:
1. Clone your repo
2. Build Docker image
3. Deploy and start your app
4. Give you a URL like: `https://realtime-sports-scraper.onrender.com`

## 📊 Monitor Your App

### View Logs
1. Go to your service dashboard
2. Click "Logs" tab
3. Watch real-time logs for goal notifications

### Check Status
- Green dot = Running
- Look for: "✅ SofaScore collector started!"

## ⚠️ Important Notes

### Free Plan Limitations:
- **Spins down after 15 minutes of inactivity**
- **Takes ~1 minute to wake up** on first request
- For 24/7 operation, upgrade to paid plan ($7/month)

### Keep It Alive (Optional):
Add a cron job to ping your app every 14 minutes:
- Use cron-job.org (free)
- Ping: `https://realtime-sports-scraper.onrender.com/health`

## 🔧 Troubleshooting

### Issue: App keeps crashing
Check logs for memory issues:
```
Dashboard → Logs → Look for "Out of memory"
```
Solution: Render free tier has 512MB RAM (should be enough)

### Issue: No notifications
1. Check logs for connection errors
2. Verify environment variables are set correctly
3. Test Telegram bot locally first

### Issue: App sleeping
Free tier spins down after inactivity. Options:
1. Accept the sleep (app wakes on activity)
2. Use cron-job.org to ping every 14 minutes
3. Upgrade to paid plan ($7/month for 24/7)

## 🎯 Expected Behavior

After successful deployment, you'll see in logs:
```
🚀 Starting SofaScore collector...
✅ SofaScore collector started!
✅ Match details fetched
⚽ GOAL DETECTED!
```

And get Telegram notifications for live match events!

## 🆚 Render vs Fly.io

| Feature | Render Free | Fly.io |
|---------|------------|--------|
| Credit Card | ❌ Not required | ✅ Required |
| Free Tier | 750 hrs/month | 7 days trial |
| Auto-sleep | After 15 min | No |
| Memory | 512MB | Configurable |
| Setup | Very easy | CLI required |

## ✅ Ready to Deploy!

Just follow steps 1-6 above. Total time: **5 minutes**!

**After deployment**, share the logs with me if you need help! 🚀
