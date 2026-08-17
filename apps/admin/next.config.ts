import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/admin",
  output: "export",
  outputFileTracingRoot: process.cwd(),
  trailingSlash: true,
  typedRoutes: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
