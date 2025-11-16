# 🚀 Auto-Extract WebSocket URL from Browser

This guide shows you how to automatically capture the live WebSocket URL from bookmaker websites.

## Method 1: Browser Console Script (Quickest)

### For Bet365, SofaScore, or any bookmaker:

1. **Open the bookmaker website** (e.g., bet365.com)
2. **Go to a LIVE match page**
3. **Open DevTools** (F12 or Right-click → Inspect)
4. **Go to Console tab**
5. **Paste and run this script:**

```javascript
// WebSocket URL Extractor
(function () {
  console.clear();
  console.log('🔍 Starting WebSocket Monitor...\n');

  const originalWebSocket = WebSocket;
  const connections = new Set();

  // Intercept WebSocket connections
  window.WebSocket = function (...args) {
    const ws = new originalWebSocket(...args);
    const url = args[0];

    if (!connections.has(url)) {
      connections.add(url);
      console.log('✅ NEW WEBSOCKET DETECTED:');
      console.log('URL:', url);
      console.log('\n📋 Copy this to your .env file:');
      console.log(`BET365_WS_URL=${url}`);
      console.log('\n' + '='.repeat(80) + '\n');

      // Also log when messages are received
      ws.addEventListener('message', event => {
        console.log('📨 Message received:', event.data.substring(0, 100) + '...');
      });
    }

    return ws;
  };

  // Check for existing connections
  console.log('✅ Monitor active! Now:');
  console.log('1. Navigate to a LIVE match');
  console.log('2. Or refresh the page');
  console.log('3. WebSocket URL will appear above\n');

  // Alternative: Check performance entries
  setTimeout(() => {
    const wsConnections = performance
      .getEntriesByType('resource')
      .filter(r => r.name.includes('ws://') || r.name.includes('wss://'));

    if (wsConnections.length > 0) {
      console.log('🔍 Found existing WebSocket connections:');
      wsConnections.forEach(ws => {
        console.log('URL:', ws.name);
      });
    }
  }, 1000);
})();
```

6. **Refresh the page or navigate to a live match**
7. **Copy the WebSocket URL** that appears in the console

---

## Method 2: Bookmarklet (One-Click)

1. **Create a new bookmark** in your browser
2. **Name it:** "Get WebSocket URL"
3. **Set URL to:**

```javascript
javascript: (function () {
  const o = WebSocket;
  window.WebSocket = function (...a) {
    const w = new o(...a);
    console.log('WebSocket:', a[0]);
    alert('WebSocket URL:\n\n' + a[0] + '\n\nCheck console for details');
    return w;
  };
  alert('Monitor active! Navigate to live match.');
})();
```

4. **Click the bookmarklet** when on the bookmaker website
5. **Navigate to a live match** - URL will pop up in an alert

---

## Method 3: Network Tab (Manual but Reliable)

1. **Open DevTools** (F12)
2. **Go to Network tab**
3. **Filter by "WS"** (WebSocket)
4. **Go to a live match page**
5. **Click on the WebSocket connection** in the list
6. **Copy the URL** from the Headers tab (Request URL)

Example for Bet365:

```
wss://premws-pt4.365lpodds.com/zap/?uid=XXXXXXXXX
```

---

## Method 4: Automated Extractor Script (Advanced)

Run this Node.js script to monitor your browser's WebSocket connections:

```bash
node examples/extract-websocket-url.js
```

---

## 📝 Update Your .env File

Once you have the URL:

```bash
# For Bet365
BET365_WS_URL=wss://premws-pt4.365lpodds.com/zap/?uid=YOUR_UID_HERE

# For SofaScore
SOFASCORE_WS_URL=wss://ws.sofascore.com:9222/

# For other bookmakers
BWIN_WS_URL=wss://your-websocket-url
```

---

## ⚠️ Important Notes

### Session-Based URLs

- The `uid` parameter in Bet365 URLs is **session-specific**
- It expires when you close your browser
- You'll need to extract a fresh URL each session

### Automation Options

**Option A: Manual Update (Simple)**

- Extract URL when needed
- Update `.env` file
- Restart your scraper

**Option B: Auto-Refresh Script (Advanced)**

- Create a browser extension
- Automatically update the URL
- Send to your Node.js app via HTTP

**Option C: Browser Automation (Most Reliable)**

- Use Puppeteer to control a real browser
- Extract URL programmatically
- Maintain session automatically

---

## 🚀 Quick Start Commands

```bash
# 1. Extract URL using browser console (Method 1 above)

# 2. Update .env with the URL
# Edit: .env

# 3. Test the connection
node examples/test-bet365.js

# 4. If it works, start the full pipeline
npm start
```

---

## 🔄 When URL Expires

If you get connection errors:

1. **Extract a fresh URL** using Method 1 or 2
2. **Update `.env`** file
3. **Restart the application**

```bash
# Stop current app (Ctrl+C)
# Update .env with new URL
npm start
```

---

## 💡 Pro Tip: Keep Browser Open

For continuous operation:

1. Keep the bookmaker website open in a browser tab
2. Your session stays active
3. WebSocket URL remains valid
4. Your scraper keeps working

---

## 🎯 Fastest Workflow

1. **Bookmark the console script** (Method 1)
2. **Open bet365.com** in a dedicated browser profile
3. **Run the script** once per session
4. **Copy URL** → **Update .env** → **Restart app**
5. **Done!** Your scraper is live

---

Would you like help with browser automation using Puppeteer for fully automatic URL extraction?
