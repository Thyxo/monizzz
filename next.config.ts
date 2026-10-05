import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // The dev badge sits on top of the bottom tab bar.
  devIndicators: false,
};

export default nextConfig;
