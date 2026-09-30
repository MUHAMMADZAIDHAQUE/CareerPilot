/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    let backendInternal =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.BACKEND_URL ||
      'https://careerpilot-backend-fk3o.onrender.com';

    backendInternal = backendInternal
      .trim()
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/api\/?$/, '')
      .replace(/\/+$/, '');

    if (!backendInternal.startsWith('http')) {
      backendInternal = 'https://careerpilot-backend-fk3o.onrender.com';
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
