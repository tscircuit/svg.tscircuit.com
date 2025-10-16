/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      fallback: [
        // Allow Next.js to serve its own assets (JS chunks, fonts, etc.)
        {
          source: "/_next/:path*",
          destination: "/_next/:path*",
        },
        // Allow any static assets placed in the public folder (e.g. fonts)
        {
          source: "/:static(fonts|images|static)/:path*",
          destination: "/:static/:path*",
        },
        {
          source: "/favicon.ico",
          destination: "/favicon.ico",
        },
        {
          source: "/robots.txt",
          destination: "/robots.txt",
        },
        {
          source: "/sitemap.xml",
          destination: "/sitemap.xml",
        },
        // Fallback all other requests to the API handler
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
