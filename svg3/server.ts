import { handleRequestWithOptions as handleRequest } from "../shared/handle-request"

// Only the private container port exposes this handoff. A random token ties the
// bytes to one render; keep at most one KV-sized model for at most 60 seconds.
let lastGlb: { token: string; bytes: Uint8Array; createdAt: number } | undefined

Bun.serve({
  hostname: "0.0.0.0",
  port: Number(process.env.PORT ?? 8080),
  // Routing a large DDR board can exceed the default HTTP idle timeout.
  idleTimeout: 255,
  maxRequestBodySize: 1024 * 1024,
  async fetch(request, server) {
    server.timeout(request, 0)
    try {
      const path = new URL(request.url).pathname
      if (path.startsWith("/__glb/")) {
        const glb = lastGlb
        if (
          !glb ||
          path !== `/__glb/${glb.token}` ||
          Date.now() - glb.createdAt > 60_000
        )
          return new Response("GLB handoff expired", { status: 404 })
        lastGlb = undefined
        return new Response(glb.bytes as BodyInit, {
          headers: {
            "Content-Type": "model/gltf-binary",
            "Cache-Control": "public",
            "X-Svg-Renderer": "container",
          },
        })
      }
      const origin = request.headers.get("X-Svg-Origin")
      if (origin) {
        const url = new URL(request.url)
        request = new Request(
          new URL(url.pathname + url.search, origin),
          request,
        )
      }
      let token: string | undefined
      const response = await handleRequest(request, {
        onGlb(glb) {
          if (glb.byteLength > 24 * 1024 * 1024) return
          token = crypto.randomUUID()
          lastGlb = { token, bytes: glb, createdAt: Date.now() }
        },
      })
      if (token) response.headers.set("X-Svg-Glb-Token", token)
      return response
    } catch (error) {
      console.error("Render failed", error)
      return new Response("Render failed", {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      })
    }
  },
})
