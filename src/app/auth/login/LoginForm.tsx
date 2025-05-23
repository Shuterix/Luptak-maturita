'use client'

import { useForm } from 'react-hook-form'
import { useState } from 'react'
import axios from 'axios'
import { isAxiosError } from 'axios'
import { useRouter } from 'next/navigation'

interface LoginFormInputs {
	email: string
	password: string
}

export default function LoginForm() {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormInputs>()

	const router = useRouter()

	const [errorMessage, setErrorMessage] = useState('')
	const [successMessage, setSuccessMessage] = useState('')

	const onSubmit = async (credentials: LoginFormInputs) => {
		try {
			const response = await axios.post('/api/login', credentials)

			setSuccessMessage(response.data.message)

			setTimeout(() => {
				router.push('/dashboard')
			}, 500)
		} catch (error: unknown) {
			console.error(error)
			setErrorMessage(isAxiosError(error) && error.response ? error.response.data.message : 'An unexpected error occurred.')
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<div className="form-control">
				<label className="label">
					<span className="label-text text-sm">Email</span>
				</label>
				<input
					type="email"
					placeholder="email@example.com"
					className="input input-bordered"
					{...register('email', {
						required: true,
						pattern: {
							value: /^\S+@\S+$/i,
							message: 'Invalid email address',
						},
					})}
				/>
				{errors.email && (
					<p className="text-error text-sm">{errors.email.message}</p>
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
					{...register('password', {
						required: 'Password is required.',
					})}
				/>
				{errors.password && (
					<p className="text-error text-sm">
						{errors.password.message}
					</p>
				)}
			</div>
			<div className="form-control">
				{errorMessage && (
					<p className="text-error text-center justify-center text-sm mt-1 mb-4">
						{errorMessage}
					</p>
				)}
				{successMessage && (
					<p className="text-success text-center justify-center text-sm mt-1 mb-4">
						{successMessage}
					</p>
				)}
				<button type="submit" className="btn btn-primary w-full">
					Login
				</button>
			</div>
		</form>
	)
}
