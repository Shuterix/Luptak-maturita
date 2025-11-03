import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label?: string
	error?: string
	helperText?: string
	className?: string
}

export default function Input({ 
	label, 
	error, 
	helperText, 
	className = '', 
	...props 
}: InputProps) {
	return (
		<div className="form-control w-full">
			{label && (
				<label className="label">
					<span className="label-text">{label}</span>
				</label>
			)}
			<input 
				{...props} 
				className={`input input-bordered w-full ${error ? 'input-error' : ''} ${className}`}
			/>
			{error && (
				<label className="label">
					<span className="label-text-alt text-error">{error}</span>
				</label>
			)}
			{helperText && !error && (
				<label className="label">
					<span className="label-text-alt">{helperText}</span>
				</label>
			)}
		</div>
	)
}
