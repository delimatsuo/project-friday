/**
 * Performance Tracer Service
 * Integrates with Google Cloud Trace for performance monitoring
 */

import logger from '../utils/logger.js';

class PerformanceTracer {
  constructor() {
    this.traces = new Map();
    this.isInitialized = false;
    this.traceClient = null;
    
    // Performance metrics storage
    this.metrics = {
      traces: [],
      spans: new Map(),
      baselines: new Map()
    };
    
    // Configuration
    this.config = {
      enableCloudTrace: process.env.NODE_ENV === 'production',
      enableLocalTracing: true,
      maxTraceHistory: 1000,
      samplingRate: 0.1 // 10% sampling in production
    };
  }

  /**
   * Initialize the performance tracer
   */
  async initialize() {
    try {
      if (this.config.enableCloudTrace) {
        // Initialize Google Cloud Trace in production
        const { TraceApi } = await import('@google-cloud/trace-agent');
        this.traceClient = TraceApi.start({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          samplingRate: this.config.samplingRate
        });
        logger.info('Google Cloud Trace initialized');
      }
      
      this.isInitialized = true;
      logger.info('Performance tracer initialized', {
        cloudTraceEnabled: this.config.enableCloudTrace,
        localTracingEnabled: this.config.enableLocalTracing
      });
      
    } catch (error) {
      logger.error('Failed to initialize performance tracer', error);
      // Continue with local tracing only
      this.config.enableCloudTrace = false;
      this.isInitialized = true;
    }
  }

  /**
   * Start a new trace
   */
  startTrace(traceId, operationName, metadata = {}) {
    if (!this.isInitialized) {
      logger.warn('Performance tracer not initialized');
      return null;
    }

    const startTime = performance.now();
    const timestamp = Date.now();
    
    const trace = {
      traceId,
      operationName,
      startTime,
      timestamp,
      metadata,
      spans: [],
      status: 'active'
    };
    
    this.traces.set(traceId, trace);
    
    // Start Cloud Trace span if enabled
    if (this.config.enableCloudTrace && this.traceClient) {
      try {
        const span = this.traceClient.createChildSpan({
          name: operationName
        });
        trace.cloudSpan = span;
      } catch (error) {
        logger.warn('Failed to create Cloud Trace span', error);
      }
    }
    
    logger.debug('Started trace', { traceId, operationName, metadata });
    return trace;
  }

  /**
   * Add a span to an existing trace
   */
  addSpan(traceId, spanName, metadata = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) {
      logger.warn('Trace not found for span', { traceId, spanName });
      return null;
    }
    
    const startTime = performance.now();
    const span = {
      spanId: `${traceId}-${spanName}-${Date.now()}`,
      spanName,
      startTime,
      metadata,
      status: 'active'
    };
    
    trace.spans.push(span);
    this.spans.set(span.spanId, span);
    
