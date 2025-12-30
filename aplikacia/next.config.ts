import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	// Ignore ESLint errors during build (for faster deployment)
	eslint: {
		ignoreDuringBuilds: true,
	},
	// Ignore TypeScript errors during build
	typescript: {
		ignoreBuildErrors: true,
	},
}

export default nextConfig
