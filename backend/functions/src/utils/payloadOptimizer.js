/**
 * Payload Optimizer
 * Optimizes API payloads for minimal size and maximum performance
 */

import zlib from 'zlib';
import { promisify } from 'util';
import logger from './logger.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

class PayloadOptimizer {
  constructor(options = {}) {
    this.options = {
      // Compression settings
      compressionThreshold: options.compressionThreshold || 1024, // bytes
      compressionLevel: options.compressionLevel || 6, // 1-9 (6 is balanced)
      algorithm: options.algorithm || 'gzip', // 'gzip' or 'deflate'
      
      // Content optimization
      stripWhitespace: options.stripWhitespace !== false,
      removeEmptyFields: options.removeEmptyFields !== false,
      minifyJson: options.minifyJson !== false,
      truncateStrings: options.truncateStrings !== false,
      
      // Size limits
      maxPayloadSize: options.maxPayloadSize || 10 * 1024, // 10KB
      maxStringLength: options.maxStringLength || 1000,
      maxArrayLength: options.maxArrayLength || 100,
      
      // Voice optimization
      optimizeForVoice: options.optimizeForVoice !== false,
      maxVoiceResponseWords: options.maxVoiceResponseWords || 50,
      
      // Caching
      enableCaching: options.enableCaching !== false,
      cacheMaxSize: options.cacheMaxSize || 1000,
      cacheMaxAge: options.cacheMaxAge || 5 * 60 * 1000, // 5 minutes
      
      ...options
    };
    
    // Compression cache
    this.compressionCache = new Map();
    this.decompressionCache = new Map();
    
    // Statistics
    this.stats = {
      totalOptimizations: 0,
      totalCompressions: 0,
      totalDecompressions: 0,
      totalBytesReduced: 0,
      averageCompressionRatio: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Optimize a payload for transmission
   */
  async optimizePayload(payload, type = 'json') {
    const startTime = performance.now();
    let optimized = payload;
    const originalSize = this.getPayloadSize(payload);
    
    try {
      // Content optimization based on type
      switch (type) {
        case 'json':
          optimized = this.optimizeJson(payload);
          break;
        case 'text':
          optimized = this.optimizeText(payload);
          break;
        case 'voice':
          optimized = this.optimizeVoiceResponse(payload);
          break;
        case 'twiml':
          optimized = this.optimizeTwiML(payload);
          break;
        default:
          optimized = payload;
      }
      
      const afterOptimizationSize = this.getPayloadSize(optimized);
      
      // Compression if beneficial
      let compressed = null;
      let compressionRatio = 1;
      
      if (afterOptimizationSize >= this.options.compressionThreshold) {
        const compressionResult = await this.compressPayload(optimized);
        
        if (compressionResult.compressed.length < afterOptimizationSize * 0.9) {
          compressed = compressionResult;
          compressionRatio = afterOptimizationSize / compressionResult.compressed.length;
        }
      }
      
      // Update statistics
      this.updateStats(originalSize, afterOptimizationSize, compressionRatio);
      
      const optimizationTime = performance.now() - startTime;
      
      const result = {
        original: payload,
        optimized,
        compressed: compressed?.compressed || null,
        metadata: {
          originalSize,
          optimizedSize: afterOptimizationSize,
          compressedSize: compressed?.compressed.length || null,
          compressionRatio,
          compressionAlgorithm: compressed?.algorithm || null,
          optimizationType: type,
          optimizationTime,
          reductionPercentage: ((originalSize - (compressed?.compressed.length || afterOptimizationSize)) / originalSize * 100).toFixed(2) + '%'
        }
      };
      
      logger.debug('Payload optimized', {
        type,
        originalSize,
        optimizedSize: afterOptimizationSize,
        compressedSize: compressed?.compressed.length || null,
        reductionPercentage: result.metadata.reductionPercentage
      });
      
      return result;
      
    } catch (error) {
      logger.error('Payload optimization failed', { type, error });
      
      return {
        original: payload,
        optimized: payload,
        compressed: null,
        metadata: {
          originalSize,
          optimizedSize: originalSize,
          compressedSize: null,
          compressionRatio: 1,
          error: error.message
        }
      };
    }
  }

  /**
   * Optimize JSON payload
   */
  optimizeJson(jsonPayload) {
    try {
      let data = typeof jsonPayload === 'string' ? JSON.parse(jsonPayload) : jsonPayload;
      
      // Remove empty fields
      if (this.options.removeEmptyFields) {
        data = this.removeEmptyFields(data);
      }
      
      // Truncate long strings
      if (this.options.truncateStrings) {
        data = this.truncateStrings(data);
      }
      
      // Limit array sizes
      data = this.limitArraySizes(data);
      
      // Minify JSON
      const optimized = this.options.minifyJson ? 
        JSON.stringify(data) : JSON.stringify(data, null, 0);
      
      return optimized;
      
    } catch (error) {
      logger.warn('JSON optimization failed', error);
      return jsonPayload;
    }
  }

  /**
   * Optimize text payload
   */
  optimizeText(textPayload) {
    let optimized = textPayload;
    
    if (this.options.stripWhitespace) {
      // Normalize whitespace
      optimized = optimized
        .replace(/\s+/g, ' ')         // Multiple spaces to single
        .replace(/\n\s*\n/g, '\n')    // Multiple newlines to single
        .trim();
    }
    
    // Limit text length
    if (optimized.length > this.options.maxStringLength) {
      optimized = optimized.substring(0, this.options.maxStringLength).trim();
      
      // Ensure it ends at a word boundary
      const lastSpace = optimized.lastIndexOf(' ');
      if (lastSpace > optimized.length * 0.8) {
        optimized = optimized.substring(0, lastSpace);
      }
      
      // Add ellipsis if truncated
      if (!optimized.match(/[.!?]$/)) {
        optimized += '...';
      }
    }
    
    return optimized;
  }

  /**
   * Optimize voice response
   */
  optimizeVoiceResponse(voiceText) {
    if (!this.options.optimizeForVoice) {
      return this.optimizeText(voiceText);
    }
    
    let optimized = voiceText;
    
    // Remove markdown formatting
    optimized = optimized
      .replace(/\*\*(.*?)\*\*/g, '$1')      // Bold
      .replace(/\*(.*?)\*/g, '$1')          // Italic
      .replace(/#{1,6}\s/g, '')             // Headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/```[\s\S]*?```/g, 'code')   // Code blocks
      .replace(/`([^`]+)`/g, '$1')          // Inline code
      .replace(/\n{2,}/g, '. ')             // Multiple newlines
      .replace(/\n/g, ' ')                  // Single newlines
      .replace(/\s+/g, ' ')                 // Normalize whitespace
      .replace(/([.!?])\s*([.!?])+/g, '$1') // Repeated punctuation
      .trim();
    
    // Limit to word count for voice
    const words = optimized.split(' ');
    if (words.length > this.options.maxVoiceResponseWords) {
      optimized = words.slice(0, this.options.maxVoiceResponseWords).join(' ');
      
      // Ensure proper ending
      if (!optimized.match(/[.!?]$/)) {
        optimized += '.';
      }
    }
    
    return optimized;
  }

  /**
   * Optimize TwiML payload
   */
  optimizeTwiML(twimlPayload) {
    let optimized = twimlPayload;
    
    if (this.options.stripWhitespace) {
      optimized = optimized
        .replace(/>\s+</g, '><')              // Remove whitespace between tags
        .replace(/\s+/g, ' ')                 // Normalize internal whitespace
        .replace(/<!--[\s\S]*?-->/g, '')      // Remove comments
        .trim();
    }
    
    return optimized;
  }

  /**
   * Remove empty fields from object
   */
  removeEmptyFields(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeEmptyFields(item))
                .filter(item => item !== null && item !== undefined);
    }
    
    if (obj && typeof obj === 'object') {
      const cleaned = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value) && value.length === 0) {
            continue; // Skip empty arrays
          }
          if (typeof value === 'object' && Object.keys(value).length === 0) {
            continue; // Skip empty objects
          }
          
          cleaned[key] = this.removeEmptyFields(value);
        }
      }
      
      return cleaned;
    }
    
    return obj;
  }

  /**
   * Truncate long strings in object
   */
  truncateStrings(obj, maxLength = null) {
    const limit = maxLength || this.options.maxStringLength;
    
    if (typeof obj === 'string') {
      return obj.length > limit ? obj.substring(0, limit) + '...' : obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.truncateStrings(item, limit));
    }
    
    if (obj && typeof obj === 'object') {
      const truncated = {};
      
      for (const [key, value] of Object.entries(obj)) {
        truncated[key] = this.truncateStrings(value, limit);
      }
      
      return truncated;
    }
    
    return obj;
  }

  /**
   * Limit array sizes in object
   */
  limitArraySizes(obj, maxLength = null) {
    const limit = maxLength || this.options.maxArrayLength;
    
    if (Array.isArray(obj)) {
      const limited = obj.slice(0, limit);
      return limited.map(item => this.limitArraySizes(item, limit));
    }
    
    if (obj && typeof obj === 'object') {
      const limited = {};
      
      for (const [key, value] of Object.entries(obj)) {
        limited[key] = this.limitArraySizes(value, limit);
      }
      
      return limited;
    }
    
    return obj;
  }

  /**
   * Compress payload
   */
  async compressPayload(payload) {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const cacheKey = this.generateCompressionCacheKey(payloadString);
    
    // Check cache
    if (this.options.enableCaching) {
      const cached = this.compressionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.options.cacheMaxAge) {
        this.stats.cacheHits++;
        return cached.result;
      }
      this.stats.cacheMisses++;
    }
    
    try {
      const startTime = performance.now();
      let compressed;
      
      const compressionOptions = {
        level: this.options.compressionLevel,
        chunkSize: 16 * 1024
      };
      
      if (this.options.algorithm === 'gzip') {
        compressed = await gzip(payloadString, compressionOptions);
      } else if (this.options.algorithm === 'deflate') {
        compressed = await deflate(payloadString, compressionOptions);
      } else {
        throw new Error(`Unsupported compression algorithm: ${this.options.algorithm}`);
      }
      
      const compressionTime = performance.now() - startTime;
      
      const result = {
        compressed,
        algorithm: this.options.algorithm,
        originalSize: payloadString.length,
        compressedSize: compressed.length,
        compressionRatio: payloadString.length / compressed.length,
        compressionTime
      };
      
      // Cache result
      if (this.options.enableCaching) {
        this.cacheCompressionResult(cacheKey, result);
      }
      
      this.stats.totalCompressions++;
      
      return result;
      
    } catch (error) {
      logger.error('Compression failed', error);
      throw error;
    }
  }

  /**
   * Decompress payload
   */
  async decompressPayload(compressedBuffer, algorithm) {
    const cacheKey = this.generateDecompressionCacheKey(compressedBuffer, algorithm);
    
    // Check cache
    if (this.options.enableCaching) {
      const cached = this.decompressionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.options.cacheMaxAge) {
        this.stats.cacheHits++;
        return cached.result;
      }
      this.stats.cacheMisses++;
    }
    
    try {
      const startTime = performance.now();
      let decompressed;
      
      if (algorithm === 'gzip') {
        decompressed = await gunzip(compressedBuffer);
      } else if (algorithm === 'deflate') {
        decompressed = await inflate(compressedBuffer);
      } else {
        throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
      }
      
      const decompressionTime = performance.now() - startTime;
      const result = {
        decompressed: decompressed.toString(),
        decompressionTime
      };
      
      // Cache result
      if (this.options.enableCaching) {
        this.cacheDecompressionResult(cacheKey, result);
      }
      
      this.stats.totalDecompressions++;
      
      return result;
      
    } catch (error) {
      logger.error('Decompression failed', error);
      throw error;
    }
  }

  /**
   * Get payload size in bytes
   */
  getPayloadSize(payload) {
    if (Buffer.isBuffer(payload)) {
      return payload.length;
    }
    
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return Buffer.byteLength(payloadString, 'utf8');
  }

  /**
   * Generate cache key for compression
   */
  generateCompressionCacheKey(payload) {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = ((hash << 5) - hash + payload.charCodeAt(i)) & 0xffffffff;
    }
    return `comp_${this.options.algorithm}_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Generate cache key for decompression
   */
  generateDecompressionCacheKey(buffer, algorithm) {
    const hash = buffer.reduce((hash, byte) => ((hash << 5) - hash + byte) & 0xffffffff, 0);
    return `decomp_${algorithm}_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Cache compression result
   */
  cacheCompressionResult(cacheKey, result) {
    if (this.compressionCache.size >= this.options.cacheMaxSize) {
      // Remove oldest entry
      const firstKey = this.compressionCache.keys().next().value;
      this.compressionCache.delete(firstKey);
    }
    
    this.compressionCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Cache decompression result
   */
  cacheDecompressionResult(cacheKey, result) {
    if (this.decompressionCache.size >= this.options.cacheMaxSize) {
      // Remove oldest entry
      const firstKey = this.decompressionCache.keys().next().value;
      this.decompressionCache.delete(firstKey);
    }
    
    this.decompressionCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Update statistics
   */
  updateStats(originalSize, optimizedSize, compressionRatio) {
    this.stats.totalOptimizations++;
    this.stats.totalBytesReduced += (originalSize - optimizedSize);
    
    // Update average compression ratio
    const alpha = 0.1; // Smoothing factor
    if (this.stats.averageCompressionRatio === 0) {
      this.stats.averageCompressionRatio = compressionRatio;
    } else {
      this.stats.averageCompressionRatio = 
        (alpha * compressionRatio) + ((1 - alpha) * this.stats.averageCompressionRatio);
    }
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    const cacheTotal = this.stats.cacheHits + this.stats.cacheMisses;
    
    return {
      ...this.stats,
      cacheHitRate: cacheTotal > 0 ? 
        (this.stats.cacheHits / cacheTotal * 100).toFixed(2) + '%' : '0%',
      compressionCacheSize: this.compressionCache.size,
      decompressionCacheSize: this.decompressionCache.size,
      averageReductionBytes: this.stats.totalOptimizations > 0 ? 
        Math.round(this.stats.totalBytesReduced / this.stats.totalOptimizations) : 0
    };
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.compressionCache.clear();
    this.decompressionCache.clear();
    
    logger.info('Payload optimizer caches cleared');
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.clearCaches();
    
    // Reset statistics
    this.stats = {
      totalOptimizations: 0,
      totalCompressions: 0,
      totalDecompressions: 0,
      totalBytesReduced: 0,
      averageCompressionRatio: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    logger.info('Payload optimizer cleanup completed');
  }
}

export default PayloadOptimizer;