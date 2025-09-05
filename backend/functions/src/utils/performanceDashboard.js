/**
 * Performance Dashboard
 * Web-based dashboard for real-time performance monitoring
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { promises as fs } from 'fs';
import PerformanceTracer from '../services/performanceTracer.js';
import PerformanceMonitor from './performanceMonitor.js';
import OptimizedGeminiService from '../services/optimizedGeminiService.js';
import logger from './logger.js';

class PerformanceDashboard {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3001,
      updateInterval: options.updateInterval || 5000, // 5 seconds
      historyLength: options.historyLength || 100,
      enableWebSocket: options.enableWebSocket !== false,
      enableApi: options.enableApi !== false,
      ...options
    };
    
    // Express app for dashboard
    this.app = express();
    this.server = null;
    this.wss = null;
    
    // Performance components
    this.performanceTracer = new PerformanceTracer();
    this.performanceMonitor = new PerformanceMonitor();
    this.geminiService = new OptimizedGeminiService();
    
    // Dashboard state
    this.isRunning = false;
    this.updateInterval = null;
    this.connectedClients = new Set();
    
    // Performance history
    this.performanceHistory = {
      timestamps: [],
      latencies: [],
      memoryUsage: [],
      throughput: [],
      errors: [],
      concurrent: []
    };
    
    this.setupRoutes();
  }

  /**
   * Initialize the dashboard
   */
  async initialize() {
    try {
      // Initialize performance components
      await this.performanceTracer.initialize();
      await this.performanceMonitor.initialize();
      await this.geminiService.initialize();
      
      // Create HTTP server
      this.server = createServer(this.app);
      
      // Setup WebSocket server if enabled
      if (this.options.enableWebSocket) {
        this.setupWebSocket();
      }
      
      logger.info('Performance dashboard initialized', {
        port: this.options.port,
        webSocket: this.options.enableWebSocket,
        api: this.options.enableApi
      });
      
    } catch (error) {
      logger.error('Failed to initialize performance dashboard', error);
      throw error;
    }
  }

  /**
   * Setup Express routes
   */
  setupRoutes() {
    // Middleware
    this.app.use(express.json());
    this.app.use(express.static(path.join(process.cwd(), 'public')));
    
    // Dashboard HTML
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });
    
    // API Routes
    if (this.options.enableApi) {
      this.setupApiRoutes();
    }
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        dashboard: {
          running: this.isRunning,
          connectedClients: this.connectedClients.size
        }
      });
    });
  }

  /**
   * Setup API routes
   */
  setupApiRoutes() {
    // Current performance metrics
    this.app.get('/api/metrics', async (req, res) => {
      try {
        const metrics = await this.getCurrentMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Performance history
    this.app.get('/api/history', (req, res) => {
      const limit = parseInt(req.query.limit) || 50;
      const history = this.getPerformanceHistory(limit);
      res.json(history);
    });
    
    // Performance summary
    this.app.get('/api/summary', async (req, res) => {
      try {
        const summary = await this.getPerformanceSummary();
        res.json(summary);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Start/stop monitoring
    this.app.post('/api/monitoring/:action', (req, res) => {
      const { action } = req.params;
      
      try {
        if (action === 'start') {
          this.startMonitoring();
          res.json({ status: 'started' });
        } else if (action === 'stop') {
          this.stopMonitoring();
          res.json({ status: 'stopped' });
        } else {
          res.status(400).json({ error: 'Invalid action' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Run performance test
    this.app.post('/api/test', async (req, res) => {
      try {
        const { type = 'basic', concurrent = 1 } = req.body;
        const testResult = await this.runPerformanceTest(type, concurrent);
        res.json(testResult);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Get alerts
    this.app.get('/api/alerts', (req, res) => {
      const alerts = this.performanceMonitor.getAlerts();
      res.json(alerts);
    });
    
    // Clear performance data
    this.app.delete('/api/clear', (req, res) => {
      this.clearPerformanceData();
      res.json({ status: 'cleared' });
    });
  }

  /**
   * Setup WebSocket server
   */
  setupWebSocket() {
    this.wss = new WebSocketServer({ server: this.server });
    
    this.wss.on('connection', (ws) => {
      this.connectedClients.add(ws);
      
      logger.debug('Dashboard client connected', { 
        totalClients: this.connectedClients.size 
      });
      
      // Send initial data
      this.sendToClient(ws, {
        type: 'initial',
        data: {
          history: this.getPerformanceHistory(20),
          summary: this.getPerformanceSummary()
        }
      });
      
      ws.on('close', () => {
        this.connectedClients.delete(ws);
        logger.debug('Dashboard client disconnected', { 
          totalClients: this.connectedClients.size 
        });
      });
      
      ws.on('error', (error) => {
        logger.warn('Dashboard WebSocket error', error);
        this.connectedClients.delete(ws);
      });
      
      // Handle client messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          logger.warn('Invalid client message', error);
        }
      });
    });
  }

  /**
   * Handle client WebSocket messages
   */
  async handleClientMessage(ws, message) {
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'startTest':
          const testResult = await this.runPerformanceTest(data.testType, data.concurrent);
          this.sendToClient(ws, { type: 'testResult', data: testResult });
          break;
          
        case 'getMetrics':
          const metrics = await this.getCurrentMetrics();
          this.sendToClient(ws, { type: 'metrics', data: metrics });
          break;
          
        case 'clearData':
          this.clearPerformanceData();
          this.sendToClient(ws, { type: 'dataCleared' });
          break;
          
        default:
          logger.warn('Unknown client message type', { type });
      }
    } catch (error) {
      this.sendToClient(ws, { 
        type: 'error', 
        data: { message: error.message } 
      });
    }
  }

  /**
   * Send message to client
   */
  sendToClient(ws, message) {
    try {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      logger.warn('Failed to send message to client', error);
      this.connectedClients.delete(ws);
    }
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(message) {
    const messageStr = JSON.stringify(message);
    
    for (const ws of this.connectedClients) {
      try {
        if (ws.readyState === ws.OPEN) {
          ws.send(messageStr);
        } else {
          this.connectedClients.delete(ws);
        }
      } catch (error) {
        logger.warn('Failed to broadcast to client', error);
        this.connectedClients.delete(ws);
      }
    }
  }

  /**
   * Start the dashboard server
   */
  async start() {
    if (this.isRunning) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      this.server.listen(this.options.port, (error) => {
        if (error) {
          reject(error);
          return;
        }
        
        this.isRunning = true;
        this.startMonitoring();
        
        logger.info('Performance dashboard started', {
          port: this.options.port,
          url: `http://localhost:${this.options.port}`
        });
        
        resolve();
      });
    });
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    if (this.updateInterval) {
      return; // Already monitoring
    }
    
    this.updateInterval = setInterval(async () => {
      try {
        const metrics = await this.getCurrentMetrics();
        this.updatePerformanceHistory(metrics);
        
        // Broadcast to connected clients
        if (this.connectedClients.size > 0) {
          this.broadcast({
            type: 'metricsUpdate',
            data: {
              metrics,
              history: this.getPerformanceHistory(10) // Last 10 data points
            }
          });
        }
        
      } catch (error) {
        logger.error('Error during performance monitoring update', error);
      }
    }, this.options.updateInterval);
    
    logger.info('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      logger.info('Performance monitoring stopped');
    }
  }

  /**
   * Get current performance metrics
   */
  async getCurrentMetrics() {
    const timestamp = Date.now();
    
    // Get tracer stats
    const tracerStats = this.performanceTracer.getPerformanceSummary();
    
    // Get monitor dashboard data
    const monitorData = this.performanceMonitor.getDashboardData();
    
    // Get Gemini service metrics
    const geminiMetrics = this.geminiService.getPerformanceMetrics();
    
    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: new Date(timestamp).toISOString(),
      timestampMs: timestamp,
      
      // AI Response metrics
      aiResponse: {
        avgLatency: tracerStats.operationStats['gemini_generate_response']?.avgDuration || 0,
        p95Latency: tracerStats.operationStats['gemini_generate_response']?.p95Duration || 0,
        p99Latency: tracerStats.operationStats['gemini_generate_response']?.p99Duration || 0,
        throughput: tracerStats.operationStats['gemini_generate_response']?.traceCount || 0
      },
      
      // System metrics
      system: {
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
          usagePercent: (memoryUsage.heapUsed / memoryUsage.heapTotal * 100).toFixed(2)
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime()
      },
      
      // Connection pool metrics
      connectionPool: geminiMetrics.connectionPool,
      
      // Cache metrics
      cache: geminiMetrics.responseCache,
      
      // Monitor data
      operations: monitorData.operationStats,
      alerts: monitorData.activeAlerts,
      
      // Targets
      targets: {
        aiResponseP95: 1500,
        aiResponseP99: 2000,
        memoryLimit: 512 * 1024 * 1024,
        errorRate: 0.01
      }
    };
  }

  /**
   * Update performance history
   */
  updatePerformanceHistory(metrics) {
    const history = this.performanceHistory;
    
    // Add new data point
    history.timestamps.push(metrics.timestampMs);
    history.latencies.push(metrics.aiResponse.avgLatency);
    history.memoryUsage.push(metrics.system.memory.heapUsed);
    history.throughput.push(metrics.aiResponse.throughput);
    history.errors.push(metrics.alerts);
    history.concurrent.push(metrics.connectionPool?.activeConnections || 0);
    
    // Limit history length
    if (history.timestamps.length > this.options.historyLength) {
      const excess = history.timestamps.length - this.options.historyLength;
      
      Object.keys(history).forEach(key => {
        history[key].splice(0, excess);
      });
    }
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(limit = null) {
    const history = this.performanceHistory;
    const actualLimit = limit || history.timestamps.length;
    
    if (actualLimit >= history.timestamps.length) {
      return history;
    }
    
    const startIndex = history.timestamps.length - actualLimit;
    const limitedHistory = {};
    
    Object.keys(history).forEach(key => {
      limitedHistory[key] = history[key].slice(startIndex);
    });
    
    return limitedHistory;
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary() {
    const tracerStats = this.performanceTracer.getPerformanceSummary();
    const monitorData = this.performanceMonitor.getDashboardData();
    const geminiMetrics = this.geminiService.getPerformanceMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      
      overview: {
        activeTraces: tracerStats.activeTraces,
        totalOperations: tracerStats.totalOperations,
        activeAlerts: monitorData.activeAlerts,
        connectedClients: this.connectedClients.size,
        uptimeSeconds: Math.floor(process.uptime())
      },
      
      performance: {
        avgResponseTime: tracerStats.operationStats['gemini_generate_response']?.avgDuration || 0,
        p95ResponseTime: tracerStats.operationStats['gemini_generate_response']?.p95Duration || 0,
        currentMemoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cacheHitRate: geminiMetrics.responseCache?.hitRate || '0%'
      },
      
      health: {
        allTargetsMet: this.checkAllTargetsMet(),
        performanceGrade: this.calculatePerformanceGrade(),
        recommendations: this.getRecommendations()
      }
    };
  }

  /**
   * Run performance test
   */
  async runPerformanceTest(type = 'basic', concurrent = 1) {
    logger.info('Running performance test', { type, concurrent });
    
    const startTime = performance.now();
    const testInputs = [
      "Hello, I need help with something",
      "Can you tell me about the weather?", 
      "I'm looking for information about my appointment",
      "What services do you provide?",
      "Can you help me with a technical issue?"
    ];
    
    const results = [];
    
    if (type === 'concurrent') {
      // Concurrent test
      const promises = [];
      
      for (let i = 0; i < concurrent; i++) {
        const input = testInputs[i % testInputs.length];
        promises.push(this.measureSingleCall(input, i));
      }
      
      const concurrentResults = await Promise.all(promises);
      results.push(...concurrentResults);
      
    } else {
      // Sequential test
      for (let i = 0; i < Math.min(concurrent, testInputs.length); i++) {
        const result = await this.measureSingleCall(testInputs[i], i);
        results.push(result);
      }
    }
    
    const totalTime = performance.now() - startTime;
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const summary = {
      type,
      concurrent,
      totalTime,
      totalCalls: results.length,
      successfulCalls: successful.length,
      failedCalls: failed.length,
      successRate: (successful.length / results.length * 100).toFixed(2) + '%',
      avgLatency: successful.length > 0 ? 
        successful.reduce((sum, r) => sum + r.latency, 0) / successful.length : 0,
      maxLatency: successful.length > 0 ? Math.max(...successful.map(r => r.latency)) : 0,
      minLatency: successful.length > 0 ? Math.min(...successful.map(r => r.latency)) : 0,
      throughput: results.length / (totalTime / 1000), // calls per second
      results
    };
    
    logger.info('Performance test completed', {
      type,
      successRate: summary.successRate,
      avgLatency: Math.round(summary.avgLatency),
      throughput: summary.throughput.toFixed(2)
    });
    
    return summary;
  }

  /**
   * Measure single call performance
   */
  async measureSingleCall(input, index = 0) {
    const startTime = performance.now();
    
    try {
      const response = await this.geminiService.generateResponse(input);
      const latency = performance.now() - startTime;
      
      return {
        index,
        input,
        success: true,
        latency,
        responseLength: response.length,
        timestamp: Date.now()
      };
      
    } catch (error) {
      const latency = performance.now() - startTime;
      
      return {
        index,
        input,
        success: false,
        latency,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check if all targets are met
   */
  checkAllTargetsMet() {
    // This is a simplified check - in real implementation,
    // you'd check against actual recent metrics
    return true; // Placeholder
  }

  /**
   * Calculate performance grade
   */
  calculatePerformanceGrade() {
    // Simplified grading - in real implementation,
    // you'd calculate based on actual metrics
    return 'A'; // Placeholder
  }

  /**
   * Get recommendations
   */
  getRecommendations() {
    const recommendations = [];
    
    // Check recent metrics and add recommendations
    // This is simplified for the example
    
    return recommendations;
  }

  /**
   * Clear performance data
   */
  clearPerformanceData() {
    this.performanceHistory = {
      timestamps: [],
      latencies: [],
      memoryUsage: [],
      throughput: [],
      errors: [],
      concurrent: []
    };
    
    logger.info('Performance data cleared');
  }

  /**
   * Generate dashboard HTML
   */
  generateDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Friday Performance Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
            color: #333;
        }
        
        .header {
            background: #2196F3;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .header h1 {
            margin: 0;
            font-size: 2em;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .stat-card h3 {
            margin: 0 0 10px 0;
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
        }
        
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            margin: 10px 0;
        }
        
        .stat-target {
            font-size: 0.9em;
            color: #666;
        }
        
        .status-good { color: #4CAF50; }
        .status-warning { color: #FF9800; }
        .status-error { color: #F44336; }
        
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        
        .controls {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        
        .controls button {
            background: #2196F3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            margin-right: 10px;
            cursor: pointer;
        }
        
        .controls button:hover {
            background: #1976D2;
        }
        
        .controls select, .controls input {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-right: 10px;
        }
        
        .log-container {
            background: #263238;
            color: #fff;
            padding: 20px;
            border-radius: 8px;
            height: 300px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
        }
        
        .connected { background: #4CAF50; }
        .disconnected { background: #F44336; }
    </style>
</head>
<body>
    <div class="connection-status" id="connectionStatus">Connecting...</div>
    
    <div class="header">
        <h1>🚀 Project Friday Performance Dashboard</h1>
        <p>Real-time call screening performance monitoring</p>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <h3>AI Response Latency (P95)</h3>
            <div class="stat-value" id="p95Latency">-</div>
            <div class="stat-target">Target: < 1.5s</div>
        </div>
        
        <div class="stat-card">
            <h3>Memory Usage</h3>
            <div class="stat-value" id="memoryUsage">-</div>
            <div class="stat-target">Limit: 512MB</div>
        </div>
        
        <div class="stat-card">
            <h3>Cache Hit Rate</h3>
            <div class="stat-value" id="cacheHitRate">-</div>
            <div class="stat-target">Target: > 30%</div>
        </div>
        
        <div class="stat-card">
            <h3>Active Connections</h3>
            <div class="stat-value" id="activeConnections">-</div>
            <div class="stat-target">Pool size: 10</div>
        </div>
    </div>
    
    <div class="chart-container">
        <h3>AI Response Latency Over Time</h3>
        <canvas id="latencyChart"></canvas>
    </div>
    
    <div class="chart-container">
        <h3>Memory Usage Over Time</h3>
        <canvas id="memoryChart"></canvas>
    </div>
    
    <div class="controls">
        <h3>Performance Testing</h3>
        <select id="testType">
            <option value="basic">Basic Test</option>
            <option value="concurrent">Concurrent Test</option>
        </select>
        
        <input type="number" id="concurrent" value="5" min="1" max="20" placeholder="Concurrent calls">
        
        <button onclick="runTest()">Run Test</button>
        <button onclick="clearData()">Clear Data</button>
        <button onclick="exportData()">Export Data</button>
    </div>
    
    <div class="chart-container">
        <h3>Performance Log</h3>
        <div class="log-container" id="performanceLog"></div>
    </div>

    <script>
        // WebSocket connection
        const ws = new WebSocket(\`ws://\${location.host}\`);
        let latencyChart, memoryChart;
        
        ws.onopen = function() {
            updateConnectionStatus(true);
            log('Connected to performance dashboard');
        };
        
        ws.onclose = function() {
            updateConnectionStatus(false);
            log('Disconnected from performance dashboard');
        };
        
        ws.onmessage = function(event) {
            try {
                const message = JSON.parse(event.data);
                handleMessage(message);
            } catch (error) {
                log('Error parsing message: ' + error.message);
            }
        };
        
        function handleMessage(message) {
            switch (message.type) {
                case 'initial':
                    initializeCharts(message.data.history);
                    updateStats(message.data.summary);
                    break;
                    
                case 'metricsUpdate':
                    updateCharts(message.data.history);
                    updateStatsFromMetrics(message.data.metrics);
                    break;
                    
                case 'testResult':
                    log(\`Test completed: \${message.data.successRate} success rate, \${Math.round(message.data.avgLatency)}ms avg latency\`);
                    break;
                    
                case 'error':
                    log('Error: ' + message.data.message);
                    break;
                    
                case 'dataCleared':
                    log('Performance data cleared');
                    clearCharts();
                    break;
            }
        }
        
        function updateConnectionStatus(connected) {
            const status = document.getElementById('connectionStatus');
            if (connected) {
                status.textContent = 'Connected';
                status.className = 'connection-status connected';
            } else {
                status.textContent = 'Disconnected';
                status.className = 'connection-status disconnected';
            }
        }
        
        function initializeCharts(history) {
            const ctx1 = document.getElementById('latencyChart').getContext('2d');
            const ctx2 = document.getElementById('memoryChart').getContext('2d');
            
            latencyChart = new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: history.timestamps.map(t => new Date(t).toLocaleTimeString()),
                    datasets: [{
                        label: 'Latency (ms)',
                        data: history.latencies,
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
            
            memoryChart = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: history.timestamps.map(t => new Date(t).toLocaleTimeString()),
                    datasets: [{
                        label: 'Memory (MB)',
                        data: history.memoryUsage.map(m => Math.round(m / 1024 / 1024)),
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
        
        function updateCharts(history) {
            if (latencyChart && history.timestamps.length > 0) {
                latencyChart.data.labels = history.timestamps.map(t => new Date(t).toLocaleTimeString());
                latencyChart.data.datasets[0].data = history.latencies;
                latencyChart.update('none');
                
                memoryChart.data.labels = history.timestamps.map(t => new Date(t).toLocaleTimeString());
                memoryChart.data.datasets[0].data = history.memoryUsage.map(m => Math.round(m / 1024 / 1024));
                memoryChart.update('none');
            }
        }
        
        function updateStats(summary) {
            document.getElementById('p95Latency').textContent = Math.round(summary.performance.p95ResponseTime) + 'ms';
            document.getElementById('memoryUsage').textContent = summary.performance.currentMemoryMB + 'MB';
            document.getElementById('cacheHitRate').textContent = summary.performance.cacheHitRate;
            document.getElementById('activeConnections').textContent = summary.overview.activeTraces;
        }
        
        function updateStatsFromMetrics(metrics) {
            const p95Element = document.getElementById('p95Latency');
            const p95Value = Math.round(metrics.aiResponse.p95Latency);
            p95Element.textContent = p95Value + 'ms';
            p95Element.className = p95Value < 1500 ? 'stat-value status-good' : 'stat-value status-error';
            
            const memElement = document.getElementById('memoryUsage');
            const memValue = Math.round(metrics.system.memory.heapUsed / 1024 / 1024);
            memElement.textContent = memValue + 'MB';
            memElement.className = memValue < 512 ? 'stat-value status-good' : 'stat-value status-error';
            
            document.getElementById('cacheHitRate').textContent = metrics.cache.hitRate || '0%';
            document.getElementById('activeConnections').textContent = metrics.connectionPool.activeConnections || 0;
        }
        
        function runTest() {
            const testType = document.getElementById('testType').value;
            const concurrent = parseInt(document.getElementById('concurrent').value);
            
            log(\`Starting \${testType} test with \${concurrent} concurrent calls...\`);
            
            ws.send(JSON.stringify({
                type: 'startTest',
                data: { testType, concurrent }
            }));
        }
        
        function clearData() {
            ws.send(JSON.stringify({ type: 'clearData' }));
            clearCharts();
        }
        
        function clearCharts() {
            if (latencyChart) {
                latencyChart.data.labels = [];
                latencyChart.data.datasets[0].data = [];
                latencyChart.update();
                
                memoryChart.data.labels = [];
                memoryChart.data.datasets[0].data = [];
                memoryChart.update();
            }
        }
        
        function exportData() {
            fetch('/api/history')
                .then(response => response.json())
                .then(data => {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'performance-data.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    log('Performance data exported');
                })
                .catch(error => {
                    log('Export failed: ' + error.message);
                });
        }
        
        function log(message) {
            const logContainer = document.getElementById('performanceLog');
            const timestamp = new Date().toLocaleTimeString();
            logContainer.innerHTML += \`<div>[\${timestamp}] \${message}</div>\`;
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        
        // Request initial metrics
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'getMetrics' }));
            }
        }, 1000);
    </script>
</body>
</html>`;
  }

  /**
   * Stop the dashboard server
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.stopMonitoring();
    
    // Close WebSocket connections
    for (const ws of this.connectedClients) {
      ws.close();
    }
    this.connectedClients.clear();
    
    // Close server
    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        logger.info('Performance dashboard stopped');
        resolve();
      });
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.stop();
    
    await this.performanceTracer.cleanup();
    await this.performanceMonitor.cleanup();
    await this.geminiService.cleanup();
    
    logger.info('Performance dashboard cleanup completed');
  }
}

export default PerformanceDashboard;

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const dashboard = new PerformanceDashboard({ port: 3001 });
  
  dashboard.initialize()
    .then(() => dashboard.start())
    .then(() => {
      console.log('\n🚀 Performance Dashboard started at http://localhost:3001');
      console.log('Press Ctrl+C to stop');
      
      process.on('SIGINT', async () => {
        console.log('\nShutting down dashboard...');
        await dashboard.cleanup();
        process.exit(0);
      });
    })
    .catch((error) => {
      console.error('Dashboard failed to start:', error);
      process.exit(1);
    });
}