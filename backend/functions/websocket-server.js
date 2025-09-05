/**
 * Standalone WebSocket server for Twilio Media Streams
 * This can be deployed separately from Cloud Functions for better WebSocket support
 */

const http = require('http');
const express = require('express');
const StreamHandler = require('./src/handlers/streamHandler');

const app = express();
const server = http.createServer(app);
const streamHandler = new StreamHandler();

// Initialize WebSocket handler
streamHandler.initialize(server);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    activeConnections: streamHandler.getActiveConnections(),
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Project Friday WebSocket Server for Twilio Media Streams');
});

// Start server
const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/media-stream`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = server;