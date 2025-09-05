/**
 * Integration tests for end-to-end call flow with Gemini AI
 */

const StreamHandler = require('../../src/handlers/streamHandler');
const WebSocket = require('ws');

// Create mock instances
const mockGeminiInstance = {
  generateResponse: jest.fn().mockResolvedValue('This is Friday. May I ask who is calling?'),
  processResponseForVoice: jest.fn(text => text),
  generateSummary: jest.fn().mockResolvedValue('Call summary: Caller inquired about services.'),
};

const mockSpeechInstance = {
  initializeSpeechToText: jest.fn(),
  processAudioChunk: jest.fn(),
  stopSpeechToText: jest.fn(),
  textToSpeech: jest.fn().mockResolvedValue(Buffer.from('audio_data')),
  onTranscript: jest.fn(),
};

// Mock the required services
jest.mock('../../src/services/speechService', () => {
  return jest.fn().mockImplementation(() => mockSpeechInstance);
});

jest.mock('../../src/services/geminiService', () => {
  return jest.fn().mockImplementation(() => mockGeminiInstance);
});

describe('End-to-End Call Flow Integration', () => {
  let streamHandler;
  let mockServer;
  let mockWs;
  let mockGeminiService;
  let mockSpeechService;

  beforeEach(() => {
    // Clear all mock calls
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockGeminiInstance.generateResponse.mockClear();
    mockGeminiInstance.processResponseForVoice.mockClear();
    mockGeminiInstance.generateSummary.mockClear();
    mockSpeechInstance.initializeSpeechToText.mockClear();
    mockSpeechInstance.processAudioChunk.mockClear();
    mockSpeechInstance.stopSpeechToText.mockClear();
    mockSpeechInstance.textToSpeech.mockClear();
    
    // Create mock HTTP server
    mockServer = {
      on: jest.fn(),
    };

    // Create mock WebSocket
    mockWs = {
      on: jest.fn(),
      send: jest.fn(),
      readyState: WebSocket.OPEN,
      close: jest.fn(),
    };

    // Mock WebSocket.Server
    jest.spyOn(WebSocket, 'Server').mockImplementation(function() {
      this.on = jest.fn((event, callback) => {
        if (event === 'connection') {
          // Simulate connection immediately
          setTimeout(() => callback(mockWs, {}), 0);
        }
      });
      return this;
    });

    // Use the mock instances
    mockGeminiService = mockGeminiInstance;
    mockSpeechService = mockSpeechInstance;

    // Set environment variable for Gemini
    process.env.GOOGLE_API_KEY = 'test-api-key';

    // Create StreamHandler instance
    streamHandler = new StreamHandler();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_API_KEY;
  });

  describe('Call Initialization', () => {
    test('should initialize WebSocket server and handle connections', async () => {
      streamHandler.initialize(mockServer);

      expect(WebSocket.Server).toHaveBeenCalledWith({
        server: mockServer,
        path: '/media-stream',
      });

      // Wait for async connection
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should send AI-generated greeting on connection', async () => {
      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Get the message handler
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];

      // Simulate connected event
      const connectedMessage = JSON.stringify({
        event: 'connected',
        protocol: {
          callSid: 'CA123456',
        },
      });

      await messageHandler(connectedMessage);

      // Verify Gemini was called for greeting
      expect(mockGeminiService.generateResponse).toHaveBeenCalledWith(
        '[SYSTEM: New incoming call connected. Generate initial greeting]',
        []
      );

      // Verify TTS was called
      expect(mockSpeechService.textToSpeech).toHaveBeenCalled();

      // Verify response was sent via WebSocket
      expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"event":"media"'));
    });
  });

  describe('Speech Processing', () => {
    test('should process incoming audio and generate AI response', async () => {
      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];

      // Simulate start event
      await messageHandler(JSON.stringify({
        event: 'start',
        start: {
          streamSid: 'stream_123',
          callSid: 'CA123456',
        },
      }));

      // Verify STT was initialized
      expect(mockSpeechService.initializeSpeechToText).toHaveBeenCalled();

      // Simulate media event
      await messageHandler(JSON.stringify({
        event: 'media',
        media: {
          payload: Buffer.from('audio').toString('base64'),
        },
      }));

      // Verify audio was processed
      expect(mockSpeechService.processAudioChunk).toHaveBeenCalled();
    });

    test('should generate AI response to user transcript', async () => {
      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Get connection
      const connection = streamHandler.connections.values().next().value;

      // Simulate transcript callback
      const transcriptData = {
        transcript: 'Hello, this is John calling about your services',
        isFinal: true,
        confidence: 0.95,
      };

      // Manually trigger transcript handling
      await streamHandler.handleTranscript(connection, transcriptData);

      // Verify Gemini was called with transcript
      expect(mockGeminiService.generateResponse).toHaveBeenCalledWith(
        'Hello, this is John calling about your services',
        expect.any(Array)
      );

      // Verify TTS was called with AI response
      expect(mockSpeechService.textToSpeech).toHaveBeenCalledWith(
        'This is Friday. May I ask who is calling?',
        expect.any(Object)
      );

      // Verify response was sent
      expect(mockWs.send).toHaveBeenCalled();
    });
  });

  describe('Call Termination', () => {
    test('should generate call summary on stop', async () => {
      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const connection = streamHandler.connections.values().next().value;

      // Add some transcripts
      connection.transcripts = [
        { transcript: 'Hello', isFinal: true },
        { transcript: 'This is John', isFinal: true },
        { transcript: 'Calling about services', isFinal: true },
      ];

      // Handle stop event
      await streamHandler.handleStop(connection);

      // Verify summary was generated
      expect(mockGeminiService.generateSummary).toHaveBeenCalledWith(connection.transcripts);
      expect(connection.summary).toBe('Call summary: Caller inquired about services.');
    });

    test('should clean up resources on disconnect', async () => {
      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const streamSid = streamHandler.connections.keys().next().value;

      // Verify connection exists
      expect(streamHandler.connections.has(streamSid)).toBe(true);

      // Clean up
      streamHandler.cleanup(streamSid);

      // Verify cleanup
      expect(mockSpeechService.stopSpeechToText).toHaveBeenCalled();
      expect(mockWs.close).toHaveBeenCalled();
      expect(streamHandler.connections.has(streamSid)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle Gemini API errors gracefully', async () => {
      mockGeminiService.generateResponse.mockRejectedValueOnce(new Error('API error'));

      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const connection = streamHandler.connections.values().next().value;

      await streamHandler.processUserInput(connection, 'Test input');

      // Should send fallback response
      expect(mockSpeechService.textToSpeech).toHaveBeenCalledWith(
        "I'm having trouble understanding. Could you please repeat that?",
        expect.any(Object)
      );
    });

    test('should work without Gemini service', async () => {
      delete process.env.GOOGLE_API_KEY;
      streamHandler = new StreamHandler();

      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const connection = streamHandler.connections.values().next().value;

      await streamHandler.processUserInput(connection, 'Test input');

      // Should send fallback response
      expect(mockSpeechService.textToSpeech).toHaveBeenCalledWith(
        expect.stringContaining('Hello, this is Friday'),
        expect.any(Object)
      );
    });
  });
});