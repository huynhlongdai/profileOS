/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Exclude heavy server-side dependencies from webpack bundling
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('playwright')
    }
    return config
  },
  // Vercel serverless function config
  experimental: {
    serverComponentsExternalPackages: ['playwright'],
  },
}

module.exports = nextConfig
