import { BwinCollector, SofaScoreCollector } from '../dataCollector/index.js';
import { EventProcessor } from '../eventProcessor/index.js';
import { TelegramNotifier } from '../notificationDispatcher/index.js';
import { logger, config, perfMonitor } from './utils/index.js';

/**
 * Main Application Class
 * Orchestrates the entire real-time sports data pipeline
 */
class SportsDataPipeline {
  constructor() {
    this.collectors = [];
    this.processor = null;
    this.notifier = null;
    this.isRunning = false;
    this.stats = {
      eventsProcessed: 0,
      alertsSent: 0,
      errors: 0,
      startTime: null,
    };
  }

  /**
   * Initialize the pipeline
   */
  async initialize() {
    logger.info('🚀 Initializing Real-time Sports Data Pipeline');
    config.logConfig();

    try {
      // Initialize Event Processor
      this.processor = new EventProcessor({
        cacheTimeout: 5000,
        enabledEvents: {
          goals: config.enableGoals,
          redCards: config.enableRedCards,
          yellowCards: config.enableYellowCards,
        },
      });

      // Initialize Telegram Notifier
      this.notifier = new TelegramNotifier(config.telegramBotToken, {
        chatId: config.telegramChatId,
        retryAttempts: 3,
        retryDelay: 1000,
      });

      await this.notifier.initialize();

      // Initialize Data Collectors
      await this.initializeCollectors();

      // Setup event listeners
      this.setupEventListeners();

      logger.info('✅ Pipeline initialized successfully');
      return true;
    } catch (error) {
      logger.error(`❌ Failed to initialize pipeline: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Initialize data collectors
   */
  async initializeCollectors() {
    // Initialize Bwin Collector (if URL is configured)
    if (config.bwinWsUrl && config.bwinWsUrl !== 'wss://websocket.bwin.com/feed') {
      const bwinCollector = new BwinCollector(config.bwinWsUrl, {
        reconnectDelay: config.reconnectDelay,
        maxReconnectAttempts: config.maxReconnectAttempts,
        heartbeatInterval: config.heartbeatInterval,
        subscriptions: ['live.football'],
      });

      this.collectors.push({
        name: 'Bwin',
        collector: bwinCollector,
      });

      logger.info('📡 Bwin collector initialized');
    }

    // Initialize SofaScore Collector (if URL is configured)
    if (config.sofascoreWsUrl && config.sofascoreWsUrl !== 'wss://www.sofascore.com/u') {
      const sofascoreCollector = new SofaScoreCollector(config.sofascoreWsUrl, {
        reconnectDelay: config.reconnectDelay,
        maxReconnectAttempts: config.maxReconnectAttempts,
        heartbeatInterval: config.heartbeatInterval,
        matchIds: [],
      });

      this.collectors.push({
        name: 'SofaScore',
        collector: sofascoreCollector,
      });

      logger.info('📡 SofaScore collector initialized');
    }

    if (this.collectors.length === 0) {
      logger.warn('⚠️ No collectors initialized. Please configure WebSocket URLs in .env');
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen to data from collectors
    this.collectors.forEach(({ name, collector }) => {
      collector.on('data', async event => {
        perfMonitor.start('event_processing');
        
        try {
          await this.processor.process(event);
          this.stats.eventsProcessed++;
        } catch (error) {
          logger.error(`Error processing event from ${name}: ${error.message}`);
          this.stats.errors++;
        }
        
        perfMonitor.end('event_processing');
      });

      collector.on('connected', () => {
        logger.info(`✅ ${name} collector connected`);
      });

      collector.on('disconnected', () => {
        logger.warn(`⚠️ ${name} collector disconnected`);
      });

      collector.on('error', error => {
        logger.error(`❌ ${name} collector error: ${error.message}`);
        this.stats.errors++;
      });

      collector.on('maxReconnectReached', () => {
        logger.error(`❌ ${name} collector reached max reconnect attempts`);
      });
    });

    // Listen to alerts from processor
    this.processor.on('alert', async alert => {
      perfMonitor.start('alert_delivery');
      
      try {
        await this.notifier.sendAlert(alert);
        this.stats.alertsSent++;
        logger.info(`📤 Alert sent: ${alert.type}`);
      } catch (error) {
        logger.error(`Failed to send alert: ${error.message}`);
        this.stats.errors++;
      }
      
      perfMonitor.end('alert_delivery');
    });

    // Setup periodic stats logging
    setInterval(() => {
      this.logStats();
    }, 60000); // Every minute
  }

  /**
   * Start the pipeline
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Pipeline is already running');
      return;
    }

    logger.info('▶️ Starting pipeline...');
    this.stats.startTime = Date.now();
    this.isRunning = true;

    // Connect all collectors
    this.collectors.forEach(({ name, collector }) => {
      try {
        collector.connect();
        logger.info(`📡 ${name} collector connecting...`);
      } catch (error) {
        logger.error(`Failed to connect ${name} collector: ${error.message}`);
      }
    });

    // Send startup notification
    try {
      await this.notifier.sendAlert({
        type: 'system',
        severity: 'info',
        timestamp: Date.now(),
        message: '🚀 Sports Data Pipeline Started\n\n✅ System is online and monitoring live matches',
        data: {
          collectors: this.collectors.map(c => c.name),
          enabledAlerts: {
            goals: config.enableGoals,
            redCards: config.enableRedCards,
            yellowCards: config.enableYellowCards,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to send startup notification');
    }

    logger.info('✅ Pipeline started successfully');
  }

  /**
   * Stop the pipeline
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('Pipeline is not running');
      return;
    }

    logger.info('⏹️ Stopping pipeline...');
    this.isRunning = false;

    // Disconnect all collectors
    this.collectors.forEach(({ name, collector }) => {
      try {
        collector.disconnect();
        logger.info(`📡 ${name} collector disconnected`);
      } catch (error) {
        logger.error(`Error disconnecting ${name} collector: ${error.message}`);
      }
    });

    // Stop notifier
    if (this.notifier) {
      this.notifier.stop();
    }

    // Send shutdown notification
    try {
      await this.notifier.sendAlert({
        type: 'system',
        severity: 'info',
        timestamp: Date.now(),
        message: '⏹️ Sports Data Pipeline Stopped\n\n📊 Final Statistics:\n' +
                 `Events Processed: ${this.stats.eventsProcessed}\n` +
                 `Alerts Sent: ${this.stats.alertsSent}\n` +
                 `Errors: ${this.stats.errors}`,
        data: this.stats,
      });
    } catch (error) {
      logger.error('Failed to send shutdown notification');
    }

    logger.info('✅ Pipeline stopped');
  }

  /**
   * Log statistics
   */
  logStats() {
    const uptime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
    const uptimeMinutes = Math.floor(uptime / 60000);

    logger.info('📊 Pipeline Statistics', {
      uptime: `${uptimeMinutes} minutes`,
      eventsProcessed: this.stats.eventsProcessed,
      alertsSent: this.stats.alertsSent,
      errors: this.stats.errors,
      performance: perfMonitor.getAllMetrics(),
    });
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      stats: this.stats,
      collectors: this.collectors.map(({ name, collector }) => ({
        name,
        connected: collector.isConnected,
      })),
      performance: perfMonitor.getAllMetrics(),
    };
  }
}

/**
 * Main function
 */
async function main() {
  const pipeline = new SportsDataPipeline();

  try {
    // Initialize pipeline
    await pipeline.initialize();

    // Start pipeline
    await pipeline.start();

    // Handle graceful shutdown
    const shutdown = async signal => {
      logger.info(`\n${signal} received. Shutting down gracefully...`);
      await pipeline.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Keep process alive
    logger.info('📡 Pipeline is running. Press Ctrl+C to stop.');

  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the application
main();

export { SportsDataPipeline };
