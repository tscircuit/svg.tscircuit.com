/** @type {import('next').NextConfig} */
const nextConfig = {
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
  webpack: (config, { isServer }) => {
    // Fix for ESM directory imports
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts", ".tsx"],
    }

    // Ensure proper resolution of @jscad/modeling
    config.resolve.mainFields = ["module", "main"]

    return config
  },
  // Transpile packages that have ESM issues
  transpilePackages: ["circuit-json-to-gltf", "@jscad/modeling"],
}

export default nextConfig
