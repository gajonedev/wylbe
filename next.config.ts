import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Force single instance of konva/react-konva to avoid duplicate warnings
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      konva: path.resolve(process.cwd(), "node_modules/konva"),
      "react-konva": path.resolve(process.cwd(), "node_modules/react-konva"),
    };
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
