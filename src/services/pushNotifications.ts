import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from '../firebase';
import { User } from 'firebase/auth';

const PROJECT_ID = "anailda-book";

export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
};

export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

export const isRunningAsPWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
};

export const getPushPermissionStatus = () => {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

const getLocalDeviceId = () => {
  let deviceId = localStorage.getItem('cabral_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    localStorage.setItem('cabral_device_id', deviceId);
  }
  return deviceId;
};

export const enablePushNotifications = async (user: User, role?: string) => {
  if (!isPushSupported()) {
    throw new Error('unsupported');
  }

  if (isIOS() && !isRunningAsPWA()) {
    throw new Error('ios-not-pwa');
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('denied');
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('[push] Service Worker registered with scope:', registration.scope);

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await savePushToken(token, user, role, 'granted');
      return token;
    } else {
      throw new Error('no-token');
    }
  } catch (err: any) {
    console.error('[push] Error enabling notifications', err);
    throw err;
  }
};

export const savePushToken = async (token: string, user: User, role?: string, permission: string = 'granted') => {
  const tokenRef = doc(db, 'pushTokens', token);
  
  const data = {
    token,
    userId: user.uid,
    userEmail: user.email,
    userName: user.displayName || user.email?.split('@')[0] || '',
    role: role || 'admin',
    projectId: PROJECT_ID,
    active: true,
    updatedAt: serverTimestamp(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    source: isRunningAsPWA() ? 'pwa' : 'browser',
    permission,
    deviceId: getLocalDeviceId(),
    lastSeenAt: serverTimestamp()
  };

  await setDoc(tokenRef, data, { merge: true });
  
  // To keep createdAt, we could do a getDoc first, but setDoc with merge won't erase it if we don't pass it.
  // We'll just rely on merge: true. If we want we could add createdAt on the server side, but this is fine.
  console.log('[push] Token saved/updated successfully:', token.slice(0, 12) + '...');
};

export const syncExistingPushToken = async (user: User, role?: string) => {
  if (!isPushSupported()) return;
  if (getPushPermissionStatus() !== 'granted') return;
  
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (token) {
      await savePushToken(token, user, role, 'granted');
    }
  } catch (err) {
    console.error('[push] Error syncing existing token', err);
  }
};

export const disablePushNotifications = async (user: User) => {
  if (!isPushSupported()) return;
  
  try {
    const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (!registration) return;
    
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    
    if (token) {
      const tokenRef = doc(db, 'pushTokens', token);
      await updateDoc(tokenRef, {
        active: false,
        updatedAt: serverTimestamp(),
        disabledReason: 'logout'
      });
      await deleteToken(messaging);
      console.log('[push] Token disabled and deleted on logout');
    }
  } catch (err) {
    console.error('[push] Error disabling notifications', err);
  }
};

export const listenForegroundMessages = (callback: (payload: any) => void) => {
  if (!isPushSupported()) return () => {};
  
  try {
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      console.log('[push] Foreground message received', payload);
      callback(payload);
    });
  } catch (e) {
    console.error('[push] Could not listen to foreground messages', e);
    return () => {};
  }
};
