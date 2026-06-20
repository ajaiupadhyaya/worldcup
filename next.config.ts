import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root — there are stray lockfiles in parent directories.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // Remote crests/logos from the data providers.
    remotePatterns: [
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "media.api-sports.io" },
    ],
  },
};

export default nextConfig;
