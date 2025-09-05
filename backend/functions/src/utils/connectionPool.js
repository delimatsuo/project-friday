/**
 * Connection Pool Utility
 * Manages HTTP connections and API client pooling for optimal performance
 */

import logger from './logger.js';

class ConnectionPool {
  constructor(options = {}) {
    this.options = {
      maxConnections: options.maxConnections || 10,
      minConnections: options.minConnections || 2,
      connectionTimeout: options.connectionTimeout || 5000,
      idleTimeout: options.idleTimeout || 30000,
      warmupDelay: options.warmupDelay || 100,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      enableKeepalive: options.enableKeepalive !== false,
      enableValidation: options.enableValidation !== false,
      ...options
    };
    
    // Connection storage
    this.connections = new Map();
    this.availableConnections = new Set();
    this.busyConnections = new Set();
    this.connectionStats = new Map();
    
    // Pool state
    this.isInitialized = false;
    this.isShuttingDown = false;
    this.nextConnectionId = 1;
    
    // Cleanup intervals
    this.cleanupInterval = null;
    this.validationInterval = null;
    this.statsInterval = null;
    
    // Statistics
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      connectionCreateCount: 0,
      connectionDestroyCount: 0,
      poolHits: 0,
      poolMisses: 0
    };
  }

  /**
   * Initialize the connection pool
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing connection pool', {
        maxConnections: this.options.maxConnections,
        minConnections: this.options.minConnections
      });

      // Create minimum connections
      const warmupPromises = [];
      for (let i = 0; i < this.options.minConnections; i++) {
        warmupPromises.push(
          new Promise(resolve => {
            setTimeout(async () => {
              try {
                await this.createConnection();
                resolve();
              } catch (error) {
                logger.warn('Failed to create warmup connection', error);
                resolve(); // Don't fail initialization
              }
            }, i * this.options.warmupDelay);
          })
        );
      }

      await Promise.all(warmupPromises);

      // Start maintenance intervals
      this.startMaintenance();
      
      this.isInitialized = true;
      
      logger.info('Connection pool initialized', {
        activeConnections: this.availableConnections.size,
        totalConnections: this.connections.size
      });

    } catch (error) {
      logger.error('Failed to initialize connection pool', error);
      throw error;
    }
  }

  /**
   * Create a new connection
   */
  async createConnection() {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    if (this.connections.size >= this.options.maxConnections) {
      throw new Error('Maximum connections exceeded');
    }

    const connectionId = `conn-${this.nextConnectionId++}`;
    const startTime = Date.now();

    try {
      // Create the actual connection (override in subclasses)
      const connection = await this.createActualConnection(connectionId);
      
      const connectionWrapper = {
        id: connectionId,
        connection,
        created: Date.now(),
        lastUsed: Date.now(),
        requestCount: 0,
        isValid: true,
        isIdle: true,
        metadata: {}
      };

      this.connections.set(connectionId, connectionWrapper);
      this.availableConnections.add(connectionId);
      
      this.stats.connectionCreateCount++;
      this.stats.totalConnections = this.connections.size;
      
      const createTime = Date.now() - startTime;
      logger.debug('Connection created', { 
        connectionId, 
        createTime,
        totalConnections: this.connections.size 
      });

      return connectionWrapper;

    } catch (error) {
      logger.error('Failed to create connection', { connectionId, error });
      throw error;
    }
  }

  /**
   * Override this method to create actual connections
   */
  async createActualConnection(connectionId) {
    throw new Error('createActualConnection must be implemented by subclass');
  }

  /**
   * Get a connection from the pool
   */
  async getConnection(timeout = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const requestTimeout = timeout || this.options.connectionTimeout;
    const startTime = Date.now();

    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection pool timeout'));
      }, requestTimeout);

      try {
        let connection = await this.tryGetAvailableConnection();
        
        if (connection) {
          clearTimeout(timeoutId);
          this.stats.poolHits++;
          resolve(connection);
          return;
        }

        // No available connection, try to create new one
        if (this.connections.size < this.options.maxConnections) {
          try {
            connection = await this.createConnection();
            clearTimeout(timeoutId);
            this.stats.poolMisses++;
            resolve(connection);
            return;
          } catch (error) {
            logger.warn('Failed to create new connection', error);
          }
        }

        // Wait for available connection
        this.waitForConnection((availableConnection) => {
          clearTimeout(timeoutId);
          resolve(availableConnection);
        }, (error) => {
          clearTimeout(timeoutId);
          reject(error);
        });

      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Try to get an available connection immediately
   */
  async tryGetAvailableConnection() {
    // Find first available connection
    for (const connectionId of this.availableConnections) {
      const connectionWrapper = this.connections.get(connectionId);
      
      if (connectionWrapper && connectionWrapper.isValid) {
        // Validate connection if needed
        if (this.options.enableValidation) {
          const isValid = await this.validateConnection(connectionWrapper);
          if (!isValid) {
            await this.destroyConnection(connectionId);
            continue;
          }
        }

        // Move to busy pool
        this.availableConnections.delete(connectionId);
        this.busyConnections.add(connectionId);
        
        connectionWrapper.lastUsed = Date.now();
        connectionWrapper.isIdle = false;
        
        return connectionWrapper;
      }
    }

    return null;
  }

  /**
   * Wait for an available connection
   */
  waitForConnection(onResolve, onReject) {
    const checkInterval = 50; // ms
    let attempts = 0;
    const maxAttempts = Math.floor(this.options.connectionTimeout / checkInterval);

    const checkForConnection = async () => {
      attempts++;
      
      if (attempts > maxAttempts) {
        onReject(new Error('Connection wait timeout'));
        return;
      }

      try {
        const connection = await this.tryGetAvailableConnection();
        if (connection) {
          onResolve(connection);
          return;
        }
      } catch (error) {
        onReject(error);
        return;
      }

      // Check again
      setTimeout(checkForConnection, checkInterval);
    };

    checkForConnection();
  }

  /**
   * Release a connection back to the pool
   */
  async releaseConnection(connectionWrapper) {
    if (!connectionWrapper || !this.connections.has(connectionWrapper.id)) {
      return;
    }

    const connectionId = connectionWrapper.id;

    try {
      // Move from busy to available
      this.busyConnections.delete(connectionId);
      
      // Update connection state
      connectionWrapper.isIdle = true;
      connectionWrapper.lastUsed = Date.now();
      connectionWrapper.requestCount++;

      // Validate connection before releasing
      if (this.options.enableValidation) {
        const isValid = await this.validateConnection(connectionWrapper);
        if (!isValid) {
          await this.destroyConnection(connectionId);
          return;
        }
      }

      // Add back to available pool
      this.availableConnections.add(connectionId);
      
      logger.debug('Connection released', { 
        connectionId,
        requestCount: connectionWrapper.requestCount 
      });

    } catch (error) {
      logger.error('Error releasing connection', { connectionId, error });
      await this.destroyConnection(connectionId);
    }
  }

  /**
   * Validate a connection (override in subclasses)
   */
  async validateConnection(connectionWrapper) {
    try {
      // Basic validation - override for specific connection types
      return connectionWrapper.isValid && 
             connectionWrapper.connection && 
             !this.isConnectionExpired(connectionWrapper);
    } catch (error) {
      logger.warn('Connection validation failed', { 
        connectionId: connectionWrapper.id, 
        error 
      });
      return false;
    }
  }

  /**
   * Check if connection is expired
   */
  isConnectionExpired(connectionWrapper) {
    const now = Date.now();
    const age = now - connectionWrapper.created;
    const idleTime = now - connectionWrapper.lastUsed;
    
    return idleTime > this.options.idleTimeout;
  }

  /**
   * Destroy a connection
   */
  async destroyConnection(connectionId) {
    const connectionWrapper = this.connections.get(connectionId);
    if (!connectionWrapper) {
      return;
    }

    try {
      // Remove from all pools
      this.connections.delete(connectionId);
      this.availableConnections.delete(connectionId);
      this.busyConnections.delete(connectionId);

      // Close the actual connection (override in subclasses)
      await this.closeActualConnection(connectionWrapper);

      this.stats.connectionDestroyCount++;
      this.stats.totalConnections = this.connections.size;
      this.stats.activeConnections = this.availableConnections.size;

      logger.debug('Connection destroyed', { 
        connectionId,
        totalConnections: this.connections.size 
      });

    } catch (error) {
      logger.error('Error destroying connection', { connectionId, error });
    }
  }

  /**
   * Override this method to close actual connections
   */
  async closeActualConnection(connectionWrapper) {
    // Default implementation - override in subclasses
    if (connectionWrapper.connection && typeof connectionWrapper.connection.close === 'function') {
      connectionWrapper.connection.close();
    }
  }

  /**
   * Execute a request using a pooled connection
   */
  async executeRequest(requestFn, retryOnFailure = true) {
    const startTime = Date.now();
    let attempts = 0;
    let lastError;

    while (attempts < this.options.retryAttempts) {
      attempts++;
      let connection = null;

      try {
        connection = await this.getConnection();
        
        const result = await requestFn(connection.connection);
        
        // Update stats
        this.stats.totalRequests++;
        this.stats.successfulRequests++;
        
        const responseTime = Date.now() - startTime;
        this.updateAverageResponseTime(responseTime);

        return result;

      } catch (error) {
        lastError = error;
        logger.warn('Request failed', { 
          attempt: attempts, 
          maxAttempts: this.options.retryAttempts,
          error: error.message 
        });

        // If connection is invalid, destroy it
        if (connection && this.isConnectionError(error)) {
          await this.destroyConnection(connection.id);
          connection = null;
        }

        // Don't retry if not requested or max attempts reached
        if (!retryOnFailure || attempts >= this.options.retryAttempts) {
          break;
        }

        // Wait before retry
        if (attempts < this.options.retryAttempts) {
          await new Promise(resolve => 
            setTimeout(resolve, this.options.retryDelay * attempts)
          );
        }

      } finally {
        if (connection) {
          await this.releaseConnection(connection);
        }
      }
    }

    // All attempts failed
    this.stats.totalRequests++;
    this.stats.failedRequests++;
    
    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Check if error indicates connection problem (override in subclasses)
   */
  isConnectionError(error) {
    // Default implementation - override for specific error types
    const connectionErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EPIPE'
    ];
    
    return connectionErrors.some(errCode => 
      error.code === errCode || error.message.includes(errCode)
    );
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime(responseTime) {
    const alpha = 0.1; // Smoothing factor
    if (this.stats.averageResponseTime === 0) {
      this.stats.averageResponseTime = responseTime;
    } else {
      this.stats.averageResponseTime = 
        (alpha * responseTime) + ((1 - alpha) * this.stats.averageResponseTime);
    }
  }

  /**
   * Start maintenance tasks
   */
  startMaintenance() {
    // Cleanup idle connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.options.idleTimeout / 2);

    // Validate connections periodically
    if (this.options.enableValidation) {
      this.validationInterval = setInterval(() => {
        this.validateAllConnections();
      }, 60000); // Every minute
    }

    // Update stats
    this.statsInterval = setInterval(() => {
      this.updateStats();
    }, 30000); // Every 30 seconds
  }

  /**
   * Clean up idle connections
   */
  async cleanupIdleConnections() {
    const now = Date.now();
    const connectionsToDestroy = [];

    for (const [connectionId, connectionWrapper] of this.connections.entries()) {
      if (this.isConnectionExpired(connectionWrapper) && 
          this.availableConnections.has(connectionId)) {
        connectionsToDestroy.push(connectionId);
      }
    }

    // Don't destroy all connections - keep minimum
    const keepMinimum = Math.min(this.options.minConnections, connectionsToDestroy.length);
    const toDestroy = connectionsToDestroy.slice(keepMinimum);

    for (const connectionId of toDestroy) {
      await this.destroyConnection(connectionId);
    }

    if (toDestroy.length > 0) {
      logger.debug('Cleaned up idle connections', { 
        destroyed: toDestroy.length,
        remaining: this.connections.size 
      });
    }
  }

  /**
   * Validate all connections
   */
  async validateAllConnections() {
    const validationPromises = [];

    for (const connectionWrapper of this.connections.values()) {
      if (this.availableConnections.has(connectionWrapper.id)) {
        validationPromises.push(
          this.validateConnection(connectionWrapper).then(isValid => {
            if (!isValid) {
              return this.destroyConnection(connectionWrapper.id);
            }
          }).catch(error => {
            logger.warn('Connection validation error', { 
              connectionId: connectionWrapper.id, 
              error 
            });
            return this.destroyConnection(connectionWrapper.id);
          })
        );
      }
    }

    await Promise.allSettled(validationPromises);
  }

  /**
   * Update statistics
   */
  updateStats() {
    this.stats.activeConnections = this.availableConnections.size;
    this.stats.totalConnections = this.connections.size;

    logger.debug('Connection pool stats', this.stats);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      availableConnections: this.availableConnections.size,
      busyConnections: this.busyConnections.size,
      poolUtilization: this.connections.size > 0 ? 
        (this.busyConnections.size / this.connections.size * 100).toFixed(2) + '%' : '0%',
      hitRate: this.stats.totalRequests > 0 ? 
        (this.stats.poolHits / (this.stats.poolHits + this.stats.poolMisses) * 100).toFixed(2) + '%' : '0%',
      successRate: this.stats.totalRequests > 0 ? 
        (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down connection pool');

    // Stop maintenance tasks
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.validationInterval) clearInterval(this.validationInterval);
    if (this.statsInterval) clearInterval(this.statsInterval);

    // Close all connections
    const shutdownPromises = [];
    for (const connectionId of this.connections.keys()) {
      shutdownPromises.push(this.destroyConnection(connectionId));
    }

    await Promise.allSettled(shutdownPromises);

    this.connections.clear();
    this.availableConnections.clear();
    this.busyConnections.clear();

    logger.info('Connection pool shutdown completed');
  }
}

export default ConnectionPool;