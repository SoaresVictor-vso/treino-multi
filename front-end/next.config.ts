import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	turbopack: {
		root: path.resolve(process.cwd(), '..'),
	},
	async rewrites() {
		const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
		return [{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }];
	},
};

export default nextConfig;
