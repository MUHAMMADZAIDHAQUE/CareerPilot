/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    let backendInternal =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://127.0.0.1:8000';

    backendInternal = backendInternal
      .trim()
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/api\/?$/, '')
      .replace(/\/+$/, '');

    if (!backendInternal.startsWith('http')) {
      backendInternal = 'http://127.0.0.1:8000';
    }

    return [
      {
        source: '/api/:path*',
        destination: `${backendInternal}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
