/**
 * Project Friday - Cloud Functions Entry Point
 * Main entry point for Firebase Cloud Functions handling call processing,
 * AI interactions, and data persistence.
 */

import { onRequest, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineString, defineInt } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import TwilioService from './src/services/twilioService.js';
import GeminiService from './src/services/geminiService.js';
import FirestoreService from './src/services/firestoreService.js';
import logger from './src/utils/logger.js';

// Initialize Firebase Admin SDK
initializeApp();

// Runtime parameters
const twilioAccountSid = defineString('TWILIO_ACCOUNT_SID');
const twilioAuthToken = defineString('TWILIO_AUTH_TOKEN');
const twilioPhoneNumber = defineString('TWILIO_PHONE_NUMBER');
const geminiApiKey = defineString('GEMINI_API_KEY');
const maxCallDuration = defineInt('MAX_CALL_DURATION', { default: 900 }); // 15 minutes

// Initialize services
const twilioService = new TwilioService();
const geminiService = new GeminiService();
const firestoreService = new FirestoreService();

// Express app for webhook endpoints
const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Twilio-Signature']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * Main call handling webhook from Twilio
 * Handles incoming calls and initiates AI conversation
 */
app.post('/handleCall', async (req, res) => {
  try {
    logger.info('Incoming call webhook received', { body: req.body });

    // Validate Twilio signature for security
    const isValid = twilioService.validateSignature(
      req.headers['x-twilio-signature'],
      process.env.FUNCTIONS_EMULATOR ? 'http://localhost:5001' : req.protocol + '://' + req.get('host') + req.originalUrl,
      req.body
    );

    if (!isValid && !process.env.FUNCTIONS_EMULATOR) {
      logger.warn('Invalid Twilio signature', { headers: req.headers });
      return res.status(403).send('Forbidden');
    }

    const {
      CallSid,
      From,
      To,
      CallStatus,
      Direction,
      AccountSid
    } = req.body;

    // Create call record in Firestore
    const callData = {
      callSid: CallSid,
      from: From,
      to: To,
      direction: Direction,
      status: CallStatus,
      accountSid: AccountSid,
      createdAt: new Date(),
      updatedAt: new Date(),
      transcript: '',
      summary: '',
      duration: 0,
      aiResponses: []
    };

    await firestoreService.createCall(callData);

    // Generate TwiML response to handle the call
    const twimlResponse = twilioService.generateInitialTwiML(CallSid);

    res.type('text/xml');
    res.send(twimlResponse);

    logger.info('Call handling initiated', { callSid: CallSid, from: From });

  } catch (error) {
    logger.error('Error in handleCall webhook', error);
    
    // Return basic TwiML to prevent call failure
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">We're experiencing technical difficulties. Please try again later.</Say>
        <Hangup/>
      </Response>`;
    
    res.type('text/xml');
    res.status(500).send(errorTwiml);
  }
});

/**
 * Handle call status updates from Twilio
 */
app.post('/callStatus', async (req, res) => {
  try {
    logger.info('Call status update received', { body: req.body });

    const { CallSid, CallStatus, CallDuration } = req.body;

    if (CallSid) {
      await firestoreService.updateCallStatus(CallSid, {
        status: CallStatus,
        duration: parseInt(CallDuration) || 0,
        updatedAt: new Date()
      });

      // If call ended, trigger summarization
      if (CallStatus === 'completed' || CallStatus === 'failed') {
        await summarizeCall(CallSid);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error updating call status', error);
    res.status(500).send('Error');
  }
});

/**
 * Handle speech-to-text results and AI responses
 */
app.post('/processAudio', async (req, res) => {
  try {
    const { CallSid, SpeechResult, Confidence } = req.body;

    if (!SpeechResult || !CallSid) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    logger.info('Processing audio input', { 
      callSid: CallSid, 
      speechResult: SpeechResult,
      confidence: Confidence 
    });

    // Get current call context
    const callData = await firestoreService.getCall(CallSid);
    if (!callData) {
      logger.error('Call not found', { callSid: CallSid });
      return res.status(404).json({ error: 'Call not found' });
    }

    // Generate AI response using Gemini
    const aiResponse = await geminiService.generateResponse(
      SpeechResult,
      callData.transcript || '',
      callData.aiResponses || []
    );

    // Update call record with new transcript and AI response
    const updatedTranscript = `${callData.transcript}\nUser: ${SpeechResult}\nAI: ${aiResponse}`;
    
    await firestoreService.updateCall(CallSid, {
      transcript: updatedTranscript,
      aiResponses: [...(callData.aiResponses || []), {
        userInput: SpeechResult,
        aiResponse: aiResponse,
        timestamp: new Date(),
        confidence: parseFloat(Confidence) || 0
      }],
      updatedAt: new Date()
    });

    // Generate TwiML response with AI's answer
    const twimlResponse = twilioService.generateAIResponseTwiML(aiResponse, CallSid);

    res.type('text/xml');
    res.send(twimlResponse);

    logger.info('AI response generated', { 
      callSid: CallSid, 
      responseLength: aiResponse.length 
    });

  } catch (error) {
    logger.error('Error processing audio', error);
    
    const errorTwiml = twilioService.generateErrorTwiML();
    res.type('text/xml');
    res.status(500).send(errorTwiml);
  }
});

/**
 * Summarize call after completion
 */
async function summarizeCall(callSid) {
  try {
    const callData = await firestoreService.getCall(callSid);
    if (!callData || !callData.transcript) {
      return;
    }

    logger.info('Generating call summary', { callSid });

    const summary = await geminiService.generateSummary(
      callData.transcript,
      callData.aiResponses || []
    );

    await firestoreService.updateCall(callSid, {
      summary: summary,
      updatedAt: new Date()
    });

    // Send push notification if user has FCM token
    if (callData.userId) {
      await sendCallSummaryNotification(callData.userId, summary);
    }

    logger.info('Call summary generated', { callSid, summaryLength: summary.length });

  } catch (error) {
    logger.error('Error generating call summary', error);
  }
}

/**
 * Send push notification for call summary
 */
async function sendCallSummaryNotification(userId, summary) {
  try {
    // Implementation will be added when FCM integration is complete
    logger.info('Push notification placeholder', { userId, summaryPreview: summary.substring(0, 100) });
  } catch (error) {
    logger.error('Error sending push notification', error);
  }
}

/**
 * Callable function to get call history
 */
export const getCallHistory = onCall(async (request) => {
  try {
    const { auth, data } = request;
    
    if (!auth) {
      throw new Error('Unauthenticated');
    }

    const { userId, limit = 20, offset = 0 } = data;
    
    if (!userId || userId !== auth.uid) {
      throw new Error('Unauthorized');
    }

    const calls = await firestoreService.getUserCalls(userId, limit, offset);
    
    return {
      success: true,
      calls: calls,
      count: calls.length
    };

  } catch (error) {
    logger.error('Error getting call history', error);
    throw new Error(error.message);
  }
});

/**
 * Callable function to get specific call details
 */
export const getCallDetails = onCall(async (request) => {
  try {
    const { auth, data } = request;
    
    if (!auth) {
      throw new Error('Unauthenticated');
    }

    const { callSid } = data;
    
    if (!callSid) {
      throw new Error('Call ID is required');
    }

    const call = await firestoreService.getCall(callSid);
    
    if (!call) {
      throw new Error('Call not found');
    }

    // Verify user owns this call
    if (call.userId !== auth.uid) {
      throw new Error('Unauthorized');
    }

    return {
      success: true,
      call: call
    };

  } catch (error) {
    logger.error('Error getting call details', error);
    throw new Error(error.message);
  }
});

/**
 * Firestore trigger for new call notifications
 */
export const onNewCall = onDocumentCreated('calls/{callId}', async (event) => {
  try {
    const callData = event.data?.data();
    
    if (!callData) {
      return;
    }

    logger.info('New call created', { callSid: callData.callSid });

    // Additional processing for new calls can be added here
    // e.g., analytics, monitoring, etc.

  } catch (error) {
    logger.error('Error processing new call event', error);
  }
});

// Export the main webhook handler
export const webhooks = onRequest({
  timeoutSeconds: 540,
  memory: '1GiB',
  maxInstances: 100,
  cors: true
}, app);

export default app;