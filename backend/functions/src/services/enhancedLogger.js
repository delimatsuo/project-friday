/**
 * Enhanced Logger Service
 * Integrates with Google Cloud Logging for production error tracking and monitoring
 */

import { Logging } from '@google-cloud/logging';
import logger from '../utils/logger.js';

class EnhancedLogger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    
    // Initialize Google Cloud Logging for production
    if (this.isProduction && this.projectId) {
      try {
        this.cloudLogging = new Logging({ projectId: this.projectId });
        this.cloudLog = this.cloudLogging.log('project-friday-errors');
        logger.info('Google Cloud Logging initialized', { projectId: this.projectId });
      } catch (error) {
        logger.error('Failed to initialize Google Cloud Logging', error);
        this.cloudLogging = null;
      }
    }

    // Error categorization for structured logging
    this.errorCategories = {
      CRITICAL: {
        level: 'CRITICAL',
        alerting: true,
        retention: '1 year'
      },
      HIGH: {
        level: 'ERROR',
        alerting: true,
        retention: '6 months'
      },
      MEDIUM: {
        level: 'WARNING',
        alerting: false,
        retention: '3 months'
      },
      LOW: {
        level: 'INFO',
        alerting: false,
        retention: '1 month'
      }
    };

    // Service-specific error tracking
    this.serviceMetrics = new Map();
    this.alertThresholds = {
      errorRate: 0.1, // 10% error rate threshold
      errorCount: 50, // 50 errors in time window
      timeWindow: 300000 // 5 minutes
    };
  }

  /**
   * Log error with categorization and Google Cloud integration
   */
  async logError(error, context = {}) {
    const errorEntry = this.createErrorEntry(error, context);
    
    // Log locally
    logger.error(errorEntry.message, error, errorEntry.context);
    
    // Log to Google Cloud in production
    if (this.cloudLogging && this.isProduction) {
      try {
        await this.writeToCloudLogging(errorEntry);
      } catch (cloudError) {
        logger.error('Failed to write to Cloud Logging', cloudError);
      }
    }

    // Update service metrics
    this.updateServiceMetrics(errorEntry);
    
    // Check for alerting conditions
    await this.checkAlertConditions(errorEntry);
    
    return errorEntry.id;
  }

  /**
   * Create structured error entry
   */
  createErrorEntry(error, context = {}) {
    const timestamp = new Date();
    const errorId = this.generateErrorId(error, timestamp);
    
    // Extract stack trace information
    const stackTrace = error.stack ? this.parseStackTrace(error.stack) : null;
    
    // Determine error severity
    const severity = this.determineSeverity(error, context);
    
    // Create structured entry
    const entry = {
      id: errorId,
      timestamp: timestamp.toISOString(),
      severity: severity.level,
      category: severity.category,
      message: error.message || 'Unknown error',
      error: {
        name: error.name || 'Error',
        message: error.message || 'Unknown error',
        code: error.code || error.status,
        stack: stackTrace
      },
      context: {
        service: context.service || 'unknown',
        function: context.function || process.env.FUNCTION_NAME,
        callSid: context.callSid,
        userId: context.userId,
        correlationId: context.correlationId || this.generateCorrelationId(),
        userAgent: context.userAgent,
        ip: context.ip,
        ...context
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        functionName: process.env.FUNCTION_NAME,
        functionRegion: process.env.FUNCTION_REGION,
        projectId: this.projectId
      },
      metrics: {
        responseTime: context.responseTime,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    // Add request information if available
    if (context.request) {
      entry.httpRequest = this.extractHttpRequestInfo(context.request);
    }

    // Add Twilio-specific context
    if (context.service === 'twilio') {
      entry.twilio = {
        accountSid: context.accountSid,
        callSid: context.callSid,
        errorCode: error.code,
        moreInfo: error.moreInfo
      };
    }

    // Add AI-specific context
    if (context.service === 'gemini' || context.service === 'ai') {
      entry.ai = {
        model: context.model,
        prompt: context.prompt ? context.prompt.substring(0, 100) : null,
        tokens: context.tokens,
        latency: context.latency
      };
    }

    return entry;
  }

  /**
   * Write error entry to Google Cloud Logging
   */
  async writeToCloudLogging(errorEntry) {
    if (!this.cloudLog) return;

    const metadata = {
      resource: {
        type: 'cloud_function',
        labels: {
          function_name: process.env.FUNCTION_NAME || 'unknown',
          region: process.env.FUNCTION_REGION || 'unknown',
          project_id: this.projectId
        }
      },
      severity: errorEntry.severity,
      timestamp: errorEntry.timestamp,
      labels: {
        service: errorEntry.context.service,
        category: errorEntry.category,
        error_id: errorEntry.id
      }
    };

    const logEntry = this.cloudLog.entry(metadata, errorEntry);
    
    try {
      await this.cloudLog.write(logEntry);
    } catch (error) {
      // Fallback to console logging if Cloud Logging fails
      logger.error('Cloud Logging write failed', error);
    }
  }

  /**
   * Determine error severity based on error type and context
   */
  determineSeverity(error, context) {
    // Critical errors that require immediate attention
    if (error.message?.includes('CRITICAL') || 
        context.severity === 'CRITICAL' ||
        error.code === 'EACCES' ||
        (error.status >= 500 && error.status < 600 && context.service === 'database')) {
      return { level: 'CRITICAL', category: 'CRITICAL' };
    }

    // High severity errors
    if (error.status >= 500 && error.status < 600 ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        context.severity === 'HIGH') {
      return { level: 'ERROR', category: 'HIGH' };
    }

    // Medium severity errors
    if (error.status === 429 ||
        error.status === 403 ||
        error.code === 'ENOTFOUND' ||
        context.severity === 'MEDIUM') {
      return { level: 'WARNING', category: 'MEDIUM' };
    }

    // Low severity errors (validation, etc.)
    if (error.status >= 400 && error.status < 500) {
      return { level: 'INFO', category: 'LOW' };
    }

    // Default to medium severity
    return { level: 'ERROR', category: 'MEDIUM' };
  }

  /**
   * Parse stack trace for structured logging
   */
  parseStackTrace(stack) {
    const lines = stack.split('\n');
    const frames = [];

    for (let i = 1; i < Math.min(lines.length, 10); i++) { // Skip first line, limit to 10 frames
      const line = lines[i].trim();
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      
      if (match) {
        frames.push({
          function: match[1],
          filename: match[2],
          line: parseInt(match[3]),
          column: parseInt(match[4])
        });
      }
    }

    return {
      raw: stack,
      frames: frames
    };
  }

  /**
   * Extract HTTP request information
   */
  extractHttpRequestInfo(request) {
    return {
      method: request.method,
      url: request.url || request.originalUrl,
      userAgent: request.headers?.['user-agent'],
      remoteIp: request.headers?.['x-forwarded-for'] || request.ip,
      referer: request.headers?.referer,
      contentLength: request.headers?.['content-length'],
      contentType: request.headers?.['content-type']
    };
  }

  /**
   * Update service-specific metrics
   */
  updateServiceMetrics(errorEntry) {
    const service = errorEntry.context.service;
    
    if (!this.serviceMetrics.has(service)) {
      this.serviceMetrics.set(service, {
        errorCount: 0,
        lastError: null,
        errorsByCategory: {},
        recentErrors: []
      });
    }

    const metrics = this.serviceMetrics.get(service);
    metrics.errorCount++;
    metrics.lastError = errorEntry.timestamp;
    metrics.errorsByCategory[errorEntry.category] = 
      (metrics.errorsByCategory[errorEntry.category] || 0) + 1;

    // Keep recent errors for trend analysis
    metrics.recentErrors.push({
      timestamp: errorEntry.timestamp,
      category: errorEntry.category,
      message: errorEntry.message
    });

    // Limit recent errors to last 100
    if (metrics.recentErrors.length > 100) {
      metrics.recentErrors.shift();
    }
  }

  /**
   * Check if alerting conditions are met
   */
  async checkAlertConditions(errorEntry) {
    const service = errorEntry.context.service;
    const metrics = this.serviceMetrics.get(service);
    
    if (!metrics) return;

    // Check error rate threshold
    const recentErrorsInWindow = metrics.recentErrors.filter(err => 
      Date.now() - new Date(err.timestamp).getTime() < this.alertThresholds.timeWindow
    );

    const errorRate = recentErrorsInWindow.length / this.alertThresholds.timeWindow * 60000; // errors per minute
    
    if (errorRate > this.alertThresholds.errorRate) {
      await this.triggerAlert('HIGH_ERROR_RATE', {
        service,
        errorRate: errorRate.toFixed(2),
        threshold: this.alertThresholds.errorRate,
        recentErrorCount: recentErrorsInWindow.length
      });
    }

    // Check for critical errors
    if (errorEntry.category === 'CRITICAL') {
      await this.triggerAlert('CRITICAL_ERROR', {
        service,
        error: errorEntry.message,
        errorId: errorEntry.id
      });
    }

    // Check for repeated errors
    const sameErrorsCount = metrics.recentErrors.filter(err =>
      err.message === errorEntry.message
    ).length;

    if (sameErrorsCount >= 5) {
      await this.triggerAlert('REPEATED_ERROR', {
        service,
        error: errorEntry.message,
        occurrences: sameErrorsCount
      });
    }
  }

  /**
   * Trigger alert (integrate with monitoring system)
   */
  async triggerAlert(alertType, data) {
    const alert = {
      type: alertType,
      timestamp: new Date().toISOString(),
      data,
      severity: this.getAlertSeverity(alertType)
    };

    // Log alert
    logger.critical(`ALERT: ${alertType}`, null, alert);

    // In production, integrate with monitoring services like:
    // - Google Cloud Monitoring
    // - PagerDuty
    // - Slack notifications
    // - Email alerts

    if (this.isProduction) {
      // Example: Send to monitoring service
      await this.sendToMonitoring(alert);
    }
  }

  /**
   * Send alert to monitoring service
   */
  async sendToMonitoring(alert) {
    // Placeholder for monitoring service integration
    // Could integrate with Google Cloud Monitoring, PagerDuty, etc.
    
    try {
      // Example implementation for Google Cloud Monitoring
      if (this.cloudLogging) {
        const alertEntry = this.cloudLog.entry({
          resource: {
            type: 'cloud_function',
            labels: {
              function_name: process.env.FUNCTION_NAME || 'unknown',
              region: process.env.FUNCTION_REGION || 'unknown',
              project_id: this.projectId
            }
          },
          severity: 'CRITICAL',
          labels: {
            alert_type: alert.type,
            service: alert.data.service
          }
        }, {
          message: `ALERT: ${alert.type}`,
          alert: alert
        });

        await this.cloudLog.write(alertEntry);
      }
    } catch (error) {
      logger.error('Failed to send alert to monitoring', error);
    }
  }

  /**
   * Get alert severity level
   */
  getAlertSeverity(alertType) {
    const severityMap = {
      CRITICAL_ERROR: 'CRITICAL',
      HIGH_ERROR_RATE: 'HIGH',
      REPEATED_ERROR: 'MEDIUM',
      SERVICE_DEGRADED: 'MEDIUM',
      CIRCUIT_BREAKER_OPEN: 'HIGH'
    };

    return severityMap[alertType] || 'MEDIUM';
  }

  /**
   * Generate unique error ID
   */
  generateErrorId(error, timestamp) {
    const errorHash = this.hashString(error.message + error.name);
    const timeHash = timestamp.getTime().toString(36);
    return `err_${timeHash}_${errorHash}`;
  }

  /**
   * Generate correlation ID for request tracking
   */
  generateCorrelationId() {
    return `corr_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Hash string for ID generation
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get service metrics
   */
  getServiceMetrics(service = null) {
    if (service) {
      return this.serviceMetrics.get(service) || null;
    }
    
    const metrics = {};
    for (const [serviceName, serviceMetrics] of this.serviceMetrics.entries()) {
      metrics[serviceName] = serviceMetrics;
    }
    
    return metrics;
  }

  /**
   * Generate error analytics report
   */
  generateAnalyticsReport(timeRange = '1h') {
    const now = Date.now();
    const timeRangeMs = {
      '1h': 3600000,
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000
    }[timeRange] || 3600000;

    const cutoffTime = now - timeRangeMs;
    const report = {
      timeRange,
      period: {
        start: new Date(cutoffTime).toISOString(),
        end: new Date(now).toISOString()
      },
      services: {},
      summary: {
        totalErrors: 0,
        criticalErrors: 0,
        services: 0,
        topErrors: []
      }
    };

    // Analyze each service
    for (const [serviceName, metrics] of this.serviceMetrics.entries()) {
      const recentErrors = metrics.recentErrors.filter(err =>
        new Date(err.timestamp).getTime() > cutoffTime
      );

      if (recentErrors.length === 0) continue;

      const serviceReport = {
        errorCount: recentErrors.length,
        errorsByCategory: {},
        errorTrend: this.calculateErrorTrend(recentErrors, timeRangeMs),
        topErrors: this.getTopErrors(recentErrors)
      };

      // Count errors by category
      recentErrors.forEach(err => {
        serviceReport.errorsByCategory[err.category] = 
          (serviceReport.errorsByCategory[err.category] || 0) + 1;
      });

      report.services[serviceName] = serviceReport;
      report.summary.totalErrors += recentErrors.length;
      report.summary.criticalErrors += (serviceReport.errorsByCategory.CRITICAL || 0);
      report.summary.services++;
    }

    // Generate top errors across all services
    report.summary.topErrors = this.getTopErrorsAcrossServices(timeRangeMs);

    return report;
  }

  /**
   * Calculate error trend (errors per hour)
   */
  calculateErrorTrend(errors, timeRangeMs) {
    if (errors.length < 2) return 0;

    const hoursInRange = timeRangeMs / 3600000;
    return errors.length / hoursInRange;
  }

  /**
   * Get top errors for a service
   */
  getTopErrors(errors) {
    const errorCounts = {};
    
    errors.forEach(err => {
      errorCounts[err.message] = (errorCounts[err.message] || 0) + 1;
    });

    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));
  }

  /**
   * Get top errors across all services
   */
  getTopErrorsAcrossServices(timeRangeMs) {
    const allErrors = [];
    const cutoffTime = Date.now() - timeRangeMs;

    for (const [serviceName, metrics] of this.serviceMetrics.entries()) {
      const recentErrors = metrics.recentErrors.filter(err =>
        new Date(err.timestamp).getTime() > cutoffTime
      );
      
      recentErrors.forEach(err => {
        allErrors.push({ ...err, service: serviceName });
      });
    }

    const errorCounts = {};
    allErrors.forEach(err => {
      const key = `${err.service}: ${err.message}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));
  }

  /**
   * Clear metrics (for maintenance)
   */
  clearMetrics(service = null) {
    if (service) {
      this.serviceMetrics.delete(service);
      logger.info('Service metrics cleared', { service });
    } else {
      this.serviceMetrics.clear();
      logger.info('All service metrics cleared');
    }
  }
}

export default EnhancedLogger;