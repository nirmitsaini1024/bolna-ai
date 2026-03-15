import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "platform.bolna.ai",
      },
      {
        protocol: "https",
        hostname: "www.bolna.ai",
      },
    ],
  },
};

export default nextConfig;
