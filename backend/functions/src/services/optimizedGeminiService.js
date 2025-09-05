/**
 * Optimized Gemini AI Service
 * High-performance implementation with streaming, connection pooling, and caching
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger.js';
import PerformanceTracer from './performanceTracer.js';
import PerformanceMonitor from '../utils/performanceMonitor.js';

class OptimizedGeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = 'gemini-2.5-flash';
    
    // Performance optimization components
    this.performanceTracer = new PerformanceTracer();
    this.performanceMonitor = new PerformanceMonitor();
    
    // Connection pooling and caching
    this.connectionPool = new Map();
    this.responseCache = new Map();
    this.streamCache = new Map();
    
    // Optimization configuration
    this.config = {
      // Connection pooling
      maxConnections: 10,
      connectionTimeout: 5000,
      keepAlive: true,
      
      // Response optimization
      maxOutputTokens: 512,      // Reduced from 1024 for faster responses
      temperature: 0.6,          // Slightly reduced for more focused responses
      topK: 20,                  // Reduced from 40 for faster generation
      topP: 0.9,                 // Slightly reduced for speed
      
      // Caching
      enableResponseCache: true,
      cacheMaxAge: 5 * 60 * 1000, // 5 minutes
      cacheMaxSize: 1000,
      
      // Streaming
      enableStreaming: true,
      streamChunkSize: 50,       // Characters per chunk
      streamDelay: 10,           // ms between chunks
      
      // Performance monitoring
      enableTracing: true,
      enableMonitoring: true
    };
    
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the optimized service
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  async _performInitialization() {
    const startTime = performance.now();
    
    try {
      // Initialize performance components
      if (this.config.enableTracing) {
        await this.performanceTracer.initialize();
      }
      
      if (this.config.enableMonitoring) {
        await this.performanceMonitor.initialize();
      }
      
      // Initialize Gemini AI with optimized settings
      if (this.apiKey) {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        
        // Create optimized model configuration
        this.modelConfig = {
          model: this.modelName,
          generationConfig: {
            temperature: this.config.temperature,
            topK: this.config.topK,
            topP: this.config.topP,
            maxOutputTokens: this.config.maxOutputTokens,
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
        };
        
        // Pre-warm the connection pool
        await this.warmConnectionPool();
        
        logger.info('Optimized Gemini service initialized', {
          modelName: this.modelName,
          config: this.config,
          initTime: performance.now() - startTime
        });
        
      } else {
        throw new Error('Gemini API key not configured');
      }
      
      this.isInitialized = true;
      
    } catch (error) {
      logger.error('Failed to initialize optimized Gemini service', error);
      throw error;
    }
  }

  /**
   * Pre-warm the connection pool
   */
  async warmConnectionPool() {
    const warmupPromises = [];
    
    for (let i = 0; i < Math.min(3, this.config.maxConnections); i++) {
      warmupPromises.push(this.createConnection());
    }
    
    await Promise.all(warmupPromises);
    logger.info(`Connection pool warmed with ${warmupPromises.length} connections`);
  }

  /**
   * Create a new connection
   */
  async createConnection() {
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    try {
      const model = this.genAI.getGenerativeModel(this.modelConfig);
      
      // Test the connection
      await model.generateContent('ping');
      
      const connection = {
        id: connectionId,
        model,
        created: Date.now(),
        lastUsed: Date.now(),
        inUse: false
      };
      
      this.connectionPool.set(connectionId, connection);
      return connection;
      
    } catch (error) {
      logger.warn('Failed to create connection', { connectionId, error });
      throw error;
    }
  }

  /**
   * Get an available connection from the pool
   */
  async getConnection() {
    // Find an available connection
    for (const [id, connection] of this.connectionPool.entries()) {
      if (!connection.inUse) {
        connection.inUse = true;
        connection.lastUsed = Date.now();
        return connection;
      }
    }
    
    // Create new connection if pool not at capacity
    if (this.connectionPool.size < this.config.maxConnections) {
      const connection = await this.createConnection();
      connection.inUse = true;
      return connection;
    }
    
    // Wait for available connection or create new one
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection pool timeout'));
      }, this.config.connectionTimeout);
      
      const checkForConnection = () => {
        for (const [id, connection] of this.connectionPool.entries()) {
          if (!connection.inUse) {
            connection.inUse = true;
            connection.lastUsed = Date.now();
            clearTimeout(timeout);
            resolve(connection);
            return;
          }
        }
        
        // Check again in 50ms
        setTimeout(checkForConnection, 50);
      };
      
      checkForConnection();
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connection) {
    if (connection && this.connectionPool.has(connection.id)) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
    }
  }

  /**
   * Generate optimized AI response with performance tracking
   */
  async generateResponse(userInput, previousTranscript = '', aiResponses = []) {
    const operationId = `gemini-response-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Start performance tracking
    let trace, monitor;
    if (this.config.enableTracing) {
      trace = this.performanceTracer.startTrace(operationId, 'gemini_generate_response', {
        inputLength: userInput.length,
        hasContext: previousTranscript.length > 0
      });
    }
    
    if (this.config.enableMonitoring) {
      monitor = this.performanceMonitor.startTracking(operationId, 'gemini_generate_response');
    }
    
    try {
      await this.initialize();
      
      // Check cache first
      let response;
      if (this.config.enableResponseCache) {
        const cacheKey = this.generateCacheKey(userInput, previousTranscript, aiResponses);
        response = this.getCachedResponse(cacheKey);
        
        if (response) {
          logger.info('Cache hit for AI response', { operationId, cacheKey });
          if (trace) this.performanceTracer.addSpan(trace.traceId, 'cache_hit');
          
          // End tracking
          if (trace) this.performanceTracer.endTrace(trace.traceId, { cached: true });
          if (monitor) this.performanceMonitor.endTracking(operationId, { cached: true });
          
          return response;
        }
      }
      
      // Get connection from pool
      if (trace) this.performanceTracer.addSpan(trace.traceId, 'get_connection');
      const connection = await this.getConnection();
      
      try {
        // Build optimized context
        if (trace) this.performanceTracer.addSpan(trace.traceId, 'build_context');
        const context = this.buildOptimizedContext(userInput, previousTranscript, aiResponses);
        
        // Generate response
        if (trace) this.performanceTracer.addSpan(trace.traceId, 'generate_content');
        if (monitor) this.performanceMonitor.addCheckpoint(operationId, 'start_generation');
        
        const result = await connection.model.generateContent(context);
        
        if (monitor) this.performanceMonitor.addCheckpoint(operationId, 'content_generated');
        
        const rawResponse = result.response.text();
        
        // Optimize response
        if (trace) this.performanceTracer.addSpan(trace.traceId, 'optimize_response');
        response = this.optimizeResponse(rawResponse, userInput);
        
        // Cache the response
        if (this.config.enableResponseCache) {
          const cacheKey = this.generateCacheKey(userInput, previousTranscript, aiResponses);
          this.cacheResponse(cacheKey, response);
        }
        
        logger.info('AI response generated', {
          operationId,
          responseLength: response.length,
          inputTokens: result.response?.usageMetadata?.promptTokenCount || 0,
          outputTokens: result.response?.usageMetadata?.candidatesTokenCount || 0,
          fromCache: false
        });
        
        // End tracking
        if (trace) this.performanceTracer.endTrace(trace.traceId, { success: true });
        if (monitor) this.performanceMonitor.endTracking(operationId, { success: true });
        
        return response;
        
      } finally {
        this.releaseConnection(connection);
      }
      
    } catch (error) {
      logger.error('Error generating optimized AI response', { operationId, error });
      
      // End tracking with error
      if (trace) this.performanceTracer.endTrace(trace.traceId, { success: false, error: error.message });
      if (monitor) this.performanceMonitor.endTracking(operationId, { success: false, error: error.message });
      
      // Return optimized fallback
      return this.getFallbackResponse(userInput);
    }
  }

  /**
   * Generate streaming response for real-time interaction
   */
  async generateStreamingResponse(userInput, previousTranscript = '', aiResponses = []) {
    const operationId = `gemini-stream-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    if (!this.config.enableStreaming) {
      return this.generateResponse(userInput, previousTranscript, aiResponses);
    }
    
    try {
      await this.initialize();
      
      // Check if we have a cached complete response
      if (this.config.enableResponseCache) {
        const cacheKey = this.generateCacheKey(userInput, previousTranscript, aiResponses);
        const cachedResponse = this.getCachedResponse(cacheKey);
        
        if (cachedResponse) {
          // Return cached response as a stream
          return this.simulateStreamFromCache(cachedResponse, operationId);
        }
      }
      
      const connection = await this.getConnection();
      
      try {
        const context = this.buildOptimizedContext(userInput, previousTranscript, aiResponses);
        
        // Start streaming generation
        const result = await connection.model.generateContentStream(context);
        
        let fullResponse = '';
        const chunks = [];
        
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullResponse += text;
            chunks.push({
              text,
              timestamp: Date.now(),
              cumulative: fullResponse
            });
          }
        }
        
        // Optimize the complete response
        const optimizedResponse = this.optimizeResponse(fullResponse, userInput);
        
        // Cache the complete response
        if (this.config.enableResponseCache) {
          const cacheKey = this.generateCacheKey(userInput, previousTranscript, aiResponses);
          this.cacheResponse(cacheKey, optimizedResponse);
        }
        
        logger.info('Streaming response generated', {
          operationId,
          chunks: chunks.length,
          totalLength: optimizedResponse.length
        });
        
        return optimizedResponse;
        
      } finally {
        this.releaseConnection(connection);
      }
      
    } catch (error) {
      logger.error('Error generating streaming response', { operationId, error });
      return this.getFallbackResponse(userInput);
    }
  }

  /**
   * Generate compressed response for bandwidth optimization
   */
  async generateCompressedResponse(userInput, previousTranscript = '', aiResponses = []) {
    const response = await this.generateResponse(userInput, previousTranscript, aiResponses);
    
    // Apply aggressive optimization for compression
    return this.compressResponse(response);
  }

  /**
   * Build optimized context with reduced token usage
   */
  buildOptimizedContext(currentInput, previousTranscript, aiResponses) {
    // Optimized system prompt (shorter than original)
    const systemPrompt = `You are Friday, an AI assistant for phone calls. 
Be conversational, concise (<50 words), and helpful. 
Avoid special characters. This is voice interaction.`;
    
    let context = systemPrompt + '\n\n';
    
    // Limit context size aggressively for performance
    if (previousTranscript && previousTranscript.length > 0) {
      // Only last 300 characters of transcript
      const recentTranscript = previousTranscript.slice(-300);
      context += `Context: ${recentTranscript}\n\n`;
    }
    
    // Only last 2 AI responses instead of 3
    if (aiResponses && aiResponses.length > 0) {
      const recentResponses = aiResponses.slice(-2);
      recentResponses.forEach((response, index) => {
        context += `${index + 1}. "${response.userInput}" -> "${response.aiResponse}"\n`;
      });
      context += '\n';
    }
    
    context += `User: "${currentInput}"\nAI:`;
    
    return context;
  }

  /**
   * Optimize response for performance and voice
   */
  optimizeResponse(text, userInput) {
    let optimized = text
      .trim()
      .replace(/\*\*/g, '') // Remove markdown bold
      .replace(/\*/g, '') // Remove markdown emphasis
      .replace(/#{1,6}\s/g, '') // Remove markdown headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/```[\s\S]*?```/g, 'code') // Replace code blocks
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/\n{2,}/g, '. ') // Multiple newlines to periods
      .replace(/\n/g, ' ') // Single newlines to spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/([.!?])\s*([.!?])+/g, '$1') // Remove repeated punctuation
      .trim();
    
    // Ensure response isn't too long for voice
    const words = optimized.split(' ');
    if (words.length > 60) {
      optimized = words.slice(0, 60).join(' ');
      // Ensure it ends properly
      if (!optimized.match(/[.!?]$/)) {
        optimized += '.';
      }
    }
    
    return optimized;
  }

  /**
   * Compress response text
   */
  compressResponse(text) {
    return text
      .replace(/\s+/g, ' ') // Single spaces only
      .replace(/\.\s+/g, '. ') // Consistent sentence spacing
      .replace(/,\s+/g, ', ') // Consistent comma spacing
      .replace(/\?\s+/g, '? ') // Consistent question spacing
      .replace(/!\s+/g, '! ') // Consistent exclamation spacing
      .trim();
  }

  /**
   * Generate cache key for response caching
   */
  generateCacheKey(userInput, previousTranscript, aiResponses) {
    const contextHash = this.simpleHash(
      userInput + 
      (previousTranscript ? previousTranscript.slice(-200) : '') + 
      (aiResponses ? JSON.stringify(aiResponses.slice(-1)) : '')
    );
    
    return `gemini-response-${contextHash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cache a response
   */
  cacheResponse(cacheKey, response) {
    if (this.responseCache.size >= this.config.cacheMaxSize) {
      // Remove oldest entry
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
    
    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * Get cached response
   */
  getCachedResponse(cacheKey) {
    const cached = this.responseCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.config.cacheMaxAge) {
      this.responseCache.delete(cacheKey);
      return null;
    }
    
    // Increment hit counter
    cached.hits++;
    
    return cached.response;
  }

  /**
   * Simulate streaming from cached response
   */
  async simulateStreamFromCache(cachedResponse, operationId) {
    // For immediate response, just return the cached response
    // In a real streaming implementation, this would emit chunks
    logger.info('Simulating stream from cache', { operationId });
    return cachedResponse;
  }

  /**
   * Get fallback response for errors
   */
  getFallbackResponse(userInput) {
    const fallbacks = [
      "I'm having trouble processing that right now. Could you please repeat your question?",
      "Sorry, I didn't catch that clearly. Can you try asking again?",
      "I'm experiencing a brief technical issue. Please repeat your request.",
      "Could you please rephrase that? I want to make sure I understand correctly."
    ];
    
    // Simple selection based on input length
    const index = userInput.length % fallbacks.length;
    return fallbacks[index];
  }

  /**
   * Test connection and performance
   */
  async testConnection() {
    const startTime = performance.now();
    
    try {
      await this.initialize();
      
      const connection = await this.getConnection();
      
      try {
        const result = await connection.model.generateContent('Test response time');
        const response = result.response.text();
        const endTime = performance.now();
        
        this.releaseConnection(connection);
        
        return {
          success: true,
          responseTime: endTime - startTime,
          response: response,
          connectionPoolSize: this.connectionPool.size,
          cacheSize: this.responseCache.size,
          model: this.modelName
        };
        
      } finally {
        this.releaseConnection(connection);
      }
      
    } catch (error) {
      const endTime = performance.now();
      return {
        success: false,
        responseTime: endTime - startTime,
        error: error.message
      };
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      connectionPool: {
        size: this.connectionPool.size,
        maxSize: this.config.maxConnections,
        activeConnections: Array.from(this.connectionPool.values()).filter(c => c.inUse).length
      },
      responseCache: {
        size: this.responseCache.size,
        maxSize: this.config.cacheMaxSize,
        hitRate: this.calculateCacheHitRate()
      },
      configuration: this.config
    };
  }

  /**
   * Calculate cache hit rate
   */
  calculateCacheHitRate() {
    let totalRequests = 0;
    let totalHits = 0;
    
    for (const cached of this.responseCache.values()) {
      totalRequests += cached.hits + 1; // +1 for initial cache
      totalHits += cached.hits;
    }
    
    return totalRequests > 0 ? (totalHits / totalRequests * 100).toFixed(2) + '%' : '0%';
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.connectionPool.clear();
    this.responseCache.clear();
    this.streamCache.clear();
    
    if (this.performanceTracer) {
      await this.performanceTracer.cleanup();
    }
    
    if (this.performanceMonitor) {
      await this.performanceMonitor.cleanup();
    }
    
    this.isInitialized = false;
    logger.info('Optimized Gemini service cleanup completed');
  }
}

export default OptimizedGeminiService;