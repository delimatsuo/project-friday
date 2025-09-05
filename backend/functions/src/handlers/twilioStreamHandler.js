const functions = require('firebase-functions');
const twilio = require('twilio');
const http = require('http');
const StreamHandler = require('./streamHandler');

// Initialize stream handler
const streamHandler = new StreamHandler();
let server = null;
let isInitialized = false;

/**
 * Initialize HTTP server with WebSocket support
 */
function initializeServer() {
  if (!isInitialized) {
    // Create a simple HTTP server for WebSocket
    server = http.createServer((req, res) => {
      res.writeHead(200);
      res.end('WebSocket server for Twilio streaming');
    });

    // Initialize WebSocket handler
    streamHandler.initialize(server);
    
    // Start listening on a port
    const port = process.env.WS_PORT || 8081;
    server.listen(port, () => {
      console.log(`WebSocket server listening on port ${port}`);
    });

    isInitialized = true;
  }
}

/**
 * Handle incoming call webhook from Twilio
 * This function returns TwiML to connect the call to our WebSocket stream
 */
exports.handleCallWithStream = functions.https.onRequest(async (req, res) => {
  console.log('Received call webhook from Twilio');
  console.log('Request body:', req.body);

  // Initialize server if not already done
  initializeServer();

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Initial greeting
  response.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Connecting you to Project Friday AI assistant. One moment please.');

  // Connect to WebSocket stream
  const connect = response.connect();
  
  // Get the WebSocket URL for this Cloud Function
  // In production, this should be your deployed function's WebSocket endpoint
  const wsUrl = process.env.WEBSOCKET_URL || 
    `wss://${req.get('host')}/media-stream`;

  const stream = connect.stream({
    url: wsUrl,
    track: 'both_tracks', // Get both inbound and outbound audio
  });

  console.log('TwiML Response:', response.toString());

  // Send TwiML response
  res.set('Content-Type', 'text/xml');
  res.status(200).send(response.toString());
});

/**
 * Health check endpoint
 */
exports.healthCheck = functions.https.onRequest((req, res) => {
  res.json({
    status: 'healthy',
    activeConnections: streamHandler.getActiveConnections(),
    websocketInitialized: isInitialized,
  });
});

/**
 * Alternative implementation for testing with ngrok or local development
 * Returns TwiML that points to a specific WebSocket URL
 */
exports.handleCallWithCustomStream = functions.https.onRequest(async (req, res) => {
  console.log('Received call webhook (custom stream)');
  
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  response.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Connecting you to Project Friday AI assistant.');

  const connect = response.connect();
  
  // Use environment variable for WebSocket URL
  // This allows testing with ngrok or other tunneling services
  const wsUrl = req.query.wsUrl || 
    process.env.CUSTOM_WEBSOCKET_URL || 
    'wss://your-websocket-server.ngrok.io/media-stream';

  const stream = connect.stream({
    url: wsUrl,
    track: 'both_tracks',
  });

  console.log('Streaming to:', wsUrl);

  res.set('Content-Type', 'text/xml');
  res.status(200).send(response.toString());
});