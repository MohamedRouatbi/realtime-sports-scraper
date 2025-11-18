# VPS Deployment Guide - Anti-Bot Configuration

This guide provides step-by-step instructions to deploy the realtime-sports-scraper on an AlmaLinux VPS with full anti-bot detection measures.

## Problem Statement

SofaScore implements sophisticated anti-scraping measures through browser fingerprinting:
- **Canvas & WebGL fingerprinting** - Detects headless browsers missing GPU support
- **Font enumeration** - Minimal server fonts flag bot behavior
- **navigator.webdriver detection** - Puppeteer sets this to `true`
- **IP reputation checks** - Datacenter IPs are flagged vs residential IPs
- **Hardware fingerprinting** - Missing graphics libraries indicate automation

**Consequence**: When detected as a bot, SofaScore degrades WebSocket data:
- Team names show as "Unknown"
- Player names show as "Unknown"
- Tournament names are empty strings
- Events lack critical metadata

**Solution**: Three-pronged approach to mimic legitimate user behavior.

---

## Solution Overview

### Option 3: Install OS Components (Required)
Install full browser dependencies to pass fingerprinting checks.

### Option 4: Headful Mode with Xvfb (Required)
Run Chrome in headful mode with virtual display to provide real GPU/Canvas/WebGL.

### Option 5: Residential Proxy (Highly Recommended)
Route traffic through residential IPs to avoid datacenter flagging.

---

## Step 1: Install OS Components (AlmaLinux)

SSH into your VPS and install required packages:

```bash
# Install all browser dependencies, fonts, and X11 components
sudo dnf install -y \
  liberation-fonts \
  liberation-sans-fonts \
  liberation-serif-fonts \
  liberation-mono-fonts \
  xorg-x11-fonts-Type1 \
  xorg-x11-fonts-misc \
  xorg-x11-fonts-75dpi \
  xorg-x11-fonts-100dpi \
  dejavu-sans-fonts \
  dejavu-serif-fonts \
  dejavu-sans-mono-fonts \
  libX11 \
  libXcomposite \
  libXcursor \
  libXdamage \
  libXext \
  libXi \
  libXrandr \
  libXScrnSaver \
  libXtst \
  libxshmfence \
  nss \
  cups-libs \
  libdrm \
  libgbm \
  alsa-lib \
  at-spi2-atk \
  at-spi2-core \
  gtk3 \
  pango \
  cairo \
  xorg-x11-server-Xvfb

# Verify installation
fc-list | grep -i liberation  # Should show multiple Liberation fonts
which Xvfb  # Should show /usr/bin/Xvfb
```

**Why this matters**: 
- Fonts enable realistic font fingerprinting results
- Graphics libraries provide Canvas/WebGL support
- Xvfb allows running Chrome headful without physical display

---

## Step 2: Configure Xvfb Virtual Display

### Create Xvfb systemd service:

```bash
sudo tee /etc/systemd/system/xvfb.service > /dev/null <<EOF
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

# Enable and start Xvfb
sudo systemctl daemon-reload
sudo systemctl enable xvfb
sudo systemctl start xvfb

# Verify Xvfb is running
sudo systemctl status xvfb
ps aux | grep Xvfb  # Should show Xvfb :99 process
```

### Configure environment variable:

Add to your `.env` file:
```bash
DISPLAY=:99
```

Or configure PM2 to inject it:
```bash
pm2 stop footsc
pm2 delete footsc
pm2 start examples/test-end-to-end.js --name footsc --update-env --env production
pm2 save
```

**Why this matters**:
- Xvfb creates a virtual display :99 that Chrome can render to
- Chrome runs headful mode (not headless) → passes GPU/WebGL checks
- No physical monitor needed on server

---

## Step 3: Configure Residential Proxy (Recommended)

### Choose a Residential Proxy Service

| Provider | Free Trial | Starting Price | Coverage |
|----------|-----------|----------------|----------|
| **Bright Data** | 7-day free trial | $8.40/GB | 195 countries |
| **Smartproxy** | 3-day money-back | $8.50/GB | 195+ countries |
| **Oxylabs** | 7-day trial | $8/GB | 195 countries |
| **Webshare** | 10 free proxies | $2.99/GB | 50+ countries |

**Recommendation**: Start with Bright Data's free trial to test effectiveness.

### Sign up for Bright Data (Example):

