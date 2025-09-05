const WebSocket = require('ws');
const SpeechService = require('../services/speechService');
const GeminiService = require('../services/geminiService');

class StreamHandler {
  constructor() {
    this.connections = new Map();
    this.wss = null;
    // Initialize Gemini service with API key from environment
    this.geminiService = process.env.GOOGLE_API_KEY ? 
      new GeminiService(process.env.GOOGLE_API_KEY) : null;
  }

  /**
   * Initialize WebSocket server
   * @param {Object} server - HTTP server instance
   */
  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/media-stream'
    });

    this.wss.on('connection', (ws, request) => {
      console.log('New WebSocket connection established');
      const streamSid = this.generateStreamId();
      
      const connection = {
        ws,
        streamSid,
        speechService: new SpeechService(),
        callSid: null,
        audioBuffer: [],
        transcripts: [],
        metadata: {},
      };

      this.connections.set(streamSid, connection);
      this.handleConnection(connection);
    });

    console.log('WebSocket server initialized at /media-stream');
  }

  /**
   * Handle WebSocket connection
   * @param {Object} connection - Connection object
   */
  handleConnection(connection) {
    const { ws, speechService, streamSid } = connection;

    // Override the transcript callback
    speechService.onTranscript = (transcriptData) => {
      this.handleTranscript(connection, transcriptData);
    };

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.event) {
          case 'connected':
            console.log('Twilio media stream connected');
            this.handleConnected(connection, data);
            break;

          case 'start':
            console.log('Media stream started:', data.start);
            this.handleStart(connection, data.start);
            break;

          case 'media':
            this.handleMedia(connection, data.media);
            break;

          case 'stop':
            console.log('Media stream stopped');
            this.handleStop(connection);
            break;

          default:
            console.log('Unknown event:', data.event);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      this.cleanup(streamSid);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.cleanup(streamSid);
    });
  }

  /**
   * Handle connected event from Twilio
   * @param {Object} connection - Connection object
   * @param {Object} data - Event data
   */
  async handleConnected(connection, data) {
    connection.callSid = data.protocol?.callSid;
    connection.metadata = {
      ...data.protocol,
      connectedAt: new Date().toISOString(),
    };

    // Generate initial greeting
    let greeting;
    if (this.geminiService) {
      try {
        // Use Gemini to generate a professional greeting
        greeting = await this.geminiService.generateResponse(
          "[SYSTEM: New incoming call connected. Generate initial greeting]",
          []
        );
        greeting = this.geminiService.processResponseForVoice(greeting);
      } catch (error) {
        console.error('Error generating AI greeting:', error);
        greeting = "Hello, this is Friday, your AI assistant. I'm here to help screen your call. May I ask who's calling?";
      }
    } else {
      greeting = "Hello, this is Friday, your AI assistant. I'm here to help screen your call. May I ask who's calling?";
    }

    // Send initial greeting
    await this.sendTTSResponse(connection, greeting);
  }

  /**
   * Handle start event - initialize STT
   * @param {Object} connection - Connection object
   * @param {Object} startData - Start event data
   */
  handleStart(connection, startData) {
    const { speechService } = connection;
    
    connection.metadata = {
      ...connection.metadata,
      ...startData,
    };

    // Initialize Speech-to-Text with Twilio audio format
    speechService.initializeSpeechToText({
      encoding: 'MULAW',
      sampleRateHertz: 8000,
      languageCode: 'en-US',
    });
  }

  /**
   * Handle media event - process audio
   * @param {Object} connection - Connection object
   * @param {Object} media - Media data
   */
  handleMedia(connection, media) {
    const { speechService } = connection;
    
    if (media.payload) {
      // Convert base64 to buffer and process
      const audioBuffer = Buffer.from(media.payload, 'base64');
      speechService.processAudioChunk(audioBuffer);
      
      // Store audio for later use if needed
      connection.audioBuffer.push(audioBuffer);
    }
  }

  /**
   * Handle transcript from Speech-to-Text
   * @param {Object} connection - Connection object
   * @param {Object} transcriptData - Transcript data
   */
  async handleTranscript(connection, transcriptData) {
    console.log('Transcript:', transcriptData);
    
    connection.transcripts.push({
      ...transcriptData,
      timestamp: new Date().toISOString(),
    });

    // Process final transcripts
    if (transcriptData.isFinal) {
      await this.processUserInput(connection, transcriptData.transcript);
    }
  }

  /**
   * Process user input and generate response
   * @param {Object} connection - Connection object
   * @param {string} userInput - User's transcribed speech
   */
  async processUserInput(connection, userInput) {
    console.log('Processing user input:', userInput);
    
    let response;
    
    if (this.geminiService) {
      try {
        // Generate AI response using Gemini
        const aiResponse = await this.geminiService.generateResponse(
          userInput,
          connection.transcripts
        );
        
        // Process the response for voice synthesis
        response = this.geminiService.processResponseForVoice(aiResponse);
        
        // Store the AI response in connection history
        connection.transcripts.push({
          transcript: response,
          isFinal: true,
          isAI: true,
          timestamp: new Date().toISOString(),
        });
        
        console.log('AI Response:', response);
      } catch (error) {
        console.error('Error generating AI response:', error);
        response = "I'm having trouble understanding. Could you please repeat that?";
      }
    } else {
      // Fallback if Gemini service is not configured
      response = "Hello, this is Friday, your AI assistant. I'm here to help screen your call. May I ask who's calling and the purpose of your call?";
    }
    
    await this.sendTTSResponse(connection, response);
  }

  /**
   * Send TTS response to caller
   * @param {Object} connection - Connection object
   * @param {string} text - Text to convert to speech
   */
  async sendTTSResponse(connection, text) {
    const { speechService, ws } = connection;
    
    try {
      // Generate TTS audio
      const audioContent = await speechService.textToSpeech(text);
      
      // Convert to base64 for Twilio
      const base64Audio = audioContent.toString('base64');
      
      // Send audio to Twilio
      const mediaMessage = {
        event: 'media',
        streamSid: connection.streamSid,
        media: {
          payload: base64Audio,
        },
      };
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(mediaMessage));
        console.log('Sent TTS response to caller');
      }
    } catch (error) {
      console.error('Error sending TTS response:', error);
    }
  }

  /**
   * Handle stop event
   * @param {Object} connection - Connection object
   */
  async handleStop(connection) {
    const { speechService } = connection;
    speechService.stopSpeechToText();
    
    // Generate call summary if Gemini is available
    if (this.geminiService && connection.transcripts.length > 0) {
      try {
        const summary = await this.geminiService.generateSummary(connection.transcripts);
        console.log('Call Summary:', summary);
        
        // Store summary in connection for potential later use
        connection.summary = summary;
        
        // TODO: Save summary to Firestore for the user
      } catch (error) {
        console.error('Error generating call summary:', error);
      }
    }
    
    // Log session summary
    console.log('Session summary:', {
      streamSid: connection.streamSid,
      callSid: connection.callSid,
      transcriptCount: connection.transcripts.length,
      duration: this.calculateDuration(connection),
      summary: connection.summary || 'No summary generated',
    });
  }

  /**
   * Clean up connection
   * @param {string} streamSid - Stream ID
   */
  cleanup(streamSid) {
    const connection = this.connections.get(streamSid);
    if (connection) {
      const { speechService, ws } = connection;
      
      speechService.stopSpeechToText();
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      
      this.connections.delete(streamSid);
      console.log('Cleaned up connection:', streamSid);
    }
  }

  /**
   * Calculate session duration
   * @param {Object} connection - Connection object
   * @returns {number} Duration in seconds
   */
  calculateDuration(connection) {
    if (connection.metadata.connectedAt) {
      const start = new Date(connection.metadata.connectedAt);
      const end = new Date();
      return Math.floor((end - start) / 1000);
    }
    return 0;
  }

  /**
   * Generate unique stream ID
   * @returns {string} Stream ID
   */
  generateStreamId() {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active connections count
   * @returns {number} Number of active connections
   */
  getActiveConnections() {
    return this.connections.size;
  }
}

module.exports = StreamHandler;