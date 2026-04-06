/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: false,
      ...(isServer ? {} : { buffer: require.resolve("buffer/") }),
    };
    if (!isServer) {
      const { ProvidePlugin } = require("webpack");
      config.plugins.push(
        new ProvidePlugin({ Buffer: ["buffer", "Buffer"] })
      );
    }
    return config;
  },
};

module.exports = nextConfig;