1. Visit https://brightdata.com/
2. Create free account → 7-day trial
3. Dashboard → Zones → Create Zone → Select "Residential Proxies"
4. Note your credentials:
   - **Proxy Server**: `brd.superproxy.io:22225`
   - **Username**: `brd-customer-hl_<your-id>-zone-residential`
   - **Password**: Your account password

### Configure proxy in .env:

```bash
# Proxy Configuration (Bright Data example)
PROXY_SERVER=brd.superproxy.io:22225
PROXY_USERNAME=brd-customer-hl_xxxxxxxx-zone-residential
PROXY_PASSWORD=your_password_here

# Or for HTTP proxy with authentication:
# PROXY_SERVER=http://username:password@proxy-host:port
```

### Alternative: SOCKS5 Proxy Setup

If using SOCKS5 proxy instead:
```bash
PROXY_SERVER=socks5://proxy-host:1080
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password
```

**Why this matters**:
- Residential IPs are from real ISPs → not flagged as datacenter
- SofaScore treats residential traffic as legitimate users
- Rotates IPs automatically → harder to block

---

## Step 4: Deploy Code Changes

### Pull latest changes:

```bash
cd /root/tg/realtime-sports-scraper
git pull origin main
```

### Update .env with all settings:

```bash
nano .env
```

Ensure you have:
```bash
# Node environment
NODE_ENV=production

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Xvfb display
DISPLAY=:99

# Residential Proxy (if using)
PROXY_SERVER=brd.superproxy.io:22225
PROXY_USERNAME=brd-customer-hl_xxxxxxxx-zone-residential
PROXY_PASSWORD=your_password_here
```

### Restart PM2 with new environment:

```bash
pm2 stop footsc
pm2 delete footsc
pm2 start examples/test-end-to-end.js --name footsc --update-env
pm2 save
```

---

## Step 5: Verify Configuration

### Check logs for success indicators:

```bash
pm2 logs footsc --lines 50
```

**Look for these log messages:**

✅ **Good Signs**:
```
🌐 Browser launched | Headless: No (Xvfb) | Proxy: Yes
🔐 Proxy authentication configured
✅ Successfully loaded SofaScore page
WebSocket connected to wss://ws.sofascore.com:9222/
⚽ Goal detected | Match: Team A vs Team B | Score: 1-0 | Player: John Doe
```

❌ **Bad Signs** (indicates still detected as bot):
```
homeTeam: 'Unknown', awayTeam: 'Unknown'
player: 'Unknown', tournament: ''
```

### Test browser fingerprint:

Create a test script to check fingerprinting:

```bash
node -e "
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--display=' + (process.env.DISPLAY || ':99'),
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--proxy-server=' + process.env.PROXY_SERVER
    ]
  });
  const page = await browser.newPage();
  
  if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
    await page.authenticate({
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    });
  }
  
  await page.goto('https://bot.sannysoft.com/');
  await page.screenshot({ path: '/tmp/bot-test.png' });
  console.log('Screenshot saved to /tmp/bot-test.png');
  console.log('Check for green checkmarks (not red Xs)');
  await browser.close();
})();
"
```

Download screenshot and verify:
- ✅ WebDriver: should show "not present" or false
- ✅ Chrome: should show "present"
- ✅ Permissions: should show "allow"
- ✅ Plugins: should show non-zero count

---

## Step 6: Monitor and Optimize

### Check match data quality:

```bash
# Monitor events in real-time
pm2 logs footsc | grep "Goal detected\|Red card\|Yellow card"

# Should see actual team/player names, not "Unknown"
```

### Performance metrics:

```bash
pm2 monit  # Check CPU/memory usage

# Expected:
# - Memory: 150-250MB (up from 36MB due to headful mode)
# - CPU: 5-15% during live matches
```

### Proxy usage monitoring:

- Check your proxy provider dashboard for traffic usage
- Typical usage: ~100-500MB per day for live match monitoring
- Optimize: Only scrape during match hours to reduce costs

---

## Troubleshooting

### Issue: "Unknown" still appearing in events

**Diagnosis**:
```bash
# Check if Xvfb is running
ps aux | grep Xvfb

# Check if DISPLAY is set in PM2
pm2 show footsc | grep DISPLAY

# Check if proxy is configured
pm2 logs footsc | grep "Proxy:"
```

**Solutions**:
1. Restart Xvfb: `sudo systemctl restart xvfb`
2. Update PM2 env: `pm2 restart footsc --update-env`
3. Verify proxy credentials in .env
4. Check proxy service dashboard for connection errors

### Issue: Chrome crashes or fails to launch

