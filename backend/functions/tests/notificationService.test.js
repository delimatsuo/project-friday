/**
 * Notification Service Tests
 * Tests for Firebase Cloud Messaging (FCM) push notifications
 * Following TDD methodology - these tests drive the implementation
 */

import { jest } from '@jest/globals';
import NotificationService from '../src/services/notificationService.js';

// Mock firebase-admin
const mockMessaging = {
  send: jest.fn(),
  sendAll: jest.fn(),
  subscribeToTopic: jest.fn(),
  unsubscribeFromTopic: jest.fn(),
};

const mockDoc = {
  get: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
};

const mockQuery = {
  get: jest.fn(),
  where: jest.fn(() => mockQuery),
  orderBy: jest.fn(() => mockQuery),
  limit: jest.fn(() => mockQuery),
};

const mockCollection = {
  doc: jest.fn(() => mockDoc),
  where: jest.fn(() => mockQuery),
  add: jest.fn(),
};

const mockFirestore = {
  collection: jest.fn(() => mockCollection),
  batch: jest.fn(() => ({
    update: jest.fn(),
    commit: jest.fn(),
  })),
  runTransaction: jest.fn(),
};

jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => mockMessaging),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockFirestore),
}));

// Mock logger
jest.mock('../src/utils/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('NotificationService', () => {
  let notificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = new NotificationService();
  });

  describe('constructor', () => {
    it('should initialize messaging and firestore services', () => {
      expect(notificationService.messaging).toBeDefined();
      expect(notificationService.db).toBeDefined();
    });

    it('should set default notification templates', () => {
      expect(notificationService.templates).toBeDefined();
      expect(notificationService.templates.call_screened).toBeDefined();
      expect(notificationService.templates.call_completed).toBeDefined();
      expect(notificationService.templates.call_urgent).toBeDefined();
    });
  });

  describe('sendCallNotification', () => {
    const mockCallData = {
      callId: 'call-123',
      phoneNumber: '+1234567890',
      callerName: 'John Doe',
      aiSummary: 'John Doe called regarding an important business matter.',
      urgency: 'medium',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      duration: 120,
      actionRequired: false,
    };

    const mockUserToken = 'fcm-token-123';

    beforeEach(() => {
      mockMessaging.send.mockResolvedValue('projects/test/messages/123');
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({ fcmToken: mockUserToken, notificationSettings: {} }),
      });
    });

    it('should send notification successfully with call data', async () => {
      const result = await notificationService.sendCallNotification('user-123', mockCallData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('projects/test/messages/123');
      expect(mockMessaging.send).toHaveBeenCalledWith({
        token: mockUserToken,
        notification: {
          title: 'Call Screened from +1234567890',
          body: 'John Doe called regarding an important business matter.',
        },
        data: {
          callId: 'call-123',
          phoneNumber: '+1234567890',
          callerName: 'John Doe',
          urgency: 'medium',
          timestamp: '2024-01-01T12:00:00.000Z',
          duration: '120',
          actionRequired: 'false',
          type: 'call_screened',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'calls',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'call_notification.wav',
              category: 'CALL_CATEGORY',
            },
          },
        },
      });
    });

    it('should truncate long AI summary to 100 characters', async () => {
      const longSummary = 'This is a very long AI summary that exceeds the 100 character limit for push notifications and should be truncated properly to ensure compatibility with notification display limits.';
      const callDataWithLongSummary = {
        ...mockCallData,
        aiSummary: longSummary,
      };

      await notificationService.sendCallNotification('user-123', callDataWithLongSummary);

      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: expect.objectContaining({
            body: longSummary.substring(0, 97) + '...',
          }),
        })
      );
    });

    it('should use caller phone number when name is not available', async () => {
      const callDataWithoutName = {
        ...mockCallData,
        callerName: null,
      };

      await notificationService.sendCallNotification('user-123', callDataWithoutName);

      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: expect.objectContaining({
            title: 'Call Screened from +1234567890',
          }),
          data: expect.objectContaining({
            callerName: '+1234567890',
          }),
        })
      );
    });

    it('should handle urgent calls with higher priority', async () => {
      const urgentCallData = {
        ...mockCallData,
        urgency: 'high',
        actionRequired: true,
      };

      await notificationService.sendCallNotification('user-123', urgentCallData);

      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: expect.objectContaining({
            title: '🚨 Urgent Call from +1234567890',
          }),
          android: expect.objectContaining({
            priority: 'high',
          }),
          apns: expect.objectContaining({
            payload: expect.objectContaining({
              aps: expect.objectContaining({
                sound: 'urgent_notification.wav',
              }),
            }),
          }),
        })
      );
    });

    it('should throw error if user not found', async () => {
      mockDoc.get.mockResolvedValue({
        exists: false,
      });

      const result = await notificationService.sendCallNotification('nonexistent-user', mockCallData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('User not found: nonexistent-user');
    });

    it('should throw error if user has no FCM token', async () => {
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({ fcmToken: null }),
      });

      const result = await notificationService.sendCallNotification('user-123', mockCallData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No FCM token found for user: user-123');
    });

    it('should handle FCM send failures gracefully', async () => {
      const fcmError = new Error('Invalid registration token');
      fcmError.code = 'messaging/invalid-registration-token';
      mockMessaging.send.mockRejectedValue(fcmError);

      const result = await notificationService.sendCallNotification('user-123', mockCallData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid registration token');
      const logger = require('../src/utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        'FCM send failed',
        expect.objectContaining({
          userId: 'user-123',
          error: fcmError.message,
        })
      );
    });

    it('should respect user notification settings', async () => {
      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          fcmToken: mockUserToken,
          notificationSettings: {
            callNotifications: false,
          },
        }),
      });

      const result = await notificationService.sendCallNotification('user-123', mockCallData);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('User has disabled call notifications');
      expect(mockMessaging.send).not.toHaveBeenCalled();
    });
  });

  describe('sendBatchNotifications', () => {
    const mockNotifications = [
      {
        userId: 'user-1',
        callData: {
          callId: 'call-1',
          phoneNumber: '+1111111111',
          callerName: 'Alice',
          aiSummary: 'Alice called about work.',
        },
      },
      {
        userId: 'user-2',
        callData: {
          callId: 'call-2',
          phoneNumber: '+2222222222',
          callerName: 'Bob',
          aiSummary: 'Bob called about personal matter.',
        },
      },
    ];

    beforeEach(() => {
      mockFirestore.collection().where().get.mockResolvedValue({
        docs: [
          {
            id: 'user-1',
            data: () => ({ fcmToken: 'token-1', notificationSettings: {} }),
          },
          {
            id: 'user-2',
            data: () => ({ fcmToken: 'token-2', notificationSettings: {} }),
          },
        ],
      });

      mockMessaging.sendAll.mockResolvedValue([
        { success: true, messageId: 'msg-1' },
        { success: true, messageId: 'msg-2' },
      ]);
    });

    it('should send batch notifications successfully', async () => {
      const result = await notificationService.sendBatchNotifications(mockNotifications);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(mockMessaging.sendAll).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            token: 'token-1',
            notification: expect.objectContaining({
              title: 'Call Screened from +1111111111',
              body: 'Alice called about work.',
            }),
          }),
          expect.objectContaining({
            token: 'token-2',
            notification: expect.objectContaining({
              title: 'Call Screened from +2222222222',
              body: 'Bob called about personal matter.',
            }),
          }),
        ])
      );
    });

    it('should handle partial failures in batch send', async () => {
      mockMessaging.sendAll.mockResolvedValue([
        { success: true, messageId: 'msg-1' },
        { success: false, error: new Error('Invalid token') },
      ]);

      const result = await notificationService.sendBatchNotifications(mockNotifications);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.results[1].success).toBe(false);
    });

    it('should skip notifications for users without tokens', async () => {
      mockFirestore.collection().where().get.mockResolvedValue({
        docs: [
          {
            id: 'user-1',
            data: () => ({ fcmToken: 'token-1', notificationSettings: {} }),
          },
          {
            id: 'user-2',
            data: () => ({ fcmToken: null, notificationSettings: {} }),
          },
        ],
      });

      const result = await notificationService.sendBatchNotifications(mockNotifications);

      expect(result.skippedCount).toBe(1);
      expect(mockMessaging.sendAll).toHaveBeenCalledWith([
        expect.objectContaining({ token: 'token-1' }),
      ]);
    });
  });

  describe('updateUserFCMToken', () => {
    it('should update user FCM token successfully', async () => {
      const mockUpdate = jest.fn().mockResolvedValue();
      mockFirestore.collection().doc.mockReturnValue({ update: mockUpdate });

      await notificationService.updateUserFCMToken('user-123', 'new-token-456');

      expect(mockFirestore.collection).toHaveBeenCalledWith('users');
      expect(mockFirestore.collection().doc).toHaveBeenCalledWith('user-123');
      expect(mockUpdate).toHaveBeenCalledWith({
        fcmToken: 'new-token-456',
        fcmTokenUpdatedAt: expect.any(Date),
      });
      // Check if logger was called (mocked)
    const logger = require('../src/utils/logger');
    expect(logger.info).toHaveBeenCalledWith('FCM token updated', {
      userId: 'user-123',
    });
    });

    it('should handle token update failures', async () => {
      const updateError = new Error('Firestore update failed');
      mockFirestore.collection().doc().update.mockRejectedValue(updateError);

      await expect(
        notificationService.updateUserFCMToken('user-123', 'new-token-456')
      ).rejects.toThrow('Firestore update failed');
    });
  });

  describe('subscribeToTopic', () => {
    it('should subscribe user to topic successfully', async () => {
      const mockResponse = { successCount: 1, failureCount: 0 };
      mockMessaging.subscribeToTopic.mockResolvedValue(mockResponse);

      const result = await notificationService.subscribeToTopic('token-123', 'urgent-calls');

      expect(result).toEqual(mockResponse);
      expect(mockMessaging.subscribeToTopic).toHaveBeenCalledWith('token-123', 'urgent-calls');
    });

    it('should handle subscription failures', async () => {
      const subscriptionError = new Error('Invalid topic');
      mockMessaging.subscribeToTopic.mockRejectedValue(subscriptionError);

      await expect(
        notificationService.subscribeToTopic('token-123', 'invalid-topic')
      ).rejects.toThrow('Invalid topic');
    });
  });

  describe('unsubscribeFromTopic', () => {
    it('should unsubscribe user from topic successfully', async () => {
      const mockResponse = { successCount: 1, failureCount: 0 };
      mockMessaging.unsubscribeFromTopic.mockResolvedValue(mockResponse);

      const result = await notificationService.unsubscribeFromTopic('token-123', 'urgent-calls');

      expect(result).toEqual(mockResponse);
      expect(mockMessaging.unsubscribeFromTopic).toHaveBeenCalledWith('token-123', 'urgent-calls');
    });
  });

  describe('createNotificationPayload', () => {
    const mockCallData = {
      callId: 'call-123',
      phoneNumber: '+1234567890',
      callerName: 'John Doe',
      aiSummary: 'John called about work.',
      urgency: 'medium',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      duration: 120,
      actionRequired: false,
    };

    it('should create standard notification payload', () => {
      const payload = notificationService.createNotificationPayload(mockCallData, 'fcm-token');

      expect(payload.token).toBe('fcm-token');
      expect(payload.notification.title).toBe('Call Screened from +1234567890');
      expect(payload.notification.body).toBe('John called about work.');
      expect(payload.data.callId).toBe('call-123');
      expect(payload.data.type).toBe('call_screened');
      expect(payload.android.priority).toBe('high');
      expect(payload.apns.payload.aps.badge).toBe(1);
    });

    it('should create urgent notification payload for high urgency calls', () => {
      const urgentCallData = { ...mockCallData, urgency: 'high' };
      const payload = notificationService.createNotificationPayload(urgentCallData, 'fcm-token');

      expect(payload.notification.title).toBe('🚨 Urgent Call from +1234567890');
      expect(payload.apns.payload.aps.sound).toBe('urgent_notification.wav');
    });

    it('should handle missing caller name gracefully', () => {
      const callDataWithoutName = { ...mockCallData, callerName: null };
      const payload = notificationService.createNotificationPayload(callDataWithoutName, 'fcm-token');

      expect(payload.notification.title).toBe('Call Screened from +1234567890');
      expect(payload.data.callerName).toBe('+1234567890');
    });

    it('should truncate long summaries for notification body', () => {
      const longSummary = 'A'.repeat(150);
      const callDataWithLongSummary = { ...mockCallData, aiSummary: longSummary };
      const payload = notificationService.createNotificationPayload(callDataWithLongSummary, 'fcm-token');

      expect(payload.notification.body).toBe('A'.repeat(97) + '...');
    });
  });

  describe('cleanupInvalidTokens', () => {
    it('should remove invalid FCM tokens from user records', async () => {
      const mockInvalidTokens = ['invalid-token-1', 'invalid-token-2'];
      
      // Mock Firestore query for users with invalid tokens
      mockFirestore.collection().where().get.mockResolvedValue({
        docs: [
          {
            id: 'user-1',
            ref: { update: jest.fn() },
            data: () => ({ fcmToken: 'invalid-token-1' }),
          },
          {
            id: 'user-2',
            ref: { update: jest.fn() },
            data: () => ({ fcmToken: 'invalid-token-2' }),
          },
        ],
      });

      const result = await notificationService.cleanupInvalidTokens(mockInvalidTokens);

      expect(result.cleaned).toBe(2);
      const logger = require('../src/utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Cleaned up invalid FCM tokens', {
        count: 2,
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      const cleanupError = new Error('Cleanup failed');
      mockFirestore.collection().where().get.mockRejectedValue(cleanupError);

      await expect(
        notificationService.cleanupInvalidTokens(['invalid-token'])
      ).rejects.toThrow('Cleanup failed');
    });
  });

  describe('getNotificationTemplate', () => {
    it('should return correct template for call_screened type', () => {
      const template = notificationService.getNotificationTemplate('call_screened');
      
      expect(template).toBeDefined();
      expect(template.title).toContain('Call Screened from');
      expect(template.android.notification.channelId).toBe('calls');
    });

    it('should return urgent template for high urgency', () => {
      const template = notificationService.getNotificationTemplate('call_urgent');
      
      expect(template).toBeDefined();
      expect(template.title).toContain('🚨 Urgent Call from');
      expect(template.apns.payload.aps.sound).toBe('urgent_notification.wav');
    });

    it('should throw error for unknown template type', () => {
      expect(() => {
        notificationService.getNotificationTemplate('unknown_type');
      }).toThrow('Unknown notification template: unknown_type');
    });
  });
});