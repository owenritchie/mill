import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": ["src-tauri/**/*"],
  },
};

export default nextConfig;
