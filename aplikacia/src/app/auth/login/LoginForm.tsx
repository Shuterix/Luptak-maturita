'use client'

import { useForm } from 'react-hook-form'
import { useAuth } from '@/context/AuthContext'
import { useEffect, useRef } from 'react'

interface LoginFormInputs {
	email: string
	password: string
}

export default function LoginForm() {
	const { login, isLoading } = useAuth()
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormInputs>()
	const passwordRef = useRef<HTMLInputElement | null>(null)

	const passwordRegister = register('password', {
		required: 'Password is required',
		// Disallow spaces in password to avoid mobile keyboard inserting spaces
		validate: (value) => (!/\s/.test(value) ? true : 'Password cannot contain spaces'),
	})

	useEffect(() => {
		if (passwordRef.current) {
			// Disable third-party password managers to avoid "compromised password" warnings
			passwordRef.current.setAttribute('data-form-type', 'other')
			passwordRef.current.setAttribute('data-1p-ignore', 'true')
			passwordRef.current.setAttribute('data-lpignore', 'true')
			passwordRef.current.setAttribute('data-bwignore', 'true')
			passwordRef.current.setAttribute('data-protonpass-ignore', 'true')
		}
	}, [])

	const onSubmit = async (data: LoginFormInputs) => {
		const email = data.email.trim().toLowerCase()
		await login(email, data.password)
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off" data-form-type="other" noValidate>
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
							message: 'Invalid email address',
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
					autoComplete="current-password"
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

			<div className="form-control mt-6">
				<button
					type="submit"
					className="btn btn-primary w-full"
					disabled={isLoading}
				>
					{isLoading ? (
						<span className="loading loading-spinner"></span>
					) : (
						'Sign in'
					)}
				</button>
			</div>
		</form>
	)
}
