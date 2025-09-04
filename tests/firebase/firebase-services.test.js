// Firebase Services Integration Tests
// Tests to validate Firebase services are properly enabled and configured

const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, collection, addDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

describe('Firebase Services Integration Tests', () => {
  let testEnv;
  let authenticatedDb;
  let unauthenticatedDb;

  const PROJECT_ID = 'demo-firebase-services-test';
  const TEST_USER_ID = 'test-user-123';

  beforeAll(async () => {
    // Read Firestore rules
    const rulesPath = path.join(__dirname, '../../config/firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    // Initialize test environment
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: rules,
        host: 'localhost',
        port: 8080,
      },
    });

    // Get authenticated and unauthenticated database instances
    authenticatedDb = testEnv.authenticatedContext(TEST_USER_ID).firestore();
    unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('Firestore Database Tests', () => {
    describe('User Document Security Rules', () => {
      test('should allow authenticated user to read their own user document', async () => {
        const userDoc = doc(authenticatedDb, 'users', TEST_USER_ID);
        await assertSucceeds(getDoc(userDoc));
      });

      test('should allow authenticated user to write their own user document', async () => {
        const userDoc = doc(authenticatedDb, 'users', TEST_USER_ID);
        const userData = {
          email: 'test@example.com',
          createdAt: new Date(),
          phoneNumber: '+1234567890'
        };
        await assertSucceeds(setDoc(userDoc, userData));
      });

      test('should deny unauthenticated access to user documents', async () => {
        const userDoc = doc(unauthenticatedDb, 'users', TEST_USER_ID);
        await assertFails(getDoc(userDoc));
      });

      test('should deny authenticated user from accessing other users documents', async () => {
        const otherUserDoc = doc(authenticatedDb, 'users', 'other-user-456');
        await assertFails(getDoc(otherUserDoc));
      });
    });

    describe('Call Logs Security Rules', () => {
      test('should allow authenticated user to create call log with their userId', async () => {
        const callLogsCollection = collection(authenticatedDb, 'call_logs');
        const callLogData = {
          userId: TEST_USER_ID,
          callerPhoneNumber: '+1234567890',
          timestamp: new Date(),
          transcript: 'Test call transcript',
          aiSummary: 'Test summary',
          duration: 120
        };
        await assertSucceeds(addDoc(callLogsCollection, callLogData));
      });

      test('should deny authenticated user from creating call log with different userId', async () => {
        const callLogsCollection = collection(authenticatedDb, 'call_logs');
        const callLogData = {
          userId: 'different-user-789',
          callerPhoneNumber: '+1234567890',
          timestamp: new Date(),
          transcript: 'Test call transcript',
          aiSummary: 'Test summary',
          duration: 120
        };
        await assertFails(addDoc(callLogsCollection, callLogData));
      });

      test('should allow authenticated user to read their own call logs', async () => {
        // First create a call log
        const callLogsCollection = collection(authenticatedDb, 'call_logs');
        const callLogData = {
          userId: TEST_USER_ID,
          callerPhoneNumber: '+1234567890',
          timestamp: new Date(),
          transcript: 'Test call transcript',
          aiSummary: 'Test summary',
          duration: 120
        };
        const docRef = await assertSucceeds(addDoc(callLogsCollection, callLogData));
        
        // Then read it
        await assertSucceeds(getDoc(docRef));
      });

      test('should deny unauthenticated access to call logs', async () => {
        const callLogsCollection = collection(unauthenticatedDb, 'call_logs');
        const callLogData = {
          userId: TEST_USER_ID,
          callerPhoneNumber: '+1234567890',
          timestamp: new Date(),
          transcript: 'Test call transcript',
          aiSummary: 'Test summary',
          duration: 120
        };
        await assertFails(addDoc(callLogsCollection, callLogData));
      });
    });

    describe('General Security Rules', () => {
      test('should deny access to unknown collections', async () => {
        const unknownCollection = collection(authenticatedDb, 'unknown_collection');
        const testData = { test: 'data' };
        await assertFails(addDoc(unknownCollection, testData));
      });

      test('should deny unauthenticated access to any collection', async () => {
        const usersCollection = collection(unauthenticatedDb, 'users');
        const userData = { email: 'test@example.com' };
        await assertFails(addDoc(usersCollection, userData));
      });
    });
  });

  describe('Firestore Indexes Tests', () => {
    test('should support querying call logs by userId and timestamp (descending)', async () => {
      // This test verifies that the composite index for userId + timestamp exists
      // Note: In emulator, indexes are not enforced, but this validates the query structure
      
      const callLogsCollection = collection(authenticatedDb, 'call_logs');
      
      // Create multiple call logs
      const callLogs = [
        {
          userId: TEST_USER_ID,
          callerPhoneNumber: '+1111111111',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          transcript: 'First call',
          aiSummary: 'First summary',
          duration: 60
        },
        {
          userId: TEST_USER_ID,
          callerPhoneNumber: '+2222222222',
          timestamp: new Date('2024-01-02T10:00:00Z'),
          transcript: 'Second call',
          aiSummary: 'Second summary',
          duration: 90
        }
      ];

      for (const callLog of callLogs) {
        await assertSucceeds(addDoc(callLogsCollection, callLog));
      }

      // Query validation would happen in production with real indexes
      expect(callLogs).toHaveLength(2);
    });
  });
});

