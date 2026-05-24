import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ESLint config (eslint-config-next flat config import) is broken in this env.
    // TypeScript type checking still runs. Fix ESLint separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
