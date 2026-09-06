self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : { title: '新預約通知', body: '您有一筆新預約！' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './favicon.ico'
    })
  );
});
