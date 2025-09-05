/**
 * Test Suite for GeminiService
 * Follows TDD London School approach with comprehensive mocking
 * Tests for Project Friday - AI call screening system
 */

// Mock the entire @google/generative-ai module
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel
  }))
}));

// Mock logger to avoid console output during tests
jest.mock('../src/utils/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

import GeminiService from '../src/services/geminiService.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../src/utils/logger.js';

describe('GeminiService', () => {
  let geminiService;
  let originalEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = process.env.GEMINI_API_KEY;
  });

  afterAll(() => {
    // Restore original environment
    process.env.GEMINI_API_KEY = originalEnv;
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Set up default API key
    process.env.GEMINI_API_KEY = 'test-api-key-12345';
    
    // Reset mock implementations
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockReset();
    
    // Set up mock return values
    mockGetGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent
    });
    
    // Reset the GoogleGenerativeAI mock
    GoogleGenerativeAI.mockClear();
  });

  afterEach(() => {
    geminiService = null;
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with valid API key', () => {
      geminiService = new GeminiService();

      expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-api-key-12345');
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
          responseMimeType: 'text/plain'
        },
        safetySettings: expect.arrayContaining([
          expect.objectContaining({
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          })
        ])
      });
      expect(geminiService.apiKey).toBe('test-api-key-12345');
      expect(geminiService.modelName).toBe('gemini-2.5-flash');
    });

    test('should handle missing API key gracefully', () => {
      delete process.env.GEMINI_API_KEY;
      
      geminiService = new GeminiService();

      expect(logger.warn).toHaveBeenCalledWith('Gemini API key not configured');
      expect(GoogleGenerativeAI).not.toHaveBeenCalled();
      expect(geminiService.apiKey).toBeUndefined();
    });

    test('should initialize with correct system prompt', () => {
      geminiService = new GeminiService();

      expect(geminiService.systemPrompt).toContain('You are Friday');
      expect(geminiService.systemPrompt).toContain('intelligent AI assistant');
      expect(geminiService.systemPrompt).toContain('phone calls');
      expect(geminiService.systemPrompt).toContain('conversational, friendly, and professional');
    });

    test('should initialize conversation history as Map', () => {
      geminiService = new GeminiService();

      expect(geminiService.conversationHistory).toBeInstanceOf(Map);
      expect(geminiService.conversationHistory.size).toBe(0);
    });
  });

  describe('generateResponse', () => {
    beforeEach(() => {
      geminiService = new GeminiService();
    });

    test('should generate response successfully with basic input', async () => {
      const mockResponse = {
        response: {
          text: () => 'Hello! How can I help you today?',
          usageMetadata: {
            promptTokenCount: 50,
            candidatesTokenCount: 12
          }
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await geminiService.generateResponse('Hello');

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining('You are Friday')
      );
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining('Current user input: "Hello"')
      );
      expect(result).toBe('Hello! How can I help you today?');
      expect(logger.info).toHaveBeenCalledWith('Generating AI response', {
        userInputLength: 5,
        hasContext: false
      });
    });

    test('should include previous transcript in context', async () => {
      const mockResponse = {
        response: {
          text: () => 'I understand the context now.',
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 15 }
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const previousTranscript = 'User: Hi, I need help with my account. AI: Of course, I can help with that.';
      await geminiService.generateResponse('What are my options?', previousTranscript);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining('Previous conversation context:')
      );
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining(previousTranscript)
      );
    });

    test('should include AI responses for continuity', async () => {
      const mockResponse = {
        response: {
          text: () => 'Based on our previous discussion...',
          usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 20 }
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const aiResponses = [
        { userInput: 'Hello', aiResponse: 'Hi there!' },
        { userInput: 'I need help', aiResponse: 'What can I help you with?' }
      ];

      await geminiService.generateResponse('Can you explain that again?', '', aiResponses);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining('Recent AI responses for context:')
      );
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining('User: "Hello"')
      );
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining('AI: "Hi there!"')
      );
    });

    test('should clean response for voice synthesis', async () => {
      const mockResponse = {
        response: {
          text: () => '**Bold text** with *emphasis* and `code` and\n\nmultiple\nlines.',
          usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 25 }
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await geminiService.generateResponse('Test input');

      expect(result).toBe('Bold text with emphasis and code and. multiple lines.');
      expect(result).not.toContain('**');
      expect(result).not.toContain('*');
      expect(result).not.toContain('`');
    });

    test('should handle API errors gracefully', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await geminiService.generateResponse('Hello');

      expect(result).toBe("I apologize, but I'm having trouble processing your request right now. Could you please repeat that or try asking in a different way?");
      expect(logger.error).toHaveBeenCalledWith('Error generating AI response', expect.any(Error));
    });

    test('should handle missing model gracefully', async () => {
      geminiService.model = null;

      const result = await geminiService.generateResponse('Hello');

      expect(result).toBe("I apologize, but I'm having trouble processing your request right now. Could you please repeat that or try asking in a different way?");
      expect(logger.error).toHaveBeenCalledWith('Error generating AI response', expect.any(Error));
    });

    test('should limit context size to manage tokens', async () => {
      const longTranscript = 'A'.repeat(2000); // 2000 characters
      const mockResponse = {
        response: {
          text: () => 'Response with limited context',
          usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 30 }
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      await geminiService.generateResponse('Question', longTranscript);

      const contextArg = mockGenerateContent.mock.calls[0][0];
      // Should only include last 1000 characters of transcript
      expect(contextArg).toContain('A'.repeat(1000));
      expect(contextArg.length).toBeLessThan(longTranscript.length + 1000);
    });
  });

  describe('generateSummary', () => {
    beforeEach(() => {
      geminiService = new GeminiService();
    });

    test('should generate call summary successfully', async () => {
      const mockResponse = {
        response: {
          text: () => 'User called to inquire about their account status. The AI assistant provided helpful information and resolved their concerns.'
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const transcript = 'User: Hi, what is my account status? AI: Let me check that for you.';
      const aiResponses = [{ userInput: 'status?', aiResponse: 'checking...' }];

      const result = await geminiService.generateSummary(transcript, aiResponses);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining('Please provide a concise summary')
      );
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining(transcript)
      );
      expect(result).toContain('User called to inquire about their account status');
      expect(logger.info).toHaveBeenCalledWith('Generating call summary', {
        transcriptLength: transcript.length,
        responseCount: 1
      });
    });

    test('should handle summary generation errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Network error'));

      const result = await geminiService.generateSummary('Some transcript', []);

      expect(result).toContain('Call summary: User had a');
      expect(result).toContain('brief conversation');
      expect(logger.error).toHaveBeenCalledWith('Error generating call summary', expect.any(Error));
    });

    test('should handle missing model for summary', async () => {
      geminiService.model = null;

      const result = await geminiService.generateSummary('transcript', []);

      expect(result).toContain('brief conversation with AI assistant Friday');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('generateFollowUpQuestions', () => {
    beforeEach(() => {
      geminiService = new GeminiService();
    });

    test('should generate relevant follow-up questions', async () => {
      const mockResponse = {
        response: {
          text: () => 'Would you like more details about that?\nIs there anything else I can help explain?\nDo you have other questions?'
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await geminiService.generateFollowUpQuestions('Some conversation', 'account help');

      expect(result).toHaveLength(3);
      expect(result[0]).toContain('Would you like more details');
      expect(result[1]).toContain('Is there anything else');
      expect(result[2]).toContain('Do you have other questions');
    });

    test('should return fallback questions on error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API error'));

      const result = await geminiService.generateFollowUpQuestions('transcript', 'topic');

      expect(result).toEqual([
        "Is there anything specific you'd like me to help you with?",
        "Would you like me to explain that in more detail?",
        "Do you have any other questions I can help with?"
      ]);
    });
  });

  describe('analyzeConversation', () => {
    beforeEach(() => {
      geminiService = new GeminiService();
    });

    test('should analyze conversation and return structured data', async () => {
      const mockAnalysis = {
        sentiment: 'positive',
        engagement: 'high',
        quality: 'excellent',
        topics: ['account inquiry', 'billing'],
        issues: [],
        recommendations: 'Continue providing helpful responses'
      };
      const mockResponse = {
        response: {
          text: () => JSON.stringify(mockAnalysis)
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await geminiService.analyzeConversation('User was happy with service');

      expect(result).toEqual(mockAnalysis);
      expect(result.sentiment).toBe('positive');
      expect(result.engagement).toBe('high');
    });

    test('should handle invalid JSON response gracefully', async () => {
      const mockResponse = {
        response: {
          text: () => 'Invalid JSON response from API'
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await geminiService.analyzeConversation('Some transcript');

      expect(result).toEqual({
        sentiment: 'neutral',
        engagement: 'medium',
        quality: 'good',
        topics: ['general conversation'],
        issues: [],
        recommendations: 'Continue providing helpful responses'
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Could not parse conversation analysis JSON',
        expect.any(Object)
      );
    });

    test('should return null on analysis error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Analysis failed'));

      const result = await geminiService.analyzeConversation('transcript');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Error analyzing conversation', expect.any(Error));
    });
  });

  describe('buildConversationContext', () => {
    beforeEach(() => {
      geminiService = new GeminiService();
    });

    test('should build context with system prompt', () => {
      const context = geminiService.buildConversationContext('Hello', '', []);

      expect(context).toContain('You are Friday');
      expect(context).toContain('Current user input: "Hello"');
      expect(context).toContain('Please provide a helpful, conversational response');
    });

    test('should include previous transcript when provided', () => {
      const previousTranscript = 'User: Hi. AI: Hello there!';
      
      const context = geminiService.buildConversationContext('How are you?', previousTranscript, []);

      expect(context).toContain('Previous conversation context:');
      expect(context).toContain(previousTranscript);
    });

    test('should limit previous transcript to 1000 characters', () => {
      const longTranscript = 'A'.repeat(1500);
      
      const context = geminiService.buildConversationContext('Question', longTranscript, []);

      // Should only contain last 1000 characters
      expect(context).toContain('A'.repeat(1000));
      expect(context).not.toContain('A'.repeat(1500));
    });

    test('should include recent AI responses for continuity', () => {
      const aiResponses = [
        { userInput: 'First question', aiResponse: 'First answer' },
        { userInput: 'Second question', aiResponse: 'Second answer' },
        { userInput: 'Third question', aiResponse: 'Third answer' },
        { userInput: 'Fourth question', aiResponse: 'Fourth answer' }
      ];

      const context = geminiService.buildConversationContext('Current question', '', aiResponses);

      // Should only include last 3 responses
      expect(context).toContain('Recent AI responses for context:');
      expect(context).toContain('Second question');
      expect(context).toContain('Third question');
      expect(context).toContain('Fourth question');
      expect(context).not.toContain('First question');
    });
  });

  describe('Response Cleaning Methods', () => {
    beforeEach(() => {
      geminiService = new GeminiService();
    });

    describe('cleanResponseForVoice', () => {
      test('should remove markdown formatting', () => {
        const input = '**Bold text** with *emphasis* and `inline code`';
        const result = geminiService.cleanResponseForVoice(input);
        
        expect(result).toBe('Bold text with emphasis and inline code');
      });

      test('should convert markdown links to text', () => {
        const input = 'Visit [Google](https://google.com) for search';
        const result = geminiService.cleanResponseForVoice(input);
        
        expect(result).toBe('Visit Google for search');
      });

      test('should replace code blocks', () => {
        const input = 'Here is code: ```\nconsole.log("hello");\n```';
        const result = geminiService.cleanResponseForVoice(input);
        
        expect(result).toBe('Here is code: code block');
      });

      test('should normalize whitespace and newlines', () => {
        const input = 'First line.\n\n\nSecond line.\n   Third line.   ';
        const result = geminiService.cleanResponseForVoice(input);
        
        expect(result).toBe('First line. Second line. Third line.');
      });

      test('should remove repeated punctuation', () => {
        const input = 'Really?!?! That is amazing!!!';
        const result = geminiService.cleanResponseForVoice(input);
        
        expect(result).toBe('Really? That is amazing!');
      });
    });

    describe('cleanResponseForText', () => {
      test('should normalize all whitespace including newlines', () => {
        const input = 'Line 1\n\n\n\nLine 2';
        const result = geminiService.cleanResponseForText(input);
        
        expect(result).toBe('Line 1 Line 2');
      });

      test('should normalize whitespace within lines', () => {
        const input = 'Text   with    extra   spaces';
        const result = geminiService.cleanResponseForText(input);
        
        expect(result).toBe('Text with extra spaces');
      });
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      geminiService = new GeminiService();
    });

    describe('estimateCallDuration', () => {
      test('should return < 1 minute for empty responses', () => {
        const result = geminiService.estimateCallDuration([]);
        expect(result).toBe('< 1 minute');
      });

      test('should calculate minutes for multiple responses', () => {
        const responses = new Array(4).fill({});
        const result = geminiService.estimateCallDuration(responses);
        expect(result).toBe('2 minutes'); // 4 * 30 seconds = 2 minutes
      });

      test('should handle single response', () => {
        const responses = [{}];
        const result = geminiService.estimateCallDuration(responses);
        expect(result).toBe('1 minute');
      });
    });

    describe('shouldShortenResponse', () => {
      test('should return true for long responses by word count', () => {
        const longResponse = 'word '.repeat(160); // 160 words
        const result = geminiService.shouldShortenResponse(longResponse);
        expect(result).toBe(true);
      });

      test('should return true for long responses by character count', () => {
        const longResponse = 'a'.repeat(900); // 900 characters
        const result = geminiService.shouldShortenResponse(longResponse);
        expect(result).toBe(true);
      });

      test('should return false for reasonable responses', () => {
        const reasonableResponse = 'This is a reasonable length response';
        const result = geminiService.shouldShortenResponse(reasonableResponse);
        expect(result).toBe(false);
      });
    });

    describe('generateShorterResponse', () => {
      test('should generate shorter version of long response', async () => {
        const mockResponse = {
          response: {
            text: () => 'This is much shorter.'
          }
        };
        mockGenerateContent.mockResolvedValue(mockResponse);

        const result = await geminiService.generateShorterResponse(
          'This is a very long response that goes on and on with lots of details...',
          'Simple question'
        );

        expect(result).toBe('This is much shorter.');
        expect(mockGenerateContent).toHaveBeenCalledWith(
          expect.stringContaining('shorter, more concise version')
        );
      });

      test('should fallback to truncation on error', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API error'));

        const longResponse = 'word '.repeat(60) + 'end'; // 61 words
        const result = await geminiService.generateShorterResponse(longResponse, 'question');

        expect(result).toContain('...');
        expect(result.split(' ').length).toBeLessThanOrEqual(51); // 50 words + '...'
      });
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      geminiService = new GeminiService();
    });

    test('should test API connection successfully', async () => {
      const mockResponse = {
        response: {
          text: () => 'Hello! Test successful.'
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await geminiService.testConnection();

      expect(result).toEqual({
        success: true,
        response: 'Hello! Test successful.',
        model: 'gemini-2.5-flash'
      });
      expect(mockGenerateContent).toHaveBeenCalledWith(
        'Hello, this is a test. Please respond briefly.'
      );
    });

    test('should handle connection test failure', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Connection failed'));

      const result = await geminiService.testConnection();

      expect(result).toEqual({
        success: false,
        error: 'Connection failed'
      });
    });

    test('should handle missing model in connection test', async () => {
      geminiService.model = null;

      const result = await geminiService.testConnection();

      expect(result).toEqual({
        success: false,
        error: 'Gemini model not initialized'
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      geminiService = new GeminiService();
    });

    test('should handle empty user input', async () => {
      const mockResponse = {
        response: {
          text: () => 'I did not receive any input. How can I help you?',
          usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 15 }
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await geminiService.generateResponse('');

      expect(result).toContain('I did not receive any input');
    });

    test('should handle null/undefined inputs gracefully', async () => {
      const mockResponse = {
        response: {
          text: () => 'How can I assist you today?',
          usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 10 }
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await geminiService.generateResponse(null);

      // Should return fallback message when API call fails or isn't made
      expect(result).toBe("I apologize, but I'm having trouble processing your request right now. Could you please repeat that or try asking in a different way?");
    });

    test('should handle API response without usage metadata', async () => {
      const mockResponse = {
        response: {
          text: () => 'Response without metadata'
          // No usageMetadata
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await geminiService.generateResponse('test');

      expect(result).toBe('Response without metadata');
      expect(logger.info).toHaveBeenCalledWith('AI response generated', {
        responseLength: expect.any(Number),
        inputTokens: 0,
        outputTokens: 0
      });
    });

    test('should handle very long conversation history', async () => {
      const veryLongHistory = Array.from({length: 100}, (_, i) => ({
        userInput: `Question ${i}`,
        aiResponse: `Answer ${i}`
      }));

      const mockResponse = {
        response: {
          text: () => 'Handled long history',
          usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 20 }
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await geminiService.generateResponse('Current question', '', veryLongHistory);

      // Should only include last 3 responses in context
      const contextArg = mockGenerateContent.mock.calls[0][0];
      expect(contextArg).toContain('Question 97');
      expect(contextArg).toContain('Question 98');
      expect(contextArg).toContain('Question 99');
      expect(contextArg).not.toContain('Question 96');
    });

    test('should handle malformed AI response objects', async () => {
      const malformedResponse = {
        response: null
      };
      mockGenerateContent.mockResolvedValue(malformedResponse);

      const result = await geminiService.generateResponse('test');

      expect(result).toBe("I apologize, but I'm having trouble processing your request right now. Could you please repeat that or try asking in a different way?");
    });
  });
});