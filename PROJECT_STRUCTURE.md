# 📁 Project Structure

```
realtime-sports-scraper/
│
├── 📄 Configuration Files
│   ├── package.json                  # Dependencies and scripts
│   ├── .env.example                  # Environment variables template
│   ├── .gitignore                    # Git ignore rules
│   ├── .gitattributes                # Git attributes
│   ├── .eslintrc.json                # ESLint configuration
│   ├── .prettierrc.json              # Prettier configuration
│   ├── Dockerfile                    # Docker image definition
│   └── docker-compose.yml            # Docker Compose setup
│
├── 📚 Documentation
│   ├── README.md                     # Main project documentation
│   ├── QUICKSTART.md                 # 5-minute setup guide
│   ├── TELEGRAM_SETUP.md             # Telegram bot setup guide
│   ├── CHANGELOG.md                  # Version history
│   └── LICENSE                       # MIT License
│
├── 📡 dataCollector/                 # WebSocket data collection
│   ├── BaseCollector.js              # Base WebSocket class
│   │                                 # - Auto-reconnection
│   │                                 # - Heartbeat monitoring
│   │                                 # - Error handling
│   ├── BwinCollector.js              # Bwin integration
│   │                                 # - Message parsing
│   │                                 # - Event normalization
│   ├── SofaScoreCollector.js         # SofaScore integration
│   │                                 # - Incident handling
│   │                                 # - Match subscription
│   └── index.js                      # Module exports
│
├── 🧠 eventProcessor/                # Event processing engine
│   ├── EventProcessor.js             # Main processing logic
│   │                                 # - Event validation
│   │                                 # - Deduplication
│   │                                 # - Alert generation
│   │                                 # - Rule execution
│   ├── rules.js                      # Default alert rules
│   │                                 # - Early goal detection
│   │                                 # - Late goal detection
│   │                                 # - Hat-trick detection
│   │                                 # - Card storm detection
│   └── index.js                      # Module exports
│
├── 📱 notificationDispatcher/        # Telegram notifications
│   ├── TelegramNotifier.js           # Telegram bot integration
│   │                                 # - Message formatting
│   │                                 # - Retry logic
│   │                                 # - Broadcast support
│   │                                 # - HTML formatting
│   └── index.js                      # Module exports
│
├── 🔧 src/                           # Main application
│   ├── index.js                      # Application entry point
│   │                                 # - Pipeline orchestration
│   │                                 # - Component integration
│   │                                 # - Lifecycle management
│   └── utils/                        # Shared utilities
│       ├── logger.js                 # Pino logging system
│       ├── config.js                 # Configuration manager
│       ├── performance.js            # Performance monitoring
│       ├── validation.js             # Input validation
│       └── index.js                  # Utility exports
│
├── 📖 examples/                      # Example code & tests
│   ├── test-setup.js                 # Setup verification tests
│   │                                 # - Telegram connection test
│   │                                 # - Event processing test
│   │                                 # - Full pipeline test
│   ├── custom-collector.js           # Custom data source example
│   │                                 # - Template for new sources
│   │                                 # - Integration patterns
│   └── advanced-rules.js             # Advanced alert rules
│                                     # - Momentum detection
│                                     # - Comeback tracking
│                                     # - Red card impact
│                                     # - Critical moments
│
└── 🚀 deployment/                    # Deployment configurations
    ├── DEPLOYMENT.md                 # Deployment guide
    │                                 # - Local setup
    │                                 # - Docker deployment
    │                                 # - Cloud platforms
    │                                 # - Performance tuning
    ├── API.md                        # API documentation
    │                                 # - Class references
    │                                 # - Event formats
    │                                 # - Usage examples
    └── fly.toml                      # Fly.io configuration

```

## 📊 Component Overview

### Data Flow

```
WebSocket Source → Data Collector → Event Processor → Telegram Notifier → End User
     (Bwin)           (Parse)         (Rules)          (Format)         (Alert)
  (SofaScore)        (Normalize)    (Deduplicate)      (Send)
```

### Module Responsibilities

| Module | Purpose | Key Features |
|--------|---------|--------------|
| **DataCollector** | WebSocket management | Auto-reconnect, heartbeat, parsing |
| **EventProcessor** | Business logic | Rules engine, deduplication, alerts |
| **TelegramNotifier** | Message delivery | Formatting, retry, broadcast |
| **Utils** | Shared functionality | Logging, config, validation |

### File Statistics

```
Total Files: 30+
Code Files: 15 JavaScript modules
Documentation: 7 markdown files
Configuration: 8 config files
```

## 🎯 Key Features by File

### BaseCollector.js (220 lines)
- WebSocket connection management
- Automatic reconnection with exponential backoff
- Heartbeat monitoring
- Event emission system
- Configurable timeouts

### EventProcessor.js (200+ lines)
- Event validation
- Smart caching for deduplication
- Alert generation
- Custom rule support
- Performance tracking

### TelegramNotifier.js (200+ lines)
- HTML message formatting
- Automatic retry logic
- Broadcast to multiple chats
- Photo and document support
- Error handling

### index.js (200+ lines)
- Full pipeline orchestration
- Component lifecycle management
- Graceful shutdown
- Statistics logging
- Error recovery

## 🔄 Development Workflow

```
1. npm install          → Install dependencies
2. cp .env.example .env → Configure environment
3. npm test             → Verify setup
4. npm start            → Run pipeline
5. npm run dev          → Development mode
```

## 📦 Dependencies

### Production
- **ws** (8.16.0) - WebSocket client
- **node-telegram-bot-api** (0.64.0) - Telegram integration
- **dotenv** (16.4.5) - Environment variables
- **pino** (8.19.0) - High-performance logging
- **pino-pretty** (10.3.1) - Pretty logging for dev

### Development
- **eslint** (8.57.0) - Code linting
- **prettier** (3.2.5) - Code formatting

## 🚀 Quick Commands

```bash
npm start              # Start production
npm run dev            # Start with auto-reload
npm test               # Run setup tests
npm run lint           # Check code quality
npm run format         # Format code
```

## 📈 Performance Targets

- **Event Processing**: < 50ms
- **Telegram Delivery**: < 200ms
- **WebSocket Reconnect**: < 3s
- **Memory Usage**: < 100MB
- **CPU Usage**: < 5%

## 🛡️ Error Handling

Every module includes:
- Try-catch blocks
- Graceful degradation
- Automatic recovery
- Detailed error logging
- User notifications

## 🧪 Testing Coverage

- ✅ Telegram connection
- ✅ Event processing
- ✅ Alert generation
- ✅ Message formatting
- ✅ Full pipeline flow

## 📝 Code Quality

- ESLint for linting
- Prettier for formatting
- JSDoc comments
- Consistent naming
- Modular architecture

---

**Everything you need to build, deploy, and scale a real-time sports data pipeline!**
