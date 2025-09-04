/**
 * Logger Utility
 * Provides structured logging for Cloud Functions with proper formatting and context
 */

import util from 'util';

class Logger {
  constructor() {
    // Determine if running in Cloud Functions environment
    this.isCloudFunction = process.env.FUNCTION_NAME || process.env.K_SERVICE;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    
    // Map log levels to numbers for comparison
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    this.currentLogLevel = this.logLevels[this.logLevel] || this.logLevels.info;
  }

  /**
   * Check if log level should be output
   */
  shouldLog(level) {
    return this.logLevels[level] >= this.currentLogLevel;
  }

  /**
   * Format log entry for Cloud Functions
   */
  formatLogEntry(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      severity: level.toUpperCase(),
      message,
      ...context
    };

    // Add execution context for Cloud Functions
    if (this.isCloudFunction) {
      logEntry.functionName = process.env.FUNCTION_NAME;
      logEntry.functionRegion = process.env.FUNCTION_REGION;
      logEntry.executionId = process.env.FUNCTION_EXECUTION_ID;
    }

    // Add trace information if available (for request correlation)
    if (process.env.TRACE_ID) {
      logEntry.trace = `projects/${process.env.GCP_PROJECT}/traces/${process.env.TRACE_ID}`;
    }

    return logEntry;
  }

  /**
   * Output log entry
   */
  output(logEntry) {
    if (this.isCloudFunction) {
      // For Cloud Functions, use structured JSON logging
      console.log(JSON.stringify(logEntry));
    } else {
      // For local development, use more readable format
      const { timestamp, severity, message, ...context } = logEntry;
      const contextStr = Object.keys(context).length > 0 
        ? ` ${util.inspect(context, { colors: true, depth: 3 })}`
        : '';
      
      console.log(`[${timestamp}] ${severity}: ${message}${contextStr}`);
    }
  }

  /**
   * Debug level logging
   */
  debug(message, context = {}) {
    if (!this.shouldLog('debug')) return;
    
    const logEntry = this.formatLogEntry('debug', message, context);
    this.output(logEntry);
  }

  /**
   * Info level logging
   */
  info(message, context = {}) {
    if (!this.shouldLog('info')) return;
    
    const logEntry = this.formatLogEntry('info', message, context);
    this.output(logEntry);
  }

  /**
   * Warning level logging
   */
  warn(message, context = {}) {
    if (!this.shouldLog('warn')) return;
    
    const logEntry = this.formatLogEntry('warning', message, context);
    this.output(logEntry);
  }

  /**
   * Error level logging
   */
  error(message, error = null, context = {}) {
    if (!this.shouldLog('error')) return;
    
    const logContext = { ...context };
    
    // Handle error object
    if (error) {
      if (error instanceof Error) {
        logContext.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: error.code || undefined
        };
      } else {
        logContext.error = error;
      }
    }
    
    const logEntry = this.formatLogEntry('error', message, logContext);
    this.output(logEntry);
  }

  /**
   * Critical error logging (always output regardless of log level)
   */
  critical(message, error = null, context = {}) {
    const logContext = { ...context };
    
    if (error) {
      if (error instanceof Error) {
        logContext.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: error.code || undefined
        };
      } else {
        logContext.error = error;
      }
    }
    
    const logEntry = this.formatLogEntry('critical', message, logContext);
    this.output(logEntry);
  }

  /**
   * Log HTTP request details
   */
  logRequest(req, res, duration = null) {
    const context = {
      httpRequest: {
        requestMethod: req.method,
        requestUrl: req.originalUrl || req.url,
        requestSize: req.headers['content-length'] || 0,
        status: res.statusCode,
        responseSize: res.get('content-length') || 0,
        userAgent: req.headers['user-agent'] || '',
        remoteIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        referer: req.headers.referer || ''
      }
    };

    if (duration !== null) {
      context.httpRequest.latency = `${duration}ms`;
    }

    // Add Twilio-specific headers if present
    if (req.headers['x-twilio-signature']) {
      context.twilio = {
        signature: req.headers['x-twilio-signature'],
        accountSid: req.body?.AccountSid || 'unknown'
      };
    }

    const level = res.statusCode >= 400 ? 'error' : 'info';
    const message = `${req.method} ${req.originalUrl || req.url} - ${res.statusCode}`;
    
    this[level](message, context);
  }

  /**
   * Log call-related events with structured context
   */
  logCall(event, callSid, context = {}) {
    const callContext = {
      call: {
        sid: callSid,
        event: event,
        ...context
      }
    };

    this.info(`Call event: ${event}`, callContext);
  }

  /**
   * Log AI interaction events
   */
  logAI(event, context = {}) {
    const aiContext = {
      ai: {
        event: event,
        ...context
      }
    };

    this.info(`AI event: ${event}`, aiContext);
  }

  /**
   * Log database operations
   */
  logDB(operation, collection, context = {}) {
    const dbContext = {
      database: {
        operation: operation,
        collection: collection,
        ...context
      }
    };

    this.debug(`DB operation: ${operation} on ${collection}`, dbContext);
  }

  /**
   * Performance timing helper
   */
  time(label) {
    const start = Date.now();
    
    return {
      end: (message = null, context = {}) => {
        const duration = Date.now() - start;
        const performanceContext = {
          ...context,
          performance: {
            label: label,
            duration: `${duration}ms`
          }
        };
        
        const logMessage = message || `Timer: ${label} completed`;
        this.info(logMessage, performanceContext);
        
        return duration;
      }
    };
  }

  /**
   * Create child logger with additional context
   */
  child(context = {}) {
    const childLogger = Object.create(this);
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    
    // Override methods to include default context
    ['debug', 'info', 'warn', 'error', 'critical'].forEach(method => {
      childLogger[method] = (message, additionalContext = {}) => {
        const mergedContext = { ...childLogger.defaultContext, ...additionalContext };
        this[method](message, mergedContext);
      };
    });
    
    return childLogger;
  }

  /**
   * Log function execution
   */
  logFunction(functionName, args = {}) {
    const timer = this.time(functionName);
    
    this.debug(`Function started: ${functionName}`, { 
      function: { 
        name: functionName, 
        args: Object.keys(args).length > 0 ? args : undefined
      }
    });

    return {
      success: (result = null, context = {}) => {
        const duration = timer.end();
        this.info(`Function completed: ${functionName}`, {
          function: {
            name: functionName,
            status: 'success',
            duration: `${duration}ms`
          },
          result: result ? { type: typeof result } : undefined,
          ...context
        });
      },
      
      error: (error, context = {}) => {
        const duration = timer.end();
        this.error(`Function failed: ${functionName}`, error, {
          function: {
            name: functionName,
            status: 'error',
            duration: `${duration}ms`
          },
          ...context
        });
      }
    };
  }

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(id) {
    process.env.CORRELATION_ID = id;
  }

  /**
   * Get correlation ID
   */
  getCorrelationId() {
    return process.env.CORRELATION_ID || 'unknown';
  }

  /**
   * Middleware for Express to add request logging
   */
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      // Generate correlation ID for this request
      const correlationId = req.headers['x-correlation-id'] || 
                           req.headers['x-request-id'] || 
                           `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.setCorrelationId(correlationId);
      req.correlationId = correlationId;
      
      // Log request start
      this.logRequest(req, res);
      
      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(...args) {
        const duration = Date.now() - start;
        originalEnd.apply(res, args);
        
        // Log completed request
        logger.logRequest(req, res, duration);
      };
      
      next();
    };
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;