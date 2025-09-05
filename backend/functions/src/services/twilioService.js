/**
 * Twilio Service
 * Handles Twilio API integration for call management and TwiML generation
 */

import twilio from 'twilio';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import ErrorHandler from './errorHandler.js';
import EnhancedLogger from './enhancedLogger.js';

class TwilioService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    
    // Initialize error handling
    this.errorHandler = new ErrorHandler();
    this.enhancedLogger = new EnhancedLogger();
    
    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
    } else {
      logger.warn('Twilio credentials not configured');
    }
  }

  /**
   * Validate Twilio webhook signature for security
   */
  validateSignature(signature, url, body) {
    try {
      if (!this.authToken) {
        logger.warn('Cannot validate signature - auth token not configured');
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha1', this.authToken)
        .update(url + JSON.stringify(body))
        .digest('base64');

      return signature === `sha1=${expectedSignature}`;
    } catch (error) {
      logger.error('Error validating Twilio signature', error);
      return false;
    }
  }

  /**
   * Generate initial TwiML response for incoming calls
   */
  generateInitialTwiML(callSid) {
    const welcomeMessage = "Hello! I'm Friday, your AI assistant. How can I help you today?";
    
    return `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice" language="en-US">${welcomeMessage}</Say>
        <Gather 
          input="speech" 
          action="/processAudio" 
          method="POST"
          speechTimeout="3"
          speechModel="experimental_conversations"
          enhanced="true"
          partialResultCallback="/partialResults"
        >
          <Say voice="alice">Please speak your question or request.</Say>
        </Gather>
        <Redirect>/handleTimeout</Redirect>
      </Response>`;
  }

  /**
   * Generate TwiML response with AI's answer
   */
  generateAIResponseTwiML(aiResponse, callSid) {
    // Clean AI response for speech synthesis
    const cleanResponse = this.sanitizeTextForSpeech(aiResponse);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice" language="en-US">${cleanResponse}</Say>
        <Gather 
          input="speech" 
          action="/processAudio" 
          method="POST"
          speechTimeout="5"
          speechModel="experimental_conversations"
          enhanced="true"
          partialResultCallback="/partialResults"
        >
          <Say voice="alice">Is there anything else I can help you with?</Say>
        </Gather>
        <Redirect>/handleTimeout</Redirect>
      </Response>`;
  }

  /**
   * Generate TwiML for handling timeouts
   */
  generateTimeoutTwiML() {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">I didn't hear anything. Let me try again.</Say>
        <Gather 
          input="speech" 
          action="/processAudio" 
          method="POST"
          speechTimeout="3"
          speechModel="experimental_conversations"
          enhanced="true"
        >
          <Say voice="alice">Please speak your question.</Say>
        </Gather>
        <Say voice="alice">Thank you for calling. Goodbye!</Say>
        <Hangup/>
      </Response>`;
  }

  /**
   * Generate TwiML for errors
   */
  generateErrorTwiML() {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">I'm sorry, I'm having trouble understanding right now. Please try again later.</Say>
        <Hangup/>
      </Response>`;
  }

  /**
   * Generate TwiML for call ending
   */
  generateEndCallTwiML(message = "Thank you for calling. Have a great day!") {
    const cleanMessage = this.sanitizeTextForSpeech(message);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">${cleanMessage}</Say>
        <Hangup/>
      </Response>`;
  }

  /**
   * Sanitize text for speech synthesis
   */
  sanitizeTextForSpeech(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Make outbound call with error handling and retry logic
   */
  async makeCall(to, webhookUrl, statusCallback) {
    return await this.errorHandler.executeWithCircuitBreaker('twilio', async () => {
      return await this.errorHandler.executeWithRetry(async () => {
        if (!this.client) {
          throw new Error('Twilio client not initialized');
        }

        const call = await this.client.calls.create({
          to: to,
          from: this.phoneNumber,
          url: webhookUrl,
          statusCallback: statusCallback,
          statusCallbackMethod: 'POST',
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          record: true,
          recordingStatusCallback: '/recordingStatus',
          recordingStatusCallbackMethod: 'POST'
        });

        logger.info('Outbound call initiated', { 
          callSid: call.sid, 
          to: to,
          from: this.phoneNumber 
        });

        return call;
      }, { 
        maxRetries: 3,
        baseDelay: 2000 // 2 second base delay for Twilio calls
      });
    });
  }

  /**
   * Get call details from Twilio
   */
  async getCallDetails(callSid) {
    try {
      if (!this.client) {
        throw new Error('Twilio client not initialized');
      }

      const call = await this.client.calls(callSid).fetch();
      return call;
    } catch (error) {
      logger.error('Error fetching call details', error);
      throw error;
    }
  }

  /**
   * Hangup active call
   */
  async hangupCall(callSid) {
    try {
      if (!this.client) {
        throw new Error('Twilio client not initialized');
      }

      const call = await this.client.calls(callSid)
        .update({ status: 'completed' });

      logger.info('Call hung up', { callSid });
      return call;
    } catch (error) {
      logger.error('Error hanging up call', error);
      throw error;
    }
  }

  /**
   * Get call recordings
   */
  async getCallRecordings(callSid) {
    try {
      if (!this.client) {
        throw new Error('Twilio client not initialized');
      }

      const recordings = await this.client.recordings.list({
        callSid: callSid,
        limit: 20
      });

      return recordings;
    } catch (error) {
      logger.error('Error fetching call recordings', error);
      throw error;
    }
  }

  /**
   * Delete call recording
   */
  async deleteRecording(recordingSid) {
    try {
      if (!this.client) {
        throw new Error('Twilio client not initialized');
      }

      await this.client.recordings(recordingSid).remove();
      logger.info('Recording deleted', { recordingSid });
    } catch (error) {
      logger.error('Error deleting recording', error);
      throw error;
    }
  }

  /**
   * Send SMS message
   */
  async sendSMS(to, message) {
    try {
      if (!this.client) {
        throw new Error('Twilio client not initialized');
      }

      const sms = await this.client.messages.create({
        to: to,
        from: this.phoneNumber,
        body: message
      });

      logger.info('SMS sent', { 
        messageSid: sms.sid, 
        to: to,
        messageLength: message.length 
      });

      return sms;
    } catch (error) {
      logger.error('Error sending SMS', error);
      throw error;
    }
  }

  /**
   * Format phone number for Twilio
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    return `+${cleaned}`;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phoneNumber) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const formatted = this.formatPhoneNumber(phoneNumber);
    return phoneRegex.test(formatted);
  }

  /**
   * Parse TwiML for testing
   */
  parseTwiML(twiml) {
    try {
      // Basic TwiML parsing for testing purposes
      const sayMatches = twiml.match(/<Say[^>]*>(.*?)<\/Say>/g) || [];
      const gatherMatches = twiml.match(/<Gather[^>]*>/g) || [];
      const redirectMatches = twiml.match(/<Redirect[^>]*>(.*?)<\/Redirect>/g) || [];
      
      return {
        sayElements: sayMatches.map(match => {
          const content = match.replace(/<Say[^>]*>|<\/Say>/g, '');
          return content;
        }),
        hasGather: gatherMatches.length > 0,
        redirects: redirectMatches.map(match => {
          const url = match.replace(/<Redirect[^>]*>|<\/Redirect>/g, '');
          return url;
        })
      };
    } catch (error) {
      logger.error('Error parsing TwiML', error);
      return null;
    }
  }
}

export default TwilioService;