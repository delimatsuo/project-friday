/**
 * API Key Management and Rotation Service for Project Friday
 * Handles secure API key lifecycle management, rotation, and validation
 */

const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');
const auditLogger = require('./auditLogger');

class ApiKeyManager {
  constructor(firestore = null) {
    this.db = firestore || getFirestore();
    this.keyCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    
    // API key configuration
    this.keyConfig = {
      test: {
        prefix: 'pf_test_',
        length: 32,
        expiresIn: 365 * 24 * 60 * 60 * 1000, // 1 year
        permissions: ['call-screening', 'webhooks', 'analytics-read']
      },
      live: {
        prefix: 'pf_live_',
        length: 32,
        expiresIn: 365 * 24 * 60 * 60 * 1000, // 1 year
        permissions: ['call-screening', 'webhooks', 'analytics-read', 'analytics-write']
      }
    };
    
    // Plan-based limits
    this.planLimits = {
      free: {
        rateLimits: { api: 50, webhook: 5, ai: 10 },
        features: ['basic-screening'],
        maxKeys: 2
      },
      developer: {
        rateLimits: { api: 200, webhook: 20, ai: 50 },
        features: ['basic-screening', 'advanced-screening', 'analytics'],
        maxKeys: 5
      },
      premium: {
        rateLimits: { api: 1000, webhook: 100, ai: 200 },
        features: ['all'],
        maxKeys: 10
      },
      enterprise: {
        rateLimits: { api: 10000, webhook: 1000, ai: 2000 },
        features: ['all'],
        maxKeys: 50
      }
    };
    
    // Start cleanup process
    this.startCleanupProcess();
  }

  /**
   * Generate a new API key
   * @param {string} userId - User ID
   * @param {string} environment - Environment (test/live)
   * @param {string} plan - User plan (free/developer/premium/enterprise)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Generated API key details
   */
  async generateApiKey(userId, environment = 'test', plan = 'free', options = {}) {
    try {
      // Validate parameters
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      if (!this.keyConfig[environment]) {
        throw new Error(`Invalid environment: ${environment}`);
      }
      
      if (!this.planLimits[plan]) {
        throw new Error(`Invalid plan: ${plan}`);
      }
      
      // Check if user has reached key limit
      const existingKeys = await this.getUserApiKeys(userId, environment);
      const maxKeys = this.planLimits[plan].maxKeys;
      
      if (existingKeys.length >= maxKeys) {
        throw new Error(`Maximum number of ${environment} API keys reached (${maxKeys})`);
      }
      
      // Generate key
      const config = this.keyConfig[environment];
      const keyHash = crypto.randomBytes(config.length / 2).toString('hex');
      const apiKey = config.prefix + keyHash;
      
      // Create key document
      const keyData = {
        apiKey: this.hashApiKey(apiKey), // Store hashed version
        userId,
        environment,
        plan,
        permissions: config.permissions.filter(perm => 
          this.planLimits[plan].features.includes('all') || 
          this.planLimits[plan].features.includes(perm)
        ),
        rateLimits: this.planLimits[plan].rateLimits,
        enabled: true,
        createdAt: Date.now(),
        expiresAt: Date.now() + config.expiresIn,
        lastUsed: null,
        usageCount: 0,
        rotated: false,
        name: options.name || `${environment} key`,
        description: options.description || '',
        ipWhitelist: options.ipWhitelist || [],
        metadata: {
          userAgent: options.userAgent,
          createdBy: userId,
          createdFrom: options.clientIP || 'unknown'
        }
      };
      
      // Store in database
      await this.db.collection('api_keys').doc(apiKey).set(keyData);
      
      // Log key creation
      await auditLogger.logApiKeyEvent('API_KEY_GENERATED', {
        keyPrefix: this.maskApiKey(apiKey),
        userId,
        environment,
        plan,
        permissions: keyData.permissions
      });
      
      // Remove from cache to force refresh
      this.keyCache.delete(apiKey);
      
      return {
        apiKey, // Return unhashed key only once
        keyId: apiKey,
        environment,
        plan,
        permissions: keyData.permissions,
        rateLimits: keyData.rateLimits,
        expiresAt: keyData.expiresAt,
        name: keyData.name
      };
      
    } catch (error) {
      console.error('API key generation error:', error);
      throw error;
    }
  }

