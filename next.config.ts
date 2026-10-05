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
  env: {
    // Different for every build. The app throws away its persisted query cache when this
    // changes, so data saved by an older version never reaches newer code.
    NEXT_PUBLIC_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || String(Date.now()),
  },
};

export default nextConfig;
