/**
 * Simple Twilio Webhook Handler for Project Friday
 * Task 3: Basic Cloud Function to handle Twilio voice webhooks
 * 
 * This is a simplified version for initial testing and deployment
 */

import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';

// Express app for webhook endpoints
const app = express();

// Basic middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Twilio-Signature']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'Project Friday Cloud Function is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * Simple handleCall webhook - responds with basic TwiML message
 * This is the main webhook endpoint that Twilio will call: 
 * https://us-central1-project-friday-471118.cloudfunctions.net/handleCall
 */
app.post('/handleCall', (req, res) => {
  try {
    console.log('Incoming call webhook received:', JSON.stringify(req.body, null, 2));

    const {
      CallSid,
      From,
      To,
      CallStatus,
      Direction,
      AccountSid
    } = req.body;

    console.log('Call details:', {
      CallSid,
      From,
      To,
      CallStatus,
      Direction,
      AccountSid
    });

    // Generate simple TwiML response as specified in task requirements
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Hello from Project Friday. Your AI assistant is being configured.</Say>
  <Pause length="1"/>
  <Say voice="alice" language="en-US">Thank you for calling. Goodbye!</Say>
  <Hangup/>
</Response>`;

    console.log('Sending TwiML response for call:', CallSid);

    res.type('text/xml');
    res.send(twimlResponse);

  } catch (error) {
    console.error('Error in handleCall webhook:', error);
    
    // Return basic error TwiML to prevent call failure
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We're experiencing technical difficulties. Please try again later.</Say>
  <Hangup/>
</Response>`;
    
    res.type('text/xml');
    res.status(500).send(errorTwiml);
  }
});

// Additional webhook endpoints for Twilio status callbacks
app.post('/callStatus', (req, res) => {
  try {
    console.log('Call status update received:', JSON.stringify(req.body, null, 2));
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error in call status webhook:', error);
    res.status(500).send('Error');
  }
});

// Export the Cloud Function
export const handleCall = onRequest({
  timeoutSeconds: 60,
  memory: '256MiB',
  maxInstances: 10,
  cors: true
}, app);

export default app;