  /**
   * Validate an API key
   * @param {string} apiKey - API key to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateApiKey(apiKey) {
    try {
      if (!apiKey || typeof apiKey !== 'string') {
        return { valid: false, error: 'Invalid API key format' };
      }
      
      // Check cache first
      const cached = this.keyCache.get(apiKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
      
      // Get key from database
      const keyDoc = await this.db.collection('api_keys').doc(apiKey).get();
      
      if (!keyDoc.exists) {
        await auditLogger.logApiKeyEvent('API_KEY_NOT_FOUND', {
          keyPrefix: this.maskApiKey(apiKey)
        });
        return { valid: false, error: 'Invalid API key' };
      }
      
      const keyData = keyDoc.data();
      
      // Check if key is enabled
      if (!keyData.enabled) {
        await auditLogger.logApiKeyEvent('DISABLED_API_KEY_USED', {
          keyPrefix: this.maskApiKey(apiKey),
          userId: keyData.userId
        });
        return { valid: false, error: 'API key disabled' };
      }
      
      // Check if key is expired
      if (keyData.expiresAt && Date.now() > keyData.expiresAt) {
        await auditLogger.logApiKeyEvent('EXPIRED_API_KEY_USED', {
          keyPrefix: this.maskApiKey(apiKey),
          userId: keyData.userId,
          expiresAt: keyData.expiresAt
        });
        return { valid: false, error: 'API key expired' };
      }
      
      // Update last used timestamp and usage count
      await this.db.collection('api_keys').doc(apiKey).update({
        lastUsed: Date.now(),
        usageCount: keyData.usageCount + 1
      });
      
      const validationResult = {
        valid: true,
        userId: keyData.userId,
        environment: keyData.environment,
        plan: keyData.plan,
        permissions: keyData.permissions,
        rateLimits: keyData.rateLimits,
        rotated: keyData.rotated || false,
        expiresAt: keyData.expiresAt
      };
      
      // Cache result
      this.keyCache.set(apiKey, {
        timestamp: Date.now(),
        data: validationResult
      });
      
      return validationResult;
      
    } catch (error) {
      console.error('API key validation error:', error);
      return { valid: false, error: 'API key validation failed' };
    }
  }

  /**
   * Rotate an existing API key
   * @param {string} oldApiKey - Current API key to rotate
   * @param {Object} options - Rotation options
   * @returns {Promise<Object>} New API key details
   */
  async rotateApiKey(oldApiKey, options = {}) {
    try {
      // Validate old key exists
      const oldKeyDoc = await this.db.collection('api_keys').doc(oldApiKey).get();
      if (!oldKeyDoc.exists) {
        throw new Error('API key not found');
      }
      
      const oldKeyData = oldKeyDoc.data();
      const gracePeriod = options.gracePeriod || 24 * 60 * 60 * 1000; // 24 hours default
      
      // Generate new key with same properties
      const newKeyResult = await this.generateApiKey(
        oldKeyData.userId,
        oldKeyData.environment,
        oldKeyData.plan,
        {
          name: oldKeyData.name + ' (rotated)',
          description: oldKeyData.description,
          ipWhitelist: oldKeyData.ipWhitelist,
          userAgent: options.userAgent,
          clientIP: options.clientIP
        }
      );
      
      // Mark old key as rotated but keep it active for grace period
      await this.db.collection('api_keys').doc(oldApiKey).update({
        rotated: true,
        rotatedAt: Date.now(),
        newKeyId: newKeyResult.keyId,
        gracePeriodExpires: Date.now() + gracePeriod,
        enabled: options.immediateRevoke ? false : true
      });
      
      // Remove old key from cache
      this.keyCache.delete(oldApiKey);
      
      // Log rotation
      await auditLogger.logApiKeyEvent('API_KEY_ROTATED', {
        oldKeyPrefix: this.maskApiKey(oldApiKey),
        newKeyPrefix: this.maskApiKey(newKeyResult.apiKey),
        userId: oldKeyData.userId,
        gracePeriod,
        immediateRevoke: options.immediateRevoke
      });
      
      return {
        ...newKeyResult,
        oldKeyId: oldApiKey,
        gracePeriodExpires: Date.now() + gracePeriod
      };
      
    } catch (error) {
      console.error('API key rotation error:', error);
      throw error;
    }
  }

