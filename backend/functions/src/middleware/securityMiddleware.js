/**
 * Security Middleware for Project Friday
 * Comprehensive security protection for all API endpoints
 * Implements multiple layers of security controls
 */

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const rateLimiter = require('../services/rateLimiter');
const inputValidator = require('../utils/inputValidator');
const auditLogger = require('../services/auditLogger');

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIP(req) {
  return req.ip ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         '0.0.0.0';
}

/**
 * Get endpoint type based on request path
 * @param {string} path - Request path
 * @returns {string} Endpoint type
 */
function getEndpointType(path) {
  if (path.includes('/webhook/')) return 'webhook';
  if (path.includes('/auth/')) return 'auth';
  if (path.includes('/ai/') || path.includes('/screen-call')) return 'ai';
  return 'api';
}

/**
 * Enhanced CORS configuration with security controls
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://app.projectfriday.com',
      'https://admin.projectfriday.com',
      'https://dashboard.projectfriday.com',
      ...(process.env.NODE_ENV === 'development' ? [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000'
      ] : [])
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      auditLogger.logSecurityEvent('CORS_VIOLATION', {
        origin,
        timestamp: Date.now()
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Requested-With',
    'X-Twilio-Signature',
    'User-Agent'
  ],
  maxAge: 86400 // 24 hours
};

/**
 * Enhanced Helmet configuration for security headers
 */
const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://apis.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.projectfriday.com'],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Required for some Google APIs
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
};

/**
 * Rate limiting middleware with advanced features
 */
const createRateLimitMiddleware = () => {
  return async (req, res, next) => {
    try {
      const clientIP = getClientIP(req);
      const endpointType = getEndpointType(req.path);
      
      // Check custom rate limiting
      const rateLimitResult = await rateLimiter.checkRateLimit(clientIP, endpointType, {
        clientInfo: {
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method
        }
      });
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': rateLimitResult.limit,
        'X-RateLimit-Remaining': rateLimitResult.remaining,
        'X-RateLimit-Reset': rateLimitResult.resetTime && !isNaN(rateLimitResult.resetTime) 
          ? new Date(rateLimitResult.resetTime).toISOString() 
          : new Date(Date.now() + 60000).toISOString()
      });
      
      if (!rateLimitResult.allowed) {
        // Check for suspicious activity
        const suspiciousActivity = await rateLimiter.checkSuspiciousActivity(clientIP);
        
        if (suspiciousActivity && suspiciousActivity.isSuspicious) {
          auditLogger.logSuspiciousActivity(clientIP, suspiciousActivity.reasons.join(', '), {
            severity: suspiciousActivity.severity,
            endpoint: req.path,
            userAgent: req.get('User-Agent')
          });
        }
        
        res.set('Retry-After', rateLimitResult.retryAfter);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        });
      }
      
      next();
      
    } catch (error) {
      console.error('Rate limiting middleware error:', error);
      // On error, allow request to proceed but log the issue
      auditLogger.logSecurityEvent('RATE_LIMIT_MIDDLEWARE_ERROR', {
        error: error.message,
        path: req.path,
        ip: getClientIP(req)
      });
      next();
    }
  };
};

/**
 * API key validation middleware
 */
const apiKeyValidation = (req, res, next) => {
  // Skip API key validation for certain endpoints
  const skipPaths = ['/health', '/status', '/webhook/twilio'];
  if (skipPaths.some(path => req.path.includes(path))) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    auditLogger.logFailedAuth(getClientIP(req), req.path, 'Missing API key');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required'
    });
  }
  
  try {
    const validation = inputValidator.validateApiKey(apiKey);
    
    if (!validation.valid) {
      auditLogger.logFailedAuth(getClientIP(req), req.path, validation.error);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }
    
    // Add user context to request
    req.user = {
      id: validation.userId,
      plan: validation.plan,
      permissions: validation.permissions,
      environment: validation.environment
    };
    
    // Log successful authentication
    auditLogger.logSecurityEvent('API_KEY_VALIDATED', {
      userId: validation.userId,
      plan: validation.plan,
      endpoint: req.path,
      ip: getClientIP(req)
    });
    
    next();
    
  } catch (error) {
    console.error('API key validation error:', error);
    auditLogger.logSecurityEvent('API_KEY_VALIDATION_ERROR', {
      error: error.message,
      endpoint: req.path,
      ip: getClientIP(req)
    });
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication service unavailable'
    });
  }
};

/**
 * Input validation middleware
 */
