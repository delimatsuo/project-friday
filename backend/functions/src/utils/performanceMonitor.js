/**
 * Performance Monitor Utility
 * Real-time performance tracking and alerting
 */

import logger from './logger.js';

class PerformanceMonitor {
  constructor() {
    this.activeOperations = new Map();
    this.metrics = new Map();
    this.baselines = new Map();
    this.alerts = [];
    this.isInitialized = false;
    
    // Configuration
    this.config = {
      alertThresholds: {
        latencyRegression: 0.25, // 25% increase triggers alert
        memoryRegression: 0.30,  // 30% increase triggers alert
        errorRateIncrease: 0.10, // 10% increase triggers alert
        maxLatency: 2000,        // Max acceptable latency in ms
        maxMemoryMB: 512         // Max acceptable memory in MB
      },
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      aggregationInterval: 60 * 1000,        // 1 minute
      maxMetricsHistory: 1000
    };
    
    // Metrics collectors
    this.collectors = {
      latency: new Map(),
      memory: new Map(),
      throughput: new Map(),
      errors: new Map(),
      concurrent: new Map()
    };
  }

  /**
   * Initialize the performance monitor
   */
  async initialize() {
    try {
      this.isInitialized = true;
      
      // Start periodic cleanup
      this.cleanupInterval = setInterval(() => {
        this.cleanupOldMetrics();
      }, this.config.aggregationInterval);
      
      // Start metrics aggregation
      this.aggregationInterval = setInterval(() => {
        this.aggregateMetrics();
      }, this.config.aggregationInterval);
      
      logger.info('Performance monitor initialized', {
        alertThresholds: this.config.alertThresholds,
        retentionPeriod: this.config.retentionPeriod
      });
      
    } catch (error) {
      logger.error('Failed to initialize performance monitor', error);
      throw error;
    }
  }

  /**
   * Start tracking an operation
   */
  startTracking(operationId, operationName = 'unknown', metadata = {}) {
    if (!this.isInitialized) {
      logger.warn('Performance monitor not initialized');
      return null;
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    const timestamp = Date.now();
    
    const operation = {
      operationId,
      operationName,
      startTime,
      startMemory,
      timestamp,
      metadata,
      checkpoints: []
    };
    
    this.activeOperations.set(operationId, operation);
    
    // Track concurrent operations
    const concurrent = this.activeOperations.size;
    this.recordMetric('concurrent', operationName, concurrent, timestamp);
    
    logger.debug('Started tracking operation', { 
      operationId, 
      operationName, 
      concurrent,
      metadata 
    });
    
    return operation;
  }

  /**
   * Add a checkpoint to an operation
   */
  addCheckpoint(operationId, checkpointName, data = {}) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      logger.warn('Operation not found for checkpoint', { operationId, checkpointName });
      return null;
    }
    
    const checkpoint = {
      name: checkpointName,
      time: performance.now(),
      relativeTime: performance.now() - operation.startTime,
      memory: process.memoryUsage(),
      data
    };
    
    operation.checkpoints.push(checkpoint);
    
    logger.debug('Added checkpoint', {
      operationId,
      checkpointName,
      relativeTime: checkpoint.relativeTime
    });
    
