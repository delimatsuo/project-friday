/**
 * Performance Tests - Latency Requirements
 * Target: <1.5s P95 AI response latency, <2s cold start time
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createServer } from 'http';
import { performance } from 'perf_hooks';

// Import services for direct testing
import GeminiService from '../../src/services/geminiService.js';
import OptimizedGeminiService from '../../src/services/optimizedGeminiService.js';
import PerformanceTracer from '../../src/services/performanceTracer.js';
import PerformanceMonitor from '../../src/utils/performanceMonitor.js';

describe('Performance Tests - Latency Requirements', () => {
  let server;
  let app;
  let geminiService;
  let optimizedGeminiService;
  let performanceTracer;
  let performanceMonitor;
  
  const LATENCY_TARGETS = {
    P95_AI_RESPONSE: 1500, // ms - P95 AI response should be under 1.5s
    P99_AI_RESPONSE: 2000, // ms - P99 AI response should be under 2s
    COLD_START: 2000,      // ms - Cold start should be under 2s
    MEMORY_LIMIT: 512 * 1024 * 1024, // 512MB
    CONCURRENT_CALLS: 10   // Support 10+ concurrent calls
  };
  
  const performanceResults = {
    aiResponseLatencies: [],
    coldStartTimes: [],
    memoryUsages: [],
    concurrentCallResults: []
  };

  beforeAll(async () => {
    // Initialize services
    geminiService = new GeminiService();
    optimizedGeminiService = new OptimizedGeminiService();
    performanceTracer = new PerformanceTracer();
    performanceMonitor = new PerformanceMonitor();
    
    await performanceTracer.initialize();
    await performanceMonitor.initialize();
  }, 30000);

  afterAll(async () => {
    if (server) {
      server.close();
    }
    
    // Generate performance report
    const report = generatePerformanceReport(performanceResults);
    console.log('\n=== PERFORMANCE TEST REPORT ===\n', report);
    
    await performanceTracer.cleanup();
    await performanceMonitor.cleanup();
  });

  describe('AI Response Latency Tests', () => {
    test('should meet P95 latency target for AI responses', async () => {
      const sampleInputs = [
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
      ];

      const latencies = [];
      
      for (const input of sampleInputs) {
        const startTime = performance.now();
        
        try {
          await optimizedGeminiService.generateResponse(input);
          const endTime = performance.now();
          const latency = endTime - startTime;
          
          latencies.push(latency);
          performanceResults.aiResponseLatencies.push(latency);
          
          console.log(`AI Response Latency: ${latency.toFixed(2)}ms for input: "${input.substring(0, 30)}..."`);
        } catch (error) {
          console.error(`Failed to generate response for: "${input}"`, error);
        }
      }

      // Calculate percentiles
      const sortedLatencies = latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedLatencies.length * 0.95);
      const p99Index = Math.floor(sortedLatencies.length * 0.99);
      
      const p95Latency = sortedLatencies[p95Index];
      const p99Latency = sortedLatencies[p99Index];
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

      console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`P95 Latency: ${p95Latency.toFixed(2)}ms (Target: ${LATENCY_TARGETS.P95_AI_RESPONSE}ms)`);
      console.log(`P99 Latency: ${p99Latency.toFixed(2)}ms (Target: ${LATENCY_TARGETS.P99_AI_RESPONSE}ms)`);

      expect(p95Latency).toBeLessThan(LATENCY_TARGETS.P95_AI_RESPONSE);
      expect(p99Latency).toBeLessThan(LATENCY_TARGETS.P99_AI_RESPONSE);
    }, 60000);

    test('should optimize response time with streaming', async () => {
      const input = "Tell me a detailed explanation about artificial intelligence";
      
      // Test regular response
      const regularStart = performance.now();
      const regularResponse = await geminiService.generateResponse(input);
      const regularTime = performance.now() - regularStart;
      
      // Test optimized/streaming response
      const optimizedStart = performance.now();
      const optimizedResponse = await optimizedGeminiService.generateStreamingResponse(input);
      const optimizedTime = performance.now() - optimizedStart;
      
      console.log(`Regular Response Time: ${regularTime.toFixed(2)}ms`);
      console.log(`Optimized Response Time: ${optimizedTime.toFixed(2)}ms`);
      console.log(`Improvement: ${((regularTime - optimizedTime) / regularTime * 100).toFixed(1)}%`);
      
      // Optimized should be at least 20% faster
      expect(optimizedTime).toBeLessThan(regularTime * 0.8);
      expect(optimizedTime).toBeLessThan(LATENCY_TARGETS.P95_AI_RESPONSE);
    }, 30000);
  });

  describe('Cold Start Performance Tests', () => {
    test('should meet cold start time targets', async () => {
      // Simulate cold start by creating new service instances
      const coldStartTests = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        
        // Create new service instance (simulates cold start)
        const newService = new OptimizedGeminiService();
        await newService.initialize();
        
        // Make first request
        await newService.generateResponse("Hello, this is a cold start test");
        
        const endTime = performance.now();
        const coldStartTime = endTime - startTime;
        
        coldStartTests.push(coldStartTime);
        performanceResults.coldStartTimes.push(coldStartTime);
        
        console.log(`Cold Start ${i + 1}: ${coldStartTime.toFixed(2)}ms`);
      }
      
      const avgColdStart = coldStartTests.reduce((sum, time) => sum + time, 0) / coldStartTests.length;
      const maxColdStart = Math.max(...coldStartTests);
      
      console.log(`Average Cold Start: ${avgColdStart.toFixed(2)}ms`);
      console.log(`Max Cold Start: ${maxColdStart.toFixed(2)}ms (Target: ${LATENCY_TARGETS.COLD_START}ms)`);
      
      expect(avgColdStart).toBeLessThan(LATENCY_TARGETS.COLD_START);
      expect(maxColdStart).toBeLessThan(LATENCY_TARGETS.COLD_START * 1.5); // Allow 50% buffer for max
    }, 45000);
  });

  describe('Memory Usage Tests', () => {
    test('should stay within memory limits during operation', async () => {
      const initialMemory = process.memoryUsage();
      console.log(`Initial Memory Usage: ${formatMemoryUsage(initialMemory)}`);
      
      // Perform memory-intensive operations
      const operations = [];
      for (let i = 0; i < 20; i++) {
        operations.push(
          optimizedGeminiService.generateResponse(`Test input ${i} with some context`)
        );
      }
      
      await Promise.all(operations);
      
      const finalMemory = process.memoryUsage();
      console.log(`Final Memory Usage: ${formatMemoryUsage(finalMemory)}`);
      
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      console.log(`Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      performanceResults.memoryUsages.push({
        initial: initialMemory,
        final: finalMemory,
        increase: memoryIncrease
      });
      
      // Should not exceed memory limit
      expect(finalMemory.heapUsed).toBeLessThan(LATENCY_TARGETS.MEMORY_LIMIT);
      
      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    }, 30000);
  });

  describe('Concurrent Call Tests', () => {
    test('should handle concurrent calls efficiently', async () => {
      const concurrentCalls = LATENCY_TARGETS.CONCURRENT_CALLS;
      const testInputs = Array.from({ length: concurrentCalls }, (_, i) => 
        `Concurrent test call ${i + 1}: Can you help me with something?`
      );
      
      const startTime = performance.now();
      
      const promises = testInputs.map(async (input, index) => {
        const callStart = performance.now();
        
        try {
          const response = await optimizedGeminiService.generateResponse(input);
          const callEnd = performance.now();
          const callLatency = callEnd - callStart;
          
          return {
            index,
            success: true,
            latency: callLatency,
            responseLength: response.length
          };
        } catch (error) {
          const callEnd = performance.now();
          return {
            index,
            success: false,
            latency: callEnd - callStart,
            error: error.message
          };
        }
      });
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const successfulCalls = results.filter(r => r.success);
      const failedCalls = results.filter(r => !r.success);
      
      const avgLatency = successfulCalls.reduce((sum, r) => sum + r.latency, 0) / successfulCalls.length;
      const maxLatency = Math.max(...successfulCalls.map(r => r.latency));
      
      console.log(`Concurrent Calls: ${concurrentCalls}`);
      console.log(`Total Time: ${totalTime.toFixed(2)}ms`);
      console.log(`Successful Calls: ${successfulCalls.length}/${concurrentCalls}`);
      console.log(`Failed Calls: ${failedCalls.length}`);
      console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`Max Latency: ${maxLatency.toFixed(2)}ms`);
      
      performanceResults.concurrentCallResults.push({
        totalCalls: concurrentCalls,
        successfulCalls: successfulCalls.length,
        failedCalls: failedCalls.length,
        totalTime,
        avgLatency,
        maxLatency,
        results
      });
      
      // At least 90% success rate
      expect(successfulCalls.length / concurrentCalls).toBeGreaterThan(0.9);
      
      // Average latency should still meet targets
      expect(avgLatency).toBeLessThan(LATENCY_TARGETS.P95_AI_RESPONSE);
      
      // All calls should complete within reasonable time
      expect(maxLatency).toBeLessThan(LATENCY_TARGETS.P99_AI_RESPONSE);
    }, 60000);
  });

  describe('Payload Optimization Tests', () => {
    test('should minimize payload sizes', async () => {
      const testScenarios = [
        { input: "Short question", expectedSize: 100 },
        { input: "Medium length question with some context", expectedSize: 300 },
        { input: "Very long detailed question with lots of context and information that should be optimized", expectedSize: 500 }
      ];
      
      for (const scenario of testScenarios) {
        const response = await optimizedGeminiService.generateResponse(scenario.input);
        const responseSize = Buffer.byteLength(response, 'utf8');
        
        console.log(`Input: "${scenario.input.substring(0, 30)}..."`);
        console.log(`Response Size: ${responseSize} bytes`);
        
        // Response should be reasonable in size
        expect(responseSize).toBeLessThan(scenario.expectedSize * 3); // Allow 3x buffer
      }
    });

    test('should compress large responses when possible', async () => {
      const largeInput = "Please provide a detailed explanation about " + "artificial intelligence ".repeat(20);
      
      const uncompressedResponse = await geminiService.generateResponse(largeInput);
      const compressedResponse = await optimizedGeminiService.generateCompressedResponse(largeInput);
      
      const uncompressedSize = Buffer.byteLength(uncompressedResponse, 'utf8');
      const compressedSize = Buffer.byteLength(compressedResponse, 'utf8');
      
      console.log(`Uncompressed Response: ${uncompressedSize} bytes`);
      console.log(`Compressed Response: ${compressedSize} bytes`);
      console.log(`Compression Ratio: ${(compressedSize / uncompressedSize * 100).toFixed(1)}%`);
      
      // Should achieve some compression for large responses
      if (uncompressedSize > 1000) {
        expect(compressedSize).toBeLessThan(uncompressedSize * 0.9);
      }
    });
  });

  describe('Performance Monitoring Tests', () => {
    test('should track performance metrics correctly', async () => {
      await performanceMonitor.startTracking('test-operation');
      
      // Simulate operation
      await new Promise(resolve => setTimeout(resolve, 100));
      await optimizedGeminiService.generateResponse("Test performance tracking");
      
      const metrics = await performanceMonitor.endTracking('test-operation');
      
      expect(metrics).toHaveProperty('duration');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics.duration).toBeGreaterThan(100);
    });

    test('should detect performance regressions', async () => {
      const baseline = await performanceMonitor.getBaseline('ai-response');
      
      // If no baseline exists, create one
      if (!baseline) {
        await performanceMonitor.setBaseline('ai-response', {
          avgLatency: 800,
          p95Latency: 1200,
          p99Latency: 1500
        });
      }
      
      const currentMetrics = {
        avgLatency: 900,
        p95Latency: 1300,
        p99Latency: 1600
      };
      
      const regression = await performanceMonitor.detectRegression('ai-response', currentMetrics);
      
      expect(regression).toHaveProperty('hasRegression');
      expect(regression).toHaveProperty('details');
    });
  });
});

// Helper functions

function formatMemoryUsage(memoryUsage) {
  return Object.entries(memoryUsage)
    .map(([key, value]) => `${key}: ${(value / 1024 / 1024).toFixed(2)}MB`)
    .join(', ');
}

function generatePerformanceReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: Object.values(results).reduce((sum, arr) => sum + arr.length, 0),
      targets: LATENCY_TARGETS
    },
    aiResponseLatencies: {
      count: results.aiResponseLatencies.length,
      average: results.aiResponseLatencies.reduce((sum, lat) => sum + lat, 0) / results.aiResponseLatencies.length,
      min: Math.min(...results.aiResponseLatencies),
      max: Math.max(...results.aiResponseLatencies),
      p95: results.aiResponseLatencies.sort((a, b) => a - b)[Math.floor(results.aiResponseLatencies.length * 0.95)]
    },
    coldStartTimes: {
      count: results.coldStartTimes.length,
      average: results.coldStartTimes.reduce((sum, time) => sum + time, 0) / results.coldStartTimes.length,
      min: Math.min(...results.coldStartTimes),
      max: Math.max(...results.coldStartTimes)
    },
    memoryUsage: {
      tests: results.memoryUsages.length,
      avgIncrease: results.memoryUsages.reduce((sum, mem) => sum + mem.increase, 0) / results.memoryUsages.length / 1024 / 1024
    },
    concurrentCalls: results.concurrentCallResults.map(test => ({
      totalCalls: test.totalCalls,
      successRate: (test.successfulCalls / test.totalCalls * 100).toFixed(1) + '%',
      avgLatency: test.avgLatency.toFixed(2) + 'ms',
      maxLatency: test.maxLatency.toFixed(2) + 'ms'
    }))
  };
  
  return JSON.stringify(report, null, 2);
}