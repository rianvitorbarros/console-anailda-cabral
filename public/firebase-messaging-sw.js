importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "console-anailda",
  appId: "1:588056723391:web:b0306b9051b5ecacbd6b0a",
  apiKey: "AIzaSyBURLcsUnnMl5x-dNgNUQl_oInZcS33p04",
  authDomain: "console-anailda.firebaseapp.com",
  messagingSenderId: "588056723391"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

const recentlyShown = new Map();

function shouldShowNotification(tag) {
  const now = Date.now();
  const last = recentlyShown.get(tag);
  if (last && now - last < 30000) return false;
  recentlyShown.set(tag, now);
  return true;
}

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.data?.title || 'Notificação';
  const tag = payload.data?.tag || `notif-${Date.now()}`;
  
  if (!shouldShowNotification(tag)) {
    console.log('[firebase-messaging-sw.js] Duplicate notification prevented for tag:', tag);
    return;
  }

  const notificationOptions = {
    body: payload.data?.body,
    icon: '/apple-touch-icon.png',
    badge: '/badge-72.png',
    data: payload.data,
    tag: tag,
    renotify: false
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.', event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/orders';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
