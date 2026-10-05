import { handleRequest } from "../shared/handle-request"

Bun.serve({
  hostname: "0.0.0.0",
  port: Number(process.env.PORT ?? 8080),
  // Routing a large DDR board can exceed the default HTTP idle timeout.
  idleTimeout: 255,
  maxRequestBodySize: 1024 * 1024,
  async fetch(request, server) {
    server.timeout(request, 0)
    try {
      const origin = request.headers.get("X-Svg-Origin")
      if (origin) {
        const url = new URL(request.url)
        request = new Request(
          new URL(url.pathname + url.search, origin),
          request,
        )
      }
      return await handleRequest(request)
    } catch (error) {
      console.error("Render failed", error)
      return new Response("Render failed", {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      })
    }
  },
})
