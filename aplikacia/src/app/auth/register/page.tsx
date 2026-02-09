import Link from 'next/link'
import RegisterForm from './RegisterForm'
import { Logo } from '@/components/Logo'

export const metadata = {
	title: 'Create Account | DanceHub',
}

export default function RegisterPage() {
	return (
		<div className="flex items-center justify-center min-h-screen bg-base-200 sm:px-0 px-4">
			<div className="w-full max-w-sm p-8 space-y-4 shadow-lg bg-base-100 rounded-box">
				<div className="text-center mb-2">
					<div className="flex justify-center mb-3">
						<Logo className="h-12 w-12 text-primary" />
					</div>
					<h1 className="text-2xl font-bold">Create account</h1>
					<p className="text-sm text-base-content/60">Join DanceHub to manage your dance studio</p>
				</div>
				<RegisterForm />
				<p className="text-sm text-center text-base-content/70">
					Already have an account?{' '}
					<Link
						href="/auth/login"
						className="text-primary hover:underline font-medium"
						prefetch={true}
					>
						Sign in
					</Link>
				</p>
			</div>
		</div>
	)
}
