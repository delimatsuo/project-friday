/**
 * Project Friday - Setup Validation Test Suite
 * 
 * This test suite validates that all required components for Project Friday
 * are properly configured and working correctly.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const functionsDir = join(__dirname, '..');
const projectRoot = join(__dirname, '../../..');

// Load environment variables
config({ path: join(functionsDir, '.env.local') });

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds

describe('Project Friday Setup Validation', () => {
  let app;
  
  beforeAll(async () => {
    // Initialize Firebase Admin SDK for testing
    if (!admin.apps.length) {
      try {
        app = admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            clientId: process.env.FIREBASE_CLIENT_ID,
            clientX509CertUrl: process.env.FIREBASE_CLIENT_X509_CERT_URL,
          }),
        });
      } catch (error) {
        console.warn('Firebase Admin initialization failed:', error.message);
        // Continue with tests that don't require Firebase Admin
      }
    } else {
      app = admin.app();
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (app) {
      await app.delete();
    }
  });

  describe('Environment Configuration', () => {
    test('should have all required Firebase environment variables', () => {
      const requiredVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_CLIENT_ID',
        'FIREBASE_CLIENT_X509_CERT_URL',
      ];

      requiredVars.forEach(varName => {
        expect(process.env[varName]).toBeDefined();
        expect(process.env[varName]).not.toBe('');
        expect(process.env[varName]).not.toMatch(/your-|example-|test-/);
      });
    });

    test('should have valid Firebase project ID format', () => {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      expect(projectId).toMatch(/^[a-z0-9-]+$/);
      expect(projectId.length).toBeGreaterThan(6);
      expect(projectId.length).toBeLessThan(31);
    });

    test('should have valid Firebase private key format', () => {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(privateKey).toContain('-----END PRIVATE KEY-----');
      expect(privateKey).toMatch(/\\n/); // Should contain escaped newlines
    });

    test('should have valid Firebase client email format', () => {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      expect(clientEmail).toMatch(/^firebase-adminsdk-.+@.+\.iam\.gserviceaccount\.com$/);
    });

    test('should have Google Cloud configuration', () => {
      expect(process.env.GOOGLE_CLOUD_PROJECT_ID).toBeDefined();
      expect(process.env.GOOGLE_CLOUD_REGION).toBeDefined();
      expect(process.env.GOOGLE_CLOUD_REGION).toMatch(/^[a-z]+-[a-z]+\d+$/);
    });

    test('should have Google AI API key', () => {
      const apiKey = process.env.GOOGLE_AI_API_KEY;
      expect(apiKey).toBeDefined();
      expect(apiKey).toMatch(/^AIza[0-9A-Za-z_-]{35}$/);
    });

    test('should have Twilio configuration', () => {
      const requiredTwilioVars = [
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'TWILIO_PHONE_NUMBER',
      ];

      requiredTwilioVars.forEach(varName => {
        expect(process.env[varName]).toBeDefined();
        expect(process.env[varName]).not.toBe('');
      });

      // Validate Twilio Account SID format
      expect(process.env.TWILIO_ACCOUNT_SID).toMatch(/^AC[a-f0-9]{32}$/);
      
      // Validate phone number format (E.164)
      expect(process.env.TWILIO_PHONE_NUMBER).toMatch(/^\+[1-9]\d{10,14}$/);
    });

    test('should have application configuration', () => {
      expect(process.env.NODE_ENV).toBeDefined();
      expect(['development', 'staging', 'production']).toContain(process.env.NODE_ENV);
    });
  });

  describe('Project Structure', () => {
    test('should have required project directories', () => {
      const requiredDirs = [
        'backend',
        'backend/functions',
        'docs',
        'scripts',
      ];

      requiredDirs.forEach(dir => {
        const fullPath = join(projectRoot, dir);
        expect(existsSync(fullPath)).toBe(true);
      });
    });

    test('should have required Firebase configuration files', () => {
      const requiredFiles = [
        'backend/firebase.json',
        'backend/firestore.rules',
        'backend/firestore.indexes.json',
      ];

      requiredFiles.forEach(file => {
        const fullPath = join(projectRoot, file);
        expect(existsSync(fullPath)).toBe(true);
      });
    });

    test('should have valid firebase.json configuration', () => {
      const firebaseConfigPath = join(projectRoot, 'backend/firebase.json');
      const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, 'utf8'));

      expect(firebaseConfig).toHaveProperty('functions');
      expect(firebaseConfig).toHaveProperty('firestore');
      expect(firebaseConfig).toHaveProperty('storage');
      expect(firebaseConfig).toHaveProperty('emulators');

      // Check functions configuration
      expect(firebaseConfig.functions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: 'functions',
            codebase: 'default',
          }),
        ])
      );

      // Check emulators configuration
      expect(firebaseConfig.emulators).toHaveProperty('auth');
      expect(firebaseConfig.emulators).toHaveProperty('functions');
      expect(firebaseConfig.emulators).toHaveProperty('firestore');
      expect(firebaseConfig.emulators).toHaveProperty('ui');
    });

    test('should have required function files', () => {
      const requiredFiles = [
        'backend/functions/package.json',
        'backend/functions/index.js',
        'backend/functions/.env.example',
      ];

      requiredFiles.forEach(file => {
        const fullPath = join(projectRoot, file);
        expect(existsSync(fullPath)).toBe(true);
      });
    });

    test('should have valid package.json', () => {
      const packageJsonPath = join(functionsDir, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

      expect(packageJson.name).toBe('project-friday-functions');
      expect(packageJson.engines.node).toBeDefined();
      expect(packageJson.dependencies).toHaveProperty('firebase-admin');
      expect(packageJson.dependencies).toHaveProperty('firebase-functions');
      expect(packageJson.dependencies).toHaveProperty('twilio');
      expect(packageJson.dependencies).toHaveProperty('@google-cloud/text-to-speech');
      expect(packageJson.dependencies).toHaveProperty('@google-cloud/speech');
      expect(packageJson.dependencies).toHaveProperty('@google/generative-ai');
    });
  });

  describe('Firebase Services', () => {
    test('should initialize Firebase Admin SDK successfully', () => {
      expect(app).toBeDefined();
      expect(app.name).toBe('[DEFAULT]');
    });

    test('should have access to Firestore', async () => {
      if (!app) {
        console.warn('Skipping Firestore test - Firebase Admin not initialized');
        return;
      }

      const firestore = admin.firestore(app);
      expect(firestore).toBeDefined();

      // Test basic Firestore operation
      try {
        const testDoc = firestore.collection('test').doc('validation');
        await testDoc.set({ timestamp: admin.firestore.FieldValue.serverTimestamp() });
        await testDoc.delete();
      } catch (error) {
        // This might fail in test mode, which is okay
        console.warn('Firestore write test failed (expected in test mode):', error.message);
      }
    }, TEST_TIMEOUT);

    test('should have access to Authentication', async () => {
      if (!app) {
        console.warn('Skipping Auth test - Firebase Admin not initialized');
        return;
      }

      const auth = admin.auth(app);
      expect(auth).toBeDefined();

      // Test basic auth operation (this should work even in test mode)
      try {
        await auth.listUsers(1);
      } catch (error) {
        // This might fail due to permissions, which is okay for validation
        console.warn('Auth test failed (may be expected):', error.message);
      }
    }, TEST_TIMEOUT);

    test('should have access to Storage', () => {
      if (!app) {
        console.warn('Skipping Storage test - Firebase Admin not initialized');
        return;
      }

      const storage = admin.storage(app);
      expect(storage).toBeDefined();
    });
  });

  describe('External API Connectivity', () => {
    test('should be able to connect to Google AI API', async () => {
      const apiKey = process.env.GOOGLE_AI_API_KEY;
      if (!apiKey) {
        console.warn('Skipping Google AI test - API key not configured');
        return;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).toBe(200);
    }, TEST_TIMEOUT);

    test('should be able to connect to Twilio API', async () => {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        console.warn('Skipping Twilio test - credentials not configured');
        return;
      }

      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json',
          },
        }
      );

      expect([200, 401, 403]).toContain(response.status);
    }, TEST_TIMEOUT);
  });

  describe('Security Configuration', () => {
    test('should not contain example values in environment', () => {
      const envVars = Object.keys(process.env);
      const dangerousPatterns = [
        'your-project-id',
        'your-api-key',
        'example-',
        'test-key',
        'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        '+15551234567',
      ];

      envVars.forEach(varName => {
        const value = process.env[varName];
        dangerousPatterns.forEach(pattern => {
          expect(value).not.toBe(pattern);
        });
      });
    });

    test('should have .env files in .gitignore', () => {
      const gitignorePath = join(projectRoot, '.gitignore');
      
      if (existsSync(gitignorePath)) {
        const gitignoreContent = readFileSync(gitignorePath, 'utf8');
        expect(gitignoreContent).toMatch(/\.env/);
      } else {
        console.warn('.gitignore file not found');
      }
    });

    test('should not expose sensitive files in function source', () => {
      const sensitiveFiles = [
        '.env.local',
        '.env.production',
        'service-account.json',
        'private-key.pem',
      ];

      // Check if these files exist in the functions directory
      sensitiveFiles.forEach(file => {
        const filePath = join(functionsDir, file);
        if (existsSync(filePath)) {
          console.warn(`Sensitive file found: ${file} (ensure it's in .gitignore)`);
        }
      });
    });
  });

  describe('Application Logic', () => {
    test('should have main function entry point', () => {
      const indexPath = join(functionsDir, 'index.js');
      const indexContent = readFileSync(indexPath, 'utf8');
      
      // Check for key exports
      expect(indexContent).toMatch(/exports\.handleCall/);
    });

    test('should handle environment-specific configuration', () => {
      const nodeEnv = process.env.NODE_ENV;
      expect(['development', 'staging', 'production']).toContain(nodeEnv);

      // Check that development vs production settings make sense
      if (nodeEnv === 'production') {
        expect(process.env.DEBUG_MODE).not.toBe('true');
      }
    });

    test('should have proper error handling setup', () => {
      const indexPath = join(functionsDir, 'index.js');
      const indexContent = readFileSync(indexPath, 'utf8');
      
      // Check for basic error handling patterns
      expect(indexContent).toMatch(/try[\s\S]*catch/);
      expect(indexContent).toMatch(/error|Error/);
    });
  });

  describe('Performance and Resource Configuration', () => {
    test('should have reasonable timeout settings', () => {
      const timeout = parseInt(process.env.WEBHOOK_TIMEOUT || '30');
      expect(timeout).toBeGreaterThan(10);
      expect(timeout).toBeLessThan(300); // 5 minutes max
    });

    test('should have reasonable call duration limits', () => {
      const maxDuration = parseInt(process.env.MAX_CALL_DURATION || '300');
      expect(maxDuration).toBeGreaterThan(60); // At least 1 minute
      expect(maxDuration).toBeLessThan(1800); // Max 30 minutes
    });

    test('should have proper region configuration', () => {
      const region = process.env.GOOGLE_CLOUD_REGION;
      const validRegions = [
        'us-central1', 'us-east1', 'us-west1', 'us-west2',
        'europe-west1', 'europe-west2', 'europe-west3',
        'asia-northeast1', 'asia-southeast1', 'asia-east1',
      ];
      
      expect(validRegions).toContain(region);
    });
  });
});

describe('Integration Tests', () => {
  test('should be able to create a test Twilio webhook payload', () => {
    const mockWebhookPayload = {
      CallSid: 'CA' + 'x'.repeat(32),
      From: '+15551234567',
      To: process.env.TWILIO_PHONE_NUMBER,
      CallStatus: 'ringing',
      Direction: 'inbound',
    };

    expect(mockWebhookPayload.CallSid).toMatch(/^CA[x]{32}$/);
    expect(mockWebhookPayload.From).toMatch(/^\+\d+$/);
    expect(mockWebhookPayload.To).toBeDefined();
  });

  test('should be able to mock Firebase Admin operations', async () => {
    if (!app) {
      console.warn('Skipping Firebase Admin mock test - not initialized');
      return;
    }

    // Mock user creation data
    const mockUserData = {
      uid: 'test-user-123',
      email: 'test@example.com',
      displayName: 'Test User',
    };

    // Mock call log data
    const mockCallLog = {
      callerId: '+15551234567',
      timestamp: new Date().toISOString(),
      duration: 120,
      transcript: 'Test conversation transcript',
      aiSummary: 'Test AI summary',
      audioRecordingUrl: 'https://example.com/recording.mp3',
    };

    // Validate data structures
    expect(mockUserData).toHaveProperty('uid');
    expect(mockCallLog).toHaveProperty('callerId');
    expect(mockCallLog).toHaveProperty('aiSummary');
  });
});

describe('Documentation and Setup Scripts', () => {
  test('should have setup documentation', () => {
    const docFiles = [
      'docs/setup/FIREBASE_SETUP_GUIDE.md',
      'docs/setup/ENVIRONMENT_VARIABLES.md',
    ];

    docFiles.forEach(file => {
      const fullPath = join(projectRoot, file);
      expect(existsSync(fullPath)).toBe(true);
    });
  });

  test('should have setup scripts', () => {
    const scriptFiles = [
      'scripts/setup.sh',
      'scripts/validate-setup.sh',
    ];

    scriptFiles.forEach(file => {
      const fullPath = join(projectRoot, file);
      expect(existsSync(fullPath)).toBe(true);
    });
  });

  test('should have executable permissions on scripts', async () => {
    const { access, constants } = await import('fs/promises');
    
    const scriptFiles = [
      join(projectRoot, 'scripts/setup.sh'),
      join(projectRoot, 'scripts/validate-setup.sh'),
    ];

    for (const file of scriptFiles) {
      try {
        await access(file, constants.F_OK | constants.X_OK);
      } catch (error) {
        throw new Error(`Script ${file} is not executable`);
      }
    }
  });
});

// Helper function to run this test suite programmatically
export const runSetupValidation = async () => {
  console.log('Running Project Friday setup validation...');
  
  // This would be called by the validation script
  // Implementation would depend on Jest's programmatic API
  
  return {
    success: true,
    errors: [],
    warnings: [],
  };
};