// Health Check Endpoint for Render/Fly.io
import http from 'http';

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      service: 'realtime-sports-scraper',
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

// Now start the actual scraper
import('../examples/test-end-to-end.js');
