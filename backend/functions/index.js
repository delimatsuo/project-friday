/**
 * Project Friday Cloud Functions
 * Main entry point for all Firebase Functions
 */

const functions = require('firebase-functions');
const twilio = require('twilio');

// Import streaming handlers
const streamingHandlers = require('./src/handlers/twilioStreamHandler');

/**
 * Handle incoming voice calls from Twilio - Basic version
 * This is the original simple handler without streaming
 */
exports.handleCall = functions.https.onRequest(async (req, res) => {
  console.log('Incoming call webhook received:', req.body);
  
  // Create TwiML response
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  
  // Add greeting message
  response.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Hello from Project Friday. Your AI assistant is being configured.');
  
  response.pause({ length: 1 });
  
  response.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Thank you for calling. Goodbye!');
  
  response.hangup();
  
  // Send TwiML response
  res.set('Content-Type', 'text/xml');
  res.status(200).send(response.toString());
});

/**
 * Handle incoming voice calls with WebSocket streaming
 * This version supports real-time STT and TTS
 */
exports.handleCallWithStream = streamingHandlers.handleCallWithStream;

/**
 * Handle incoming voice calls with custom WebSocket URL
 * Useful for development and testing with ngrok
 */
exports.handleCallWithCustomStream = streamingHandlers.handleCallWithCustomStream;

/**
 * Health check endpoint for monitoring
 */
exports.healthCheck = streamingHandlers.healthCheck;