    return checkpoint;
  }

  /**
   * End tracking an operation
   */
  endTracking(operationId, result = {}) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      logger.warn('Operation not found for end tracking', { operationId });
      return null;
    }
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - operation.startTime;
    const memoryIncrease = endMemory.heapUsed - operation.startMemory.heapUsed;
    
    const completedOperation = {
      ...operation,
      endTime,
      endMemory,
      duration,
      memoryIncrease,
      result,
      success: result.error ? false : true
    };
    
    // Remove from active operations
    this.activeOperations.delete(operationId);
    
    // Record metrics
    this.recordMetric('latency', operation.operationName, duration, Date.now());
    this.recordMetric('memory', operation.operationName, memoryIncrease, Date.now());
    this.recordMetric('throughput', operation.operationName, 1, Date.now());
    
    if (!completedOperation.success) {
      this.recordMetric('errors', operation.operationName, 1, Date.now());
    }
    
    // Check for performance issues
    this.checkPerformanceIssues(completedOperation);
    
    logger.info('Completed operation tracking', {
      operationId,
      operationName: operation.operationName,
      duration: Math.round(duration),
      memoryIncrease: Math.round(memoryIncrease / 1024 / 1024 * 100) / 100, // MB
      success: completedOperation.success
    });
    
    return completedOperation;
  }

  /**
   * Record a metric
   */
  recordMetric(metricType, operationName, value, timestamp = Date.now()) {
    if (!this.collectors[metricType]) {
      this.collectors[metricType] = new Map();
    }
    
    const operationMetrics = this.collectors[metricType].get(operationName) || [];
    operationMetrics.push({ value, timestamp });
    
    // Keep only recent metrics
    const cutoff = timestamp - this.config.retentionPeriod;
    const recentMetrics = operationMetrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length > this.config.maxMetricsHistory) {
      recentMetrics.splice(0, recentMetrics.length - this.config.maxMetricsHistory);
    }
    
    this.collectors[metricType].set(operationName, recentMetrics);
  }

  /**
   * Get metrics for an operation
   */
  getMetrics(operationName, metricType = 'all', timeRange = 3600000) { // 1 hour default
    const endTime = Date.now();
    const startTime = endTime - timeRange;
    
    const result = {};
    
    if (metricType === 'all') {
      Object.keys(this.collectors).forEach(type => {
        result[type] = this.getMetricData(type, operationName, startTime, endTime);
      });
    } else if (this.collectors[metricType]) {
      result[metricType] = this.getMetricData(metricType, operationName, startTime, endTime);
    }
    
    return result;
  }

  /**
   * Get metric data for a specific type and operation
   */
  getMetricData(metricType, operationName, startTime, endTime) {
    const metrics = this.collectors[metricType].get(operationName) || [];
    const timeRangeMetrics = metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
    
    if (timeRangeMetrics.length === 0) {
      return null;
    }
    
    const values = timeRangeMetrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      sum,
      average: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      timeRange: { startTime, endTime },
      recentValues: timeRangeMetrics.slice(-10).map(m => ({
        value: m.value,
        timestamp: new Date(m.timestamp).toISOString()
      }))
    };
  }

  /**
   * Set performance baseline
   */
  setBaseline(operationName, baseline) {
    this.baselines.set(operationName, {
      ...baseline,
      timestamp: Date.now()
    });
    
    logger.info('Set performance baseline', { operationName, baseline });
  }

  /**
   * Get performance baseline
   */
  getBaseline(operationName) {
    return this.baselines.get(operationName);
  }

  /**
   * Detect performance regressions
   */
  detectRegression(operationName, currentMetrics = null) {
    const baseline = this.getBaseline(operationName);
    if (!baseline) {
      return { hasRegression: false, reason: 'No baseline available' };
    }
    
    // Get current metrics if not provided
    if (!currentMetrics) {
      const recentMetrics = this.getMetrics(operationName, 'all', 600000); // Last 10 minutes
      if (!recentMetrics.latency) {
        return { hasRegression: false, reason: 'No recent metrics available' };
      }
      
      currentMetrics = {
        avgLatency: recentMetrics.latency.average,
        p95Latency: recentMetrics.latency.p95,
        p99Latency: recentMetrics.latency.p99,
        avgMemory: recentMetrics.memory ? recentMetrics.memory.average : 0,
        errorRate: recentMetrics.errors ? (recentMetrics.errors.sum / recentMetrics.throughput.sum) : 0
      };
    }
    
    const regressions = [];
    const thresholds = this.config.alertThresholds;
    
    // Check latency regression
    if (baseline.avgLatency && currentMetrics.avgLatency > baseline.avgLatency * (1 + thresholds.latencyRegression)) {
      regressions.push({
        metric: 'avgLatency',
        baseline: baseline.avgLatency,
        current: currentMetrics.avgLatency,
        threshold: thresholds.latencyRegression,
        regression: ((currentMetrics.avgLatency - baseline.avgLatency) / baseline.avgLatency * 100).toFixed(1) + '%'
      });
    }
    
    // Check P95 latency regression
    if (baseline.p95Latency && currentMetrics.p95Latency > baseline.p95Latency * (1 + thresholds.latencyRegression)) {
      regressions.push({
        metric: 'p95Latency',
        baseline: baseline.p95Latency,
        current: currentMetrics.p95Latency,
        threshold: thresholds.latencyRegression,
        regression: ((currentMetrics.p95Latency - baseline.p95Latency) / baseline.p95Latency * 100).toFixed(1) + '%'
      });
    }
    
    // Check memory regression
    if (baseline.avgMemory && currentMetrics.avgMemory > baseline.avgMemory * (1 + thresholds.memoryRegression)) {
      regressions.push({
        metric: 'avgMemory',
        baseline: baseline.avgMemory,
        current: currentMetrics.avgMemory,
        threshold: thresholds.memoryRegression,
        regression: ((currentMetrics.avgMemory - baseline.avgMemory) / baseline.avgMemory * 100).toFixed(1) + '%'
      });
    }
    
    // Check error rate increase
    if (baseline.errorRate !== undefined && currentMetrics.errorRate > baseline.errorRate + thresholds.errorRateIncrease) {
      regressions.push({
        metric: 'errorRate',
        baseline: baseline.errorRate,
        current: currentMetrics.errorRate,
        threshold: thresholds.errorRateIncrease,
        increase: ((currentMetrics.errorRate - baseline.errorRate) * 100).toFixed(1) + '%'
      });
    }
    
    const result = {
      hasRegression: regressions.length > 0,
      operationName,
      checkTime: new Date().toISOString(),
      currentMetrics,
      baseline,
      regressions
    };
    
    if (result.hasRegression) {
      this.createAlert('performance_regression', result);
    }
    
    return result;
  }

  /**
   * Check for immediate performance issues
   */
  checkPerformanceIssues(completedOperation) {
    const alerts = [];
    const thresholds = this.config.alertThresholds;
    
    // Check excessive latency
    if (completedOperation.duration > thresholds.maxLatency) {
      alerts.push({
        type: 'high_latency',
        operationId: completedOperation.operationId,
        operationName: completedOperation.operationName,
        value: completedOperation.duration,
        threshold: thresholds.maxLatency,
        severity: completedOperation.duration > thresholds.maxLatency * 2 ? 'critical' : 'warning'
      });
    }
    
    // Check excessive memory usage
    const memoryMB = completedOperation.memoryIncrease / 1024 / 1024;
    if (memoryMB > thresholds.maxMemoryMB) {
      alerts.push({
        type: 'high_memory',
        operationId: completedOperation.operationId,
        operationName: completedOperation.operationName,
        value: memoryMB,
        threshold: thresholds.maxMemoryMB,
        severity: memoryMB > thresholds.maxMemoryMB * 2 ? 'critical' : 'warning'
      });
    }
    
    // Create alerts
    alerts.forEach(alert => this.createAlert(alert.type, alert));
    
    return alerts;
  }

  /**
   * Create an alert
   */
  createAlert(type, data) {
    const alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type,
      timestamp: Date.now(),
      data,
      status: 'active'
    };
    
    this.alerts.push(alert);
    
    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
    
    logger.warn('Performance alert created', { 
      alertType: type,
      alertId: alert.id,
      data: alert.data 
    });
    
    return alert;
  }

  /**
   * Get active alerts
   */
  getAlerts(type = null, severity = null) {
    let filteredAlerts = this.alerts.filter(alert => alert.status === 'active');
    
    if (type) {
      filteredAlerts = filteredAlerts.filter(alert => alert.type === type);
    }
    
    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.data.severity === severity);
    }
    
    return filteredAlerts;
  }

  /**
   * Aggregate metrics periodically
   */
  aggregateMetrics() {
    const timestamp = Date.now();
    const operations = new Set();
    
    // Collect all operation names
    Object.values(this.collectors).forEach(collector => {
      collector.forEach((_, operationName) => {
        operations.add(operationName);
      });
    });
    
    // Check each operation for regressions
    operations.forEach(operationName => {
      try {
        this.detectRegression(operationName);
      } catch (error) {
        logger.error('Error detecting regression', { operationName, error });
      }
    });
    
    logger.debug('Metrics aggregation completed', {
      timestamp: new Date(timestamp).toISOString(),
      operationCount: operations.size,
      activeOperations: this.activeOperations.size
    });
  }

  /**
   * Clean up old metrics
   */
  cleanupOldMetrics() {
    const cutoff = Date.now() - this.config.retentionPeriod;
    let cleanedCount = 0;
    
    Object.values(this.collectors).forEach(collector => {
      collector.forEach((metrics, operationName) => {
        const beforeCount = metrics.length;
        const filtered = metrics.filter(m => m.timestamp >= cutoff);
        collector.set(operationName, filtered);
        cleanedCount += beforeCount - filtered.length;
      });
    });
    
    // Clean up old alerts
    const alertsBefore = this.alerts.length;
    this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoff);
    cleanedCount += alertsBefore - this.alerts.length;
    
    if (cleanedCount > 0) {
      logger.debug('Cleaned up old metrics and alerts', { cleanedCount });
    }
  }

  /**
   * Get performance dashboard data
   */
  getDashboardData() {
    const operations = new Set();
    
    // Collect all operations
    Object.values(this.collectors).forEach(collector => {
      collector.forEach((_, operationName) => {
        operations.add(operationName);
      });
    });
    
    const operationStats = {};
    operations.forEach(operationName => {
      const metrics = this.getMetrics(operationName, 'all', 3600000); // Last hour
      if (metrics.latency && metrics.latency.count > 0) {
        operationStats[operationName] = {
          latency: {
            avg: Math.round(metrics.latency.average),
            p95: Math.round(metrics.latency.p95),
            p99: Math.round(metrics.latency.p99),
            count: metrics.latency.count
          },
          memory: metrics.memory ? {
            avg: Math.round(metrics.memory.average / 1024 / 1024 * 100) / 100, // MB
            max: Math.round(metrics.memory.max / 1024 / 1024 * 100) / 100
          } : null,
          throughput: metrics.throughput ? metrics.throughput.sum : 0,
          errorRate: metrics.errors && metrics.throughput ? 
            (metrics.errors.sum / metrics.throughput.sum * 100).toFixed(2) + '%' : '0%'
        };
      }
    });
    
    return {
      timestamp: new Date().toISOString(),
      activeOperations: this.activeOperations.size,
      totalOperations: operations.size,
      activeAlerts: this.getAlerts().length,
      operationStats,
      systemMetrics: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    
    this.activeOperations.clear();
    this.metrics.clear();
    this.alerts = [];
    
    Object.values(this.collectors).forEach(collector => {
      collector.clear();
    });
    
    this.isInitialized = false;
    logger.info('Performance monitor cleanup completed');
  }
}

export default PerformanceMonitor;