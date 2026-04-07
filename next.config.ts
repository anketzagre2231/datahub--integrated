import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["express", "swagger-ui-express", "swagger-jsdoc"],
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
        return [
        {
            source: '/api/backend/:path*',
            destination: 'http://localhost:5000/:path*', // Proxy to Backend
        },
        ];
    }
    return [];
  },
};

export default nextConfig;
