/**
 * WebSocket URL Extractor
 * Run this in the browser console while on a bookmaker website
 * It will automatically detect and log WebSocket connections
 */

// Copy this entire script and paste it into the browser console
// when you're on Bet365, SofaScore, or any bookmaker website

(function () {
  console.clear();
  console.log(
    '%c🔍 WebSocket URL Monitor Started',
    'color: #00ff00; font-size: 16px; font-weight: bold'
  );
  console.log('%c' + '='.repeat(80), 'color: #00ff00');
  console.log('\n');

  const connections = new Map();
  const originalWebSocket = window.WebSocket;

  // Intercept all WebSocket connections
  window.WebSocket = function (...args) {
    const url = args[0];
    const ws = new originalWebSocket(...args);

    if (!connections.has(url)) {
      connections.set(url, {
        created: new Date(),
        messages: 0,
        lastMessage: null,
      });

      console.log(
        '%c✅ NEW WEBSOCKET CONNECTION DETECTED!',
        'color: #00ff00; font-size: 14px; font-weight: bold'
      );
      console.log('%cURL:', 'color: #ffff00; font-weight: bold', url);
      console.log('\n%c📋 Copy this line to your .env file:', 'color: #00ffff');

      // Detect the type of websocket
      if (url.includes('bet365') || url.includes('365')) {
        console.log(`%cBET365_WS_URL=${url}`, 'color: #00ff00; background: #000; padding: 5px');
      } else if (url.includes('sofascore')) {
        console.log(`%cSOFASCORE_WS_URL=${url}`, 'color: #00ff00; background: #000; padding: 5px');
      } else if (url.includes('bwin')) {
        console.log(`%cBWIN_WS_URL=${url}`, 'color: #00ff00; background: #000; padding: 5px');
      } else {
        console.log(`%cWEBSOCKET_URL=${url}`, 'color: #00ff00; background: #000; padding: 5px');
      }

      console.log('\n%c' + '='.repeat(80), 'color: #00ff00');
      console.log('\n');

      // Monitor messages
      ws.addEventListener('open', () => {
        console.log(`%c🟢 WebSocket CONNECTED: ${url.substring(0, 50)}...`, 'color: #00ff00');
      });

      ws.addEventListener('message', event => {
        const info = connections.get(url);
        info.messages++;
        info.lastMessage = new Date();

        console.groupCollapsed(
          `%c📨 Message #${info.messages} from ${url.substring(0, 40)}...`,
          'color: #00ffff'
        );

        // Try to parse and display message
        try {
          const data = event.data;
          if (typeof data === 'string') {
            if (data.length > 200) {
              console.log('Data (truncated):', data.substring(0, 200) + '...');
            } else {
              console.log('Data:', data);
            }

            // Try to parse as JSON
            try {
              const json = JSON.parse(data);
              console.log('Parsed JSON:', json);
            } catch {
              // Not JSON, that's ok
            }
          } else {
            console.log('Binary data, length:', data.length || data.byteLength);
          }
        } catch (err) {
          console.log('Could not display message:', err.message);
        }

        console.groupEnd();
      });

      ws.addEventListener('close', event => {
        console.log(`%c🔴 WebSocket CLOSED: ${url.substring(0, 50)}...`, 'color: #ff0000');
        console.log('Close code:', event.code, 'Reason:', event.reason || 'No reason');
      });

      ws.addEventListener('error', error => {
        console.error('❌ WebSocket ERROR:', url, error);
      });
    }

    return ws;
  };

  // Copy constructor properties
  Object.setPrototypeOf(window.WebSocket, originalWebSocket);
  window.WebSocket.prototype = originalWebSocket.prototype;

  // Check for existing WebSocket connections in performance API
  setTimeout(() => {
    console.log('%c🔍 Checking for existing connections...', 'color: #ffff00');

    const resources = performance.getEntriesByType('resource');
    const wsResources = resources.filter(
      r => r.name.includes('ws://') || r.name.includes('wss://')
    );

    if (wsResources.length > 0) {
      console.log('%c✅ Found existing WebSocket resources:', 'color: #00ff00');
      wsResources.forEach((ws, i) => {
        console.log(`${i + 1}. ${ws.name}`);
      });
    } else {
      console.log('%c⚠️ No existing connections found.', 'color: #ffaa00');
      console.log('%cTry:', 'color: #ffaa00');
      console.log('  1. Navigate to a LIVE match');
      console.log('  2. Or refresh the page');
      console.log('  3. WebSocket URLs will appear above');
    }

    console.log(
      '\n%c✅ Monitor is active and running!',
      'color: #00ff00; font-size: 14px; font-weight: bold'
    );
    console.log('%cAll WebSocket connections will be logged automatically.', 'color: #ffff00');
  }, 1000);

  // Add a global function to show status
  window.showWebSocketStatus = function () {
    console.log(
      '\n%c📊 WebSocket Connection Status',
      'color: #00ffff; font-size: 14px; font-weight: bold'
    );
    console.log('%c' + '='.repeat(80), 'color: #00ffff');

    if (connections.size === 0) {
      console.log('%c⚠️ No WebSocket connections detected yet', 'color: #ffaa00');
    } else {
      connections.forEach((info, url) => {
        console.log('\n%cURL:', 'color: #00ff00', url);
        console.log('  Created:', info.created.toLocaleTimeString());
        console.log('  Messages:', info.messages);
        console.log(
          '  Last message:',
          info.lastMessage ? info.lastMessage.toLocaleTimeString() : 'None'
        );
      });
    }

    console.log('\n%c' + '='.repeat(80), 'color: #00ffff');
  };

  console.log(
    '%c💡 Tip: Type showWebSocketStatus() to see connection status anytime',
    'color: #ffff00'
  );
  console.log('\n');
})();
