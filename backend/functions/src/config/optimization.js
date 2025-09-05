/**
 * Performance Optimization Configuration
 * Centralized configuration for all performance optimizations
 */

/**
 * Cloud Function optimization settings
 */
export const cloudFunctionConfig = {
  // Runtime optimization
  runtime: 'nodejs20',
  memory: '512MB',           // Optimized memory allocation
  timeout: '60s',            // Reasonable timeout for call handling
  minInstances: 2,           // Prevent cold starts
  maxInstances: 100,         // Scale for concurrent calls
  
  // Connection settings
  keepAlive: true,
  maxConnections: 10,
  connectionTimeout: 5000,
  
  // Environment optimization
  node_options: '--max-old-space-size=512 --optimize-for-size',
  
  // VPC and network optimization
  vpcConnector: process.env.VPC_CONNECTOR,
  egressSettings: 'ALL_TRAFFIC',
  ingressSettings: 'ALLOW_ALL',
  
  // Labels for monitoring
  labels: {
    app: 'project-friday',
    component: 'call-screening',
    optimization: 'enabled'
  }
};

/**
 * Gemini API optimization settings
 */
export const geminiOptimization = {
  // Model configuration for speed
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.6,          // Balanced creativity/speed
    topK: 20,                  // Reduced for speed
    topP: 0.9,                 // Slightly reduced
    maxOutputTokens: 512,      // Reduced for faster generation
    responseMimeType: 'text/plain'
  },
  
  // Connection pooling
  connectionPool: {
    maxConnections: 10,
    warmupConnections: 3,
    connectionTimeout: 5000,
    idleTimeout: 30000,
    validateConnection: true
  },
  
  // Response optimization
  responseOptimization: {
    maxResponseLength: 150,    // Words
    enableCompression: true,
    enableStreaming: true,
    streamChunkSize: 50,
    streamDelay: 10
  },
  
  // Caching settings
  cache: {
    enabled: true,
    maxSize: 1000,
    maxAge: 5 * 60 * 1000,     // 5 minutes
    compressionThreshold: 100,  // bytes
    persistToDisk: false       // Memory only for speed
  }
};

/**
 * Performance monitoring configuration
 */
export const monitoringConfig = {
  // Tracing
  tracing: {
    enabled: true,
    samplingRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    exportInterval: 30000,     // 30 seconds
    maxTraceHistory: 1000
  },
  
  // Metrics collection
  metrics: {
    enabled: true,
    aggregationInterval: 60000, // 1 minute
    retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
    maxMetricsHistory: 1000
  },
  
  // Performance targets
  targets: {
    // Primary targets
    aiResponseLatencyP95: 1500,   // ms
    aiResponseLatencyP99: 2000,   // ms
    coldStartTime: 2000,          // ms
    memoryLimit: 512 * 1024 * 1024, // 512MB
    
    // Secondary targets
    avgResponseTime: 800,         // ms
    maxConcurrentCalls: 10,
    errorRate: 0.01,             // 1%
    cacheHitRate: 0.30           // 30%
  },
  
  // Alert thresholds
  alertThresholds: {
    latencyRegression: 0.25,     // 25% increase
    memoryRegression: 0.30,      // 30% increase
    errorRateIncrease: 0.05,     // 5% increase
    maxLatency: 2000,           // ms
    maxMemoryMB: 512,           // MB
    minCacheHitRate: 0.20       // 20%
  }
};

/**
 * API payload optimization
 */
export const payloadOptimization = {
  // Request optimization
  request: {
    compression: {
      enabled: true,
      threshold: 1024,           // bytes
      algorithm: 'gzip',
      level: 6                   // Balance between speed/compression
    },
    
    // Payload size limits
    maxRequestSize: 10 * 1024,   // 10KB
    maxTranscriptSize: 5 * 1024, // 5KB
    maxContextSize: 2 * 1024,    // 2KB
    
    // Content optimization
    stripWhitespace: true,
    removeEmptyFields: true,
    minifyJson: true
  },
  
  // Response optimization
  response: {
    compression: {
      enabled: true,
      threshold: 512,            // bytes
      algorithm: 'gzip',
      level: 6
    },
    
    // Content optimization
    maxResponseSize: 2 * 1024,   // 2KB
    truncateTranscripts: true,
    optimizeForVoice: true,
    removeMetadata: true
  },
  
  // TwiML optimization
  twiml: {
    minify: true,
    removeComments: true,
    optimizeAttributes: true,
    maxTwiMLSize: 4 * 1024       // 4KB TwiML limit
  }
};

/**
 * Database optimization (Firestore)
 */
