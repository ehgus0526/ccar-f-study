import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
  experimental: { serverActions: { bodySizeLimit: "512kb" } },
};

export default nextConfig;
