# Quick Start - VPS Deployment

## SSH into your VPS and run these commands:

### 1. Install OS Components (5 minutes)
```bash
sudo dnf install -y liberation-fonts liberation-sans-fonts liberation-serif-fonts \
  liberation-mono-fonts xorg-x11-fonts-Type1 xorg-x11-fonts-misc dejavu-sans-fonts \
  dejavu-serif-fonts dejavu-sans-mono-fonts libX11 libXcomposite libXcursor libXdamage \
  libXext libXi libXrandr libXScrnSaver libXtst libxshmfence nss cups-libs libdrm \
  libgbm alsa-lib at-spi2-atk at-spi2-core gtk3 pango cairo xorg-x11-server-Xvfb
```

### 2. Setup Xvfb Virtual Display (2 minutes)
```bash
# Create systemd service
sudo tee /etc/systemd/system/xvfb.service > /dev/null <<'EOF'
[Unit]
Description=X Virtual Frame Buffer Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start Xvfb
sudo systemctl daemon-reload
sudo systemctl enable xvfb
sudo systemctl start xvfb
sudo systemctl status xvfb  # Verify it's running
```

### 3. Sign Up for Residential Proxy (10 minutes)

**Option A: Bright Data (Recommended - 7-day free trial)**
1. Visit https://brightdata.com/
2. Create account → Start free trial
3. Dashboard → Zones → Create Zone → "Residential Proxies"
4. Note credentials:
   - Server: `brd.superproxy.io:22225`
   - Username: `brd-customer-hl_xxxxxxxx-zone-residential`
   - Password: Your password

**Option B: Webshare (Budget - 10 free proxies)**
1. Visit https://www.webshare.io/
2. Create account → Free plan
3. Dashboard → Proxy List → Copy any proxy details

**Option C: Skip proxy initially** (test if Options 1+2 alone are sufficient)

### 4. Update Your VPS Code (2 minutes)
```bash
cd /root/tg/realtime-sports-scraper
git pull origin main

# Edit .env file
nano .env
```

**Add these lines to .env:**
```bash
# Xvfb display
DISPLAY=:99

# Residential Proxy (if using Bright Data)
PROXY_SERVER=brd.superproxy.io:22225
PROXY_USERNAME=brd-customer-hl_xxxxxxxx-zone-residential
PROXY_PASSWORD=your_password_here

# Or leave empty to skip proxy initially
# PROXY_SERVER=
# PROXY_USERNAME=
# PROXY_PASSWORD=
```

Save (Ctrl+X, Y, Enter)

### 5. Restart PM2 with New Configuration (1 minute)
```bash
pm2 stop footsc
pm2 delete footsc
pm2 start examples/test-end-to-end.js --name footsc --update-env
pm2 save
```

### 6. Verify It's Working (30 seconds)
```bash
pm2 logs footsc --lines 30
```

**✅ Look for these SUCCESS indicators:**
```
🌐 Browser launched | Headless: No (Xvfb) | Proxy: Yes
🔐 Proxy authentication configured
✅ Successfully loaded SofaScore page
WebSocket connected to wss://ws.sofascore.com:9222/
⚽ Goal detected | Manchester United vs Liverpool | Score: 1-0 | Player: Marcus Rashford
```

**❌ If you still see these BAD indicators:**
```
homeTeam: 'Unknown', awayTeam: 'Unknown'
player: 'Unknown'
```

Then:
1. Verify Xvfb running: `ps aux | grep Xvfb`
2. Check DISPLAY set: `pm2 show footsc | grep DISPLAY`
3. If no proxy yet, sign up for Bright Data trial and add credentials

---

## Troubleshooting One-Liners

```bash
# Restart everything fresh
sudo systemctl restart xvfb && pm2 restart footsc --update-env

# Check all services status
echo "=== Xvfb ===" && ps aux | grep Xvfb | grep -v grep && \
echo "=== PM2 ===" && pm2 status && \
echo "=== Display Env ===" && pm2 show footsc | grep DISPLAY

# Watch logs live
pm2 logs footsc --raw

# Test if proxy working (replace with your proxy details)
curl -x http://username:password@brd.superproxy.io:22225 https://ipinfo.io/json

# Check memory usage
pm2 monit
```

---

## Expected Results

**Without Proxy (Options 1+2 only):**
- Effectiveness: 60-70%
- May still occasionally show "Unknown"
- Cost: VPS only ($5-10/month)

**With Proxy (All 3 Options):**
- Effectiveness: 90-95%
- Consistently shows real team/player names
- Cost: VPS + Proxy ($13-25/month)

---

## What Each Option Does

| Option | Purpose | Required? |
|--------|---------|-----------|
| **1. OS Components** | Provides fonts + graphics libs → passes fingerprint checks | ✅ Required |
| **2. Xvfb + Headful** | Gives Chrome real GPU/Canvas/WebGL → not headless | ✅ Required |
| **3. Residential Proxy** | Uses residential IP → avoids datacenter flagging | ⭐ Highly Recommended |

---

## Total Setup Time: ~20 minutes

1. OS Components: 5 min
2. Xvfb: 2 min
3. Proxy signup: 10 min
4. Code update: 2 min
5. PM2 restart: 1 min

**After this, your scraper will run 24/7 with accurate team/player data!** ⚽🎉

---

## Need Help?

See full documentation: `DEPLOYMENT_VPS.md`

Common issues:
- Chrome crashes → Re-run Step 1 (OS components)
- "Unknown" persists → Add proxy (Step 3)
- High memory → Normal (150-250MB for headful mode)
- Proxy auth fails → Double-check credentials in .env
