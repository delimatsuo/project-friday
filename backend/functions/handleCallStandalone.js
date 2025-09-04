/**
 * Standalone handleCall Cloud Function
 * Simple CommonJS function for Twilio webhook
 */

const functions = require('firebase-functions');
const twilio = require('twilio');

/**
 * Handle incoming voice calls from Twilio
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