/**
 * Input Validation and Sanitization Utilities for Project Friday
 * Comprehensive security validation for all user inputs and API payloads
 */

const Joi = require('joi');
const crypto = require('crypto');
const auditLogger = require('../services/auditLogger');

class InputValidator {
  constructor() {
    // Define validation schemas
    this.schemas = {
      phoneNumber: Joi.string()
        .pattern(/^\+[1-9]\d{1,14}$/)
        .required(),
        
      webhookPayload: Joi.object({
        AccountSid: Joi.string().required(),
        CallSid: Joi.string().required(),
        From: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
        To: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
        Direction: Joi.string().valid('inbound', 'outbound').required(),
        CallStatus: Joi.string().optional(),
        CallDuration: Joi.number().optional(),
        RecordingUrl: Joi.string().uri().optional()
      }),
      
      apiKey: Joi.string()
        .pattern(/^pf_(test|live)_[a-zA-Z0-9]{32}$/)
        .required(),
        
      userMessage: Joi.string()
        .max(1000)
        .required(),
        
      callScreeningRequest: Joi.object({
        callSid: Joi.string().required(),
        callerNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
        recipientNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
        userPreferences: Joi.object().optional(),
        context: Joi.string().max(500).optional()
      })
    };
    
    // Dangerous patterns to detect
    this.dangerousPatterns = [
      // SQL Injection patterns
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      /((\%27)|(\'))/gi, // SQL quotes
      /((\%3D)|(=))/gi, // SQL equals
      
      // XSS patterns
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // onclick, onload, etc.
      
      // Command injection patterns
      /(\||\;|\&|\$\(|\`)/g,
      /(nc\s|netcat\s|wget\s|curl\s)/gi,
      
      // Path traversal patterns
      /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/gi,
      
      // LDAP injection patterns
      /(\)|\(|\*|\||\&)/g,
      
      // NoSQL injection patterns
      /(\$ne|\$gt|\$lt|\$regex|\$where)/gi
    ];
    
    // API key storage for validation
    this.apiKeys = new Map();
    this.loadApiKeys();
  }

  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {Object} Validation result
   */
  validatePhoneNumber(phoneNumber) {
    try {
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return { valid: false, error: 'Phone number is required and must be a string' };
      }

      // Sanitize input first
      const sanitized = this.sanitizeInput(phoneNumber);
      
      // Validate against schema
      const { error } = this.schemas.phoneNumber.validate(sanitized);
      
      if (error) {
        auditLogger.logSecurityEvent('INVALID_PHONE_NUMBER', {
          phoneNumber: this.maskSensitiveData(phoneNumber),
          error: error.message
        });
        return { valid: false, error: 'Invalid phone number format. Must be E.164 format (+1234567890)' };
      }

      // Additional business logic validation
      const countryCode = sanitized.slice(1, 2);
      if (!this.isValidCountryCode(countryCode)) {
        return { valid: false, error: 'Unsupported country code' };
      }

      return {
        valid: true,
        formatted: sanitized,
        countryCode: countryCode,
        nationalNumber: sanitized.slice(countryCode.length + 1)
      };
      
    } catch (error) {
      console.error('Phone number validation error:', error);
      return { valid: false, error: 'Phone number validation failed' };
    }
  }

  /**
   * Sanitize user input to prevent various injection attacks
   * @param {string} input - Input to sanitize
   * @param {Object} options - Sanitization options
   * @returns {string} Sanitized input
   */
  sanitizeInput(input, options = {}) {
    try {
      if (typeof input !== 'string') {
        return input;
      }

      let sanitized = input;

      // Check for dangerous patterns first
      this.dangerousPatterns.forEach(pattern => {
        if (pattern.test(sanitized)) {
          const patternType = this.identifyPatternType(pattern);
          auditLogger.logSecurityEvent('DANGEROUS_PATTERN_DETECTED', {
            pattern: patternType,
            input: this.maskSensitiveData(input),
            sanitized: true
          });
          
          // For security-critical patterns, throw error
          if (patternType.includes('SQL_INJECTION') || patternType.includes('COMMAND_INJECTION')) {
            throw new Error(`Potential ${patternType.replace('_', ' ')} detected`);
          }
        }
      });

      // Basic sanitization
      sanitized = sanitized.trim();
      
      // HTML entity encoding for XSS prevention
      if (options.encodeHtml !== false) {
        sanitized = sanitized
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');
      }
      
      // Remove null bytes
      sanitized = sanitized.replace(/\0/g, '');
      
      // Normalize unicode
      sanitized = sanitized.normalize('NFC');
      
      // Limit length if specified
      if (options.maxLength) {
        sanitized = sanitized.slice(0, options.maxLength);
      }
      
      return sanitized;
      
    } catch (error) {
      console.error('Input sanitization error:', error);
      throw error;
    }
  }

  /**
   * Validate webhook payload from Twilio
   * @param {Object} payload - Webhook payload
   * @param {string} signature - Twilio signature header
   * @returns {Object} Validation result
   */
  validateWebhookPayload(payload, signature = null) {
    try {
      if (!payload || typeof payload !== 'object') {
        return { valid: false, errors: ['Payload is required and must be an object'] };
      }

      // Validate payload structure
      const { error } = this.schemas.webhookPayload.validate(payload);
      
      if (error) {
        const errors = error.details.map(detail => detail.message);
        auditLogger.logSecurityEvent('INVALID_WEBHOOK_PAYLOAD', {
          errors,
          payloadKeys: Object.keys(payload)
        });
        return { valid: false, errors };
      }

      // Sanitize all string values
      const sanitizedPayload = {};
      Object.keys(payload).forEach(key => {
        if (typeof payload[key] === 'string') {
          sanitizedPayload[key] = this.sanitizeInput(payload[key]);
        } else {
          sanitizedPayload[key] = payload[key];
        }
      });

      // Validate Twilio signature if provided
      if (signature && !this.validateTwilioSignature(payload, signature)) {
        auditLogger.logSecurityEvent('INVALID_TWILIO_SIGNATURE', {
          signature: this.maskSensitiveData(signature)
        });
        return { valid: false, errors: ['Invalid Twilio signature'] };
      }

      return {
        valid: true,
        payload: sanitizedPayload,
        signatureValid: signature ? true : null
      };
      
    } catch (error) {
      console.error('Webhook payload validation error:', error);
      return { valid: false, errors: ['Webhook validation failed'] };
    }
  }

  /**
   * Validate API key format and authenticity
   * @param {string} apiKey - API key to validate
   * @returns {Object} Validation result
   */
  validateApiKey(apiKey) {
    try {
      if (!apiKey || typeof apiKey !== 'string') {
        return { valid: false, error: 'API key is required' };
      }

      // Check format
      const { error } = this.schemas.apiKey.validate(apiKey);
      if (error) {
        auditLogger.logSecurityEvent('INVALID_API_KEY_FORMAT', {
          keyPrefix: this.maskSensitiveData(apiKey, 8),
          error: error.message
        });
        return { valid: false, error: 'Invalid API key format' };
      }

      // Extract key information
      const [, environment, keyHash] = apiKey.split('_');
      
      // Check if key exists in our store
      const keyInfo = this.apiKeys.get(apiKey);
      if (!keyInfo) {
        auditLogger.logSecurityEvent('UNKNOWN_API_KEY', {
          keyPrefix: this.maskSensitiveData(apiKey, 8),
          environment
        });
        return { valid: false, error: 'Invalid API key' };
      }

      // Check if key is expired
      if (keyInfo.expiresAt && Date.now() > keyInfo.expiresAt) {
        auditLogger.logSecurityEvent('EXPIRED_API_KEY', {
          keyPrefix: this.maskSensitiveData(apiKey, 8),
          expiresAt: keyInfo.expiresAt
        });
        return { valid: false, error: 'API key expired' };
      }

      // Check if key is disabled
      if (!keyInfo.enabled) {
        auditLogger.logSecurityEvent('DISABLED_API_KEY', {
          keyPrefix: this.maskSensitiveData(apiKey, 8),
          userId: keyInfo.userId
        });
        return { valid: false, error: 'API key disabled' };
      }

      return {
        valid: true,
        userId: keyInfo.userId,
        environment,
        plan: keyInfo.plan,
        permissions: keyInfo.permissions,
        rotated: keyInfo.rotated || false,
        expiresAt: keyInfo.expiresAt
      };
      
    } catch (error) {
      console.error('API key validation error:', error);
      return { valid: false, error: 'API key validation failed' };
    }
  }

  /**
   * Validate call screening request payload
   * @param {Object} payload - Call screening request
   * @returns {Object} Validation result
   */
  validateCallScreeningRequest(payload) {
    try {
      const { error } = this.schemas.callScreeningRequest.validate(payload);
      
      if (error) {
        const errors = error.details.map(detail => detail.message);
        return { valid: false, errors };
      }

      // Additional security checks
      const sanitizedPayload = {
        ...payload,
        callerNumber: this.sanitizeInput(payload.callerNumber),
        recipientNumber: this.sanitizeInput(payload.recipientNumber),
        context: payload.context ? this.sanitizeInput(payload.context, { maxLength: 500 }) : undefined
      };

      return { valid: true, payload: sanitizedPayload };
      
    } catch (error) {
      console.error('Call screening request validation error:', error);
      return { valid: false, errors: ['Call screening request validation failed'] };
    }
  }

  /**
   * Validate user message input
   * @param {string} message - User message
   * @returns {Object} Validation result
   */
  validateUserMessage(message) {
    try {
      const { error } = this.schemas.userMessage.validate(message);
      
      if (error) {
        return { valid: false, error: error.message };
      }

      const sanitizedMessage = this.sanitizeInput(message, { maxLength: 1000 });
      
      return {
        valid: true,
        message: sanitizedMessage,
        length: sanitizedMessage.length
      };
      
    } catch (error) {
      console.error('User message validation error:', error);
      return { valid: false, error: 'Message validation failed' };
    }
  }

  /**
   * Validate Twilio webhook signature
   * @param {Object} payload - Request payload
   * @param {string} signature - X-Twilio-Signature header
   * @returns {boolean} Signature validity
   */
  validateTwilioSignature(payload, signature) {
    try {
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (!authToken) {
        console.warn('Twilio auth token not configured');
        return false;
      }

      // Create signature string
      const url = process.env.TWILIO_WEBHOOK_URL || 'https://your-domain.com/webhook/twilio';
      let signatureString = url;
      
      // Sort parameters and append
      const sortedKeys = Object.keys(payload).sort();
      sortedKeys.forEach(key => {
        signatureString += key + payload[key];
      });

      // Generate expected signature
      const expectedSignature = crypto
        .createHmac('sha1', authToken)
        .update(signatureString)
        .digest('base64');

      return signature === expectedSignature;
      
    } catch (error) {
      console.error('Twilio signature validation error:', error);
      return false;
    }
  }

  /**
   * Check if country code is supported
   * @param {string} countryCode - Country code to check
   * @returns {boolean} Whether country code is supported
   */
  isValidCountryCode(countryCode) {
    const supportedCodes = ['1', '44', '33', '49', '81', '86', '91']; // US, UK, France, Germany, Japan, China, India
    return supportedCodes.includes(countryCode);
  }

  /**
   * Identify the type of dangerous pattern detected
   * @param {RegExp} pattern - The pattern that matched
   * @returns {string} Pattern type identifier
   */
  identifyPatternType(pattern) {
    const patternString = pattern.toString();
    
    if (patternString.includes('SELECT|INSERT|UPDATE|DELETE')) return 'SQL_INJECTION';
    if (patternString.includes('script|iframe')) return 'XSS_ATTEMPT';
    if (patternString.includes('nc|netcat|wget|curl')) return 'COMMAND_INJECTION';
    if (patternString.includes('..')) return 'PATH_TRAVERSAL';
    if (patternString.includes('$ne|$gt')) return 'NOSQL_INJECTION';
    
    return 'UNKNOWN_DANGEROUS_PATTERN';
  }

  /**
   * Mask sensitive data for logging
   * @param {string} data - Sensitive data
   * @param {number} visibleChars - Number of characters to keep visible
   * @returns {string} Masked data
   */
  maskSensitiveData(data, visibleChars = 4) {
    if (!data || typeof data !== 'string') return '[REDACTED]';
    if (data.length <= visibleChars) return '*'.repeat(data.length);
    
    return data.slice(0, visibleChars) + '*'.repeat(Math.max(0, data.length - visibleChars));
  }

  /**
   * Load API keys from secure storage
   */
  async loadApiKeys() {
    try {
      // In production, this would load from secure key management service
      // For now, using environment variables and mock data
      const testKey = 'pf_test_abcd1234567890abcdef1234567890ab';
      const liveKey = 'pf_live_1234567890abcdef1234567890abcdef';
      
      this.apiKeys.set(testKey, {
        userId: 'user_123',
        environment: 'test',
        plan: 'developer',
        permissions: ['call-screening', 'webhooks'],
        enabled: true,
        createdAt: Date.now(),
        rotated: false
      });
      
      this.apiKeys.set(liveKey, {
        userId: 'user_456',
        environment: 'live',
        plan: 'premium',
        permissions: ['call-screening', 'webhooks', 'analytics'],
        enabled: true,
        createdAt: Date.now(),
        expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
        rotated: false
      });
      
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  }

  /**
   * Add new API key to the validation store
   * @param {string} apiKey - API key to add
   * @param {Object} keyInfo - Key information
   */
  addApiKey(apiKey, keyInfo) {
    this.apiKeys.set(apiKey, {
      ...keyInfo,
      createdAt: Date.now(),
      enabled: true
    });
    
    auditLogger.logSecurityEvent('API_KEY_ADDED', {
      keyPrefix: this.maskSensitiveData(apiKey, 8),
      userId: keyInfo.userId,
      environment: keyInfo.environment
    });
  }

  /**
   * Revoke an API key
   * @param {string} apiKey - API key to revoke
   */
  revokeApiKey(apiKey) {
    const keyInfo = this.apiKeys.get(apiKey);
    if (keyInfo) {
      keyInfo.enabled = false;
      keyInfo.revokedAt = Date.now();
      
      auditLogger.logSecurityEvent('API_KEY_REVOKED', {
        keyPrefix: this.maskSensitiveData(apiKey, 8),
        userId: keyInfo.userId
      });
    }
  }

  /**
   * Get validation statistics
   * @returns {Object} Validation statistics
   */
  getValidationStats() {
    return {
      totalApiKeys: this.apiKeys.size,
      enabledApiKeys: Array.from(this.apiKeys.values()).filter(k => k.enabled).length,
      patterns: this.dangerousPatterns.length,
      schemas: Object.keys(this.schemas).length
    };
  }
}

// Export singleton instance
const inputValidator = new InputValidator();
module.exports = inputValidator;