export const databaseOptimization = {
  // Connection settings
  connection: {
    maxIdleTime: 60000,          // 1 minute
    keepAlive: true,
    ssl: true
  },
  
  // Query optimization
  queries: {
    maxResultSize: 100,
    useIndexes: true,
    enableCaching: true,
    cacheTimeout: 5 * 60 * 1000  // 5 minutes
  },
  
  // Write optimization
  writes: {
    batchSize: 500,
    enableCompression: true,
    retryAttempts: 3,
    retryDelay: 1000
  },
  
  // Data optimization
  data: {
    compressLargeFields: true,
    compressionThreshold: 1024,   // bytes
    maxDocumentSize: 1 * 1024 * 1024, // 1MB
    archiveOldData: true
  }
};

/**
 * Load testing configuration
 */
export const loadTestConfig = {
  // Test scenarios
  scenarios: {
    // Basic load test
    basic: {
      concurrent: 5,
      duration: 300,             // 5 minutes
      rampUp: 60,               // 1 minute
      thinkTime: 2000           // 2 seconds between requests
    },
    
    // Stress test
    stress: {
      concurrent: 10,
      duration: 600,             // 10 minutes
      rampUp: 120,              // 2 minutes
      thinkTime: 1000           // 1 second between requests
    },
    
    // Peak load test
    peak: {
      concurrent: 20,
      duration: 300,             // 5 minutes
      rampUp: 30,               // 30 seconds
      thinkTime: 500            // 0.5 seconds between requests
    }
  },
  
  // Test data
  testData: {
    sampleInputs: [
      "Hello, I need help with something",
      "Can you tell me about the weather?",
      "I'm looking for information about my appointment",
      "What services do you provide?",
      "Can you help me with a technical issue?",
      "I need to reschedule something",
      "Tell me about your features",
      "How can you assist me today?",
      "I have a question about my account",
      "What's the best way to contact support?"
    ],
    
    // Varying input lengths for testing
    shortInputs: [
      "Hi",
      "Help",
      "What?",
      "Yes",
      "No"
    ],
    
    longInputs: [
      "I'm calling because I have a very detailed question about the services you provide and I want to understand all the options available to me",
      "Can you please help me understand the complete process for scheduling an appointment and what information I need to have ready beforehand",
      "I'm experiencing some technical difficulties with my account and I've tried several troubleshooting steps but nothing seems to be working properly"
    ]
  },
  
  // Performance assertions
  assertions: {
    avgResponseTime: 1000,       // ms
    p95ResponseTime: 1500,       // ms
    p99ResponseTime: 2000,       // ms
    errorRate: 0.01,            // 1%
    minThroughput: 5            // requests/second
  }
};

/**
 * Environment-specific optimizations
 */
export const environmentOptimizations = {
  development: {
    enableTracing: true,
    enableCaching: false,
    verboseLogging: true,
    minInstances: 0,
    maxInstances: 5
  },
  
  testing: {
    enableTracing: true,
    enableCaching: true,
    verboseLogging: false,
    minInstances: 0,
    maxInstances: 10
  },
  
  production: {
    enableTracing: true,
    enableCaching: true,
    verboseLogging: false,
    minInstances: 2,
    maxInstances: 100,
    enablePrewarming: true,
    enableConnectionPooling: true
  }
};

/**
 * Get configuration for current environment
 */
export function getOptimizationConfig() {
  const env = process.env.NODE_ENV || 'development';
  const baseConfig = {
    cloudFunction: cloudFunctionConfig,
    gemini: geminiOptimization,
    monitoring: monitoringConfig,
    payload: payloadOptimization,
    database: databaseOptimization,
    loadTest: loadTestConfig
  };
  
  // Apply environment-specific overrides
  if (environmentOptimizations[env]) {
    const envOverrides = environmentOptimizations[env];
    
    // Override cloud function settings
    Object.assign(baseConfig.cloudFunction, {
      minInstances: envOverrides.minInstances,
      maxInstances: envOverrides.maxInstances
    });
    
    // Override monitoring settings
    Object.assign(baseConfig.monitoring.tracing, {
      enabled: envOverrides.enableTracing,
      samplingRate: env === 'production' ? 0.1 : 1.0
    });
    
    // Override caching
    baseConfig.gemini.cache.enabled = envOverrides.enableCaching;
    
    // Override connection pooling
    if (envOverrides.enableConnectionPooling !== undefined) {
      baseConfig.gemini.connectionPool.enabled = envOverrides.enableConnectionPooling;
    }
  }
  
  return {
    ...baseConfig,
    environment: env,
    timestamp: new Date().toISOString()
  };
}

export default {
  cloudFunctionConfig,
  geminiOptimization,
  monitoringConfig,
  payloadOptimization,
  databaseOptimization,
  loadTestConfig,
  environmentOptimizations,
  getOptimizationConfig
};