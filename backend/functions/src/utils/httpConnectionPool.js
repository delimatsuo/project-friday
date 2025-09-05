/**
 * HTTP Connection Pool
 * Specialized connection pool for HTTP requests with keep-alive
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import ConnectionPool from './connectionPool.js';
import logger from './logger.js';

class HTTPConnectionPool extends ConnectionPool {
  constructor(options = {}) {
    super({
      maxConnections: 10,
      minConnections: 2,
      connectionTimeout: 5000,
      idleTimeout: 30000,
      enableKeepalive: true,
      socketTimeout: 10000,
      ...options
    });

    // HTTP-specific options
    this.httpOptions = {
      keepAlive: this.options.enableKeepalive,
      keepAliveMsecs: 30000,
      maxSockets: this.options.maxConnections,
      maxFreeSockets: this.options.minConnections,
      timeout: this.options.socketTimeout,
      freeSocketTimeout: this.options.idleTimeout
    };

    // Agents for different protocols
    this.httpAgent = new http.Agent(this.httpOptions);
    this.httpsAgent = new https.Agent(this.httpOptions);
  }

  /**
   * Create HTTP connection
   */
  async createActualConnection(connectionId) {
    // For HTTP connection pool, we store the agent references
    // The actual connections are managed by Node.js HTTP agents
    
    const connection = {
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
      id: connectionId,
      type: 'http'
    };

    logger.debug('HTTP connection created', { connectionId });
    return connection;
  }

  /**
   * Close HTTP connection
   */
  async closeActualConnection(connectionWrapper) {
    // The HTTP agent manages the actual socket connections
    // We just need to mark this wrapper as closed
    connectionWrapper.connection = null;
    logger.debug('HTTP connection closed', { connectionId: connectionWrapper.id });
  }

  /**
   * Make HTTP request using pooled connection
   */
  async makeRequest(url, options = {}) {
    return this.executeRequest(async (connection) => {
      return this.performHttpRequest(url, {
        ...options,
        agent: this.getAgentForUrl(url, connection)
      });
    });
  }

  /**
   * Get appropriate agent for URL
   */
  getAgentForUrl(url, connection) {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' ? connection.httpsAgent : connection.httpAgent;
  }

  /**
   * Perform actual HTTP request
   */
  performHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const requestModule = isHttps ? https : http;

      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || this.options.socketTimeout,
        agent: options.agent,
        ...options
      };

      const req = requestModule.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            data,
            url
          };

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      // Send request body if provided
      if (options.body) {
        if (typeof options.body === 'object') {
          req.write(JSON.stringify(options.body));
        } else {
          req.write(options.body);
        }
      }

      req.end();
    });
  }

  /**
   * Make JSON request
   */
  async makeJsonRequest(url, data = null, options = {}) {
    const requestOptions = {
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (data) {
      requestOptions.body = data;
    }

    const response = await this.makeRequest(url, requestOptions);
    
    try {
      return {
        ...response,
        json: JSON.parse(response.data)
      };
    } catch (error) {
      throw new Error(`Invalid JSON response: ${error.message}`);
    }
  }

  /**
   * Validate HTTP connection
   */
  async validateConnection(connectionWrapper) {
    try {
      // Check if agents are still valid
      const connection = connectionWrapper.connection;
      
      if (!connection || !connection.httpAgent || !connection.httpsAgent) {
        return false;
      }

      // Check agent status
      const httpSockets = Object.keys(connection.httpAgent.sockets).length;
      const httpsSockets = Object.keys(connection.httpsAgent.sockets).length;
      const httpRequests = Object.keys(connection.httpAgent.requests).length;
      const httpsRequests = Object.keys(connection.httpsAgent.requests).length;

      // Connection is valid if agents exist and aren't overloaded
      return httpSockets + httpsSockets < this.options.maxConnections &&
             httpRequests + httpsRequests < this.options.maxConnections;

    } catch (error) {
      logger.warn('HTTP connection validation failed', { 
        connectionId: connectionWrapper.id, 
        error 
      });
      return false;
    }
  }

  /**
   * Check if error is connection-related
   */
  isConnectionError(error) {
    const httpConnectionErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EPIPE',
      'ECONNABORTED',
      'EHOSTUNREACH'
    ];
    
    return httpConnectionErrors.some(errCode => 
      error.code === errCode || 
      error.message.includes(errCode) ||
      error.message.includes('socket hang up') ||
      error.message.includes('timeout')
    );
  }

  /**
   * Get HTTP agent statistics
   */
  getHttpStats() {
    const httpSockets = Object.keys(this.httpAgent.sockets).reduce((sum, key) => 
      sum + this.httpAgent.sockets[key].length, 0);
    const httpFreeSockets = Object.keys(this.httpAgent.freeSockets).reduce((sum, key) => 
      sum + this.httpAgent.freeSockets[key].length, 0);
    const httpRequests = Object.keys(this.httpAgent.requests).reduce((sum, key) => 
      sum + this.httpAgent.requests[key].length, 0);

    const httpsSockets = Object.keys(this.httpsAgent.sockets).reduce((sum, key) => 
      sum + this.httpsAgent.sockets[key].length, 0);
    const httpsFreeSockets = Object.keys(this.httpsAgent.freeSockets).reduce((sum, key) => 
      sum + this.httpsAgent.freeSockets[key].length, 0);
    const httpsRequests = Object.keys(this.httpsAgent.requests).reduce((sum, key) => 
      sum + this.httpsAgent.requests[key].length, 0);

    return {
      ...this.getStats(),
      http: {
        sockets: httpSockets,
        freeSockets: httpFreeSockets,
        requests: httpRequests
      },
      https: {
        sockets: httpsSockets,
        freeSockets: httpsFreeSockets,
        requests: httpsRequests
      },
      totalSockets: httpSockets + httpsSockets,
      totalFreeSockets: httpFreeSockets + httpsFreeSockets,
      totalRequests: httpRequests + httpsRequests
    };
  }

  /**
   * Shutdown HTTP connection pool
   */
  async shutdown() {
    logger.info('Shutting down HTTP connection pool');

    // Destroy HTTP agents
    if (this.httpAgent) {
      this.httpAgent.destroy();
    }
    
    if (this.httpsAgent) {
      this.httpsAgent.destroy();
    }

    // Call parent shutdown
    await super.shutdown();

    logger.info('HTTP connection pool shutdown completed');
  }
}

export default HTTPConnectionPool;