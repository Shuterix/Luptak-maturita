import Head from 'next/head'
import Link from 'next/link'
import RegisterForm from './RegisterForm'

export default async function RegisterPage() {
	return (
		<>
			<Head>
				<title>Register</title>
			</Head>
			<div className="flex items-center justify-center min-h-screen bg-base-200 sm:px-0 px-4">
				<div className="w-full max-w-sm p-8 space-y-4 shadow-lg bg-base-100 rounded-box">
					<h2 className="text-2xl font-bold text-center">Register</h2>
					<RegisterForm />
					<p className="text-sm text-center">
						Already have an account?{' '}
						<Link
							href="/auth/login"
							className="text-primary hover:underline"
							prefetch={true}
						>
							Login
						</Link>
					</p>
				</div>
			</div>
		</>
	)
}
