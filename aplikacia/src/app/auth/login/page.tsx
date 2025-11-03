import Head from 'next/head'
import Link from 'next/link'
import LoginForm from './LoginForm'

export default function LoginPage() {
	return (
		<>
			<Head>
				<title>Login</title>
			</Head>
			<div className="flex items-center justify-center min-h-screen bg-base-200 sm:px-0 px-4">
				<div className="w-full max-w-sm p-8 space-y-4 shadow-lg bg-base-100 rounded-box">
					<h2 className="text-2xl font-bold text-center">Login</h2>
					<LoginForm />
					<p className="text-sm text-center">
						Don&apos;t have an account?{' '}
						<Link
							href="/auth/register"
							className="text-primary hover:underline"
							prefetch={true}
						>
							Register
						</Link>
					</p>
				</div>
			</div>
		</>
	)
}
