/**
 * Error Handler Service
 * Comprehensive error handling with retry logic, circuit breakers, and fallback strategies
 */

import logger from '../utils/logger.js';

class ErrorHandler {
  constructor() {
    this.circuits = new Map(); // Circuit breaker states
    this.errorMetrics = {
      totalErrors: 0,
      totalSuccess: 0,
      errorsByCategory: {},
      errorsByService: {},
      recentErrors: []
    };
    
    this.config = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      circuitFailureThreshold: 5,
      circuitTimeout: 60000, // 1 minute
      circuitSuccessThreshold: 3
    };

    // Error classification rules
    this.errorClassification = {
      NETWORK: {
        codes: ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNABORTED'],
        statuses: [502, 503, 504],
        severity: 'HIGH',
        retryable: true,
        baseDelay: 2000
      },
      RATE_LIMIT: {
        statuses: [429],
        severity: 'MEDIUM',
        retryable: true,
        baseDelay: 5000
      },
      AUTHENTICATION: {
        statuses: [401, 403],
        severity: 'HIGH',
        retryable: false
      },
      VALIDATION: {
        statuses: [400, 422],
        severity: 'LOW',
        retryable: false
      },
      SERVER: {
        statuses: [500, 502, 503, 504],
        severity: 'HIGH',
        retryable: true,
        baseDelay: 3000
      },
      NOT_FOUND: {
        statuses: [404],
        severity: 'MEDIUM',
        retryable: false
      }
    };