    return span;
  }

  /**
   * End a span
   */
  endSpan(spanId, result = {}) {
    const span = this.spans.get(spanId);
    if (!span) {
      logger.warn('Span not found', { spanId });
      return null;
    }
    
    const endTime = performance.now();
    span.endTime = endTime;
    span.duration = endTime - span.startTime;
    span.result = result;
    span.status = 'completed';
    
    logger.debug('Ended span', {
      spanId: span.spanId,
      spanName: span.spanName,
      duration: span.duration
    });
    
    return span;
  }

  /**
   * End a trace
   */
  endTrace(traceId, result = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) {
      logger.warn('Trace not found', { traceId });
      return null;
    }
    
    const endTime = performance.now();
    trace.endTime = endTime;
    trace.duration = endTime - trace.startTime;
    trace.result = result;
    trace.status = 'completed';
    
    // End Cloud Trace span if exists
    if (trace.cloudSpan) {
      try {
        trace.cloudSpan.endSpan();
      } catch (error) {
        logger.warn('Failed to end Cloud Trace span', error);
      }
    }
    
    // Store completed trace
    this.metrics.traces.push({
      traceId: trace.traceId,
      operationName: trace.operationName,
      duration: trace.duration,
      timestamp: trace.timestamp,
      metadata: trace.metadata,
      result: trace.result,
      spanCount: trace.spans.length
    });
    
    // Clean up if we're at capacity
    if (this.metrics.traces.length > this.config.maxTraceHistory) {
      this.metrics.traces = this.metrics.traces.slice(-this.config.maxTraceHistory);
    }
    
    // Remove from active traces
    this.traces.delete(traceId);
    
    // Clean up spans
    trace.spans.forEach(span => {
      this.spans.delete(span.spanId);
    });
    
    logger.info('Completed trace', {
      traceId: trace.traceId,
      operationName: trace.operationName,
      duration: trace.duration,
      spanCount: trace.spans.length
    });
    
    return trace;
  }

  /**
   * Trace a function execution
   */
  async traceFunction(operationName, fn, metadata = {}) {
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const trace = this.startTrace(traceId, operationName, metadata);
    
    try {
      const result = await fn();
      this.endTrace(traceId, { success: true, result });
      return result;
    } catch (error) {
      this.endTrace(traceId, { success: false, error: error.message });
      throw error;
    }
  }

  /**
   * Get trace statistics
   */
  getTraceStats(operationName = null) {
    const traces = operationName 
      ? this.metrics.traces.filter(t => t.operationName === operationName)
      : this.metrics.traces;
    
    if (traces.length === 0) {
      return null;
    }
    
    const durations = traces.map(t => t.duration).sort((a, b) => a - b);
    const spanCounts = traces.map(t => t.spanCount);
    
    return {
      operationName,
      traceCount: traces.length,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p50Duration: durations[Math.floor(durations.length * 0.5)],
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      p99Duration: durations[Math.floor(durations.length * 0.99)],
      avgSpanCount: spanCounts.reduce((sum, c) => sum + c, 0) / spanCounts.length,
      recentTraces: traces.slice(-10).map(t => ({
        traceId: t.traceId,
        duration: t.duration,
        timestamp: new Date(t.timestamp).toISOString(),
        success: t.result?.success !== false
      }))
    };
  }

  /**
   * Set performance baseline
   */
  setBaseline(operationName, baseline) {
    this.metrics.baselines.set(operationName, {
      ...baseline,
      timestamp: Date.now()
    });
    
    logger.info('Set performance baseline', { operationName, baseline });
  }

  /**
   * Get performance baseline
   */
  getBaseline(operationName) {
    return this.metrics.baselines.get(operationName);
  }

  /**
   * Check for performance regressions
   */
  checkRegression(operationName, currentMetrics) {
    const baseline = this.getBaseline(operationName);
    if (!baseline) {
      return { hasRegression: false, reason: 'No baseline available' };
    }
    
    const regressions = [];
    
    // Check average duration regression (20% threshold)
    if (currentMetrics.avgDuration > baseline.avgDuration * 1.2) {
      regressions.push({
        metric: 'avgDuration',
        baseline: baseline.avgDuration,
        current: currentMetrics.avgDuration,
        regression: ((currentMetrics.avgDuration - baseline.avgDuration) / baseline.avgDuration * 100).toFixed(1) + '%'
      });
    }
    
    // Check P95 duration regression (25% threshold)
    if (currentMetrics.p95Duration && baseline.p95Duration && 
        currentMetrics.p95Duration > baseline.p95Duration * 1.25) {
      regressions.push({
        metric: 'p95Duration',
        baseline: baseline.p95Duration,
        current: currentMetrics.p95Duration,
        regression: ((currentMetrics.p95Duration - baseline.p95Duration) / baseline.p95Duration * 100).toFixed(1) + '%'
      });
    }
    
    return {
      hasRegression: regressions.length > 0,
      regressions,
      operationName,
      checkTime: new Date().toISOString()
    };
  }

  /**
   * Export trace data
   */
  exportTraceData(format = 'json') {
    const data = {
      timestamp: new Date().toISOString(),
      config: this.config,
      metrics: {
        totalTraces: this.metrics.traces.length,
        activeTraces: this.traces.size,
        activeSpans: this.spans.size,
        baselines: Object.fromEntries(this.metrics.baselines)
      },
      traces: this.metrics.traces,
      operationStats: this.getUniqueOperations().map(op => this.getTraceStats(op))
    };
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    
    return data;
  }

  /**
   * Get unique operation names
   */
  getUniqueOperations() {
    return [...new Set(this.metrics.traces.map(t => t.operationName))];
  }

  /**
   * Clear all trace data
   */
  clear() {
    this.traces.clear();
    this.spans.clear();
    this.metrics.traces = [];
    logger.info('Cleared all trace data');
  }

  /**
   * Get current performance summary
   */
  getPerformanceSummary() {
    const operations = this.getUniqueOperations();
    const summary = {
      timestamp: new Date().toISOString(),
      totalTraces: this.metrics.traces.length,
      activeTraces: this.traces.size,
      operations: operations.length,
      operationStats: {}
    };
    
    operations.forEach(op => {
      const stats = this.getTraceStats(op);
      if (stats) {
        summary.operationStats[op] = {
          traceCount: stats.traceCount,
          avgDuration: Math.round(stats.avgDuration),
          p95Duration: Math.round(stats.p95Duration),
          p99Duration: Math.round(stats.p99Duration)
        };
      }
    });
    
    return summary;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.clear();
    
    if (this.traceClient && this.config.enableCloudTrace) {
      try {
        // Cloud Trace cleanup if needed
        logger.info('Cleaned up Cloud Trace resources');
      } catch (error) {
        logger.warn('Error during Cloud Trace cleanup', error);
      }
    }
    
    this.isInitialized = false;
    logger.info('Performance tracer cleanup completed');
  }
}

export default PerformanceTracer;