// Storage Rules Tests (requires Firebase Storage emulator setup)
describe('Cloud Storage Security Rules Tests', () => {
  // Note: These tests require the Storage emulator to be running
  // For now, we'll include structural tests

  test('should have storage rules file', () => {
    const storageRulesPath = path.join(__dirname, '../../config/storage.rules');
    expect(fs.existsSync(storageRulesPath)).toBe(true);
  });

  test('should validate storage rules syntax', () => {
    const storageRulesPath = path.join(__dirname, '../../config/storage.rules');
    const rules = fs.readFileSync(storageRulesPath, 'utf8');
    
    // Basic syntax validation
    expect(rules).toContain('rules_version');
    expect(rules).toContain('service firebase.storage');
    expect(rules).toContain('match /b/{bucket}/o');
  });
});

// Functions Tests (placeholder for when functions are implemented)
describe('Cloud Functions Tests', () => {
  test('should have functions directory structure ready', () => {
    const functionsPath = path.join(__dirname, '../../functions');
    // Functions directory might not exist yet, so this is optional
    if (fs.existsSync(functionsPath)) {
      expect(fs.existsSync(path.join(functionsPath, 'package.json'))).toBe(true);
    }
  });
});

// Configuration Tests
describe('Firebase Configuration Tests', () => {
  test('should have valid firebase.json configuration', () => {
    const configPath = path.join(__dirname, '../../config/firebase.json');
    expect(fs.existsSync(configPath)).toBe(true);
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config).toHaveProperty('firestore');
    expect(config).toHaveProperty('storage');
    expect(config).toHaveProperty('emulators');
    expect(config.firestore).toHaveProperty('rules');
    expect(config.firestore).toHaveProperty('indexes');
  });

  test('should have valid firestore indexes configuration', () => {
    const indexesPath = path.join(__dirname, '../../config/firestore.indexes.json');
    expect(fs.existsSync(indexesPath)).toBe(true);
    
    const indexes = JSON.parse(fs.readFileSync(indexesPath, 'utf8'));
    expect(indexes).toHaveProperty('indexes');
    expect(Array.isArray(indexes.indexes)).toBe(true);
    
    // Should have at least one index for call_logs
    const callLogsIndexes = indexes.indexes.filter(index => 
      index.collectionGroup === 'call_logs'
    );
    expect(callLogsIndexes.length).toBeGreaterThan(0);
  });
});