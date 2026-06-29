/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@tscircuit/ti-parts-engine"],
  experimental: {
    outputFileTracingIncludes: {
      "/api/*": ["node_modules/manifold-3d/**/*"],
    },
  },
  rewrites() {
    return {
      fallback: [
        {
          source: "/",
          destination: "/api",
        },
        {
          source: "/:path*",
          destination: "/api/:path*",
        },
      ],
    }
  },
}

export default nextConfig
