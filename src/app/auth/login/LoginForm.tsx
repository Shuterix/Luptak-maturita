'use client'

import { useForm } from 'react-hook-form'
import { useAuth } from '@/context/AuthContext'

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

	const onSubmit = async (data: LoginFormInputs) => {
		await login(data.email, data.password)
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
					{...register('password', {
						required: 'Password is required',
					})}
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
						'Login'
					)}
				</button>
			</div>
		</form>
	)
}
