import {
  cacheKey,
  cachedResponse,
  FRESH_SECONDS,
  markResponse,
  readImage,
  wantsRefresh,
  type ImageStore,
  MAX_REQUEST_BYTES,
} from "./cache"

export interface RefreshJob {
  url: string
  version: string
}
export interface ServiceEnv {
  IMAGES: ImageStore
  CACHE_VERSION: string
  REFRESH_QUEUE: { send(job: RefreshJob): Promise<void> }
}
export interface BackgroundContext {
  waitUntil(promise: Promise<unknown>): void
}

export async function serve(
  request: Request,
  env: ServiceEnv,
  ctx: BackgroundContext,
  render: (request: Request) => Promise<Response>,
): Promise<Response> {
  if (request.method === "POST" && request.body) {
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel()
        return new Response("Request body exceeds 1 MiB", {
          status: 413,
          headers: { "Cache-Control": "no-store" },
        })
      }
      chunks.push(value)
    }
    const body = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.length
    }
    request = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body,
    })
  }
  if (new URL(request.url).pathname === "/health") {
    return Response.json(
      { ok: true, service: "svg3", cacheVersion: env.CACHE_VERSION },
      { headers: { "Cache-Control": "no-store" } },
    )
  }
  const key = await cacheKey(request, env.CACHE_VERSION)
  let entry = null
  if (key) {
    try {
      entry = await readImage(env.IMAGES, key)
    } catch (error) {
      console.error("KV image read failed", error)
    }
  }
  if (entry) {
    const fresh = Date.now() - entry.metadata.createdAt < FRESH_SECONDS * 1000
    if (fresh && !wantsRefresh(request))
      return cachedResponse(entry, request, "HIT")
    if (!wantsRefresh(request) && request.method !== "POST") {
      // Queue consumers can run for 15 minutes; waitUntil cannot keep a long
      // renderer alive after the stale HTTP response has been sent.
      ctx.waitUntil(
        env.REFRESH_QUEUE.send({
          url: request.url,
          version: env.CACHE_VERSION,
        }).catch((error) =>
          console.error("Could not enqueue image refresh", error),
        ),
      )
      return cachedResponse(entry, request, "STALE")
    }
  }
  try {
    const upstreamRequest =
      request.method === "HEAD"
        ? new Request(request, { method: "GET" })
        : request
    const response = await render(upstreamRequest)
    if (entry && response.status >= 500) {
      await response.body?.cancel()
      return cachedResponse(entry, request, "STALE-ERROR")
    }
    await entry?.value.cancel()
    if (request.method === "HEAD") {
      await response.body?.cancel()
      return new Response(null, {
        status: response.status,
        headers: response.headers,
      })
    }
    return request.method === "POST"
      ? markResponse(response, response.headers.get("X-Svg-Cache") ?? "BYPASS")
      : response
  } catch (error) {
    console.error("Renderer unavailable", error)
    if (entry) return cachedResponse(entry, request, "STALE-ERROR")
    return new Response("Renderer unavailable", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    })
  }
}
