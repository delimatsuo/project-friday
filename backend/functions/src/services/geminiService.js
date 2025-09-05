/**
 * Gemini AI Service
 * Handles Google Gemini 2.5 Flash integration for conversational AI
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger.js';

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = 'gemini-2.5-flash';
    
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: this.modelName,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
          responseMimeType: 'text/plain'
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      });
    } else {
      logger.warn('Gemini API key not configured');
    }
    
    // System prompt for the AI assistant
    this.systemPrompt = `You are Friday, an intelligent AI assistant created to help users through phone calls. 

Key characteristics:
- Be conversational, friendly, and professional
- Keep responses concise and clear for voice interaction (under 100 words typically)
- Ask clarifying questions when needed
- Be helpful but acknowledge your limitations
- Remember context from the current conversation
- Use natural speech patterns suitable for text-to-speech

Guidelines:
- Avoid overly long responses that would be tedious to listen to
- Don't use special characters or formatting that don't work well in speech
- When you don't know something, be honest about it
- Keep the conversation flowing naturally
- Be empathetic and understanding

Remember: This is a phone conversation, so optimize for audio interaction.`;

    // Conversation history for context
    this.conversationHistory = new Map();
  }

  /**
   * Generate AI response based on user input and conversation context
   */
  async generateResponse(userInput, previousTranscript = '', aiResponses = []) {
    try {
      if (!this.model) {
        throw new Error('Gemini model not initialized');
      }

      logger.info('Generating AI response', { 
        userInputLength: userInput.length,
        hasContext: previousTranscript.length > 0
      });

      // Build conversation context
      const context = this.buildConversationContext(userInput, previousTranscript, aiResponses);
      
      // Generate response
      const result = await this.model.generateContent(context);
      const response = result.response;
      const text = response.text();

      // Clean and validate response
      const cleanedResponse = this.cleanResponseForVoice(text);

      logger.info('AI response generated', { 
        responseLength: cleanedResponse.length,
        inputTokens: result.response?.usageMetadata?.promptTokenCount || 0,
        outputTokens: result.response?.usageMetadata?.candidatesTokenCount || 0
      });

      return cleanedResponse;

    } catch (error) {
      logger.error('Error generating AI response', error);
      
      // Return fallback response
      return "I apologize, but I'm having trouble processing your request right now. Could you please repeat that or try asking in a different way?";
    }
  }

  /**
   * Generate conversation summary
   */
  async generateSummary(transcript, aiResponses = []) {
    try {
      if (!this.model) {
        throw new Error('Gemini model not initialized');
      }

      logger.info('Generating call summary', { 
        transcriptLength: transcript.length,
        responseCount: aiResponses.length
      });

      const summaryPrompt = `Please provide a concise summary of this phone conversation between a user and Friday (AI assistant).

Conversation Transcript:
${transcript}

Additional Context:
- Total AI responses: ${aiResponses.length}
- Call duration: ${this.estimateCallDuration(aiResponses)}

Please provide a summary that includes:
1. Main topics discussed (2-3 sentences)
2. Key requests or questions from the user
3. How the AI assistant helped or responded
4. Any follow-up actions mentioned

Keep the summary professional and under 200 words.`;

      const result = await this.model.generateContent(summaryPrompt);
      const summary = result.response.text();

      logger.info('Call summary generated', { 
        summaryLength: summary.length
      });

      return this.cleanResponseForText(summary);

    } catch (error) {
      logger.error('Error generating call summary', error);
      
      // Return basic fallback summary
      return `Call summary: User had a ${aiResponses.length > 3 ? 'detailed' : 'brief'} conversation with AI assistant Friday. ${aiResponses.length} responses exchanged. Call completed successfully.`;
    }
  }

  /**
   * Generate contextual follow-up questions
   */
  async generateFollowUpQuestions(transcript, topic) {
    try {
      if (!this.model) {
        throw new Error('Gemini model not initialized');
      }

      const followUpPrompt = `Based on this conversation about ${topic}, suggest 2-3 relevant follow-up questions that the AI assistant could ask to be more helpful.

Conversation context:
${transcript.slice(-500)} // Last 500 characters

Provide questions that:
- Are natural and conversational
- Help clarify user needs
- Show active listening
- Are appropriate for voice interaction

Format as simple questions, one per line.`;

      const result = await this.model.generateContent(followUpPrompt);
      const questions = result.response.text();

      return questions.split('\n').filter(q => q.trim().length > 0);

    } catch (error) {
      logger.error('Error generating follow-up questions', error);
      return [
        "Is there anything specific you'd like me to help you with?",
        "Would you like me to explain that in more detail?",
        "Do you have any other questions I can help with?"
      ];
    }
  }

  /**
   * Analyze conversation sentiment and engagement
   */
  async analyzeConversation(transcript, aiResponses = []) {
    try {
      if (!this.model) {
        throw new Error('Gemini model not initialized');
      }

      const analysisPrompt = `Analyze this phone conversation for:
1. Overall sentiment (positive/neutral/negative)
2. User engagement level (high/medium/low)
3. Conversation quality (excellent/good/fair/poor)
4. Key topics mentioned
5. Any issues or concerns raised

Conversation:
${transcript}

Provide analysis in JSON format:
{
  "sentiment": "positive|neutral|negative",
  "engagement": "high|medium|low", 
  "quality": "excellent|good|fair|poor",
  "topics": ["topic1", "topic2"],
  "issues": ["issue1", "issue2"],
  "recommendations": "Brief recommendations for improvement"
}`;

      const result = await this.model.generateContent(analysisPrompt);
      const analysis = result.response.text();

      try {
        return JSON.parse(analysis);
      } catch (parseError) {
        logger.warn('Could not parse conversation analysis JSON', { analysis });
        return {
          sentiment: 'neutral',
          engagement: 'medium',
          quality: 'good',
          topics: ['general conversation'],
          issues: [],
          recommendations: 'Continue providing helpful responses'
        };
      }

    } catch (error) {
      logger.error('Error analyzing conversation', error);
      return null;
    }
  }

  /**
   * Build conversation context for the AI model
   */
  buildConversationContext(currentInput, previousTranscript, aiResponses) {
    let context = this.systemPrompt + '\n\n';

    // Add conversation history if available
    if (previousTranscript && previousTranscript.length > 0) {
      // Limit context to last 1000 characters to manage token usage
      const recentTranscript = previousTranscript.slice(-1000);
      context += `Previous conversation context:\n${recentTranscript}\n\n`;
    }

    // Add recent AI responses for continuity
    if (aiResponses && aiResponses.length > 0) {
      const recentResponses = aiResponses.slice(-3); // Last 3 responses
      context += 'Recent AI responses for context:\n';
      recentResponses.forEach((response, index) => {
        context += `${index + 1}. User: "${response.userInput}"\n   AI: "${response.aiResponse}"\n`;
      });
      context += '\n';
    }

    // Add current user input
    context += `Current user input: "${currentInput}"\n\n`;
    context += 'Please provide a helpful, conversational response suitable for voice interaction:';

    return context;
  }

  /**
   * Clean response text for voice synthesis
   */
  cleanResponseForVoice(text) {
    return text
      .trim()
      .replace(/\*\*/g, '') // Remove markdown bold
      .replace(/\*/g, '') // Remove markdown emphasis
      .replace(/#{1,6}\s/g, '') // Remove markdown headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert markdown links to text
      .replace(/```[\s\S]*?```/g, 'code block') // Replace code blocks
      .replace(/`([^`]+)`/g, '$1') // Remove inline code formatting
      .replace(/\n{2,}/g, '. ') // Replace multiple newlines with periods
      .replace(/\n/g, ' ') // Replace single newlines with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/([.!?])\s*([.!?])+/g, '$1') // Remove repeated punctuation
      .trim();
  }

  /**
   * Clean response text for text display
   */
  cleanResponseForText(text) {
    return text
      .trim()
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .replace(/\s+/g, ' ') // Normalize whitespace within lines
      .trim();
  }

  /**
   * Estimate call duration from AI responses
   */
  estimateCallDuration(aiResponses) {
    if (!aiResponses || aiResponses.length === 0) {
      return '< 1 minute';
    }

    // Rough estimation: 30 seconds per exchange
    const estimatedSeconds = aiResponses.length * 30;
    const minutes = Math.ceil(estimatedSeconds / 60);

    if (minutes < 1) {
      return '< 1 minute';
    } else if (minutes === 1) {
      return '1 minute';
    } else {
      return `${minutes} minutes`;
    }
  }

  /**
   * Check if response needs to be shortened for voice
   */
  shouldShortenResponse(text) {
    // If response is over 150 words or 800 characters, consider shortening
    const wordCount = text.split(/\s+/).length;
    return wordCount > 150 || text.length > 800;
  }

  /**
   * Generate shorter version of response for voice
   */
  async generateShorterResponse(originalResponse, userInput) {
    try {
      const shortenPrompt = `Please provide a shorter, more concise version of this response that's better for voice interaction:

Original response: "${originalResponse}"

User's original question: "${userInput}"

Requirements:
- Keep the main information and helpfulness
- Make it under 50 words
- Ensure it flows well when spoken aloud
- Maintain a friendly, conversational tone`;

      const result = await this.model.generateContent(shortenPrompt);
      return this.cleanResponseForVoice(result.response.text());

    } catch (error) {
      logger.error('Error generating shorter response', error);
      
      // Fallback: truncate the original response
      const words = originalResponse.split(' ');
      if (words.length > 50) {
        return words.slice(0, 50).join(' ') + '...';
      }
      return originalResponse;
    }
  }

  /**
   * Test the Gemini API connection
   */
  async testConnection() {
    try {
      if (!this.model) {
        return { success: false, error: 'Gemini model not initialized' };
      }

      const result = await this.model.generateContent('Hello, this is a test. Please respond briefly.');
      const response = result.response.text();

      logger.info('Gemini API test successful');
      return { 
        success: true, 
        response: response,
        model: this.modelName
      };

    } catch (error) {
      logger.error('Gemini API test failed', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Method aliases for compatibility with different naming conventions
  
  /**
   * Alias for cleanResponseForVoice - processes response for TTS optimization
   */
  processResponseForVoice(text) {
    return this.cleanResponseForVoice(text);
  }

  /**
   * Alias for generateSummary - generates call summary
   */
  async generateCallSummary(transcript, aiResponses = []) {
    return await this.generateSummary(transcript, aiResponses);
  }

  /**
   * Alias for shouldShortenResponse - checks if response is too long
   */
  isResponseTooLong(text) {
    return this.shouldShortenResponse(text);
  }

  /**
   * Alias for generateShorterResponse - shortens response
   */
  async shortenResponse(originalResponse, userInput) {
    return await this.generateShorterResponse(originalResponse, userInput);
  }
}

export default GeminiService;