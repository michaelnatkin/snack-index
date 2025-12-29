/**
 * Push notification utilities for Snack Index
 */

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface NotificationResult {
  success: boolean;
  token?: string;
  error?: string;
  permissionState: NotificationPermissionState;
}

/**
 * Check if notifications are supported
 */
export function isNotificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Get the current notification permission state
 */
export function getNotificationPermissionState(): NotificationPermissionState {
  if (!isNotificationsSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationResult> {
  if (!isNotificationsSupported()) {
    return {
      success: false,
      error: 'Notifications are not supported by your browser',
      permissionState: 'unsupported',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const token = await getFCMToken();
      return {
        success: true,
        permissionState: 'granted',
        token: token || undefined,
      };
    }

    return {
      success: false,
      error: permission === 'denied' 
        ? 'Notification permission was denied' 
        : 'Notification permission was dismissed',
      permissionState: permission,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to request notification permission',
      permissionState: getNotificationPermissionState(),
    };
  }
}

/**
 * Get FCM token for push notifications
 * This is a placeholder - in production, this would use Firebase Messaging
 */
export async function getFCMToken(): Promise<string | null> {
  // In production, this would be:
  // import { getMessaging, getToken } from 'firebase/messaging';
  // const messaging = getMessaging();
  // return await getToken(messaging, { vapidKey: '...' });
  
  // For now, return null as FCM isn't set up yet
  return null;
}

