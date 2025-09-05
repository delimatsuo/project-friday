/**
 * Performance Benchmark Runner
 * Automated performance testing and baseline establishment
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import PerformanceTracer from '../../src/services/performanceTracer.js';
import PerformanceMonitor from '../../src/utils/performanceMonitor.js';
import OptimizedGeminiService from '../../src/services/optimizedGeminiService.js';
import logger from '../../src/utils/logger.js';

class BenchmarkRunner {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './performance-results',
      baselineFile: options.baselineFile || 'performance-baseline.json',
      reportFile: options.reportFile || 'performance-report.json',
      
      // Test configuration
      warmupDuration: options.warmupDuration || 30000,    // 30 seconds
      testDuration: options.testDuration || 300000,       // 5 minutes
      concurrent: options.concurrent || 5,
      rampUpDuration: options.rampUpDuration || 60000,    // 1 minute
      
      // Target metrics
      targets: {
        aiResponseLatencyP95: 1500,  // ms
        aiResponseLatencyP99: 2000,  // ms
        coldStartTime: 2000,         // ms
        memoryLimit: 512 * 1024 * 1024, // 512MB
        errorRate: 0.01,             // 1%
        throughput: 5                // requests/second
      },
      
      ...options
    };
    
    this.performanceTracer = new PerformanceTracer();
    this.performanceMonitor = new PerformanceMonitor();
    this.geminiService = new OptimizedGeminiService();
    
    // Test results
    this.results = {
      timestamp: new Date().toISOString(),
      configuration: this.options,
      tests: {},
      baseline: null,
      summary: {}
    };
  }

  /**
   * Initialize benchmark runner
   */
  async initialize() {
    try {
      // Create output directory
      await fs.mkdir(this.options.outputDir, { recursive: true });
      
      // Initialize services
      await this.performanceTracer.initialize();
      await this.performanceMonitor.initialize();
      await this.geminiService.initialize();
      
      // Load existing baseline if available
      await this.loadBaseline();
      
      logger.info('Benchmark runner initialized', {
        outputDir: this.options.outputDir,
        targets: this.options.targets
      });
      
    } catch (error) {
      logger.error('Failed to initialize benchmark runner', error);
      throw error;
    }
  }

  /**
   * Run all performance benchmarks
   */
  async runAllBenchmarks() {
    try {
      logger.info('Starting comprehensive performance benchmarks');
      
      // Warmup phase
      await this.runWarmup();
      
      // Individual component benchmarks
      await this.runAIResponseBenchmark();
      await this.runColdStartBenchmark();
      await this.runMemoryBenchmark();
      await this.runConcurrentCallsBenchmark();
      await this.runPayloadOptimizationBenchmark();
      
      // Load testing
      await this.runLoadTest();
      
      // Generate comprehensive report
      await this.generateReport();
      
      // Update baseline if performance improved
      await this.updateBaselineIfImproved();
      
      logger.info('All benchmarks completed successfully');
      return this.results;
      
    } catch (error) {
      logger.error('Benchmark execution failed', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Warmup phase to stabilize performance
   */
  async runWarmup() {
    logger.info('Starting warmup phase');
    const startTime = Date.now();
    
    const warmupRequests = [];
    const requestCount = Math.floor(this.options.warmupDuration / 1000); // 1 per second
    
    for (let i = 0; i < requestCount; i++) {
      warmupRequests.push(
        new Promise(resolve => {
          setTimeout(async () => {
            try {
              await this.geminiService.generateResponse(`Warmup request ${i}`);
              resolve({ success: true });
            } catch (error) {
              resolve({ success: false, error: error.message });
            }
          }, i * 1000);
        })
      );
    }
    
    const warmupResults = await Promise.all(warmupRequests);
    const successCount = warmupResults.filter(r => r.success).length;
    
    this.results.tests.warmup = {
      duration: Date.now() - startTime,
      requestCount,
      successCount,
      successRate: (successCount / requestCount * 100).toFixed(2) + '%',
      timestamp: new Date().toISOString()
    };
    
    logger.info('Warmup completed', this.results.tests.warmup);
  }

  /**
   * AI Response latency benchmark
   */
  async runAIResponseBenchmark() {
    logger.info('Running AI response latency benchmark');
    const startTime = Date.now();
    
    const testInputs = [
      "Hello, I need help with something",
      "Can you tell me about the weather?",
      "I'm looking for information about my appointment",
      "What services do you provide?",
      "Can you help me with a technical issue?",
      "I need to reschedule something",
      "Tell me about your features",
      "How can you assist me today?",
      "I have a question about my account",
      "What's the best way to contact support?",
      "I need detailed information about your pricing plans",
      "Can you help me troubleshoot a connection issue?",
      "What are your business hours and availability?",
      "I'd like to know about your customer support options",
      "Can you explain how your service works?"
    ];
    
    const latencies = [];
    const errors = [];
    
    // Sequential test for accurate latency measurement
    for (const input of testInputs) {
      const requestStart = performance.now();
      
      try {
        await this.geminiService.generateResponse(input);
        const latency = performance.now() - requestStart;
        latencies.push(latency);
        
      } catch (error) {
        const latency = performance.now() - requestStart;
        latencies.push(latency);
        errors.push({ input, error: error.message, latency });
      }
    }
    
    // Calculate statistics
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const stats = {
      count: latencies.length,
      min: sortedLatencies[0],
      max: sortedLatencies[sortedLatencies.length - 1],
      avg: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
      p50: sortedLatencies[Math.floor(sortedLatencies.length * 0.5)],
      p95: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)],
      p99: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)],
      errorCount: errors.length,
      errorRate: (errors.length / latencies.length * 100).toFixed(2) + '%'
    };
    
    this.results.tests.aiResponseLatency = {
      ...stats,
      duration: Date.now() - startTime,
      targetP95: this.options.targets.aiResponseLatencyP95,
      targetP99: this.options.targets.aiResponseLatencyP99,
      meetsP95Target: stats.p95 < this.options.targets.aiResponseLatencyP95,
      meetsP99Target: stats.p99 < this.options.targets.aiResponseLatencyP99,
      errors,
      timestamp: new Date().toISOString()
    };
    
    logger.info('AI response benchmark completed', {
      avgLatency: Math.round(stats.avg),
      p95Latency: Math.round(stats.p95),
      p99Latency: Math.round(stats.p99),
      errorRate: stats.errorRate,
      meetsTargets: this.results.tests.aiResponseLatency.meetsP95Target && this.results.tests.aiResponseLatency.meetsP99Target
    });
  }

  /**
   * Cold start benchmark
   */
  async runColdStartBenchmark() {
    logger.info('Running cold start benchmark');
    
    const coldStartTests = [];
    
    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();
      
      try {
        // Create new service instance to simulate cold start
        const newService = new OptimizedGeminiService();
        await newService.initialize();
        
        // Make first request
        await newService.generateResponse(`Cold start test ${i}`);
        
        const coldStartTime = performance.now() - startTime;
        coldStartTests.push({ success: true, time: coldStartTime });
        
        await newService.cleanup();
        
      } catch (error) {
        const coldStartTime = performance.now() - startTime;
        coldStartTests.push({ success: false, time: coldStartTime, error: error.message });
      }
      
      // Wait between tests to ensure clean state
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    const successfulTests = coldStartTests.filter(t => t.success);
    const times = successfulTests.map(t => t.time);
    
    if (times.length > 0) {
      const stats = {
        count: times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        avg: times.reduce((sum, time) => sum + time, 0) / times.length,
        failureCount: coldStartTests.length - times.length
      };
      
      this.results.tests.coldStart = {
        ...stats,
        targetTime: this.options.targets.coldStartTime,
        meetsTarget: stats.avg < this.options.targets.coldStartTime,
        allTests: coldStartTests,
        timestamp: new Date().toISOString()
      };
    } else {
      this.results.tests.coldStart = {
        error: 'All cold start tests failed',
        failureCount: coldStartTests.length,
        allTests: coldStartTests,
        timestamp: new Date().toISOString()
      };
    }
    
    logger.info('Cold start benchmark completed', {
      avgTime: this.results.tests.coldStart.avg ? Math.round(this.results.tests.coldStart.avg) : 'N/A',
      maxTime: this.results.tests.coldStart.max ? Math.round(this.results.tests.coldStart.max) : 'N/A',
      successCount: successfulTests.length,
      totalCount: coldStartTests.length
    });
  }

  /**
   * Memory usage benchmark
   */
  async runMemoryBenchmark() {
    logger.info('Running memory usage benchmark');
    
    const initialMemory = process.memoryUsage();
    const memorySnapshots = [{ phase: 'initial', ...initialMemory, timestamp: Date.now() }];
    
    // Memory stress test
    const operations = [];
    for (let i = 0; i < 50; i++) {
      operations.push(
        this.geminiService.generateResponse(`Memory test ${i} with extended context`)
      );
      
      // Take memory snapshots during execution
      if (i % 10 === 0) {
        memorySnapshots.push({
          phase: `operation_${i}`,
          ...process.memoryUsage(),
          timestamp: Date.now()
        });
      }
    }
    
    await Promise.all(operations);
    
    const finalMemory = process.memoryUsage();
    memorySnapshots.push({ phase: 'final', ...finalMemory, timestamp: Date.now() });
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      const afterGCMemory = process.memoryUsage();
      memorySnapshots.push({ phase: 'after_gc', ...afterGCMemory, timestamp: Date.now() });
    }
    
    // Calculate memory statistics
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const maxHeapUsed = Math.max(...memorySnapshots.map(s => s.heapUsed));
    
    this.results.tests.memoryUsage = {
      initialMemory: initialMemory.heapUsed,
      finalMemory: finalMemory.heapUsed,
      maxMemory: maxHeapUsed,
      memoryIncrease,
      memoryIncreasePercent: (memoryIncrease / initialMemory.heapUsed * 100).toFixed(2) + '%',
      targetLimit: this.options.targets.memoryLimit,
      withinLimit: maxHeapUsed < this.options.targets.memoryLimit,
      snapshots: memorySnapshots,
      timestamp: new Date().toISOString()
    };
    
    logger.info('Memory benchmark completed', {
      memoryIncrease: Math.round(memoryIncrease / 1024 / 1024 * 100) / 100 + 'MB',
      maxMemory: Math.round(maxHeapUsed / 1024 / 1024 * 100) / 100 + 'MB',
      withinLimit: this.results.tests.memoryUsage.withinLimit
    });
  }

  /**
   * Concurrent calls benchmark
   */
  async runConcurrentCallsBenchmark() {
    logger.info('Running concurrent calls benchmark');
    
    const concurrencyLevels = [1, 3, 5, 10];
    const concurrentResults = {};
    
    for (const concurrent of concurrencyLevels) {
      logger.info(`Testing ${concurrent} concurrent calls`);
      
      const startTime = performance.now();
      const promises = [];
      
      for (let i = 0; i < concurrent; i++) {
        promises.push(
          this.measureSingleCall(`Concurrent test ${concurrent}/${i}`)
        );
      }
      
      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      concurrentResults[concurrent] = {
        totalCalls: concurrent,
        successfulCalls: successful.length,
        failedCalls: failed.length,
        successRate: (successful.length / concurrent * 100).toFixed(2) + '%',
        totalTime,
        avgLatency: successful.length > 0 ? 
          successful.reduce((sum, r) => sum + r.latency, 0) / successful.length : 0,
        maxLatency: successful.length > 0 ? Math.max(...successful.map(r => r.latency)) : 0,
        throughput: concurrent / (totalTime / 1000), // calls per second
        results
      };
    }
    
    this.results.tests.concurrentCalls = {
      results: concurrentResults,
      maxConcurrency: Math.max(...Object.keys(concurrentResults).map(k => parseInt(k))),
      targetConcurrency: 10,
      meetsTarget: concurrentResults[10]?.successRate === '100.00%',
      timestamp: new Date().toISOString()
    };
    
    logger.info('Concurrent calls benchmark completed', {
      maxTested: this.results.tests.concurrentCalls.maxConcurrency,
      successAt10: concurrentResults[10]?.successRate || 'Not tested'
    });
  }

  /**
   * Payload optimization benchmark
   */
  async runPayloadOptimizationBenchmark() {
    logger.info('Running payload optimization benchmark');
    
    const PayloadOptimizer = (await import('../../src/utils/payloadOptimizer.js')).default;
    const optimizer = new PayloadOptimizer();
    
    const testPayloads = [
      { type: 'json', data: { userInput: "Hello", transcript: "User said hello" } },
      { type: 'json', data: { userInput: "Very long detailed question about services", transcript: "Extended conversation with multiple exchanges" } },
      { type: 'text', data: "This is a sample text response that should be optimized for voice interaction and compressed if beneficial" },
      { type: 'voice', data: "This is a **very detailed** response with [markdown](formatting) that needs to be optimized for voice synthesis and TTS systems" }
    ];
    
    const optimizationResults = [];
    
    for (const payload of testPayloads) {
      const startTime = performance.now();
      const result = await optimizer.optimizePayload(payload.data, payload.type);
      const optimizationTime = performance.now() - startTime;
      
      optimizationResults.push({
        type: payload.type,
        originalSize: result.metadata.originalSize,
        optimizedSize: result.metadata.optimizedSize,
        compressedSize: result.metadata.compressedSize,
        reductionPercentage: result.metadata.reductionPercentage,
        optimizationTime,
        compressionRatio: result.metadata.compressionRatio
      });
    }
    
    const avgReduction = optimizationResults.reduce((sum, r) => 
      sum + parseFloat(r.reductionPercentage), 0) / optimizationResults.length;
    
    this.results.tests.payloadOptimization = {
      results: optimizationResults,
      avgReductionPercentage: avgReduction.toFixed(2) + '%',
      totalOptimizations: optimizationResults.length,
      stats: optimizer.getStats(),
      timestamp: new Date().toISOString()
    };
    
    logger.info('Payload optimization benchmark completed', {
      avgReduction: this.results.tests.payloadOptimization.avgReductionPercentage,
      totalTests: optimizationResults.length
    });
  }

  /**
   * Run load test using Artillery
   */
  async runLoadTest() {
    logger.info('Running Artillery load test');
    
    return new Promise((resolve, reject) => {
      const artillery = spawn('artillery', ['run', 'tests/performance/load-test.yml'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });
      
      let output = '';
      let errorOutput = '';
      
      artillery.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      artillery.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      artillery.on('close', (code) => {
        if (code === 0) {
          this.results.tests.loadTest = {
            success: true,
            output,
            timestamp: new Date().toISOString()
          };
          
          // Parse Artillery output for metrics
          this.parseArtilleryOutput(output);
          
          logger.info('Load test completed successfully');
          resolve();
        } else {
          this.results.tests.loadTest = {
            success: false,
            error: errorOutput,
            output,
            exitCode: code,
            timestamp: new Date().toISOString()
          };
          
          logger.warn('Load test failed', { exitCode: code, error: errorOutput });
          resolve(); // Don't fail the entire benchmark
        }
      });
      
      artillery.on('error', (error) => {
        this.results.tests.loadTest = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        
        logger.warn('Artillery load test error', error);
        resolve(); // Don't fail the entire benchmark
      });
    });
  }

  /**
   * Parse Artillery output for metrics
   */
  parseArtilleryOutput(output) {
    try {
      // Extract key metrics from Artillery output
      const lines = output.split('\n');
      const metrics = {};
      
      for (const line of lines) {
        if (line.includes('http.response_time')) {
          const parts = line.split(':');
          if (parts[1]) {
            const [metric, value] = parts[1].trim().split(' ');
            metrics[metric] = parseFloat(value);
          }
        }
        
        if (line.includes('http.responses')) {
          metrics.responses = parseInt(line.match(/\d+/)?.[0] || '0');
        }
        
        if (line.includes('errors')) {
          metrics.errors = parseInt(line.match(/\d+/)?.[0] || '0');
        }
      }
      
      if (Object.keys(metrics).length > 0) {
        this.results.tests.loadTest.metrics = metrics;
      }
      
    } catch (error) {
      logger.warn('Failed to parse Artillery output', error);
    }
  }

  /**
   * Measure a single call
   */
  async measureSingleCall(input) {
    const startTime = performance.now();
    
    try {
      await this.geminiService.generateResponse(input);
      const latency = performance.now() - startTime;
      
      return { success: true, latency, input };
      
    } catch (error) {
      const latency = performance.now() - startTime;
      
      return { 
        success: false, 
        latency, 
        input, 
        error: error.message 
      };
    }
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport() {
    logger.info('Generating performance report');
    
    // Calculate overall performance score
    this.results.summary = this.calculateOverallScore();
    
    // Save detailed report
    const reportPath = path.join(this.options.outputDir, this.options.reportFile);
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    
    // Generate human-readable summary
    const summaryPath = path.join(this.options.outputDir, 'performance-summary.txt');
    const summary = this.generateHumanReadableSummary();
    await fs.writeFile(summaryPath, summary);
    
    logger.info('Performance report generated', {
      reportPath,
      summaryPath,
      overallScore: this.results.summary.overallScore
    });
  }

  /**
   * Calculate overall performance score
   */
  calculateOverallScore() {
    const scores = {
      aiResponse: 0,
      coldStart: 0,
      memory: 0,
      concurrent: 0,
      payload: 0,
      load: 0
    };
    
    let totalWeight = 0;
    
    // AI Response Score (weight: 30%)
    if (this.results.tests.aiResponseLatency) {
      const test = this.results.tests.aiResponseLatency;
      let score = 100;
      
      if (!test.meetsP95Target) score -= 25;
      if (!test.meetsP99Target) score -= 15;
      if (parseFloat(test.errorRate) > 1) score -= 20;
      
      scores.aiResponse = Math.max(0, score);
      totalWeight += 30;
    }
    
    // Cold Start Score (weight: 20%)
    if (this.results.tests.coldStart && this.results.tests.coldStart.avg) {
      const test = this.results.tests.coldStart;
      let score = test.meetsTarget ? 100 : Math.max(0, 100 - ((test.avg - this.options.targets.coldStartTime) / this.options.targets.coldStartTime * 100));
      
      scores.coldStart = Math.max(0, score);
      totalWeight += 20;
    }
    
    // Memory Score (weight: 15%)
    if (this.results.tests.memoryUsage) {
      const test = this.results.tests.memoryUsage;
      scores.memory = test.withinLimit ? 100 : 50;
      totalWeight += 15;
    }
    
    // Concurrent Calls Score (weight: 20%)
    if (this.results.tests.concurrentCalls) {
      const test = this.results.tests.concurrentCalls;
      scores.concurrent = test.meetsTarget ? 100 : 75;
      totalWeight += 20;
    }
    
    // Payload Optimization Score (weight: 10%)
    if (this.results.tests.payloadOptimization) {
      const avgReduction = parseFloat(this.results.tests.payloadOptimization.avgReductionPercentage);
      scores.payload = Math.min(100, avgReduction * 2); // Scale to 100
      totalWeight += 10;
    }
    
    // Load Test Score (weight: 5%)
    if (this.results.tests.loadTest && this.results.tests.loadTest.success) {
      scores.load = 100;
      totalWeight += 5;
    }
    
    // Calculate weighted average
    const weightedSum = Object.entries(scores).reduce((sum, [key, score]) => {
      const weights = { aiResponse: 30, coldStart: 20, memory: 15, concurrent: 20, payload: 10, load: 5 };
      return sum + (score * (weights[key] || 0));
    }, 0);
    
    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    return {
      overallScore: Math.round(overallScore),
      componentScores: scores,
      grade: this.getPerformanceGrade(overallScore),
      meetsAllTargets: this.checkAllTargetsMet(),
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Get performance grade
   */
  getPerformanceGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 55) return 'C-';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Check if all targets are met
   */
  checkAllTargetsMet() {
    const tests = this.results.tests;
    
    return (
      tests.aiResponseLatency?.meetsP95Target !== false &&
      tests.aiResponseLatency?.meetsP99Target !== false &&
      tests.coldStart?.meetsTarget !== false &&
      tests.memoryUsage?.withinLimit !== false &&
      tests.concurrentCalls?.meetsTarget !== false
    );
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const tests = this.results.tests;
    
    if (tests.aiResponseLatency && !tests.aiResponseLatency.meetsP95Target) {
      recommendations.push('Optimize AI response latency - consider connection pooling, caching, or streaming');
    }
    
    if (tests.coldStart && !tests.coldStart.meetsTarget) {
      recommendations.push('Reduce cold start time - increase minimum instances or optimize initialization');
    }
    
    if (tests.memoryUsage && !tests.memoryUsage.withinLimit) {
      recommendations.push('Optimize memory usage - implement garbage collection, reduce cached data');
    }
    
    if (tests.concurrentCalls && !tests.concurrentCalls.meetsTarget) {
      recommendations.push('Improve concurrent call handling - optimize connection pooling and resource management');
    }
    
    return recommendations;
  }

  /**
   * Generate human-readable summary
   */
  generateHumanReadableSummary() {
    const summary = this.results.summary;
    const tests = this.results.tests;
    
    let report = `# Performance Benchmark Report\n\n`;
    report += `**Timestamp:** ${this.results.timestamp}\n`;
    report += `**Overall Score:** ${summary.overallScore}/100 (Grade: ${summary.grade})\n`;
    report += `**All Targets Met:** ${summary.meetsAllTargets ? 'YES' : 'NO'}\n\n`;
    
    report += `## Key Metrics\n\n`;
    
    if (tests.aiResponseLatency) {
      const test = tests.aiResponseLatency;
      report += `### AI Response Latency\n`;
      report += `- Average: ${Math.round(test.avg)}ms\n`;
      report += `- P95: ${Math.round(test.p95)}ms (Target: ${test.targetP95}ms) ${test.meetsP95Target ? '✅' : '❌'}\n`;
      report += `- P99: ${Math.round(test.p99)}ms (Target: ${test.targetP99}ms) ${test.meetsP99Target ? '✅' : '❌'}\n`;
      report += `- Error Rate: ${test.errorRate}\n\n`;
    }
    
    if (tests.coldStart && tests.coldStart.avg) {
      const test = tests.coldStart;
      report += `### Cold Start Performance\n`;
      report += `- Average: ${Math.round(test.avg)}ms (Target: ${test.targetTime}ms) ${test.meetsTarget ? '✅' : '❌'}\n`;
      report += `- Max: ${Math.round(test.max)}ms\n`;
      report += `- Success Rate: ${test.count}/${test.count + test.failureCount}\n\n`;
    }
    
    if (tests.memoryUsage) {
      const test = tests.memoryUsage;
      report += `### Memory Usage\n`;
      report += `- Max Memory: ${Math.round(test.maxMemory / 1024 / 1024)}MB\n`;
      report += `- Memory Increase: ${Math.round(test.memoryIncrease / 1024 / 1024)}MB (${test.memoryIncreasePercent})\n`;
      report += `- Within Limit: ${test.withinLimit ? '✅' : '❌'}\n\n`;
    }
    
    if (summary.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      summary.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
    }
    
    return report;
  }

  /**
   * Load existing baseline
   */
  async loadBaseline() {
    try {
      const baselinePath = path.join(this.options.outputDir, this.options.baselineFile);
      const baselineData = await fs.readFile(baselinePath, 'utf8');
      this.results.baseline = JSON.parse(baselineData);
      
      logger.info('Loaded performance baseline', {
        timestamp: this.results.baseline.timestamp,
        score: this.results.baseline.summary?.overallScore
      });
      
    } catch (error) {
      logger.info('No existing baseline found, will create new one');
    }
  }

  /**
   * Update baseline if performance improved
   */
  async updateBaselineIfImproved() {
    if (!this.results.baseline || 
        this.results.summary.overallScore > this.results.baseline.summary?.overallScore) {
      
      const baselinePath = path.join(this.options.outputDir, this.options.baselineFile);
      await fs.writeFile(baselinePath, JSON.stringify(this.results, null, 2));
      
      logger.info('Updated performance baseline', {
        oldScore: this.results.baseline?.summary?.overallScore || 'N/A',
        newScore: this.results.summary.overallScore
      });
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      await this.performanceTracer.cleanup();
      await this.performanceMonitor.cleanup();
      await this.geminiService.cleanup();
      
      logger.info('Benchmark runner cleanup completed');
    } catch (error) {
      logger.error('Error during benchmark cleanup', error);
    }
  }
}

export default BenchmarkRunner;

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new BenchmarkRunner();
  
  runner.initialize()
    .then(() => runner.runAllBenchmarks())
    .then((results) => {
      console.log('\n=== BENCHMARK RESULTS ===');
      console.log(`Overall Score: ${results.summary.overallScore}/100 (${results.summary.grade})`);
      console.log(`All Targets Met: ${results.summary.meetsAllTargets ? 'YES' : 'NO'}`);
      
      if (results.summary.recommendations.length > 0) {
        console.log('\nRecommendations:');
        results.summary.recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. ${rec}`);
        });
      }
      
      process.exit(results.summary.meetsAllTargets ? 0 : 1);
    })
    .catch((error) => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}