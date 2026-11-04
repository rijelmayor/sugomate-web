import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Product photos are validated at 5 MiB in the server action. Allow a small
  // amount of multipart/form-data overhead so camera uploads reach that check.
  serverActions: {
    bodySizeLimit: "6mb",
  },
};

export default nextConfig;
