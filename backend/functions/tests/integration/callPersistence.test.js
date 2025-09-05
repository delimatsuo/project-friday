/**
 * Integration tests for call log persistence to Firestore
 */

const StreamHandler = require('../../src/handlers/streamHandler');
const WebSocket = require('ws');

// Mock all services
jest.mock('../../src/services/speechService');
jest.mock('../../src/services/geminiService');
jest.mock('../../src/services/firestoreService');

// Create mock instances
const mockGeminiInstance = {
  generateResponse: jest.fn().mockResolvedValue('This is Friday. How can I help?'),
  processResponseForVoice: jest.fn(text => text),
  generateSummary: jest.fn().mockResolvedValue('Caller inquired about services. Name: John. Purpose: Product information.'),
  analyzeConversation: jest.fn().mockResolvedValue({
    sentiment: 'positive',
    urgency: 'medium',
    actionRequired: true,
    followUpNeeded: true,
    callerName: 'John Smith',
    purpose: 'Product inquiry',
  }),
};

const mockSpeechInstance = {
  initializeSpeechToText: jest.fn(),
  processAudioChunk: jest.fn(),
  stopSpeechToText: jest.fn(),
  textToSpeech: jest.fn().mockResolvedValue(Buffer.from('audio_data')),
  onTranscript: jest.fn(),
};

const mockFirestoreInstance = {
  createCall: jest.fn().mockResolvedValue({ id: 'call_123', success: true }),
  updateUserStats: jest.fn().mockResolvedValue({ success: true }),
  getCall: jest.fn(),
  getUserCalls: jest.fn(),
};

// Mock the services
jest.mock('../../src/services/speechService', () => {
  return jest.fn().mockImplementation(() => mockSpeechInstance);
});

jest.mock('../../src/services/geminiService', () => {
  return jest.fn().mockImplementation(() => mockGeminiInstance);
});

jest.mock('../../src/services/firestoreService', () => {
  return jest.fn().mockImplementation(() => mockFirestoreInstance);
});

