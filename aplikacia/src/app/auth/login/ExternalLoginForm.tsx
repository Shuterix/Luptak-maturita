'use client'

import { useState, useRef, useEffect } from 'react'
import { showAlertToast } from '@/components/toast/Toast'

export default function ExternalLoginForm() {
	const [code, setCode] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		inputRef.current?.focus()
	}, [])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		const trimmedCode = code.trim().toUpperCase()
		if (!trimmedCode) {
			setError('Please enter your login code')
			return
		}

		setIsLoading(true)
		try {
			const res = await fetch('/api/auth/external-login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: trimmedCode }),
			})

			const data = await res.json()

			if (!res.ok) {
				setError(data.error || 'Login failed')
				return
			}

			showAlertToast('Logged in successfully!', { variant: 'success' })
			// Redirect to the external teacher dashboard
			window.location.replace('/dashboard/my-lessons')
		} catch (err: any) {
			console.error('External login error:', err)
			setError('Something went wrong. Please try again.')
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm">Login Code</span>
				</label>
				<input
					ref={inputRef}
					type="text"
					placeholder="Enter your code (e.g. A1B2C3)"
					className="input input-bordered"
					value={code}
					onChange={(e) => {
						setCode(e.target.value.toUpperCase())
						setError(null)
					}}
					maxLength={10}
					autoCapitalize="characters"
					spellCheck={false}
					autoComplete="off"
				/>
				{error && (
					<p className="text-error text-sm mt-1">{error}</p>
				)}
			</div>

			<div className="form-control mt-6">
				<button
					type="submit"
					className="btn btn-warning w-full"
					disabled={isLoading}
				>
					{isLoading ? (
						<span className="loading loading-spinner"></span>
					) : (
						'Sign in with code'
					)}
				</button>
			</div>

			<p className="text-xs text-center text-base-content/50 mt-2">
				Your trainer will give you a unique code to access your lessons.
			</p>
		</form>
	)
}

