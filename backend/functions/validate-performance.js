/**
 * Performance Validation Script
 * Quick validation of performance optimization implementation
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function validatePerformanceOptimizations() {
  console.log('🚀 Validating Performance Optimizations...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: { passed: 0, total: 0 }
  };
  
  // Test 1: Basic Service Initialization
  console.log('1. Testing service initialization...');
  try {
    const startTime = performance.now();
    
    // Test if our optimized service can be imported
    const OptimizedGeminiService = require('./src/services/optimizedGeminiService.js').default;
    const service = new OptimizedGeminiService();
    
    const initTime = performance.now() - startTime;
    
    results.tests.initialization = {
      passed: true,
      duration: Math.round(initTime),
      target: '<100ms',
      meetsTarget: initTime < 100
    };
    
    results.summary.passed += results.tests.initialization.meetsTarget ? 1 : 0;
    results.summary.total += 1;
    
    console.log(`   ✅ Service initialization: ${Math.round(initTime)}ms`);
    
  } catch (error) {
    results.tests.initialization = {
      passed: false,
      error: error.message
    };
    results.summary.total += 1;
    console.log(`   ❌ Service initialization failed: ${error.message}`);
  }
  
  // Test 2: Performance Tracer
  console.log('2. Testing performance tracer...');
  try {
    const PerformanceTracer = require('./src/services/performanceTracer.js').default;
    const tracer = new PerformanceTracer();
    
    const trace = tracer.startTrace('test-trace', 'validation');
    tracer.addSpan(trace.traceId, 'test-span');
    tracer.endTrace(trace.traceId);
    
    const stats = tracer.getTraceStats('validation');
    
    results.tests.performanceTracer = {
      passed: true,
      tracesRecorded: stats ? stats.traceCount : 0,
      avgDuration: stats ? Math.round(stats.avgDuration) : 0
    };
    
    results.summary.passed += 1;
    results.summary.total += 1;
    
    console.log(`   ✅ Performance tracer working`);
    
  } catch (error) {
    results.tests.performanceTracer = {
      passed: false,
      error: error.message
    };
    results.summary.total += 1;
    console.log(`   ❌ Performance tracer failed: ${error.message}`);
  }
  
  // Test 3: Performance Monitor
  console.log('3. Testing performance monitor...');
  try {
    const PerformanceMonitor = require('./src/utils/performanceMonitor.js').default;
    const monitor = new PerformanceMonitor();
    
    const operation = monitor.startTracking('test-operation', 'validation');
    monitor.addCheckpoint(operation.operationId, 'checkpoint-1');
    monitor.endTracking(operation.operationId);
    
    results.tests.performanceMonitor = {
      passed: true,
      operationsTracked: 1
    };
    
    results.summary.passed += 1;
    results.summary.total += 1;
    
    console.log(`   ✅ Performance monitor working`);
    
  } catch (error) {
    results.tests.performanceMonitor = {
      passed: false,
      error: error.message
    };
    results.summary.total += 1;
    console.log(`   ❌ Performance monitor failed: ${error.message}`);
  }
  
  // Test 4: Connection Pool
  console.log('4. Testing connection pool...');
  try {
    const ConnectionPool = require('./src/utils/connectionPool.js').default;
    
    // Create a simple test connection pool
    class TestConnectionPool extends ConnectionPool {
      async createActualConnection(connectionId) {
        return { id: connectionId, test: true };
      }
      
      async closeActualConnection(connectionWrapper) {
        // Test cleanup
      }
    }
    
    const pool = new TestConnectionPool({ maxConnections: 5, minConnections: 1 });
    const stats = pool.getStats();
    
    results.tests.connectionPool = {
      passed: true,
      maxConnections: 5,
      statsAvailable: !!stats
    };
    
    results.summary.passed += 1;
    results.summary.total += 1;
    
    console.log(`   ✅ Connection pool working`);
    
  } catch (error) {
    results.tests.connectionPool = {
      passed: false,
      error: error.message
    };
    results.summary.total += 1;
    console.log(`   ❌ Connection pool failed: ${error.message}`);
  }
  
  // Test 5: Payload Optimizer
  console.log('5. Testing payload optimizer...');
  try {
    const PayloadOptimizer = require('./src/utils/payloadOptimizer.js').default;
    const optimizer = new PayloadOptimizer();
    
    const testPayload = { test: 'data', message: 'This is a test message that should be optimized' };
    const result = await optimizer.optimizePayload(testPayload, 'json');
    
    const reductionPercent = parseFloat(result.metadata.reductionPercentage);
    
    results.tests.payloadOptimizer = {
      passed: true,
      originalSize: result.metadata.originalSize,
      optimizedSize: result.metadata.optimizedSize,
      reductionPercent: reductionPercent
    };
    
    results.summary.passed += 1;
    results.summary.total += 1;
    
    console.log(`   ✅ Payload optimizer working (${result.metadata.reductionPercentage} reduction)`);
    
  } catch (error) {
    results.tests.payloadOptimizer = {
      passed: false,
      error: error.message
    };
    results.summary.total += 1;
    console.log(`   ❌ Payload optimizer failed: ${error.message}`);
  }
  
  // Test 6: Configuration
  console.log('6. Testing optimization configuration...');
  try {
    const optimizationConfig = require('./src/config/optimization.js');
    const config = optimizationConfig.getOptimizationConfig();
    
    results.tests.configuration = {
      passed: true,
      environment: config.environment,
      targets: config.monitoring.targets,
      hasCloudFunction: !!config.cloudFunction,
      hasGeminiOptimization: !!config.gemini
    };
    
    results.summary.passed += 1;
    results.summary.total += 1;
    
    console.log(`   ✅ Configuration loaded for ${config.environment} environment`);
    
  } catch (error) {
    results.tests.configuration = {
      passed: false,
      error: error.message
    };
    results.summary.total += 1;
    console.log(`   ❌ Configuration failed: ${error.message}`);
  }
  
  // Summary
  console.log('\n📊 Performance Optimization Validation Results:');
  console.log(`✅ Passed: ${results.summary.passed}/${results.summary.total}`);
  console.log(`❌ Failed: ${results.summary.total - results.summary.passed}/${results.summary.total}`);
  
  const successRate = (results.summary.passed / results.summary.total * 100).toFixed(1);
  console.log(`📈 Success Rate: ${successRate}%`);
  
  if (results.summary.passed === results.summary.total) {
    console.log('\n🎉 All performance optimizations validated successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Run load tests: npm run test:load');
    console.log('   2. Start performance dashboard: node src/utils/performanceDashboard.js');
    console.log('   3. Monitor production performance with Cloud Functions');
  } else {
    console.log('\n⚠️  Some validations failed. Please review the errors above.');
  }
  
  return results;
}

// Run validation if called directly
if (require.main === module) {
  validatePerformanceOptimizations().catch(console.error);
}

module.exports = validatePerformanceOptimizations;