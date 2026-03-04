/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ['@supabase/supabase-js', '@supabase/ssr'],
  ...(process.env.NODE_ENV === 'development'
    ? {
        allowedDevOrigins: [
          'https://*.cloudworkstations.dev',
          'https://*.firebase.studio',
        ],
      }
    : {}),
};

module.exports = nextConfig;
