/**
 * Test Suite for FirestoreService
 * Follows TDD London School (mockist) approach with comprehensive behavior verification
 * Tests for Project Friday - AI call screening system
 * 
 * Focus areas:
 * - Mock-driven development with interaction testing
 * - Contract verification between FirestoreService and Firestore SDK
 * - Outside-in testing approach from user behavior to implementation
 * - Behavior verification over state testing
 */

// ===============================
// MOCK SETUP - London School TDD
// ===============================

// Mock the entire firebase-admin/firestore module
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockAdd = jest.fn();
const mockGet = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockOffset = jest.fn();
const mockUpdate = jest.fn();
const mockSet = jest.fn();
const mockDelete = jest.fn();
const mockCount = jest.fn();
const mockBatch = jest.fn();
const mockCommit = jest.fn();
const mockRunTransaction = jest.fn();

// Mock Firestore query chain
const mockQuery = {
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  offset: mockOffset,
  get: mockGet,
  count: mockCount
};

// Mock document reference
const mockDocRef = {
  id: 'test-doc-id',
  update: mockUpdate,
  set: mockSet,
  delete: mockDelete,
  get: mockGet
};

// Mock batch operations
const mockBatchObj = {
  update: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  commit: mockCommit
};

// Mock transaction
const mockTransaction = {
  get: jest.fn(),
  update: jest.fn(),
  set: jest.fn()
};

// Mock Firestore database
const mockDb = {
  collection: mockCollection,
  doc: mockDoc,
  batch: mockBatch,
  runTransaction: mockRunTransaction
};

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockDb)
}));

