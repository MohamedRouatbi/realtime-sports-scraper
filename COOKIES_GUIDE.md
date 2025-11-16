# 🍪 How to Get Bet365 Cookies

The WebSocket requires cookies from your browser session. Here's how to get them:

## Method 1: DevTools (Quick)

1. **Open bet365.com** in your browser
2. **Press F12** → **Application** tab (Chrome) or **Storage** tab (Firefox)
3. **Click on Cookies** → `https://www.bet365.com`
4. **Look for these important cookies:**
   - `pstk` (session token)
   - Any cookies with `365` in the name

5. **Copy cookie values** and add to `.env`:

```env
# Add to your .env file
BET365_COOKIE=pstk=YOUR_PSTK_VALUE; other_cookie=value
```

## Method 2: Browser Extension "Cookie Editor"

1. Install "Cookie Editor" extension
2. Go to bet365.com
3. Click the extension
4. Export cookies as JSON or String

## Method 3: DevTools Network Tab

1. **F12** → **Network** tab
2. **Click on any request** to bet365.com
3. **Scroll to Request Headers**
4. **Copy the entire `Cookie:` header value**

Example:

```
Cookie: pstk=abc123...; __cf_bm=xyz789...; session=def456...
```

Add this to `.env`:

```env
BET365_COOKIE=pstk=abc123...; __cf_bm=xyz789...; session=def456...
```

---

## ⚠️ Important Notes

- **Cookies expire!** You'll need to refresh them periodically
- Keep bet365.com open in browser to maintain session
- Don't share your cookies (they contain your session)

---

## 🚀 Easier Alternative: Browser Automation

Instead of manually managing cookies, we can use Puppeteer to automate a real browser.

Would you like me to create that solution instead?
