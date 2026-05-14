/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin", "rss-parser"],
    optimizePackageImports: ["klinecharts", "firebase"],
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: '/favicon.svg',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}
export default nextConfig
