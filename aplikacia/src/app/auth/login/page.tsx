import Link from 'next/link'
import LoginForm from './LoginForm'
import { Logo } from '@/components/Logo'

export const metadata = {
	title: 'Sign In | DanceHub',
}

export default function LoginPage() {
	return (
		<div className="flex items-center justify-center min-h-screen bg-base-200 sm:px-0 px-4">
			<div className="w-full max-w-sm p-8 space-y-4 shadow-lg bg-base-100 rounded-box">
				<div className="text-center mb-2">
					<div className="flex justify-center mb-3">
						<Logo className="h-12 w-12 text-primary" />
					</div>
					<h1 className="text-2xl font-bold">Welcome back</h1>
					<p className="text-sm text-base-content/60">Sign in to your DanceHub account</p>
				</div>
				<LoginForm />
				<p className="text-sm text-center text-base-content/70">
					Don&apos;t have an account?{' '}
					<Link
						href="/auth/register"
						className="text-primary hover:underline font-medium"
						prefetch={true}
					>
						Create account
					</Link>
				</p>
			</div>
		</div>
	)
}
