/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
      domains: [
        'lh3.googleusercontent.com',
        'avatars.githubusercontent.com',
        'images.unsplash.com'
      ]
    },
    typescript: {
      ignoreBuildErrors: true
    },
    eslint: {
      ignoreDuringBuilds: true
    },
    webpack(config) {
      config.module.rules.push({
        test: /\.svg$/,
        use: ['@svgr/webpack'],
      });
      return config;
    }
  }
  
  module.exports = nextConfig