const inputValidation = (req, res, next) => {
  try {
    // Skip validation for GET requests
    if (req.method === 'GET') {
      return next();
    }
    
    // Validate request body size
    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > 1024 * 1024) { // 1MB limit
      auditLogger.logSecurityEvent('OVERSIZED_REQUEST', {
        contentLength,
        ip: getClientIP(req),
        endpoint: req.path
      });
      return res.status(413).json({
        error: 'Payload Too Large',
        message: 'Request body exceeds size limit'
      });
    }
    
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.sanitizedBody = {};
      
      Object.keys(req.body).forEach(key => {
        const value = req.body[key];
        if (typeof value === 'string') {
          try {
            req.sanitizedBody[key] = inputValidator.sanitizeInput(value);
          } catch (sanitizeError) {
            auditLogger.logSecurityEvent('MALICIOUS_INPUT_DETECTED', {
              field: key,
              error: sanitizeError.message,
              ip: getClientIP(req),
              endpoint: req.path
            });
            return res.status(400).json({
              error: 'Bad Request',
              message: `Invalid input in field: ${key}`
            });
          }
        } else {
          req.sanitizedBody[key] = value;
        }
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Input validation middleware error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Input validation failed'
    });
  }
};

/**
 * Request logging middleware
 */
const requestLogging = (req, res, next) => {
  const startTime = Date.now();
  const clientIP = getClientIP(req);
  
  // Log request details
  const requestInfo = {
    method: req.method,
    path: req.path,
    ip: clientIP,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    timestamp: startTime,
    userId: req.user?.id
  };
  
  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    auditLogger.logSecurityEvent('REQUEST_COMPLETED', {
      ...requestInfo,
      statusCode: res.statusCode,
      responseTime,
      endTime
    });
    
    originalEnd.apply(res, args);
  };
  
  next();
};

/**
 * Error handling middleware for security events
 */
const securityErrorHandler = (error, req, res, next) => {
  const clientIP = getClientIP(req);
  
  // Log security-related errors
  if (error.name === 'ValidationError' || error.message.includes('injection')) {
    auditLogger.logSecurityEvent('SECURITY_ERROR', {
      error: error.message,
      stack: error.stack,
      ip: clientIP,
      endpoint: req.path,
      severity: 'HIGH'
    });
    
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request validation failed'
    });
  }
  
  if (error.name === 'UnauthorizedError') {
    auditLogger.logFailedAuth(clientIP, req.path, error.message);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
  }
  
  // Log unexpected errors
  auditLogger.logSecurityEvent('UNEXPECTED_ERROR', {
    error: error.message,
    stack: error.stack,
    ip: clientIP,
    endpoint: req.path
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
};

/**
 * Webhook signature validation middleware (specifically for Twilio)
 */
const webhookValidation = (req, res, next) => {
  // Only apply to webhook endpoints
  if (!req.path.includes('/webhook/')) {
    return next();
  }
  
  const signature = req.headers['x-twilio-signature'];
  
  if (!signature) {
    auditLogger.logSecurityEvent('MISSING_WEBHOOK_SIGNATURE', {
      endpoint: req.path,
      ip: getClientIP(req)
    });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing webhook signature'
    });
  }
  
  try {
    const isValid = inputValidator.validateTwilioSignature(req.body, signature);
    
    if (!isValid) {
      auditLogger.logSecurityEvent('INVALID_WEBHOOK_SIGNATURE', {
        endpoint: req.path,
        ip: getClientIP(req),
        signature: inputValidator.maskSensitiveData(signature)
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook signature'
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Webhook validation error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Webhook validation failed'
    });
  }
};

/**
 * Main security middleware function
 * Combines all security measures
 */
function createSecurityMiddleware() {
  return [
    // Basic security headers
    helmet(helmetOptions),
    
    // CORS configuration
    cors(corsOptions),
    
    // Request logging
    requestLogging,
    
    // Rate limiting
    createRateLimitMiddleware(),
    
    // API key validation (conditional)
    apiKeyValidation,
    
    // Input validation and sanitization
    inputValidation,
    
    // Webhook signature validation
    webhookValidation,
    
    // Security error handler
    securityErrorHandler
  ];
}

/**
 * Health check endpoint (bypasses most security checks)
 */
const healthCheckHandler = (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: Date.now(),
    version: process.env.npm_package_version || '1.0.0'
  });
};

/**
 * Security status endpoint (requires authentication)
 */
const securityStatusHandler = async (req, res) => {
  try {
    const stats = await rateLimiter.getStatistics();
    const validationStats = inputValidator.getValidationStats();
    
    res.json({
      rateLimiting: stats,
      inputValidation: validationStats,
      middleware: {
        cors: true,
        helmet: true,
        rateLimit: true,
        apiKeyValidation: true,
        inputValidation: true,
        webhookValidation: true
      },
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Security status error:', error);
    res.status(500).json({
      error: 'Unable to retrieve security status'
    });
  }
};

module.exports = {
  createSecurityMiddleware,
  healthCheckHandler,
  securityStatusHandler,
  corsOptions,
  helmetOptions,
  getClientIP,
  getEndpointType
};