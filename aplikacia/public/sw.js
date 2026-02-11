// Service Worker for Push Notifications
// This runs in the browser's background thread

self.addEventListener('install', (event) => {
	self.skipWaiting()
})

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
	if (!event.data) return

	let data
	try {
		data = event.data.json()
	} catch {
		data = {
			title: 'DanceHub',
			body: event.data.text(),
			icon: '/icon.svg',
		}
	}

	const options = {
		body: data.body || 'You have a notification',
		icon: data.icon || '/icon.svg',
		badge: data.badge || '/icon.svg',
		tag: data.tag || 'dancehub-notification',
		data: {
			url: data.url || '/dashboard',
		},
		actions: data.actions || [],
		vibrate: [100, 50, 100],
		requireInteraction: data.requireInteraction || false,
	}

	event.waitUntil(
		self.registration.showNotification(data.title || 'DanceHub', options)
	)
})

self.addEventListener('notificationclick', (event) => {
	event.notification.close()

	const url = event.notification.data?.url || '/dashboard'

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			// Try to focus an existing window
			for (const client of clients) {
				if (client.url.includes(self.location.origin) && 'focus' in client) {
					client.navigate(url)
					return client.focus()
				}
			}
			// Open a new window if none exists
			if (self.clients.openWindow) {
				return self.clients.openWindow(url)
			}
		})
	)
})

