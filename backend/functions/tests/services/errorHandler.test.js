/**
 * Error Handler Service Tests
 * Comprehensive test suite for error handling, retry logic, and circuit breaker patterns
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import ErrorHandler from '../../src/services/errorHandler.js';
import logger from '../../src/utils/logger.js';

// Mock logger
jest.mock('../../src/utils/logger.js');

describe('ErrorHandler Service', () => {
  let errorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Error Classification', () => {
    test('should classify network errors correctly', () => {
      const networkError = new Error('ECONNREFUSED');
      networkError.code = 'ECONNREFUSED';

      const classified = errorHandler.classifyError(networkError);
      
      expect(classified.category).toBe('NETWORK');
      expect(classified.severity).toBe('HIGH');
      expect(classified.retryable).toBe(true);
    });

    test('should classify rate limit errors correctly', () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;

      const classified = errorHandler.classifyError(rateLimitError);
      
      expect(classified.category).toBe('RATE_LIMIT');
      expect(classified.severity).toBe('MEDIUM');
      expect(classified.retryable).toBe(true);
      expect(classified.retryDelay).toBeGreaterThan(1000);
    });

    test('should classify authentication errors correctly', () => {
      const authError = new Error('Unauthorized');
      authError.status = 401;

      const classified = errorHandler.classifyError(authError);
      
      expect(classified.category).toBe('AUTHENTICATION');
      expect(classified.severity).toBe('HIGH');
      expect(classified.retryable).toBe(false);
    });

    test('should classify validation errors correctly', () => {
      const validationError = new Error('Invalid input');
      validationError.status = 400;

      const classified = errorHandler.classifyError(validationError);
      
      expect(classified.category).toBe('VALIDATION');
      expect(classified.severity).toBe('LOW');
      expect(classified.retryable).toBe(false);
    });

    test('should classify server errors correctly', () => {
      const serverError = new Error('Internal server error');
      serverError.status = 500;

      const classified = errorHandler.classifyError(serverError);
      
      expect(classified.category).toBe('SERVER');
      expect(classified.severity).toBe('HIGH');
      expect(classified.retryable).toBe(true);
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    test('should retry retryable operations with exponential backoff', async () => {
      let attempt = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        attempt++;
        if (attempt <= 2) {
          const error = new Error('Temporary failure');
          error.code = 'ECONNRESET';
          throw error;
        }
        return 'success';
      });

      const result = await errorHandler.executeWithRetry(mockOperation, {
        maxRetries: 3,
        baseDelay: 100
      });

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(2); // Two retry attempts
    });

    test('should fail after max retries exceeded', async () => {
      const mockOperation = jest.fn().mockImplementation(() => {
        const error = new Error('Persistent failure');
        error.code = 'ECONNRESET';
        throw error;
      });

      await expect(
        errorHandler.executeWithRetry(mockOperation, {
          maxRetries: 2,
          baseDelay: 10
        })
      ).rejects.toThrow('Persistent failure');

      expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Max retries exceeded'),
        expect.any(Error)
      );
    });

    test('should not retry non-retryable errors', async () => {
      const mockOperation = jest.fn().mockImplementation(() => {
        const error = new Error('Unauthorized');
        error.status = 401;
        throw error;
      });

      await expect(
        errorHandler.executeWithRetry(mockOperation)
      ).rejects.toThrow('Unauthorized');

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    test('should respect custom retry conditions', async () => {
      let attempt = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        attempt++;
        if (attempt <= 1) {
          const error = new Error('Custom error');
          error.code = 'CUSTOM_ERROR';
          throw error;
        }
        return 'success';
      });

      const customRetryCondition = (error) => {
        return error.code === 'CUSTOM_ERROR';
      };

      const result = await errorHandler.executeWithRetry(mockOperation, {
        retryCondition: customRetryCondition
      });

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Circuit Breaker Pattern', () => {
    test('should open circuit after failure threshold', async () => {
      const circuitName = 'test-service';
      const mockOperation = jest.fn().mockImplementation(() => {
        throw new Error('Service failure');
      });

      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await errorHandler.executeWithCircuitBreaker(circuitName, mockOperation);
        } catch (e) {
          // Expected failures
        }
      }

      const circuitState = errorHandler.getCircuitState(circuitName);
      expect(circuitState.state).toBe('OPEN');
      expect(circuitState.failureCount).toBe(3);
    });

    test('should reject fast when circuit is open', async () => {
      const circuitName = 'failing-service';
      const mockOperation = jest.fn().mockImplementation(() => {
        throw new Error('Service failure');
      });

      // Open the circuit
      errorHandler.circuits.set(circuitName, {
        state: 'OPEN',
        failureCount: 5,
        lastFailureTime: Date.now(),
        successCount: 0
      });

      await expect(
        errorHandler.executeWithCircuitBreaker(circuitName, mockOperation)
      ).rejects.toThrow('Circuit breaker is OPEN');

      expect(mockOperation).not.toHaveBeenCalled();
    });

    test('should transition to half-open after timeout', async () => {
      const circuitName = 'recovering-service';
      const mockOperation = jest.fn().mockResolvedValue('success');

      // Set circuit to open with past timestamp
      errorHandler.circuits.set(circuitName, {
        state: 'OPEN',
        failureCount: 3,
        lastFailureTime: Date.now() - 65000, // 65 seconds ago
        successCount: 0
      });

      const result = await errorHandler.executeWithCircuitBreaker(circuitName, mockOperation);

      expect(result).toBe('success');
      const circuitState = errorHandler.getCircuitState(circuitName);
      expect(circuitState.state).toBe('CLOSED');
      expect(circuitState.successCount).toBe(1);
    });
  });

  describe('API-Specific Error Handling', () => {
    test('should handle Twilio errors correctly', () => {
      const twilioError = new Error('Twilio API Error');
      twilioError.status = 20003;
      twilioError.code = 20003;
      twilioError.moreInfo = 'https://www.twilio.com/docs/errors/20003';

      const fallback = errorHandler.getTwilioFallback(twilioError);
      
      expect(fallback.type).toBe('FALLBACK_RESPONSE');
      expect(fallback.action).toBe('GENERATE_ERROR_TWIML');
      expect(logger.error).toHaveBeenCalledWith(
        'Twilio API error',
        twilioError,
        expect.objectContaining({
          service: 'twilio',
          errorCode: 20003
        })
      );
    });

    test('should handle Gemini API errors correctly', () => {
      const geminiError = new Error('Gemini API quota exceeded');
      geminiError.status = 429;

      const fallback = errorHandler.getGeminiFallback(geminiError);
      
      expect(fallback.type).toBe('FALLBACK_RESPONSE');
      expect(fallback.response).toContain('temporarily unavailable');
      expect(fallback.retryAfter).toBeGreaterThan(0);
    });

    test('should handle Google Speech API errors correctly', () => {
      const speechError = new Error('Audio format not supported');
      speechError.status = 400;

      const fallback = errorHandler.getSpeechAPIFallback(speechError);
      
      expect(fallback.type).toBe('FALLBACK_RESPONSE');
      expect(fallback.transcript).toBe('[Audio processing failed]');
      expect(fallback.confidence).toBe(0);
    });
  });

  describe('Connection Management', () => {
    test('should detect dropped WebSocket connections', () => {
      const mockWebSocket = {
        readyState: 3, // CLOSED
        close: jest.fn()
      };

      const isDropped = errorHandler.isConnectionDropped(mockWebSocket);
      expect(isDropped).toBe(true);
    });

    test('should handle silent caller timeout', async () => {
      const callSid = 'test-call-123';
      const silentDuration = 10000; // 10 seconds

      const timeoutHandler = errorHandler.handleSilentCaller(callSid, silentDuration);
      
      // Fast forward time
      jest.advanceTimersByTime(silentDuration + 1000);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Silent caller timeout',
        expect.objectContaining({
          callSid,
          duration: silentDuration
        })
      );

      // Cleanup
      timeoutHandler.clear();
    });

    test('should implement graceful stream termination', async () => {
      const mockStream = {
        end: jest.fn(),
        destroy: jest.fn(),
        listeners: jest.fn().mockReturnValue([])
      };

      await errorHandler.terminateStreamGracefully(mockStream);

      expect(mockStream.end).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Stream terminated gracefully');
    });
  });

  describe('Error Metrics and Monitoring', () => {
    test('should track error metrics', () => {
      const error1 = new Error('Test error 1');
      error1.code = 'ECONNRESET';
      
      const error2 = new Error('Test error 2');
      error2.status = 429;

      errorHandler.trackError(error1, { service: 'twilio' });
      errorHandler.trackError(error2, { service: 'gemini' });

      const metrics = errorHandler.getErrorMetrics();
      
      expect(metrics.totalErrors).toBe(2);
      expect(metrics.errorsByCategory.NETWORK).toBe(1);
      expect(metrics.errorsByCategory.RATE_LIMIT).toBe(1);
      expect(metrics.errorsByService.twilio).toBe(1);
      expect(metrics.errorsByService.gemini).toBe(1);
    });

    test('should generate error reports', () => {
      // Add some errors for reporting
      for (let i = 0; i < 5; i++) {
        const error = new Error(`Test error ${i}`);
        error.status = i % 2 === 0 ? 500 : 429;
        errorHandler.trackError(error, { service: 'test' });
      }

      const report = errorHandler.generateErrorReport();
      
      expect(report.summary.totalErrors).toBe(5);
      expect(report.summary.errorRate).toBeGreaterThan(0);
      expect(report.topErrors).toBeInstanceOf(Array);
      expect(report.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Recovery Strategies', () => {
    test('should provide recovery strategy for network errors', () => {
      const networkError = new Error('ECONNREFUSED');
      networkError.code = 'ECONNREFUSED';

      const strategy = errorHandler.getRecoveryStrategy(networkError);
      
      expect(strategy.immediate).toContain('retry');
      expect(strategy.shortTerm).toContain('check network');
      expect(strategy.longTerm).toContain('implement fallback');
    });

    test('should provide recovery strategy for rate limit errors', () => {
      const rateLimitError = new Error('Too Many Requests');
      rateLimitError.status = 429;

      const strategy = errorHandler.getRecoveryStrategy(rateLimitError);
      
      expect(strategy.immediate).toContain('wait');
      expect(strategy.shortTerm).toContain('implement backoff');
      expect(strategy.longTerm).toContain('optimize usage');
    });
  });

  describe('Health Check Integration', () => {
    test('should provide health status based on error rates', () => {
      // Simulate high error rate
      for (let i = 0; i < 50; i++) {
        const error = new Error('Test error');
        error.status = 500;
        errorHandler.trackError(error);
      }

      const healthStatus = errorHandler.getHealthStatus();
      
      expect(healthStatus.status).toBe('UNHEALTHY');
      expect(healthStatus.errorRate).toBeGreaterThan(0.8);
      expect(healthStatus.recommendations).toContain('High error rate detected');
    });

    test('should provide healthy status with low error rates', () => {
      // Simulate low error rate with successful operations
      for (let i = 0; i < 100; i++) {
        errorHandler.trackSuccess({ service: 'test' });
      }
      
      // Add a few errors
      for (let i = 0; i < 2; i++) {
        const error = new Error('Minor error');
        error.status = 400;
        errorHandler.trackError(error);
      }

      const healthStatus = errorHandler.getHealthStatus();
      
      expect(healthStatus.status).toBe('HEALTHY');
      expect(healthStatus.errorRate).toBeLessThan(0.1);
    });
  });
});