describe('Call Log Persistence Integration', () => {
  let streamHandler;
  let mockServer;
  let mockWs;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
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
          setTimeout(() => callback(mockWs, {}), 0);
        }
      });
      return this;
    });

    // Set environment variable
    process.env.GOOGLE_API_KEY = 'test-api-key';

    // Create StreamHandler instance
    streamHandler = new StreamHandler();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_API_KEY;
  });

  describe('Call Log Creation', () => {
    test('should save call log to Firestore when call ends', async () => {
      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const connection = streamHandler.connections.values().next().value;
      
      // Set up connection with call data
      connection.callSid = 'CA123456789';
      connection.phoneNumber = '+1234567890';
      connection.userId = 'user_456';
      connection.startTime = new Date('2025-01-01T10:00:00Z');
      
      // Add sample transcripts
      connection.transcripts = [
        {
          transcript: 'Hello, my name is John Smith',
          isFinal: true,
          timestamp: '2025-01-01T10:00:05Z',
          confidence: 0.95,
        },
        {
          transcript: 'I am calling about your product information',
          isFinal: true,
          timestamp: '2025-01-01T10:00:10Z',
          confidence: 0.92,
        },
        {
          transcript: 'Thank you for your help',
          isFinal: true,
          timestamp: '2025-01-01T10:00:30Z',
          confidence: 0.98,
        },
      ];

      // Trigger stop event
      await streamHandler.handleStop(connection);

      // Verify Gemini services were called
      expect(mockGeminiInstance.generateSummary).toHaveBeenCalledWith(connection.transcripts);
      expect(mockGeminiInstance.analyzeConversation).toHaveBeenCalledWith(connection.transcripts);

      // Verify Firestore createCall was called with correct data
      expect(mockFirestoreInstance.createCall).toHaveBeenCalledWith(
        expect.objectContaining({
          callSid: 'CA123456789',
          userId: 'user_456',
          phoneNumber: '+1234567890',
          callStartTime: connection.startTime,
          duration: expect.any(Number),
          transcripts: expect.arrayContaining([
            expect.objectContaining({
              text: 'Hello, my name is John Smith',
              isFinal: true,
            }),
          ]),
          aiSummary: 'Caller inquired about services. Name: John. Purpose: Product information.',
          callerName: 'John Smith',
          callPurpose: 'Product inquiry',
          urgency: 'medium',
          sentiment: 'positive',
          actionRequired: true,
          followUpNeeded: true,
        })
      );

      // Verify user stats were updated
      expect(mockFirestoreInstance.updateUserStats).toHaveBeenCalledWith(
        'user_456',
        expect.objectContaining({
          totalCalls: 1,
          totalDuration: expect.any(Number),
          lastCallAt: expect.any(Date),
        })
      );
    });

    test('should extract caller information from transcripts', async () => {
      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const connection = streamHandler.connections.values().next().value;
      
      const transcripts = [
        { transcript: 'Hi, this is Sarah Johnson calling' },
        { transcript: 'I need help with my account issue' },
      ];

      const callerInfo = streamHandler.extractCallerInfo(transcripts);
      
      expect(callerInfo.name).toBe('sarah johnson');
      expect(callerInfo.purpose).toBe('my account issue');
    });

    test('should handle missing Gemini service gracefully', async () => {
      // Create handler without Gemini
      delete process.env.GOOGLE_API_KEY;
      streamHandler = new StreamHandler();
      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const connection = streamHandler.connections.values().next().value;
      connection.callSid = 'CA123456789';
      connection.transcripts = [
        { transcript: 'Test call', isFinal: true },
      ];

      await streamHandler.handleStop(connection);

      // Should still save call log with default values
      expect(mockFirestoreInstance.createCall).toHaveBeenCalledWith(
        expect.objectContaining({
          aiSummary: 'No summary generated',
          urgency: 'medium',
          sentiment: 'neutral',
        })
      );
    });

    test('should handle Firestore save errors gracefully', async () => {
      // Mock Firestore error
      mockFirestoreInstance.createCall.mockRejectedValueOnce(new Error('Firestore error'));

      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const connection = streamHandler.connections.values().next().value;
      connection.callSid = 'CA123456789';

      // Should not throw, just log error
      await expect(streamHandler.handleStop(connection)).resolves.not.toThrow();
    });

    test('should not save call log if no callSid', async () => {
      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const connection = streamHandler.connections.values().next().value;
      // Don't set callSid
      connection.transcripts = [
        { transcript: 'Test call', isFinal: true },
      ];

      await streamHandler.handleStop(connection);

      // Should not attempt to save
      expect(mockFirestoreInstance.createCall).not.toHaveBeenCalled();
    });
  });

  describe('Call Metadata Handling', () => {
    test('should extract phone number from start event', async () => {
      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const connection = streamHandler.connections.values().next().value;
      
      const startData = {
        callSid: 'CA987654321',
        customParameters: {
          from: '+19876543210',
          callSid: 'CA987654321',
          userId: 'user_789',
        },
      };

      streamHandler.handleStart(connection, startData);

      expect(connection.phoneNumber).toBe('+19876543210');
      expect(connection.callSid).toBe('CA987654321');
      expect(connection.userId).toBe('user_789');
    });

    test('should handle missing custom parameters', async () => {
      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const connection = streamHandler.connections.values().next().value;
      
      const startData = {
        callSid: 'CA987654321',
        // No customParameters
      };

      streamHandler.handleStart(connection, startData);

      // Should still initialize STT
      expect(mockSpeechInstance.initializeSpeechToText).toHaveBeenCalled();
    });
  });

  describe('Call Duration Calculation', () => {
    test('should calculate correct call duration', async () => {
      streamHandler.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 10));

      const connection = streamHandler.connections.values().next().value;
      
      // Set specific start time
      const startTime = new Date('2025-01-01T10:00:00Z');
      connection.startTime = startTime;
      connection.metadata = {
        connectedAt: startTime.toISOString(),
      };
      connection.callSid = 'CA123456789';

      // Mock current time for end
      const endTime = new Date('2025-01-01T10:05:30Z'); // 5 minutes 30 seconds later
      jest.spyOn(Date, 'now').mockReturnValue(endTime.getTime());

      await streamHandler.handleStop(connection);

      // Verify duration calculation (330 seconds)
      expect(mockFirestoreInstance.createCall).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: 330,
        })
      );

      Date.now.mockRestore();
    });
  });
});