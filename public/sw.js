// Trailhead OS service worker — push handling ONLY (brief 17).
// Deliberately no fetch/caching interception: adding it risks breaking the app's
// data fetches in subtle ways. Push + notification click, nothing else.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Trailhead OS'
  const options = {
    body: data.body || '',
    icon: data.icon || '/logo-icon.svg',
    data: { url: data.url || '/' },
    tag: data.tag, // same tag collapses rapid notifications into one
    renotify: !!data.renotify,
  }
  if (data.badge) options.badge = data.badge

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Reuse an existing app window if one is open — never spawn duplicates.
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) {
            try { client.navigate(url) } catch { /* cross-origin/navigation guard */ }
          }
          return undefined
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
