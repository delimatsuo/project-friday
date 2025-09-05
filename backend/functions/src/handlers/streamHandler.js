const WebSocket = require('ws');
const SpeechService = require('../services/speechService');

class StreamHandler {
  constructor() {
    this.connections = new Map();
    this.wss = null;
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
  handleConnected(connection, data) {
    connection.callSid = data.protocol?.callSid;
    connection.metadata = {
      ...data.protocol,
      connectedAt: new Date().toISOString(),
    };

    // Send initial greeting
    this.sendTTSResponse(connection, 
      "Hello from Project Friday. I'm your AI assistant. How can I help you today?"
    );
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
    
    // For now, echo back what the user said
    // This will be replaced with Gemini AI integration later
    const response = `I heard you say: "${userInput}". This feature is being configured.`;
    
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
  handleStop(connection) {
    const { speechService } = connection;
    speechService.stopSpeechToText();
    
    // Log session summary
    console.log('Session summary:', {
      streamSid: connection.streamSid,
      callSid: connection.callSid,
      transcriptCount: connection.transcripts.length,
      duration: this.calculateDuration(connection),
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