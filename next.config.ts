import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // The picker compresses product photos to <= 4.5 MiB WebP.
      // Leave multipart/form-data overhead while keeping the request bounded.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
