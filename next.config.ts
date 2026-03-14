import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // allows local data: URLs from FileReader previews
  },
};

export default nextConfig;
