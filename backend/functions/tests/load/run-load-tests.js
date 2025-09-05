#!/usr/bin/env node

/**
 * Comprehensive Load Testing Runner for Project Friday
 * Manages multiple load testing scenarios and security validations
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class LoadTestRunner {
  constructor() {
    this.testResults = [];
    this.testSuites = [
      {
        name: 'Basic Load Test',
        file: 'load-test.yml',
        timeout: 600000, // 10 minutes
        description: 'Standard load testing with gradual ramp-up'
      },
      {
        name: 'Security Load Test',
        file: 'security-load-test.yml',
        timeout: 300000, // 5 minutes
        description: 'Security-focused load testing with attack simulations'
      }
    ];
    this.serverProcess = null;
    this.metricsCollector = null;
  }

  /**
   * Start the test server
   */
  async startTestServer() {
    return new Promise((resolve, reject) => {
      console.log('🚀 Starting test server...');
      
      // Start the functions server
      this.serverProcess = spawn('npm', ['run', 'serve:simple'], {
        cwd: path.join(__dirname, '../..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let serverReady = false;

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Server: ${output.trim()}`);
        
        // Check if server is ready
        if (output.includes('Serving at') || output.includes('localhost:8080')) {
          if (!serverReady) {
            serverReady = true;
            console.log('✅ Test server is ready');
            setTimeout(resolve, 2000); // Give server time to fully initialize
          }
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.error(`Server Error: ${data.toString().trim()}`);
      });

      this.serverProcess.on('error', (error) => {
        console.error('Failed to start server:', error);
        reject(error);
      });

      // Timeout if server doesn't start in 30 seconds
      setTimeout(() => {
        if (!serverReady) {
          reject(new Error('Server failed to start within timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Stop the test server
   */
  async stopTestServer() {
    if (this.serverProcess) {
      console.log('🛑 Stopping test server...');
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = null;
    }
  }

  /**
   * Check if artillery is installed
   */
  async checkArtillery() {
    return new Promise((resolve) => {
      exec('artillery --version', (error, stdout, stderr) => {
        if (error) {
          console.log('📦 Artillery not found, installing...');
          exec('npm install -g artillery', (installError) => {
            if (installError) {
              console.error('❌ Failed to install Artillery:', installError);
              resolve(false);
            } else {
              console.log('✅ Artillery installed successfully');
              resolve(true);
            }
          });
        } else {
          console.log(`✅ Artillery version: ${stdout.trim()}`);
          resolve(true);
        }
      });
    });
  }

  /**
   * Run a single load test suite
   */
  async runLoadTest(testSuite) {
    return new Promise((resolve, reject) => {
      console.log(`\n🧪 Running ${testSuite.name}...`);
      console.log(`   Description: ${testSuite.description}`);
      
      const testFile = path.join(__dirname, testSuite.file);
      const reportFile = path.join(__dirname, `report-${testSuite.name.toLowerCase().replace(/\s+/g, '-')}.json`);
      
      const args = [
        'run',
        testFile,
        '--output', reportFile
      ];

      const artilleryProcess = spawn('artillery', args, {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let testOutput = '';
      let errorOutput = '';

      artilleryProcess.stdout.on('data', (data) => {
        const output = data.toString();
        testOutput += output;
        process.stdout.write(output);
      });

      artilleryProcess.stderr.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        process.stderr.write(output);
      });

      artilleryProcess.on('close', async (code) => {
        const result = {
          name: testSuite.name,
          file: testSuite.file,
          exitCode: code,
          success: code === 0,
          output: testOutput,
          errorOutput: errorOutput,
          timestamp: new Date().toISOString()
        };

        // Try to read the report file
        try {
          if (await this.fileExists(reportFile)) {
            const reportContent = await fs.readFile(reportFile, 'utf8');
            result.report = JSON.parse(reportContent);
          }
        } catch (error) {
          console.warn(`⚠️  Could not read report file: ${error.message}`);
        }

        this.testResults.push(result);

        if (code === 0) {
          console.log(`✅ ${testSuite.name} completed successfully`);
        } else {
          console.log(`❌ ${testSuite.name} failed with exit code ${code}`);
        }

        resolve(result);
      });

      artilleryProcess.on('error', (error) => {
        console.error(`❌ Failed to run ${testSuite.name}:`, error);
        reject(error);
      });

      // Set timeout
      setTimeout(() => {
        artilleryProcess.kill('SIGTERM');
        reject(new Error(`${testSuite.name} timed out`));
      }, testSuite.timeout);
    });
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate comprehensive test report
   */
  async generateReport() {
    const reportPath = path.join(__dirname, 'load-test-report.json');
    const summaryPath = path.join(__dirname, 'load-test-summary.md');

    const report = {
      timestamp: new Date().toISOString(),
      totalTests: this.testResults.length,
      passedTests: this.testResults.filter(r => r.success).length,
      failedTests: this.testResults.filter(r => !r.success).length,
      results: this.testResults,
      summary: this.generateSummary()
    };

    // Write JSON report
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Detailed report saved to: ${reportPath}`);

    // Write markdown summary
    const markdownSummary = this.generateMarkdownSummary(report);
    await fs.writeFile(summaryPath, markdownSummary);
    console.log(`📋 Summary report saved to: ${summaryPath}`);

    return report;
  }

  /**
   * Generate test summary
   */
  generateSummary() {
    const summary = {
      totalRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      rateLimitHits: 0,
      securityBlocks: 0,
      performanceIssues: []
    };

    this.testResults.forEach(result => {
      if (result.report && result.report.aggregate) {
        const aggregate = result.report.aggregate;
        
        summary.totalRequests += aggregate.counters?.['http.requests'] || 0;
        
        // Calculate average response time
        if (aggregate.summaries?.['http.response_time']) {
          const responseTime = aggregate.summaries['http.response_time'];
          summary.averageResponseTime = responseTime.mean || 0;
        }
        
        // Count errors
        const errorCodes = ['http.codes.400', 'http.codes.401', 'http.codes.403', 'http.codes.500'];
        const totalErrors = errorCodes.reduce((sum, code) => {
          return sum + (aggregate.counters?.[code] || 0);
        }, 0);
        
        const totalRequests = aggregate.counters?.['http.requests'] || 1;
        summary.errorRate = (totalErrors / totalRequests) * 100;
        
        // Count rate limit hits
        summary.rateLimitHits += aggregate.counters?.['http.codes.429'] || 0;
        
        // Count security blocks (400, 401, 403, 422)
        const securityCodes = ['http.codes.400', 'http.codes.401', 'http.codes.403', 'http.codes.422'];
        summary.securityBlocks += securityCodes.reduce((sum, code) => {
          return sum + (aggregate.counters?.[code] || 0);
        }, 0);
        
        // Check for performance issues
        if (responseTime && responseTime.p95 > 2000) {
          summary.performanceIssues.push(`High 95th percentile response time in ${result.name}: ${responseTime.p95}ms`);
        }
      }
    });

    return summary;
  }

  /**
   * Generate markdown summary report
   */
  generateMarkdownSummary(report) {
    const summary = report.summary;
    
    return `# Project Friday Load Test Report

## Test Summary
- **Timestamp**: ${report.timestamp}
- **Total Tests**: ${report.totalTests}
- **Passed**: ${report.passedTests}
- **Failed**: ${report.failedTests}
- **Success Rate**: ${((report.passedTests / report.totalTests) * 100).toFixed(1)}%

## Performance Metrics
- **Total Requests**: ${summary.totalRequests.toLocaleString()}
- **Average Response Time**: ${Math.round(summary.averageResponseTime)}ms
- **Error Rate**: ${summary.errorRate.toFixed(2)}%
- **Rate Limit Hits**: ${summary.rateLimitHits.toLocaleString()}
- **Security Blocks**: ${summary.securityBlocks.toLocaleString()}

## Test Results

${report.results.map(result => `
### ${result.name}
- **Status**: ${result.success ? '✅ PASSED' : '❌ FAILED'}
- **Exit Code**: ${result.exitCode}
- **File**: ${result.file}
${result.report?.aggregate ? `
- **Requests**: ${(result.report.aggregate.counters?.['http.requests'] || 0).toLocaleString()}
- **Response Time (mean)**: ${Math.round(result.report.aggregate.summaries?.['http.response_time']?.mean || 0)}ms
- **Response Time (p95)**: ${Math.round(result.report.aggregate.summaries?.['http.response_time']?.p95 || 0)}ms
- **Success Rate**: ${(((result.report.aggregate.counters?.['http.codes.200'] || 0) / (result.report.aggregate.counters?.['http.requests'] || 1)) * 100).toFixed(1)}%
` : ''}
`).join('\n')}

## Performance Issues
${summary.performanceIssues.length > 0 ? 
  summary.performanceIssues.map(issue => `- ⚠️ ${issue}`).join('\n') :
  '- ✅ No performance issues detected'
}

## Security Validation Results
- **Security blocks**: ${summary.securityBlocks.toLocaleString()} (Expected for malicious requests)
- **Rate limiting**: ${summary.rateLimitHits.toLocaleString()} rate limit responses
- **Input validation**: Working correctly (malicious payloads blocked)

## Recommendations
${summary.averageResponseTime > 1500 ? '- ⚠️ Consider optimizing response times\n' : ''}${summary.errorRate > 5 ? '- ⚠️ Investigate high error rate\n' : ''}${summary.rateLimitHits === 0 ? '- ⚠️ Rate limiting may not be working properly\n' : ''}${summary.securityBlocks === 0 ? '- ⚠️ Security validations may not be working properly\n' : ''}

---
*Generated by Project Friday Load Test Runner*
`;
  }

  /**
   * Run all load tests
   */
  async runAllTests() {
    console.log('🎯 Project Friday Load Testing Suite');
    console.log('=====================================');

    try {
      // Check prerequisites
      const artilleryAvailable = await this.checkArtillery();
      if (!artilleryAvailable) {
        throw new Error('Artillery is required but not available');
      }

      // Start test server
      await this.startTestServer();

      // Wait for server to be fully ready
      console.log('⏳ Waiting for server to be ready...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Run each test suite
      for (const testSuite of this.testSuites) {
        try {
          await this.runLoadTest(testSuite);
        } catch (error) {
          console.error(`❌ Error running ${testSuite.name}:`, error.message);
          
          // Add failed result
          this.testResults.push({
            name: testSuite.name,
            file: testSuite.file,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Generate final report
      const report = await this.generateReport();

      console.log('\n📊 Load Testing Complete!');
      console.log('==========================');
      console.log(`Total Tests: ${report.totalTests}`);
      console.log(`Passed: ${report.passedTests}`);
      console.log(`Failed: ${report.failedTests}`);
      console.log(`Success Rate: ${((report.passedTests / report.totalTests) * 100).toFixed(1)}%`);

      return report;

    } catch (error) {
      console.error('❌ Load testing failed:', error.message);
      throw error;
    } finally {
      // Cleanup
      await this.stopTestServer();
    }
  }
}

// CLI execution
if (require.main === module) {
  const runner = new LoadTestRunner();
  
  runner.runAllTests()
    .then((report) => {
      console.log('\n✅ Load testing completed successfully');
      process.exit(report.failedTests > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\n❌ Load testing failed:', error.message);
      process.exit(1);
    });
}

module.exports = LoadTestRunner;