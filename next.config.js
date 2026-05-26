/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server Actions are enabled by default in Next.js 14+
  // Exclude Playwright from webpack bundling (server-side only)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('playwright')
    }
    return config
  },
}

module.exports = nextConfig

