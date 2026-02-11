'use client'

import { useState, useEffect, useCallback } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
	const rawData = window.atob(base64)
	const outputArray = new Uint8Array(rawData.length)
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i)
	}
	return outputArray
}

export function usePushNotifications() {
	const [isSupported, setIsSupported] = useState(false)
	const [isSubscribed, setIsSubscribed] = useState(false)
	const [permission, setPermission] = useState<NotificationPermission>('default')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (typeof window === 'undefined') return

		const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
		setIsSupported(supported)

		if (supported) {
			setPermission(Notification.permission)
			checkExistingSubscription()
		}
	}, [])

	const checkExistingSubscription = async () => {
		try {
			const registration = await navigator.serviceWorker.getRegistration('/sw.js')
			if (registration) {
				const subscription = await registration.pushManager.getSubscription()
				setIsSubscribed(!!subscription)
			}
		} catch {
			// Silently handle
		}
	}

	const registerServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
		const registration = await navigator.serviceWorker.register('/sw.js')
		// Wait for it to be ready
		await navigator.serviceWorker.ready
		return registration
	}

	const subscribe = useCallback(async () => {
		if (!isSupported || !VAPID_PUBLIC_KEY) {
			setError('Push notifications are not supported or VAPID key is missing')
			return false
		}

		setLoading(true)
		setError(null)

		try {
			// Request permission
			const perm = await Notification.requestPermission()
			setPermission(perm)

			if (perm !== 'granted') {
				setError('Notification permission was denied')
				setLoading(false)
				return false
			}

			// Register service worker
			const registration = await registerServiceWorker()

			// Subscribe to push
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
			})

			// Send subscription to server
			const res = await fetch('/api/notifications/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ subscription: subscription.toJSON() }),
			})

			if (!res.ok) {
				throw new Error('Failed to save subscription on server')
			}

			setIsSubscribed(true)
			setLoading(false)
			return true
		} catch (err: any) {
			console.error('Error subscribing to push:', err)
			setError(err.message || 'Failed to subscribe')
			setLoading(false)
			return false
		}
	}, [isSupported])

	const unsubscribe = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			const registration = await navigator.serviceWorker.getRegistration('/sw.js')
			if (registration) {
				const subscription = await registration.pushManager.getSubscription()
				if (subscription) {
					// Remove from server
					await fetch('/api/notifications/subscribe', {
						method: 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ endpoint: subscription.endpoint }),
					})

					// Unsubscribe locally
					await subscription.unsubscribe()
				}
			}

			setIsSubscribed(false)
			setLoading(false)
			return true
		} catch (err: any) {
			console.error('Error unsubscribing:', err)
			setError(err.message || 'Failed to unsubscribe')
			setLoading(false)
			return false
		}
	}, [])

	return {
		isSupported,
		isSubscribed,
		permission,
		loading,
		error,
		subscribe,
		unsubscribe,
	}
}