  /**
   * Revoke an API key
   * @param {string} apiKey - API key to revoke
   * @param {string} reason - Reason for revocation
   * @returns {Promise<boolean>} Success status
   */
  async revokeApiKey(apiKey, reason = 'Manual revocation') {
    try {
      const keyDoc = await this.db.collection('api_keys').doc(apiKey).get();
      if (!keyDoc.exists) {
        throw new Error('API key not found');
      }
      
      const keyData = keyDoc.data();
      
      // Update key status
      await this.db.collection('api_keys').doc(apiKey).update({
        enabled: false,
        revokedAt: Date.now(),
        revokedReason: reason
      });
      
      // Remove from cache
      this.keyCache.delete(apiKey);
      
      // Log revocation
      await auditLogger.logApiKeyEvent('API_KEY_REVOKED', {
        keyPrefix: this.maskApiKey(apiKey),
        userId: keyData.userId,
        reason,
        severity: 'HIGH'
      });
      
      return true;
      
    } catch (error) {
      console.error('API key revocation error:', error);
      throw error;
    }
  }

  /**
   * Get all API keys for a user
   * @param {string} userId - User ID
   * @param {string} environment - Optional environment filter
   * @returns {Promise<Array>} User's API keys
   */
  async getUserApiKeys(userId, environment = null) {
    try {
      let query = this.db.collection('api_keys')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc');
      
      if (environment) {
        query = query.where('environment', '==', environment);
      }
      
      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          keyId: doc.id,
          keyPrefix: this.maskApiKey(doc.id),
          environment: data.environment,
          plan: data.plan,
          enabled: data.enabled,
          name: data.name,
          description: data.description,
          createdAt: data.createdAt,
          lastUsed: data.lastUsed,
          usageCount: data.usageCount,
          expiresAt: data.expiresAt,
          rotated: data.rotated,
          permissions: data.permissions
        };
      });
      
    } catch (error) {
      console.error('Error getting user API keys:', error);
      return [];
    }
  }

  /**
   * Update API key permissions based on plan change
   * @param {string} userId - User ID
   * @param {string} newPlan - New plan name
   * @returns {Promise<Object>} Update results
   */
  async updateUserPlan(userId, newPlan) {
    try {
      if (!this.planLimits[newPlan]) {
        throw new Error(`Invalid plan: ${newPlan}`);
      }
      
      const userKeys = await this.getUserApiKeys(userId);
      const planConfig = this.planLimits[newPlan];
      const updates = [];
      
      for (const key of userKeys) {
        if (key.enabled) {
          const environment = key.environment;
          const newPermissions = this.keyConfig[environment].permissions.filter(perm => 
            planConfig.features.includes('all') || planConfig.features.includes(perm)
          );
          
          await this.db.collection('api_keys').doc(key.keyId).update({
            plan: newPlan,
            permissions: newPermissions,
            rateLimits: planConfig.rateLimits,
            updatedAt: Date.now()
          });
          
          // Remove from cache to force refresh
          this.keyCache.delete(key.keyId);
          
          updates.push({
            keyId: key.keyId,
            newPermissions,
            newRateLimits: planConfig.rateLimits
          });
        }
      }
      
      // Log plan update
      await auditLogger.logApiKeyEvent('USER_PLAN_UPDATED', {
        userId,
        newPlan,
        keysUpdated: updates.length
      });
      
      return { updated: updates.length, details: updates };
      
    } catch (error) {
      console.error('Error updating user plan:', error);
      throw error;
    }
  }

  /**
   * Get API key usage statistics
   * @param {string} apiKey - API key to get stats for
   * @param {string} timeRange - Time range (24h, 7d, 30d)
   * @returns {Promise<Object>} Usage statistics
   */
  async getApiKeyStats(apiKey, timeRange = '24h') {
    try {
      const keyDoc = await this.db.collection('api_keys').doc(apiKey).get();
      if (!keyDoc.exists) {
        throw new Error('API key not found');
      }
      
      const keyData = keyDoc.data();
      
      // Get usage statistics from audit logs
      const stats = await auditLogger.getSecurityStatistics(timeRange);
      
      // Filter for this specific API key
      const keyHash = this.hashApiKey(apiKey);
      const keyEvents = stats.topClientIds[keyHash] || 0;
      
      return {
        keyId: this.maskApiKey(apiKey),
        totalUsage: keyData.usageCount,
        recentUsage: keyEvents,
        timeRange,
        lastUsed: keyData.lastUsed,
        rateLimits: keyData.rateLimits,
        plan: keyData.plan,
        enabled: keyData.enabled,
        expiresAt: keyData.expiresAt
      };
      
    } catch (error) {
      console.error('Error getting API key stats:', error);
      return null;
    }
  }

  /**
   * Clean up expired and rotated keys
   */
  async cleanupExpiredKeys() {
    try {
      const now = Date.now();
      
      // Find keys that are past their grace period
      const expiredQuery = await this.db.collection('api_keys')
        .where('rotated', '==', true)
        .where('gracePeriodExpires', '<', now)
        .limit(100)
        .get();
      
      // Find naturally expired keys
      const naturallyExpiredQuery = await this.db.collection('api_keys')
        .where('expiresAt', '<', now)
        .limit(100)
        .get();
      
      const batch = this.db.batch();
      let cleanupCount = 0;
      
      // Disable rotated keys past grace period
      expiredQuery.docs.forEach(doc => {
        batch.update(doc.ref, { enabled: false });
        this.keyCache.delete(doc.id);
        cleanupCount++;
      });
      
      // Disable naturally expired keys
      naturallyExpiredQuery.docs.forEach(doc => {
        batch.update(doc.ref, { enabled: false });
        this.keyCache.delete(doc.id);
        cleanupCount++;
      });
      
      if (cleanupCount > 0) {
        await batch.commit();
        
        await auditLogger.logApiKeyEvent('EXPIRED_KEYS_CLEANUP', {
          keysDisabled: cleanupCount,
          timestamp: now
        });
        
        console.log(`Cleaned up ${cleanupCount} expired API keys`);
      }
      
      return { cleaned: cleanupCount };
      
    } catch (error) {
      console.error('Error cleaning up expired keys:', error);
      return { error: error.message };
    }
  }

  /**
   * Start the cleanup process (runs periodically)
   */
  startCleanupProcess() {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredKeys();
    }, 60 * 60 * 1000);
  }

  /**
   * Stop the cleanup process
   */
  stopCleanupProcess() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Hash API key for storage
   * @param {string} apiKey - API key to hash
   * @returns {string} Hashed API key
   */
  hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Mask API key for logging/display
   * @param {string} apiKey - API key to mask
   * @returns {string} Masked API key
   */
  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) return '[MASKED]';
    return apiKey.slice(0, 8) + '...' + apiKey.slice(-4);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopCleanupProcess();
    this.keyCache.clear();
  }
}

// Export singleton instance
const apiKeyManager = new ApiKeyManager();
module.exports = apiKeyManager;