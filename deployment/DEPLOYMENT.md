# Deployment Guide

## Quick Start

### Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Run the application**
   ```bash
   npm start
   # or for development with auto-reload
   npm run dev
   ```

## Docker Deployment

### Build and run with Docker

```bash
# Build the image
docker build -t sports-scraper .

# Run the container
docker run -d \
  --name sports-scraper \
  --env-file .env \
  sports-scraper
```

### Using Docker Compose

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

## Cloud Deployment

### Fly.io (Recommended for low latency)

1. **Install Fly CLI**
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   
   # Linux/Mac
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly.io**
   ```bash
   fly auth login
   ```

3. **Deploy the application**
   ```bash
   fly launch --config deployment/fly.toml
   
   # Set secrets
   fly secrets set TELEGRAM_BOT_TOKEN=your_token
   fly secrets set TELEGRAM_CHAT_ID=your_chat_id
   fly secrets set BWIN_WS_URL=your_websocket_url
   
   # Deploy
   fly deploy
   ```

4. **Monitor the application**
   ```bash
   # View logs
   fly logs
   
   # Check status
   fly status
   
   # Open dashboard
   fly dashboard
   ```

### Hetzner Cloud

1. **Create a server**
   - Choose Ubuntu 22.04 LTS
   - Minimum: CX11 (2GB RAM)
   - Recommended: CX21 (4GB RAM)

2. **SSH into server**
   ```bash
   ssh root@your-server-ip
   ```

3. **Install Docker**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

4. **Clone and deploy**
   ```bash
   git clone https://github.com/yourusername/realtime-sports-scraper.git
   cd realtime-sports-scraper
   cp .env.example .env
   nano .env  # Edit configuration
   docker-compose up -d
   ```

### DigitalOcean

1. **Create a Droplet**
   - Ubuntu 22.04 LTS
   - Basic plan: $6/month (1GB RAM)
   - Choose region closest to your users

2. **Deploy using Docker**
   ```bash
   # Follow same steps as Hetzner Cloud
   ```

### Heroku

```bash
# Login
heroku login

# Create app
heroku create realtime-sports-scraper

# Set environment variables
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set TELEGRAM_CHAT_ID=your_chat_id

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

## Performance Optimization

### For lowest latency:

1. **Choose the right region**
   - Deploy close to data source (EU for Bwin/SofaScore)
   - Frankfurt or Amsterdam for EU
   - Virginia for US East

2. **Optimize settings**
   ```env
   # In .env
   RECONNECT_DELAY=2000
   HEARTBEAT_INTERVAL=20000
   ```

3. **Enable only needed alerts**
   ```env
   ENABLE_GOALS=true
   ENABLE_RED_CARDS=true
   ENABLE_YELLOW_CARDS=false  # Disable if not needed
   ```

## Monitoring

### View logs

```bash
# Docker
docker logs -f sports-scraper

# Docker Compose
docker-compose logs -f

# Fly.io
fly logs
```

### Health checks

The application logs statistics every minute:
- Events processed
- Alerts sent
- Errors
- Performance metrics

## Troubleshooting

### WebSocket connection issues

1. Check if WebSocket URL is correct
2. Verify firewall allows outbound WebSocket connections
3. Check logs for connection errors

### Telegram not sending messages

1. Verify bot token is correct
2. Check if bot is not blocked
3. Verify chat ID is correct
4. Check Telegram API rate limits

### High latency

1. Deploy closer to data source
2. Reduce reconnection delays
3. Optimize event processing rules
4. Check network latency

## Scaling

### Horizontal scaling

For multiple data sources, run separate instances:

```bash
# Instance 1: Bwin
docker run -d --env SOFASCORE_WS_URL="" sports-scraper

# Instance 2: SofaScore
docker run -d --env BWIN_WS_URL="" sports-scraper
```

### Load balancing

Use multiple Telegram chat IDs to distribute load:

```javascript
// In src/index.js, modify broadcast logic
const chatIds = [CHAT_ID_1, CHAT_ID_2, CHAT_ID_3];
await notifier.broadcast(alert, chatIds);
```
