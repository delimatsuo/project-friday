/**
 * Rate Limiting Service for Project Friday
 * Implements sliding window rate limiting with Redis-like storage
 * Designed for high-performance call screening scenarios
 */

const { getFirestore } = require('firebase-admin/firestore');
const auditLogger = require('./auditLogger');

class RateLimiter {
  constructor(firestore = null) {
    this.db = firestore || getFirestore();
    this.rateLimits = {
      api: { limit: 100, window: 60 * 1000 }, // 100 requests per minute
      webhook: { limit: 10, window: 60 * 1000 }, // 10 webhook calls per minute
      auth: { limit: 5, window: 15 * 60 * 1000 }, // 5 auth attempts per 15 minutes
      ai: { limit: 20, window: 60 * 1000 } // 20 AI calls per minute
    };
    
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a client request should be allowed based on rate limits
   * @param {string} clientId - IP address or user ID
   * @param {string} endpoint - Endpoint type (api, webhook, auth, ai)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Rate limit result
   */
  async checkRateLimit(clientId, endpoint, options = {}) {
    try {
      const rateConfig = this.rateLimits[endpoint];
      if (!rateConfig) {
        throw new Error(`Unknown endpoint type: ${endpoint}`);
      }

      const now = Date.now();
      const windowStart = now - rateConfig.window;
      const rateLimitRef = this.db.collection('rateLimits').doc(`${clientId}_${endpoint}`);
      
      // Get current rate limit data
      const doc = await rateLimitRef.get();
      let requestData = doc.exists ? doc.data() : { requests: [], totalRequests: 0 };
      
      // Clean old requests outside the window
      requestData.requests = requestData.requests.filter(
        timestamp => timestamp > windowStart
      );
      
      const currentCount = requestData.requests.length;
      const allowed = currentCount < rateConfig.limit;
      
      if (allowed) {
        // Add current request timestamp
        requestData.requests.push(now);
        requestData.totalRequests = (requestData.totalRequests || 0) + 1;
        requestData.lastRequest = now;
        
        // Update in Firestore
        await rateLimitRef.set(requestData, { merge: true });
      } else {
        // Log rate limit violation
        await auditLogger.logRateLimitViolation(clientId, endpoint, {
          currentCount,
          limit: rateConfig.limit,
          window: rateConfig.window,
          clientInfo: options.clientInfo
        });
      }
      
      return {
        allowed,
        remaining: Math.max(0, rateConfig.limit - currentCount),
        limit: rateConfig.limit,
        resetTime: windowStart + rateConfig.window,
        retryAfter: allowed ? null : Math.ceil(Math.max(1, (requestData.requests[0] + rateConfig.window - now) / 1000))
      };
      
    } catch (error) {
      console.error('Rate limiting error:', error);
      // On error, allow the request but log the issue
      await auditLogger.logSecurityEvent('RATE_LIMITER_ERROR', {
        clientId,
        endpoint,
        error: error.message
      });
      
      return {
        allowed: true,
        remaining: 1,
        limit: 1,
        resetTime: Date.now() + 60000,
        error: 'Rate limiter temporarily unavailable'
      };
    }
  }

  /**
   * Increment counter for a specific client and endpoint
   * @param {string} clientId - Client identifier
   * @param {string} endpoint - Endpoint type
   */
  async incrementCounter(clientId, endpoint) {
    const now = Date.now();
    const rateLimitRef = this.db.collection('rateLimits').doc(`${clientId}_${endpoint}`);
    
    await rateLimitRef.set({
      requests: this.db.FieldValue.arrayUnion(now),
      totalRequests: this.db.FieldValue.increment(1),
      lastRequest: now
    }, { merge: true });
  }

  /**
   * Reset rate limit counter for a client
   * @param {string} clientId - Client identifier
   * @param {string} endpoint - Endpoint type
   */
  async resetCounter(clientId, endpoint) {
    const rateLimitRef = this.db.collection('rateLimits').doc(`${clientId}_${endpoint}`);
    await rateLimitRef.set({
      requests: [],
      totalRequests: 0,
      lastRequest: Date.now()
    });
    
    await auditLogger.logSecurityEvent('RATE_LIMIT_RESET', {
      clientId,
      endpoint,
      timestamp: Date.now()
    });
  }

  /**
   * Get rate limit status for a client
   * @param {string} clientId - Client identifier
   * @param {string} endpoint - Endpoint type
   * @returns {Promise<Object>} Current rate limit status
   */
  async getRateLimitStatus(clientId, endpoint) {
    const rateConfig = this.rateLimits[endpoint];
    if (!rateConfig) {
      return null;
    }

    const rateLimitRef = this.db.collection('rateLimits').doc(`${clientId}_${endpoint}`);
    const doc = await rateLimitRef.get();
    
    if (!doc.exists) {
      return {
        remaining: rateConfig.limit,
        limit: rateConfig.limit,
        resetTime: Date.now() + rateConfig.window,
        requests: []
      };
    }
    
    const data = doc.data();
    const now = Date.now();
    const windowStart = now - rateConfig.window;
    
    // Filter active requests
    const activeRequests = data.requests.filter(timestamp => timestamp > windowStart);
    
    return {
      remaining: Math.max(0, rateConfig.limit - activeRequests.length),
      limit: rateConfig.limit,
      resetTime: windowStart + rateConfig.window,
      requests: activeRequests,
      totalRequests: data.totalRequests || 0
    };
  }

  /**
   * Update rate limits configuration
   * @param {string} endpoint - Endpoint type
   * @param {Object} config - New rate limit configuration
   */
  updateRateLimit(endpoint, config) {
    if (!config.limit || !config.window) {
      throw new Error('Rate limit config must include limit and window');
    }
    
    this.rateLimits[endpoint] = config;
    
    auditLogger.logSecurityEvent('RATE_LIMIT_CONFIG_UPDATED', {
      endpoint,
      newConfig: config,
      timestamp: Date.now()
    });
  }

  /**
   * Check if an IP address is showing suspicious behavior
   * @param {string} clientId - Client identifier
   * @returns {Promise<Object>} Suspicious activity analysis
   */
  async checkSuspiciousActivity(clientId) {
    try {
      // Check activity across all endpoints
      const endpointChecks = Object.keys(this.rateLimits).map(async (endpoint) => {
        const status = await this.getRateLimitStatus(clientId, endpoint);
        return {
          endpoint,
          requestCount: status.requests.length,
          limit: status.limit,
          utilization: status.requests.length / status.limit
        };
      });
      
      const results = await Promise.all(endpointChecks);
      
      // Analyze patterns
      const highUtilization = results.filter(r => r.utilization > 0.8);
      const veryHighUtilization = results.filter(r => r.utilization > 0.95);
      
      const suspicious = {
        isSuspicious: false,
        reasons: [],
        severity: 'LOW',
        recommendations: []
      };
      
      if (veryHighUtilization.length >= 2) {
        suspicious.isSuspicious = true;
        suspicious.severity = 'HIGH';
        suspicious.reasons.push('Multiple endpoints near rate limit');
        suspicious.recommendations.push('Consider blocking IP temporarily');
      } else if (highUtilization.length >= 3) {
        suspicious.isSuspicious = true;
        suspicious.severity = 'MEDIUM';
        suspicious.reasons.push('High utilization across multiple endpoints');
        suspicious.recommendations.push('Monitor closely for pattern escalation');
      }
      
      if (suspicious.isSuspicious) {
        await auditLogger.logSuspiciousActivity(clientId, suspicious.reasons.join(', '), {
          severity: suspicious.severity,
          endpointUtilization: results
        });
      }
      
      return suspicious;
      
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
      return { 
        isSuspicious: false, 
        reasons: [], 
        severity: 'LOW', 
        recommendations: [],
        error: error.message 
      };
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  async cleanupExpiredEntries() {
    try {
      const now = Date.now();
      const maxAge = Math.max(...Object.values(this.rateLimits).map(r => r.window));
      const cutoff = now - (maxAge * 2); // Keep data for twice the longest window
      
      const rateLimitsRef = this.db.collection('rateLimits');
      const oldEntries = await rateLimitsRef
        .where('lastRequest', '<', cutoff)
        .limit(100)
        .get();
      
      const batch = this.db.batch();
      oldEntries.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      if (oldEntries.size > 0) {
        await batch.commit();
        console.log(`Cleaned up ${oldEntries.size} expired rate limit entries`);
      }
      
    } catch (error) {
      console.error('Error during rate limit cleanup:', error);
    }
  }

  /**
   * Get comprehensive rate limit statistics
   * @returns {Promise<Object>} Rate limiting statistics
   */
  async getStatistics() {
    try {
      const rateLimitsRef = this.db.collection('rateLimits');
      const snapshot = await rateLimitsRef.get();
      
      const stats = {
        totalClients: snapshot.size,
        endpointStats: {},
        timestamp: Date.now()
      };
      
      // Initialize endpoint stats
      Object.keys(this.rateLimits).forEach(endpoint => {
        stats.endpointStats[endpoint] = {
          activeClients: 0,
          totalRequests: 0,
          averageUtilization: 0
        };
      });
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const [clientId, endpoint] = doc.id.split('_');
        
        if (stats.endpointStats[endpoint]) {
          stats.endpointStats[endpoint].activeClients++;
          stats.endpointStats[endpoint].totalRequests += data.totalRequests || 0;
        }
      });
      
      return stats;
      
    } catch (error) {
      console.error('Error getting rate limit statistics:', error);
      return { error: error.message };
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
const rateLimiter = new RateLimiter();

module.exports = rateLimiter;