self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Order Tracker', {
      body: data.body || '',
      icon: '/vite.svg',
      badge: '/vite.svg',
      vibrate: [200, 100, 200],
      data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