    // Fallback responses for different services
    this.fallbackResponses = {
      gemini: {
        default: "I'm sorry, I'm having trouble processing your request right now. Could you please try again or call back later?",
        rateLimit: "I'm currently experiencing high demand. Please hold on while I process your request.",
        timeout: "I didn't catch that. Could you please repeat your question?"
      },
      twilio: {
        error: `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">I'm sorry, I'm experiencing technical difficulties. Please try calling again in a few minutes.</Say>
            <Hangup/>
          </Response>`,
        timeout: `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">I didn't hear anything. Please try calling again.</Say>
            <Hangup/>
          </Response>`
      },
      speech: {
        error: '[Audio processing failed]',
        timeout: '[No speech detected]'
      }
    };
  }

  /**
   * Classify error for appropriate handling
   */
  classifyError(error) {
    const classification = {
      category: 'UNKNOWN',
      severity: 'MEDIUM',
      retryable: false,
      retryDelay: this.config.baseDelay
    };

    // Check each classification rule
    for (const [category, rules] of Object.entries(this.errorClassification)) {
      const matchesCodes = rules.codes?.includes(error.code);
      const matchesStatus = rules.statuses?.includes(error.status);
      const matchesMessage = rules.messages?.some(msg => 
        error.message?.toLowerCase().includes(msg.toLowerCase())
      );

      if (matchesCodes || matchesStatus || matchesMessage) {
        classification.category = category;
        classification.severity = rules.severity;
        classification.retryable = rules.retryable;
        classification.retryDelay = rules.baseDelay || this.config.baseDelay;
        break;
      }
    }

    // Special handling for rate limit errors
    if (classification.category === 'RATE_LIMIT') {
      const retryAfter = error.headers?.['retry-after'] || error.retryAfter;
      if (retryAfter) {
        classification.retryDelay = parseInt(retryAfter) * 1000;
      }
    }

    return classification;
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  async executeWithRetry(operation, options = {}) {
    const config = { ...this.config, ...options };
    let lastError;
    let delay = options.baseDelay || config.baseDelay;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Track success
        this.trackSuccess({ attempt, totalAttempts: attempt + 1 });
        
        if (attempt > 0) {
          logger.info('Operation succeeded after retry', {
            attempt,
            totalAttempts: attempt + 1
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        const classification = this.classifyError(error);
        
        // Track error
        this.trackError(error, { attempt, operation: operation.name });

        // Don't retry if not retryable or max attempts reached
        if (!classification.retryable || attempt >= config.maxRetries) {
          break;
        }

        // Check custom retry condition if provided
        if (config.retryCondition && !config.retryCondition(error)) {
          break;
        }

        // Log retry attempt
        logger.warn('Operation failed, retrying', {
          error: error.message,
          attempt: attempt + 1,
          nextRetryIn: `${delay}ms`,
          category: classification.category
        });

        // Wait before retry with exponential backoff
        await this.sleep(delay);
        delay = Math.min(delay * 2, config.maxDelay);
      }
    }

    // All retries exhausted
    logger.error('Max retries exceeded', lastError, {
      maxRetries: config.maxRetries,
      operation: operation.name
    });

    throw lastError;
  }

  /**
   * Execute operation with circuit breaker pattern
   */
  async executeWithCircuitBreaker(circuitName, operation, options = {}) {
    const circuit = this.getOrCreateCircuit(circuitName);
    const config = { ...this.config, ...options };

    // Check circuit state
    if (circuit.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - circuit.lastFailureTime;
      
      if (timeSinceLastFailure < config.circuitTimeout) {
        const error = new Error(`Circuit breaker is OPEN for ${circuitName}`);
        error.circuitState = circuit.state;
        throw error;
      } else {
        // Move to half-open state
        circuit.state = 'HALF_OPEN';
        logger.info('Circuit breaker moving to HALF_OPEN', { circuitName });
      }
    }

    try {
      const result = await operation();
      
      // Operation succeeded
      circuit.successCount++;
      circuit.failureCount = 0; // Reset failure count on success

      // Close circuit if enough successes in half-open state
      if (circuit.state === 'HALF_OPEN' && 
          circuit.successCount >= config.circuitSuccessThreshold) {
        circuit.state = 'CLOSED';
        circuit.successCount = 0;
        logger.info('Circuit breaker CLOSED', { circuitName });
      }

      return result;
    } catch (error) {
      // Operation failed
      circuit.failureCount++;
      circuit.lastFailureTime = Date.now();
      circuit.successCount = 0; // Reset success count on failure

      // Open circuit if failure threshold exceeded
      if (circuit.failureCount >= config.circuitFailureThreshold) {
        circuit.state = 'OPEN';
        logger.warn('Circuit breaker OPENED', {
          circuitName,
          failureCount: circuit.failureCount,
          threshold: config.circuitFailureThreshold
        });
      }

      throw error;
    }
  }

  /**
   * Get or create circuit breaker state
   */
  getOrCreateCircuit(name) {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0
      });
    }
    return this.circuits.get(name);
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(name) {
    return this.circuits.get(name) || null;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(name) {
    if (this.circuits.has(name)) {
      this.circuits.set(name, {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0
      });
      logger.info('Circuit breaker reset', { circuitName: name });
    }
  }

  /**
   * Handle Twilio-specific errors and provide fallbacks
   */
  getTwilioFallback(error) {
    logger.error('Twilio API error', error, {
      service: 'twilio',
      errorCode: error.code || error.status,
      moreInfo: error.moreInfo
    });

    // Determine fallback based on error type
    if (error.status === 429 || error.code === 20429) {
      return {
        type: 'FALLBACK_RESPONSE',
        action: 'GENERATE_ERROR_TWIML',
        twiml: this.fallbackResponses.twilio.timeout,
        retryAfter: 30000
      };
    }

    return {
      type: 'FALLBACK_RESPONSE',
      action: 'GENERATE_ERROR_TWIML',
      twiml: this.fallbackResponses.twilio.error
    };
  }

  /**
   * Handle Gemini API errors and provide fallbacks
   */
  getGeminiFallback(error) {
    logger.error('Gemini API error', error, {
      service: 'gemini',
      errorCode: error.status
    });

    let fallbackResponse = this.fallbackResponses.gemini.default;
    let retryAfter = 0;

    if (error.status === 429) {
      fallbackResponse = "I'm temporarily unavailable due to high demand. Please try again in a moment.";
      retryAfter = 60000; // 1 minute
    } else if (error.code === 'ETIMEDOUT') {
      fallbackResponse = this.fallbackResponses.gemini.timeout;
      retryAfter = 10000; // 10 seconds
    }

    return {
      type: 'FALLBACK_RESPONSE',
      response: fallbackResponse,
      retryAfter
    };
  }

  /**
   * Handle Google Speech API errors and provide fallbacks
   */
  getSpeechAPIFallback(error) {
    logger.error('Google Speech API error', error, {
      service: 'speech',
      errorCode: error.status
    });

    return {
      type: 'FALLBACK_RESPONSE',
      transcript: this.fallbackResponses.speech.error,
      confidence: 0,
      language: 'en-US'
    };
  }

  /**
   * Check if WebSocket connection is dropped
   */
  isConnectionDropped(websocket) {
    if (!websocket) return true;
    
    // WebSocket.CLOSED = 3
    return websocket.readyState === 3;
  }

  /**
   * Handle silent caller with timeout
   */
  handleSilentCaller(callSid, timeoutMs = 30000) {
    const timeoutId = setTimeout(() => {
      logger.warn('Silent caller timeout', {
        callSid,
        duration: timeoutMs
      });
      
      // Could trigger call termination here
      this.terminateCall(callSid, 'SILENT_TIMEOUT');
    }, timeoutMs);

    return {
      clear: () => clearTimeout(timeoutId),
      timeoutId
    };
  }

  /**
   * Gracefully terminate stream with cleanup
   */
  async terminateStreamGracefully(stream, timeoutMs = 5000) {
    return new Promise((resolve) => {
      if (!stream) {
        resolve();
        return;
      }

      let isResolved = false;
      const resolveOnce = () => {
        if (!isResolved) {
          isResolved = true;
          resolve();
        }
      };

      // Set up timeout for forced termination
      const forceTimeout = setTimeout(() => {
        if (stream.destroy) {
          stream.destroy();
        }
        logger.warn('Stream force terminated due to timeout');
        resolveOnce();
      }, timeoutMs);

      // Graceful termination
      try {
        if (stream.end) {
          stream.end();
        }
        
        // Wait for stream to close
        if (typeof stream.on === 'function') {
          stream.on('close', () => {
            clearTimeout(forceTimeout);
            logger.info('Stream terminated gracefully');
            resolveOnce();
          });
          
          stream.on('error', (error) => {
            clearTimeout(forceTimeout);
            logger.warn('Stream termination error', error);
            resolveOnce();
          });
        } else {
          // No event listeners, resolve immediately
          clearTimeout(forceTimeout);
          logger.info('Stream terminated gracefully');
          resolveOnce();
        }
      } catch (error) {
        clearTimeout(forceTimeout);
        logger.error('Error during stream termination', error);
        resolveOnce();
      }
    });
  }

  /**
   * Terminate call with reason
   */
  async terminateCall(callSid, reason) {
    logger.info('Terminating call', { callSid, reason });
    
    // Implementation would integrate with Twilio service
    // This is a placeholder for the actual termination logic
    return { callSid, terminated: true, reason };
  }

  /**
   * Track error for metrics and monitoring
   */
  trackError(error, context = {}) {
    const classification = this.classifyError(error);
    
    this.errorMetrics.totalErrors++;
    this.errorMetrics.errorsByCategory[classification.category] = 
      (this.errorMetrics.errorsByCategory[classification.category] || 0) + 1;
    
    if (context.service) {
      this.errorMetrics.errorsByService[context.service] = 
        (this.errorMetrics.errorsByService[context.service] || 0) + 1;
    }

    // Keep recent errors (limit to last 100)
    this.errorMetrics.recentErrors.push({
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: error.code,
        status: error.status
      },
      classification,
      context
    });

    if (this.errorMetrics.recentErrors.length > 100) {
      this.errorMetrics.recentErrors.shift();
    }

    // Log structured error
    logger.error('Error tracked', error, {
      classification,
      metrics: {
        totalErrors: this.errorMetrics.totalErrors,
        errorRate: this.getErrorRate()
      },
      ...context
    });
  }

  /**
   * Track successful operation
   */
  trackSuccess(context = {}) {
    this.errorMetrics.totalSuccess++;
    
    logger.debug('Success tracked', {
      totalSuccess: this.errorMetrics.totalSuccess,
      errorRate: this.getErrorRate(),
      ...context
    });
  }

  /**
   * Get error metrics
   */
  getErrorMetrics() {
    return {
      ...this.errorMetrics,
      errorRate: this.getErrorRate(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate current error rate
   */
  getErrorRate() {
    const total = this.errorMetrics.totalErrors + this.errorMetrics.totalSuccess;
    return total > 0 ? this.errorMetrics.totalErrors / total : 0;
  }

  /**
   * Generate comprehensive error report
   */
  generateErrorReport() {
    const errorRate = this.getErrorRate();
    const recentErrorsCount = this.errorMetrics.recentErrors.filter(
      err => Date.now() - new Date(err.timestamp).getTime() < 3600000 // Last hour
    ).length;

    const topErrors = Object.entries(this.errorMetrics.errorsByCategory)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    const recommendations = [];
    
    // Generate recommendations based on error patterns
    if (errorRate > 0.1) {
      recommendations.push('High error rate detected - review system health');
    }
    
    if (this.errorMetrics.errorsByCategory.NETWORK > 5) {
      recommendations.push('Network errors detected - check connectivity');
    }
    
    if (this.errorMetrics.errorsByCategory.RATE_LIMIT > 3) {
      recommendations.push('Rate limiting detected - implement backoff strategies');
    }

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalErrors: this.errorMetrics.totalErrors,
        totalSuccess: this.errorMetrics.totalSuccess,
        errorRate: errorRate,
        recentErrorsLastHour: recentErrorsCount
      },
      topErrors: topErrors.map(([category, count]) => ({ category, count })),
      circuitBreakers: Array.from(this.circuits.entries()).map(([name, state]) => ({
        name,
        ...state
      })),
      recommendations
    };
  }

  /**
   * Get recovery strategy for error type
   */
  getRecoveryStrategy(error) {
    const classification = this.classifyError(error);
    
    const strategies = {
      NETWORK: {
        immediate: 'retry with exponential backoff',
        shortTerm: 'check network connectivity and DNS resolution',
        longTerm: 'implement fallback endpoints and circuit breakers'
      },
      RATE_LIMIT: {
        immediate: 'wait for rate limit reset, implement backoff',
        shortTerm: 'implement proper rate limiting and request queuing',
        longTerm: 'optimize usage patterns and consider caching'
      },
      AUTHENTICATION: {
        immediate: 'refresh authentication tokens',
        shortTerm: 'review authentication configuration',
        longTerm: 'implement robust token management and renewal'
      },
      SERVER: {
        immediate: 'retry after delay',
        shortTerm: 'check server status and logs',
        longTerm: 'implement health checks and failover mechanisms'
      },
      VALIDATION: {
        immediate: 'fix input validation errors',
        shortTerm: 'review input validation logic',
        longTerm: 'implement comprehensive input sanitization'
      }
    };

    return strategies[classification.category] || {
      immediate: 'log error and alert monitoring',
      shortTerm: 'investigate error cause',
      longTerm: 'implement appropriate error handling'
    };
  }

  /**
   * Get system health status based on error patterns
   */
  getHealthStatus() {
    const errorRate = this.getErrorRate();
    const recentErrors = this.errorMetrics.recentErrors.filter(
      err => Date.now() - new Date(err.timestamp).getTime() < 300000 // Last 5 minutes
    );

    let status = 'HEALTHY';
    const recommendations = [];

    if (errorRate > 0.5) {
      status = 'CRITICAL';
      recommendations.push('Critical error rate - immediate attention required');
    } else if (errorRate > 0.2) {
      status = 'UNHEALTHY';
      recommendations.push('High error rate detected');
    } else if (errorRate > 0.1) {
      status = 'DEGRADED';
      recommendations.push('Elevated error rate - monitor closely');
    }

    // Check for open circuit breakers
    const openCircuits = Array.from(this.circuits.entries())
      .filter(([, state]) => state.state === 'OPEN');
    
    if (openCircuits.length > 0) {
      status = status === 'HEALTHY' ? 'DEGRADED' : status;
      recommendations.push(`${openCircuits.length} circuit breakers are open`);
    }

    return {
      status,
      errorRate,
      recentErrorCount: recentErrors.length,
      openCircuitBreakers: openCircuits.length,
      recommendations,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sleep helper for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset all metrics (for testing or maintenance)
   */
  resetMetrics() {
    this.errorMetrics = {
      totalErrors: 0,
      totalSuccess: 0,
      errorsByCategory: {},
      errorsByService: {},
      recentErrors: []
    };
    logger.info('Error metrics reset');
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuits() {
    for (const [name] of this.circuits.entries()) {
      this.resetCircuit(name);
    }
    logger.info('All circuit breakers reset');
  }
}

export default ErrorHandler;