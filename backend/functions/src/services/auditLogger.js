/**
 * Audit Logging Service for Project Friday
 * Comprehensive security event logging and monitoring
 * Implements structured logging for security analysis
 */

const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');

class AuditLogger {
  constructor(firestore = null) {
    this.db = firestore || getFirestore();
    this.logBuffer = [];
    this.bufferSize = 100;
    this.flushInterval = 30000; // 30 seconds
    
    // Event severity levels
    this.severityLevels = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4
    };
    
    // Event categories
    this.eventCategories = {
      AUTHENTICATION: 'auth',
      AUTHORIZATION: 'authz',
      INPUT_VALIDATION: 'input',
      RATE_LIMITING: 'rate_limit',
      SUSPICIOUS_ACTIVITY: 'suspicious',
      SECURITY_ERROR: 'security_error',
      API_USAGE: 'api_usage',
      WEBHOOK: 'webhook',
      SYSTEM: 'system'
    };
    
    // Start periodic log flushing
    this.startLogFlushing();
    
    // Graceful shutdown handling
    process.on('SIGTERM', () => this.flushLogs());
    process.on('SIGINT', () => this.flushLogs());
  }

  /**
   * Log a security event with structured data
   * @param {string} eventType - Type of security event
   * @param {Object} eventData - Event-specific data
   * @param {string} severity - Event severity (LOW, MEDIUM, HIGH, CRITICAL)
   * @param {string} category - Event category
   */
  async logSecurityEvent(eventType, eventData = {}, severity = 'MEDIUM', category = 'SYSTEM') {
    try {
      const logEntry = {
        id: this.generateEventId(),
        eventType,
        category,
        severity,
        severityLevel: this.severityLevels[severity] || 2,
        timestamp: Date.now(),
        isoTimestamp: new Date().toISOString(),
        data: this.sanitizeLogData(eventData),
        metadata: {
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development',
          instanceId: process.env.GAE_INSTANCE || 'local',
          version: process.env.npm_package_version || '1.0.0'
        }
      };
      
      // Add to buffer for batch processing
      this.logBuffer.push(logEntry);
      
      // Immediate flush for critical events
      if (severity === 'CRITICAL') {
        await this.flushLogs();
      }
      
      // Console log for development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[SECURITY-${severity}] ${eventType}:`, eventData);
      }
      
      // Flush buffer if full
      if (this.logBuffer.length >= this.bufferSize) {
        await this.flushLogs();
      }
      
    } catch (error) {
      console.error('Audit logging error:', error);
      // Fallback to console logging
      console.log(`[AUDIT-ERROR] ${eventType}:`, eventData);
    }
  }

  /**
   * Log failed authentication attempts
   * @param {string} clientId - Client IP or identifier
   * @param {string} endpoint - Endpoint that was accessed
   * @param {string} reason - Reason for authentication failure
   * @param {Object} additionalData - Additional context data
   */
  async logFailedAuth(clientId, endpoint, reason, additionalData = {}) {
    await this.logSecurityEvent('AUTHENTICATION_FAILED', {
      clientId: this.hashSensitiveData(clientId),
      endpoint,
      reason,
      userAgent: additionalData.userAgent,
      requestMethod: additionalData.method,
      timestamp: Date.now()
    }, 'HIGH', this.eventCategories.AUTHENTICATION);
  }

  /**
   * Log suspicious activity patterns
   * @param {string} clientId - Client IP or identifier
   * @param {string} pattern - Description of suspicious pattern
   * @param {Object} metadata - Additional metadata about the activity
   */
  async logSuspiciousActivity(clientId, pattern, metadata = {}) {
    const severity = metadata.severity || 'HIGH';
    
    await this.logSecurityEvent('SUSPICIOUS_ACTIVITY_DETECTED', {
      clientId: this.hashSensitiveData(clientId),
      pattern,
      metadata: this.sanitizeLogData(metadata),
      analysisTimestamp: Date.now()
    }, severity, this.eventCategories.SUSPICIOUS_ACTIVITY);
    
    // For critical suspicious activity, also create an alert
    if (severity === 'CRITICAL') {
      await this.createSecurityAlert(clientId, pattern, metadata);
    }
  }

  /**
   * Log rate limit violations
   * @param {string} clientId - Client IP or identifier
   * @param {string} endpoint - Endpoint type that was rate limited
   * @param {Object} rateLimitData - Rate limit details
   */
  async logRateLimitViolation(clientId, endpoint, rateLimitData = {}) {
    await this.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      clientId: this.hashSensitiveData(clientId),
      endpoint,
      currentCount: rateLimitData.currentCount,
      limit: rateLimitData.limit,
      window: rateLimitData.window,
      clientInfo: rateLimitData.clientInfo
    }, 'MEDIUM', this.eventCategories.RATE_LIMITING);
  }

  /**
   * Log API key related events
   * @param {string} eventType - Type of API key event
   * @param {Object} keyData - API key related data
   */
  async logApiKeyEvent(eventType, keyData = {}) {
    await this.logSecurityEvent(eventType, {
      keyPrefix: keyData.keyPrefix,
      userId: keyData.userId,
      environment: keyData.environment,
      action: keyData.action,
      timestamp: Date.now()
    }, keyData.severity || 'MEDIUM', this.eventCategories.AUTHENTICATION);
  }

  /**
   * Log webhook security events
   * @param {string} eventType - Type of webhook event
   * @param {Object} webhookData - Webhook related data
   */
  async logWebhookEvent(eventType, webhookData = {}) {
    await this.logSecurityEvent(eventType, {
      source: webhookData.source,
      endpoint: webhookData.endpoint,
      signatureValid: webhookData.signatureValid,
      payloadSize: webhookData.payloadSize,
      clientId: this.hashSensitiveData(webhookData.clientId)
    }, webhookData.severity || 'LOW', this.eventCategories.WEBHOOK);
  }

  /**
   * Log input validation events
   * @param {string} eventType - Type of validation event
   * @param {Object} validationData - Validation related data
   */
  async logInputValidationEvent(eventType, validationData = {}) {
    await this.logSecurityEvent(eventType, {
      field: validationData.field,
      validationType: validationData.type,
      errorMessage: validationData.error,
      clientId: this.hashSensitiveData(validationData.clientId),
      endpoint: validationData.endpoint
    }, validationData.severity || 'MEDIUM', this.eventCategories.INPUT_VALIDATION);
  }

  /**
   * Create a security alert for critical events
   * @param {string} clientId - Client identifier
   * @param {string} description - Alert description
   * @param {Object} metadata - Alert metadata
   */
  async createSecurityAlert(clientId, description, metadata = {}) {
    try {
      const alert = {
        id: this.generateEventId(),
        type: 'SECURITY_ALERT',
        clientId: this.hashSensitiveData(clientId),
        description,
        severity: 'CRITICAL',
        metadata: this.sanitizeLogData(metadata),
        timestamp: Date.now(),
        isoTimestamp: new Date().toISOString(),
        status: 'ACTIVE',
        acknowledged: false,
        createdAt: Date.now()
      };
      
      // Store in separate alerts collection for immediate attention
      await this.db.collection('security_alerts').add(alert);
      
      // Also log as a regular security event
      await this.logSecurityEvent('SECURITY_ALERT_CREATED', alert, 'CRITICAL');
      
      // In production, this would trigger notifications to security team
      console.warn(`[CRITICAL SECURITY ALERT] ${description}`, metadata);
      
    } catch (error) {
      console.error('Error creating security alert:', error);
    }
  }

  /**
   * Query security events with filtering
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} Filtered security events
   */
  async querySecurityEvents(filters = {}) {
    try {
      let query = this.db.collection('security_logs');
      
      // Apply filters
      if (filters.eventType) {
        query = query.where('eventType', '==', filters.eventType);
      }
      
      if (filters.category) {
        query = query.where('category', '==', filters.category);
      }
      
      if (filters.severity) {
        query = query.where('severity', '==', filters.severity);
      }
      
      if (filters.startTime) {
        query = query.where('timestamp', '>=', filters.startTime);
      }
      
      if (filters.endTime) {
        query = query.where('timestamp', '<=', filters.endTime);
      }
      
      // Order and limit
      query = query.orderBy('timestamp', 'desc');
      
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
    } catch (error) {
      console.error('Error querying security events:', error);
      return [];
    }
  }

  /**
   * Get security statistics and metrics
   * @param {string} timeRange - Time range for statistics (1h, 24h, 7d, 30d)
   * @returns {Promise<Object>} Security statistics
   */
  async getSecurityStatistics(timeRange = '24h') {
    try {
      const timeRanges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };
      
      const startTime = Date.now() - timeRanges[timeRange];
      const events = await this.querySecurityEvents({ startTime });
      
      const stats = {
        totalEvents: events.length,
        timeRange,
        startTime,
        endTime: Date.now(),
        eventsByType: {},
        eventsByCategory: {},
        eventsBySeverity: {},
        topClientIds: {},
        alertsCount: 0
      };
      
      // Aggregate statistics
      events.forEach(event => {
        // Count by type
        stats.eventsByType[event.eventType] = (stats.eventsByType[event.eventType] || 0) + 1;
        
        // Count by category
        stats.eventsByCategory[event.category] = (stats.eventsByCategory[event.category] || 0) + 1;
        
        // Count by severity
        stats.eventsBySeverity[event.severity] = (stats.eventsBySeverity[event.severity] || 0) + 1;
        
        // Count client IDs (already hashed)
        if (event.data.clientId) {
          stats.topClientIds[event.data.clientId] = (stats.topClientIds[event.data.clientId] || 0) + 1;
        }
        
        // Count alerts
        if (event.severity === 'CRITICAL') {
          stats.alertsCount++;
        }
      });
      
      // Sort top client IDs
      stats.topClientIds = Object.entries(stats.topClientIds)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
      
      return stats;
      
    } catch (error) {
      console.error('Error getting security statistics:', error);
      return { error: error.message };
    }
  }

  /**
   * Flush log buffer to persistent storage
   */
  async flushLogs() {
    if (this.logBuffer.length === 0) {
      return;
    }
    
    try {
      const batch = this.db.batch();
      const logsToFlush = [...this.logBuffer];
      this.logBuffer = [];
      
      logsToFlush.forEach(logEntry => {
        const docRef = this.db.collection('security_logs').doc();
        batch.set(docRef, logEntry);
      });
      
      await batch.commit();
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Flushed ${logsToFlush.length} security log entries`);
      }
      
    } catch (error) {
      console.error('Error flushing logs:', error);
      // Re-add failed logs to buffer
      this.logBuffer.unshift(...this.logBuffer);
    }
  }

  /**
   * Start periodic log flushing
   */
  startLogFlushing() {
    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);
  }

  /**
   * Stop log flushing timer
   */
  stopLogFlushing() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
  }

  /**
   * Generate unique event ID
   * @returns {string} Unique event identifier
   */
  generateEventId() {
    return `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Hash sensitive data for logging
   * @param {string} data - Data to hash
   * @returns {string} Hashed data
   */
  hashSensitiveData(data) {
    if (!data) return 'unknown';
    return crypto.createHash('sha256').update(data.toString()).digest('hex').slice(0, 16);
  }

  /**
   * Sanitize log data to prevent sensitive information leakage
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeLogData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'signature'];
    const sanitized = { ...data };
    
    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeLogData(sanitized[key]);
      }
    });
    
    return sanitized;
  }

  /**
   * Archive old log entries
   * @param {number} maxAge - Maximum age in milliseconds
   */
  async archiveOldLogs(maxAge = 90 * 24 * 60 * 60 * 1000) { // 90 days default
    try {
      const cutoffTime = Date.now() - maxAge;
      const oldLogs = await this.db.collection('security_logs')
        .where('timestamp', '<', cutoffTime)
        .limit(1000)
        .get();
      
      if (oldLogs.empty) {
        return { archived: 0 };
      }
      
      // In production, these would be moved to cold storage
      // For now, we'll delete them
      const batch = this.db.batch();
      oldLogs.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      return { archived: oldLogs.size };
      
    } catch (error) {
      console.error('Error archiving old logs:', error);
      return { error: error.message };
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopLogFlushing();
    this.flushLogs(); // Final flush
  }
}

// Export singleton instance
const auditLogger = new AuditLogger();
module.exports = auditLogger;