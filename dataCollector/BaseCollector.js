import WebSocket from 'ws';
import EventEmitter from 'events';
import { logger } from '../src/utils/logger.js';

/**
 * Base WebSocket Collector
 * Handles connection, reconnection, and message parsing
 * Optimized for low-latency real-time streaming
 */
export class BaseCollector extends EventEmitter {
  constructor(url, options = {}) {
    super();
    this.url = url;
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.reconnectDelay = options.reconnectDelay || 3000;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.heartbeatTimer = null;
    this.lastMessageTime = Date.now();
  }

  /**
   * Connect to WebSocket
   */
  connect() {
    try {
      logger.info(`Connecting to ${this.url}`);

      this.ws = new WebSocket(this.url, {
        perMessageDeflate: false, // Disable compression for lower latency
        handshakeTimeout: 10000,
      });

      this.ws.on('open', this.onOpen.bind(this));
      this.ws.on('message', this.onMessage.bind(this));
      this.ws.on('error', this.onError.bind(this));
      this.ws.on('close', this.onClose.bind(this));
      this.ws.on('ping', this.onPing.bind(this));
    } catch (error) {
      logger.error(`Connection error: ${error.message}`);
      this.handleReconnect();
    }
  }

  /**
   * Handle connection open
   */
  onOpen() {
    logger.info('WebSocket connected successfully');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.lastMessageTime = Date.now();
    this.startHeartbeat();
    this.emit('connected');
    this.subscribe();
  }

  /**
   * Handle incoming messages
   * Override in child classes for specific parsing
   */
  onMessage(data) {
    this.lastMessageTime = Date.now();

    try {
      const message = this.parseMessage(data);
      if (message) {
        this.emit('data', message);
      }
    } catch (error) {
      logger.error(`Message parsing error: ${error.message}`);
    }
  }

  /**
   * Parse message - override in child classes
   */
  parseMessage(data) {
    try {
      return JSON.parse(data.toString());
    } catch (error) {
      logger.warn('Failed to parse message as JSON');
      return null;
    }
  }

  /**
   * Handle errors
   */
  onError(error) {
    logger.error(`WebSocket error: ${error.message}`);
    this.emit('error', error);
  }

  /**
   * Handle connection close
   */
  onClose(code, reason) {
    logger.warn(`WebSocket closed: ${code} - ${reason}`);
    this.isConnected = false;
    this.stopHeartbeat();
    this.emit('disconnected');
    this.handleReconnect();
  }

  /**
   * Handle ping
   */
  onPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.pong();
    }
  }

  /**
   * Subscribe to events - override in child classes
   */
  subscribe() {
    // Override in child classes
    logger.info('Subscription method should be overridden');
  }

  /**
   * Send message to WebSocket
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      logger.warn('Cannot send message: WebSocket not open');
    }
  }

  /**
   * Start heartbeat to detect connection issues
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;

      if (timeSinceLastMessage > this.heartbeatInterval * 2) {
        logger.warn('No messages received, connection may be dead');
        this.reconnect();
      }
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Handle reconnection logic
   */
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      this.emit('maxReconnectReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  /**
   * Reconnect
   */
  reconnect() {
    this.disconnect();
    this.connect();
  }

  /**
   * Disconnect
   */
  disconnect() {
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.isConnected = false;
  }
}
