# Getting Your Telegram Bot Token

## Step 1: Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Start a conversation with BotFather
3. Send the command: `/newbot`
4. Follow the prompts:
   - Choose a name for your bot (e.g., "Sports Alert Bot")
   - Choose a username for your bot (must end in 'bot', e.g., "mysportsalert_bot")
5. BotFather will give you a **token** - copy this for `TELEGRAM_BOT_TOKEN`

## Step 2: Get Your Chat ID

### Method 1: Using @userinfobot

1. Search for [@userinfobot](https://t.me/userinfobot) in Telegram
2. Start a conversation with it
3. It will send you your chat ID - copy this for `TELEGRAM_CHAT_ID`

### Method 2: Using Your Bot

1. Start a conversation with your newly created bot
2. Send any message to it
3. Open this URL in your browser (replace YOUR_BOT_TOKEN):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
4. Look for `"chat":{"id":123456789}` in the response
5. Copy the ID number for `TELEGRAM_CHAT_ID`

## Step 3: Configure Your Bot

Optional but recommended settings with BotFather:

```
/setdescription - Set bot description
/setabouttext - Set about text
/setuserpic - Set bot profile picture
```

## Step 4: For Group Chats

If you want to send alerts to a group:

1. Create a Telegram group
2. Add your bot to the group
3. Make the bot an admin (optional, but recommended)
4. Send a message in the group
5. Use Method 2 above to get the group chat ID (it will be negative, like -123456789)

## Example .env Configuration

```env
# Your bot token from BotFather
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Your chat ID (personal or group)
TELEGRAM_CHAT_ID=123456789

# For group chats, the ID will be negative
# TELEGRAM_CHAT_ID=-987654321
```

## Testing Your Setup

Once configured, you can test with:

```bash
npm start
```

You should receive a startup notification in your Telegram chat.

## Troubleshooting

### Bot not sending messages

- Verify the token is correct
- Make sure you've started a conversation with the bot (send /start)
- For groups, ensure the bot is a member and has permission to send messages

### Wrong chat ID

- The chat ID should be a number (positive for personal chats, negative for groups)
- No quotes around the number in .env
- Try Method 2 to verify your chat ID

### Bot sends but you don't receive

- Check your Telegram notification settings
- Verify you're not blocking the bot
- Try sending a message to the bot first

## Multiple Chat IDs

To send alerts to multiple chats, you can modify the code:

```javascript
// In src/index.js
const chatIds = [123456789, -987654321, 111222333];
await notifier.broadcast(alert, chatIds);
```
