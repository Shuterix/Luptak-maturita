'use client'

import { useForm } from 'react-hook-form'
import axios from 'axios'
import { isAxiosError } from 'axios'
import { showAlertToast } from '@/components/toast/Toast'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

interface RegisterFormInputs {
	firstName: string
	lastName: string
	email: string
	password: string
	confirmedPassword: string
}

export default function RegisterForm() {
	const {
		register,
		handleSubmit,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<RegisterFormInputs>()

	const router = useRouter()
	const passwordRef = useRef<HTMLInputElement | null>(null)
	const confirmPasswordRef = useRef<HTMLInputElement | null>(null)

	const passwordRegister = register('password', {
		required: 'Password is required',
		minLength: {
			value: 6,
			message: 'Password must be at least 6 characters',
		},
		validate: (value) => (!/\s/.test(value) ? true : 'Password cannot contain spaces'),
	})

	const confirmPasswordRegister = register('confirmedPassword', {
		required: 'Please confirm your password',
		validate: (value) =>
			value === watch('password') ||
			'Passwords do not match',
	})

	useEffect(() => {
		const disablePasswordManager = (el: HTMLInputElement | null) => {
			if (!el) return
			// Disable third-party password managers to avoid "compromised password" warnings
			el.setAttribute('data-form-type', 'other')
			el.setAttribute('data-1p-ignore', 'true')
			el.setAttribute('data-lpignore', 'true')
			el.setAttribute('data-bwignore', 'true')
			el.setAttribute('data-protonpass-ignore', 'true')
		}
		disablePasswordManager(passwordRef.current)
		disablePasswordManager(confirmPasswordRef.current)
	}, [])

	const onSubmit = async (credentials: RegisterFormInputs) => {
		try {
			const response = await axios.post('/api/auth/register', credentials)

			// Prefetch login page
			router.prefetch('/auth/login')
			
			// Use replace to avoid adding to history
			router.replace('/auth/login')

			// Show toast after navigation starts
			setTimeout(() => {
				showAlertToast(response.data.message, {
					variant: 'success',
					title: 'Success',
				})
			}, 100)
		} catch (error: unknown) {
			console.error(error)

			showAlertToast(
				isAxiosError(error) && error.response
					? error.response.data.message
					: 'An unexpected error occurred.',
				{
					variant: 'error',
					title: 'Error',
				},
			)
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off" data-form-type="other" noValidate>
			<div className="flex gap-2">
				<div className="form-control">
					<label className="label">
						<span className="label-text text-sm">First Name</span>
					</label>
					<input
						type="text"
						placeholder="John"
						className="input input-bordered"
						{...register('firstName', {
							required: 'First name is required',
							maxLength: { value: 64, message: 'First name is too long' },
						})}
						autoCapitalize="words"
						spellCheck={false}
					/>
					{errors.firstName && (
						<p className="text-error text-sm mt-1">
							{errors.firstName.message}
						</p>
					)}
				</div>
				<div className="form-control">
					<label className="label">
						<span className="label-text text-sm">Last Name</span>
					</label>
					<input
						type="text"
						placeholder="Doe"
						className="input input-bordered"
						{...register('lastName', {
							required: 'Last name is required',
							maxLength: { value: 64, message: 'Last name is too long' },
						})}
						autoCapitalize="words"
						spellCheck={false}
					/>
					{errors.lastName && (
						<p className="text-error text-sm mt-1">
							{errors.lastName.message}
						</p>
					)}
				</div>
			</div>
			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm">Email</span>
				</label>
				<input
					type="email"
					placeholder="email@example.com"
					className="input input-bordered"
					inputMode="email"
					autoCapitalize="none"
					spellCheck={false}
					maxLength={254}
					{...register('email', {
						required: 'Email is required',
						pattern: {
							value: /^\S+@\S+$/i,
							message: 'Enter a valid email',
						},
					})}
				/>
				{errors.email && (
					<p className="text-error text-sm mt-1">
						{errors.email.message}
					</p>
				)}
			</div>
			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm">Password</span>
				</label>
				<input
					type="password"
					placeholder="••••••••"
					className="input input-bordered"
					inputMode="text"
					autoCapitalize="none"
					autoComplete="new-password"
					spellCheck={false}
					maxLength={128}
					{...passwordRegister}
					ref={(e) => {
						passwordRegister.ref(e)
						passwordRef.current = e
					}}
				/>
				{errors.password && (
					<p className="text-error text-sm mt-1">
						{errors.password.message}
					</p>
				)}
			</div>
			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm">Confirm Password</span>
				</label>
				<input
					type="password"
					placeholder="••••••••"
					className="input input-bordered"
					inputMode="text"
					autoCapitalize="none"
					autoComplete="new-password"
					spellCheck={false}
					maxLength={128}
					{...confirmPasswordRegister}
					onPaste={(e) => {
						// Prevent accidental paste into confirm field on mobile
						e.preventDefault()
					}}
					ref={(e) => {
						confirmPasswordRegister.ref(e)
						confirmPasswordRef.current = e
					}}
				/>
				{errors.confirmedPassword && (
					<p className="text-error text-sm mt-1">
						{errors.confirmedPassword.message}
					</p>
				)}
			</div>
			<div className="form-control">
				<button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
					{isSubmitting ? (
						<span className="loading loading-spinner"></span>
					) : (
						'Create account'
					)}
				</button>
			</div>
		</form>
	)
}