// Mock logger to control console output during tests
jest.mock('../src/utils/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

import FirestoreService from '../src/services/firestoreService.js';
import { getFirestore } from 'firebase-admin/firestore';
import logger from '../src/utils/logger.js';

describe('FirestoreService - TDD London School Approach', () => {
  let firestoreService;
  let mockSnapshot;
  let mockQuerySnapshot;

  beforeEach(() => {
    // Reset all mocks before each test - essential for isolation
    jest.clearAllMocks();
    
    // Set up mock snapshot for document operations
    mockSnapshot = {
      empty: false,
      docs: [{
        id: 'test-doc-id',
        data: jest.fn(() => ({
          callSid: 'test-call-sid',
          userId: 'test-user-id',
          phoneNumber: '+1234567890',
          status: 'in-progress'
        })),
        ref: mockDocRef
      }]
    };

    // Set up mock query snapshot
    mockQuerySnapshot = {
      empty: false,
      docs: mockSnapshot.docs
    };

    // Configure mock chains for Firestore operations
    mockCollection.mockReturnValue({
      add: mockAdd,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      offset: mockOffset,
      get: mockGet,
      count: mockCount,
      doc: mockDoc
    });

    // Configure query chain mocks
    mockWhere.mockReturnValue(mockQuery);
    mockOrderBy.mockReturnValue(mockQuery);
    mockLimit.mockReturnValue(mockQuery);
    mockOffset.mockReturnValue(mockQuery);
    mockGet.mockResolvedValue(mockQuerySnapshot);
    mockCount.mockReturnValue({ get: jest.fn().mockResolvedValue({ data: () => ({ count: 5 }) }) });

    // Configure document operations
    mockAdd.mockResolvedValue(mockDocRef);
    mockDoc.mockReturnValue(mockDocRef);
    mockUpdate.mockResolvedValue();
    mockSet.mockResolvedValue();
    mockDelete.mockResolvedValue();

    // Configure batch operations
    mockBatch.mockReturnValue(mockBatchObj);
    mockCommit.mockResolvedValue();

    // Configure transaction
    mockRunTransaction.mockImplementation(async (callback) => {
      return await callback(mockTransaction);
    });

    // Create service instance
    firestoreService = new FirestoreService();
  });

  // ===============================
  // CONSTRUCTOR & INITIALIZATION
  // ===============================

  describe('Constructor and Initialization', () => {
    it('should initialize with proper Firestore instance and collection references', () => {
      // Verify constructor calls getFirestore() - contract verification
      expect(getFirestore).toHaveBeenCalledTimes(1);
      
      // Verify service has correct collection references
      expect(firestoreService.callsCollection).toBe('calls');
      expect(firestoreService.usersCollection).toBe('users');
      expect(firestoreService.analyticsCollection).toBe('analytics');
      expect(firestoreService.settingsCollection).toBe('settings');
    });
  });

  // ===============================
  // CALL LOG CREATION - Outside-In TDD
  // ===============================

  describe('Call Log Creation - Outside-In TDD', () => {
    const validCallData = {
      callSid: 'CA1234567890abcdef',
      userId: 'user-123',
      phoneNumber: '+1234567890',
      callStartTime: new Date('2024-01-15T10:30:00Z'),
      duration: 120,
      transcripts: [
        {
          speaker: 'caller',
          text: 'Hello, is this the right number for the restaurant?',
          timestamp: new Date('2024-01-15T10:30:15Z')
        }
      ],
      aiSummary: 'Caller inquiring about restaurant contact information',
      callerName: 'John Doe',
      callPurpose: 'restaurant_inquiry',
      urgency: 'low',
      sentiment: 'neutral',
      actionRequired: false,
      followUpNeeded: false,
      metadata: {
        twilioCallSid: 'CA1234567890abcdef',
        fromCountry: 'US'
      }
    };

    it('should create call record with proper data structure and timestamps', async () => {
      // Act - Execute the behavior we're testing
      const result = await firestoreService.createCall(validCallData);

      // Assert - Verify interactions with collaborators (London School focus)
      expect(mockCollection).toHaveBeenCalledWith('calls');
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          ...validCallData,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          version: 1
        })
      );

      // Verify the conversation between objects
      expect(logger.info).toHaveBeenCalledWith(
        'Call record created',
        { docId: 'test-doc-id', callSid: validCallData.callSid }
      );

      // Verify return value structure
      expect(result).toEqual({
        id: 'test-doc-id',
        ...validCallData,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        version: 1
      });
    });

    it('should handle call creation with minimal required fields', async () => {
      const minimalCallData = {
        callSid: 'CA1234567890abcdef',
        userId: 'user-123',
        phoneNumber: '+1234567890'
      };

      await firestoreService.createCall(minimalCallData);

      // Verify only required fields are processed correctly
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          callSid: minimalCallData.callSid,
          userId: minimalCallData.userId,
          phoneNumber: minimalCallData.phoneNumber,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          version: 1
        })
      );
    });

    it('should handle call creation failure and log error appropriately', async () => {
      const errorMessage = 'Firestore connection failed';
      mockAdd.mockRejectedValue(new Error(errorMessage));

      // Verify error handling behavior
      await expect(firestoreService.createCall(validCallData)).rejects.toThrow(errorMessage);
      
      // Verify error logging interaction
      expect(logger.error).toHaveBeenCalledWith('Error creating call record', expect.any(Error));
    });

    it('should assign proper timestamps in correct sequence', async () => {
      const beforeCall = new Date();
      await firestoreService.createCall(validCallData);
      const afterCall = new Date();

      const addCall = mockAdd.mock.calls[0][0];
      
      // Verify timestamps are within expected range
      expect(addCall.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(addCall.createdAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
      expect(addCall.updatedAt).toEqual(addCall.createdAt);
    });
  });

  // ===============================
  // CALL LOG RETRIEVAL - Behavior Verification
  // ===============================

  describe('Call Log Retrieval - Behavior Verification', () => {
    it('should retrieve call by CallSid with proper query construction', async () => {
      const testCallSid = 'CA1234567890abcdef';
      
      await firestoreService.getCall(testCallSid);

      // Verify the conversation between service and Firestore
      expect(mockCollection).toHaveBeenCalledWith('calls');
      expect(mockWhere).toHaveBeenCalledWith('callSid', '==', testCallSid);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(mockGet).toHaveBeenCalled();
    });

    it('should return null when call is not found', async () => {
      mockGet.mockResolvedValue({ empty: true });

      const result = await firestoreService.getCall('non-existent-call');

      expect(result).toBeNull();
    });

    it('should return properly formatted call data when found', async () => {
      const expectedData = {
        callSid: 'test-call-sid',
        userId: 'test-user-id',
        phoneNumber: '+1234567890',
        status: 'in-progress'
      };
      
      mockSnapshot.docs[0].data.mockReturnValue(expectedData);

      const result = await firestoreService.getCall('test-call-sid');

      expect(result).toEqual({
        id: 'test-doc-id',
        ...expectedData
      });
    });

    it('should handle retrieval errors and propagate them appropriately', async () => {
      const errorMessage = 'Database connection timeout';
      mockGet.mockRejectedValue(new Error(errorMessage));

      await expect(firestoreService.getCall('test-call-sid')).rejects.toThrow(errorMessage);
      expect(logger.error).toHaveBeenCalledWith('Error getting call record', expect.any(Error));
    });
  });

  // ===============================
  // USER CALLS RETRIEVAL - Pagination & Filtering
  // ===============================

  describe('User Calls Retrieval - Pagination & Filtering', () => {
    it('should construct proper query for user calls with default pagination', async () => {
      const userId = 'user-123';
      
      await firestoreService.getUserCalls(userId);

      // Verify query construction sequence
      expect(mockCollection).toHaveBeenCalledWith('calls');
      expect(mockWhere).toHaveBeenCalledWith('userId', '==', userId);
      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(20);
    });

    it('should apply custom pagination parameters', async () => {
      const userId = 'user-123';
      const customLimit = 50;
      const customOffset = 25;

      await firestoreService.getUserCalls(userId, customLimit, customOffset);

      expect(mockLimit).toHaveBeenCalledWith(customLimit);
      expect(mockOffset).toHaveBeenCalledWith(customOffset);
    });

    it('should transform query results to proper format', async () => {
      const mockCalls = [
        { id: 'call-1', callSid: 'CA1111', status: 'completed' },
        { id: 'call-2', callSid: 'CA2222', status: 'in-progress' }
      ];

      mockQuerySnapshot.docs = mockCalls.map(call => ({
        id: call.id,
        data: () => ({ callSid: call.callSid, status: call.status })
      }));

      const result = await firestoreService.getUserCalls('user-123');

      expect(result).toEqual([
        { id: 'call-1', callSid: 'CA1111', status: 'completed' },
        { id: 'call-2', callSid: 'CA2222', status: 'in-progress' }
      ]);
    });

    it('should handle empty result sets gracefully', async () => {
      mockGet.mockResolvedValue({ docs: [] });

      const result = await firestoreService.getUserCalls('user-123');

      expect(result).toEqual([]);
    });
  });

  // ===============================
  // CALL STATUS UPDATES - Transaction Testing
  // ===============================

  describe('Call Status Updates - Transaction Testing', () => {
    it('should update call with proper version increment', async () => {
      const callSid = 'CA1234567890abcdef';
      const updateData = {
        status: 'completed',
        callEndTime: new Date(),
        duration: 180,
        aiSummary: 'Customer service inquiry resolved'
      };

      // Mock existing call data
      mockSnapshot.docs[0].data.mockReturnValue({
        callSid,
        status: 'in-progress',
        version: 2
      });

      await firestoreService.updateCall(callSid, updateData);

      // Verify query to find existing call
      expect(mockWhere).toHaveBeenCalledWith('callSid', '==', callSid);
      
      // Verify update with version increment
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updateData,
          updatedAt: expect.any(Date),
          version: 3
        })
      );

      // Verify logging interaction
      expect(logger.info).toHaveBeenCalledWith(
        'Call record updated',
        { callSid, updatedFields: Object.keys(updateData) }
      );
    });

    it('should throw error when updating non-existent call', async () => {
      mockGet.mockResolvedValue({ empty: true });

      const callSid = 'non-existent-call';
      await expect(firestoreService.updateCall(callSid, {})).rejects.toThrow(`Call not found: ${callSid}`);
    });

    it('should handle update failures appropriately', async () => {
      const errorMessage = 'Update operation failed';
      mockUpdate.mockRejectedValue(new Error(errorMessage));

      await expect(firestoreService.updateCall('test-call-sid', {})).rejects.toThrow(errorMessage);
      expect(logger.error).toHaveBeenCalledWith('Error updating call record', expect.any(Error));
    });

    it('should update call status with proper status transition', async () => {
      const callSid = 'CA1234567890abcdef';
      const statusData = {
        status: 'completed',
        duration: 300
      };

      await firestoreService.updateCallStatus(callSid, statusData);

      // Verify it delegates to updateCall with enhanced data
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          duration: 300,
          endTime: expect.any(Date),
          updatedAt: expect.any(Date),
          version: expect.any(Number)
        })
      );
    });
  });

  // ===============================
  // USER STATISTICS - Transaction Handling
  // ===============================

  describe('User Statistics - Transaction Handling', () => {
    it('should update user stats using transaction for consistency', async () => {
      const userId = 'user-123';
      const callDuration = 150;
      const callSid = 'CA1234567890abcdef';

      // Mock existing user data
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          callCount: 5,
          totalCallDuration: 600
        })
      });

      await firestoreService.updateUserStats(userId, callDuration, callSid);

      // Verify transaction is used
      expect(mockRunTransaction).toHaveBeenCalled();
      
      // Verify user document retrieval within transaction
      expect(mockTransaction.get).toHaveBeenCalled();
      
      // Verify user stats update within transaction
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          callCount: 6,
          totalCallDuration: 750,
          lastCallAt: expect.any(Date),
          lastCallSid: callSid,
          updatedAt: expect.any(Date)
        })
      );

      expect(logger.info).toHaveBeenCalledWith('User stats updated', { userId, callDuration });
    });

    it('should create new user when user does not exist', async () => {
      const userId = 'new-user-456';
      const callDuration = 100;
      const callSid = 'CA9876543210fedcba';

      // Mock user does not exist
      mockTransaction.get.mockResolvedValue({ exists: false });

      await firestoreService.updateUserStats(userId, callDuration, callSid);

      // Verify new user creation within transaction
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          callCount: 1,
          totalCallDuration: callDuration,
          lastCallAt: expect.any(Date),
          lastCallSid: callSid,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      );
    });

    it('should handle transaction failures appropriately', async () => {
      const errorMessage = 'Transaction failed due to contention';
      mockRunTransaction.mockRejectedValue(new Error(errorMessage));

      await expect(firestoreService.updateUserStats('user-123', 100, 'call-sid')).rejects.toThrow(errorMessage);
      expect(logger.error).toHaveBeenCalledWith('Error updating user stats', expect.any(Error));
    });
  });

  // ===============================
  // SEARCH FUNCTIONALITY - Query Construction
  // ===============================

  describe('Search Functionality - Query Construction', () => {
    it('should search calls by phone number when query looks like phone number', async () => {
      const phoneQuery = '+1234567890';
      
      await firestoreService.searchCalls(phoneQuery);

      // Verify phone number search query construction
      expect(mockWhere).toHaveBeenCalledWith('from', '==', phoneQuery);
      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(20);
    });

    it('should search calls by transcript content for text queries', async () => {
      const textQuery = 'restaurant reservation';
      
      await firestoreService.searchCalls(textQuery);

      // Verify text search query construction (Firestore prefix matching)
      expect(mockWhere).toHaveBeenCalledWith('transcript', '>=', textQuery);
      expect(mockWhere).toHaveBeenCalledWith('transcript', '<', textQuery + '\uf8ff');
      expect(mockOrderBy).toHaveBeenCalledWith('transcript');
    });

    it('should handle search with custom limit parameter', async () => {
      const customLimit = 50;
      
      await firestoreService.searchCalls('test query', customLimit);

      expect(mockLimit).toHaveBeenCalledWith(customLimit);
    });

    it('should handle search errors and propagate them', async () => {
      const errorMessage = 'Search index unavailable';
      mockGet.mockRejectedValue(new Error(errorMessage));

      await expect(firestoreService.searchCalls('test')).rejects.toThrow(errorMessage);
      expect(logger.error).toHaveBeenCalledWith('Error searching calls', expect.any(Error));
    });
  });

  // ===============================
  // SOFT DELETE OPERATIONS - Data Preservation
  // ===============================

  describe('Soft Delete Operations - Data Preservation', () => {
    it('should perform soft delete by default', async () => {
      const callSid = 'CA1234567890abcdef';
      
      await firestoreService.deleteCall(callSid);

      // Verify soft delete update operation
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted: true,
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date)
        })
      );

      // Verify no hard delete occurred
      expect(mockDelete).not.toHaveBeenCalled();
      
      expect(logger.info).toHaveBeenCalledWith('Call record soft deleted', { callSid });
    });

    it('should perform hard delete when explicitly requested', async () => {
      const callSid = 'CA1234567890abcdef';
      
      await firestoreService.deleteCall(callSid, true);

      // Verify hard delete operation
      expect(mockDelete).toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      
      expect(logger.info).toHaveBeenCalledWith('Call record permanently deleted', { callSid });
    });

    it('should handle delete operations on non-existent calls', async () => {
      mockGet.mockResolvedValue({ empty: true });
      const callSid = 'non-existent-call';

      await expect(firestoreService.deleteCall(callSid)).rejects.toThrow(`Call not found: ${callSid}`);
    });
  });

  // ===============================
  // ANALYTICS AND REPORTING - Aggregation Testing
  // ===============================

  describe('Analytics and Reporting - Aggregation Testing', () => {
    it('should calculate call analytics for date range correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      // Mock call data for analytics
      const mockCallsData = [
        { status: 'completed', duration: 120, from: '+1111111111' },
        { status: 'completed', duration: 180, from: '+2222222222' },
        { status: 'failed', duration: 0, from: '+1111111111' },
        { status: 'completed', duration: 90, from: '+3333333333' }
      ];

      mockQuerySnapshot.docs = mockCallsData.map((call, index) => ({
        data: () => call
      }));

      const result = await firestoreService.getCallAnalytics(startDate, endDate);

      // Verify query construction for date range
      expect(mockWhere).toHaveBeenCalledWith('createdAt', '>=', startDate);
      expect(mockWhere).toHaveBeenCalledWith('createdAt', '<=', endDate);

      // Verify analytics calculations
      expect(result).toEqual({
        totalCalls: 4,
        completedCalls: 3,
        failedCalls: 1,
        avgDuration: 130, // (120 + 180 + 90) / 3
        totalDuration: 390,
        uniqueCallers: 3
      });
    });

    it('should handle empty analytics data gracefully', async () => {
      mockGet.mockResolvedValue({ docs: [] });

      const result = await firestoreService.getCallAnalytics(new Date(), new Date());

      expect(result).toEqual({
        totalCalls: 0,
        completedCalls: 0,
        failedCalls: 0,
        avgDuration: 0,
        totalDuration: 0,
        uniqueCallers: 0
      });
    });

    it('should record analytics events without affecting main functionality', async () => {
      const eventType = 'call_completed';
      const eventData = { callSid: 'CA123', duration: 150 };

      await firestoreService.recordAnalyticsEvent(eventType, eventData);

      // Verify analytics collection is used
      expect(mockCollection).toHaveBeenCalledWith('analytics');
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType,
          eventData,
          timestamp: expect.any(Date),
          date: expect.any(String)
        })
      );
    });

    it('should not throw errors for analytics failures', async () => {
      mockAdd.mockRejectedValue(new Error('Analytics service unavailable'));

      // Should not throw error - analytics failures should not break main functionality
      await expect(firestoreService.recordAnalyticsEvent('test', {})).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith('Error recording analytics event', expect.any(Error));
    });
  });

  // ===============================
  // BATCH OPERATIONS - Atomic Operations
  // ===============================

  describe('Batch Operations - Atomic Operations', () => {
    it('should perform batch updates atomically', async () => {
      const updates = [
        { collection: 'calls', docId: 'call-1', data: { status: 'completed' } },
        { collection: 'calls', docId: 'call-2', data: { status: 'failed' } }
      ];

      await firestoreService.batchUpdate(updates);

      // Verify batch creation and operations
      expect(mockBatch).toHaveBeenCalled();
      expect(mockBatchObj.update).toHaveBeenCalledTimes(2);
      expect(mockCommit).toHaveBeenCalled();
      
      expect(logger.info).toHaveBeenCalledWith('Batch update completed', { updateCount: 2 });
    });

    it('should handle batch operation failures', async () => {
      const errorMessage = 'Batch operation failed';
      mockCommit.mockRejectedValue(new Error(errorMessage));

      await expect(firestoreService.batchUpdate([])).rejects.toThrow(errorMessage);
      expect(logger.error).toHaveBeenCalledWith('Error performing batch update', expect.any(Error));
    });
  });

  // ===============================
  // HEALTH MONITORING - System Status
  // ===============================

  describe('Health Monitoring - System Status', () => {
    it('should return healthy status with collection statistics', async () => {
      // Mock count queries for each collection
      const mockCountResult = { data: () => ({ count: 42 }) };
      mockCount.mockReturnValue({ get: jest.fn().mockResolvedValue(mockCountResult) });

      const result = await firestoreService.getHealthStatus();

      expect(result.status).toBe('healthy');
      expect(result.collections).toEqual({
        calls: 42,
        users: 42,
        analytics: 42,
        recentCalls24h: 42
      });
      expect(result.timestamp).toBeDefined();
    });

    it('should return unhealthy status on database errors', async () => {
      mockCount.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await firestoreService.getHealthStatus();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Database connection failed');
      expect(result.timestamp).toBeDefined();
    });
  });

  // ===============================
  // ERROR HANDLING - Edge Cases
  // ===============================

  describe('Error Handling - Edge Cases', () => {
    it('should handle network timeout errors gracefully', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.code = 'TIMEOUT';
      mockGet.mockRejectedValue(timeoutError);

      await expect(firestoreService.getCall('test-call-sid')).rejects.toThrow('Network timeout');
      expect(logger.error).toHaveBeenCalledWith('Error getting call record', expect.objectContaining({
        message: 'Network timeout'
      }));
    });

    it('should handle permission denied errors appropriately', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.code = 'PERMISSION_DENIED';
      mockAdd.mockRejectedValue(permissionError);

      await expect(firestoreService.createCall({})).rejects.toThrow('Permission denied');
    });

    it('should handle quota exceeded errors', async () => {
      const quotaError = new Error('Quota exceeded');
      quotaError.code = 'RESOURCE_EXHAUSTED';
      mockUpdate.mockRejectedValue(quotaError);

      await expect(firestoreService.updateCall('test-call-sid', {})).rejects.toThrow('Quota exceeded');
    });
  });

  // ===============================
  // DATA VALIDATION - Input Sanitization
  // ===============================

  describe('Data Validation - Input Sanitization', () => {
    it('should handle undefined and null values in call data', async () => {
      const callDataWithNulls = {
        callSid: 'CA123',
        userId: 'user-123',
        phoneNumber: '+1234567890',
        transcripts: null,
        aiSummary: undefined,
        metadata: {}
      };

      await firestoreService.createCall(callDataWithNulls);

      // Verify data is passed through as-is for Firestore to handle
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          callSid: 'CA123',
          transcripts: null,
          aiSummary: undefined
        })
      );
    });

    it('should preserve complex nested data structures', async () => {
      const complexCallData = {
        callSid: 'CA123',
        userId: 'user-123',
        phoneNumber: '+1234567890',
        transcripts: [
          {
            speaker: 'caller',
            text: 'Hello world',
            timestamp: new Date(),
            metadata: { confidence: 0.95 }
          }
        ],
        metadata: {
          twilioData: { country: 'US', region: 'CA' },
          aiAnalysis: { keywords: ['hello', 'world'] }
        }
      };

      await firestoreService.createCall(complexCallData);

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          transcripts: complexCallData.transcripts,
          metadata: complexCallData.metadata
        })
      );
    });
  });

  // ===============================
  // CONCURRENCY - Race Condition Testing
  // ===============================

  describe('Concurrency - Race Condition Testing', () => {
    it('should handle concurrent call status updates correctly', async () => {
      const callSid = 'CA123';
      const updates = [
        { status: 'ringing' },
        { status: 'answered' },
        { status: 'completed' }
      ];

      // Execute updates concurrently
      const promises = updates.map(update => 
        firestoreService.updateCallStatus(callSid, update)
      );

      await Promise.all(promises);

      // Verify all updates were attempted
      expect(mockUpdate).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent user stat updates with transactions', async () => {
      const userId = 'user-123';
      const callDurations = [100, 150, 200];

      // Mock transaction to simulate concurrent access
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({ callCount: 0, totalCallDuration: 0 })
      });

      // Execute concurrent user stat updates
      const promises = callDurations.map(duration => 
        firestoreService.updateUserStats(userId, duration, `call-${duration}`)
      );

      await Promise.all(promises);

      // Verify transactions were used for each update
      expect(mockRunTransaction).toHaveBeenCalledTimes(3);
    });
  });
});