**Diagnosis**:
```bash
# Check Chrome dependencies
ldd $(which google-chrome-stable) | grep "not found"

# Check Xvfb logs
sudo journalctl -u xvfb -n 50
```

**Solutions**:
1. Re-run OS components install (Step 1)
2. Verify Xvfb running: `sudo systemctl status xvfb`
3. Check disk space: `df -h`
4. Check memory: `free -h` (need at least 512MB free)

### Issue: Proxy authentication failing

**Diagnosis**:
```bash
pm2 logs footsc | grep -i "proxy\|authentication"
```

**Solutions**:
1. Verify credentials correct in .env
2. Test proxy outside browser:
   ```bash
   curl -x http://username:password@proxy-host:port https://ipinfo.io/json
   ```
3. Check proxy service dashboard for account status
4. Try different proxy zone (e.g., sticky sessions vs rotating)

### Issue: High memory usage

**Diagnosis**:
```bash
pm2 monit  # Check memory usage
```

**Solutions**:
1. Headful mode uses more memory (150-250MB normal)
2. If >400MB, may have memory leak:
   ```bash
   pm2 restart footsc  # Temporary fix
   ```
3. Consider adding memory limit:
   ```bash
   pm2 start examples/test-end-to-end.js --name footsc --max-memory-restart 300M
   ```

---

## Cost Estimation

### Without Proxy (Free):
- VPS: $5-10/month (AlmaLinux)
- Telegram: Free
- **Total**: $5-10/month
- **Effectiveness**: 60-70% (may still get flagged intermittently)

### With Residential Proxy:
- VPS: $5-10/month
- Proxy: $8-15/month (100MB-500MB usage)
- Telegram: Free
- **Total**: $13-25/month
- **Effectiveness**: 90-95% (rare detection)

**Recommendation**: Start without proxy (free trial period), add proxy if "Unknown" issues persist.

---

## Expected Results

After implementing all three options:

**Before (Headless + No Proxy)**:
```json
{
  "eventType": "goal",
  "homeTeam": "Unknown",
  "awayTeam": "Unknown",
  "player": "Unknown",
  "tournament": "",
  "minute": null
}
```

**After (Headful + Xvfb + Residential Proxy)**:
```json
{
  "eventType": "goal",
  "homeTeam": "Manchester United",
  "awayTeam": "Liverpool",
  "player": "Marcus Rashford",
  "tournament": "Premier League",
  "minute": 23,
  "score": "1-0"
}
```

---

## Maintenance

### Weekly tasks:
- Monitor PM2 logs for errors: `pm2 logs footsc --lines 100`
- Check proxy usage in provider dashboard
- Verify Xvfb still running: `sudo systemctl status xvfb`

### Monthly tasks:
- Review proxy costs and optimize if needed
- Update Node packages: `npm update`
- Restart services for fresh state: `pm2 restart footsc`

### When matches aren't happening:
- PM2 will keep process alive but idle
- Memory usage drops to ~100MB
- Proxy usage minimal (~10MB/day for keepalive)

---

## Security Notes

1. **Never commit .env to git** - contains sensitive credentials
2. **Use strong passwords** for proxy accounts
3. **Rotate proxy credentials** monthly
4. **Monitor proxy dashboard** for suspicious activity
5. **Keep PM2 logs private** - may contain API endpoints

---

## Support

If you encounter issues:

1. Check PM2 logs: `pm2 logs footsc --lines 200`
2. Verify all services running:
   ```bash
   sudo systemctl status xvfb
   pm2 status
   ```
3. Test components individually:
   - OS fonts: `fc-list | wc -l` (should show >50)
   - Xvfb: `DISPLAY=:99 xdpyinfo` (should show display info)
   - Proxy: `curl -x $PROXY_SERVER https://ipinfo.io/json`
4. Review this guide's Troubleshooting section

---

## Summary Checklist

- [ ] Step 1: Installed OS components (fonts, X11, graphics libs)
- [ ] Step 2: Configured Xvfb service and DISPLAY=:99
- [ ] Step 3: Signed up for residential proxy service
- [ ] Step 4: Updated .env with proxy credentials
- [ ] Step 5: Deployed code changes with git pull
- [ ] Step 6: Restarted PM2 with --update-env
- [ ] Verified: Logs show "Headless: No (Xvfb) | Proxy: Yes"
- [ ] Verified: Events show real team/player names (not "Unknown")
- [ ] Tested: Telegram notifications working with full details

**Expected outcome**: 24/7 monitoring with accurate real-time notifications for goals, red cards, and yellow cards across all live football matches. 🎉
