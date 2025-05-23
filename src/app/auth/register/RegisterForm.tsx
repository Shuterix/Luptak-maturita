'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import axios from 'axios'
import { isAxiosError } from 'axios'

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
		formState: { errors },
	} = useForm<RegisterFormInputs>()

	const [errorMessage, setErrorMessage] = useState('')
	const [successMessage, setSuccessMessage] = useState('')

	const onSubmit = async (credentials: RegisterFormInputs) => {
		setErrorMessage('')
		setSuccessMessage('')

		try {
			const response = await axios.post('/api/register', credentials)

			console.log(response)

			setSuccessMessage(response.data.message)
		} catch (error: unknown) {
			console.error(error)
			setErrorMessage(isAxiosError(error) && error.response ? error.response.data.message : 'An unexpected error occurred.')
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
						})}
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
						})}
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
					{...register('password', {
						required: 'Password is required',
						minLength: {
							value: 6,
							message: 'Password must be at least 6 characters',
						},
					})}
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
					{...register('confirmedPassword', {
						required: 'Please confirm your password',
						validate: (value) =>
							value === watch('password') ||
							'Passwords do not match',
					})}
				/>
				{errors.confirmedPassword && (
					<p className="text-error text-sm mt-1">
						{errors.confirmedPassword.message}
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
					Register
				</button>
			</div>
		</form>
	)
}
