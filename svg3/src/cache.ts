// This module uses only Web APIs so the cache policy is testable outside Workers.
export const FRESH_SECONDS = 12 * 60 * 60
export const RETENTION_SECONDS = 30 * 24 * 60 * 60
export const MAX_CACHE_BYTES = 24 * 1024 * 1024 // KV values must be <25 MiB.
export const MAX_REQUEST_BYTES = 1024 * 1024

export interface Metadata {
  createdAt: number
  contentType: string
  etag: string
}

export interface ImageStore {
  getWithMetadata<T>(
    key: string,
    options: { type: "stream"; cacheTtl: number },
  ): Promise<{
    value: ReadableStream<Uint8Array> | null
    metadata: T | null
  }>
  put(
    key: string,
    value: ArrayBuffer,
    options: { metadata: Metadata; expirationTtl: number },
  ): Promise<void>
}

export async function digest(bytes: BufferSource): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("")
}

export function wantsRefresh(request: Request): boolean {
  return (
    /(?:no-cache|max-age=0)/i.test(
      request.headers.get("Cache-Control") ?? "",
    ) || /no-cache/i.test(request.headers.get("Pragma") ?? "")
  )
}

export async function cacheKey(
  request: Request,
  version: string,
): Promise<string | null> {
  const url = new URL(request.url)
  // Cache only rendering routes. Never cache debug pages, errors, or credentials.
  if (
    !["GET", "HEAD", "POST"].includes(request.method) ||
    !["/", "/api", "/api/"].includes(url.pathname) ||
    url.searchParams.has("debug") ||
    request.headers.has("Authorization") ||
    request.headers.has("Cookie")
  )
    return null
  url.searchParams.sort() // Stable sort preserves the meaning of duplicate keys.
  const method = request.method === "HEAD" ? "GET" : request.method
  const body =
    method === "POST" ? await request.clone().arrayBuffer() : new ArrayBuffer(0)
  if (body.byteLength > MAX_REQUEST_BYTES) return null
  const input = JSON.stringify([
    version,
    method,
    url.searchParams.toString(),
    await digest(body),
  ])
  return `image:${version}:${await digest(new TextEncoder().encode(input))}`
}

export async function readImage(store: ImageStore, key: string) {
  const entry = await store.getWithMetadata<Metadata>(key, {
    type: "stream",
    cacheTtl: 60,
  })
  if (
    !entry.value ||
    !entry.metadata ||
    Date.now() - entry.metadata.createdAt >= RETENTION_SECONDS * 1000
  ) {
    await entry.value?.cancel()
    return null
  }
  return entry as { value: ReadableStream<Uint8Array>; metadata: Metadata }
}

export function cachedResponse(
  entry: { value: ReadableStream<Uint8Array>; metadata: Metadata },
  request: Request,
  state: string,
): Response {
  const age = Math.max(
    0,
    Math.floor((Date.now() - entry.metadata.createdAt) / 1000),
  )
  const headers = new Headers({
    "Content-Type": entry.metadata.contentType,
    "Cache-Control":
      request.method === "POST" ? "no-store" : "public, max-age=300",
    // The Worker owns revalidation; don't put another stale cache in front of it.
    "CDN-Cache-Control": "no-store",
    ETag: entry.metadata.etag,
    Age: String(age),
    "X-Svg-Cache": state,
  })
  if (state.includes("STALE"))
    headers.set("Warning", '110 - "Response is stale"')
  const notModified =
    request.method !== "POST" &&
    request.headers
      .get("If-None-Match")
      ?.split(",")
      .some(
        (tag) =>
          tag.trim().replace(/^W\//, "") === entry.metadata.etag ||
          tag.trim() === "*",
      )
  if (request.method === "HEAD" || notModified) {
    void entry.value.cancel()
    return new Response(null, { status: notModified ? 304 : 200, headers })
  }
  return new Response(entry.value, { headers })
}

export function markResponse(response: Response, state: string): Response {
  const headers = new Headers(response.headers)
  headers.set("X-Svg-Cache", state)
  headers.set("Cache-Control", "no-store")
  headers.set("CDN-Cache-Control", "no-store")
  return new Response(response.body, { status: response.status, headers })
}

// Read at most the KV limit. On overflow, return the prefix plus the rest as a
// stream rather than buffering a potentially huge diagram in the Worker.
export async function storeImage(
  store: ImageStore,
  key: string,
  response: Response,
): Promise<Response> {
  const contentType = response.headers.get("Content-Type") ?? ""
  if (
    response.status !== 200 ||
    !/^(image\/svg\+xml|image\/png)(;|$)/i.test(contentType) ||
    response.headers.has("Set-Cookie") ||
    /no-store|private/i.test(response.headers.get("Cache-Control") ?? "") ||
    !response.body
  ) {
    return markResponse(response, "BYPASS")
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    length += value.byteLength
    if (length > MAX_CACHE_BYTES) {
      let index = 0
      return markResponse(
        new Response(
          new ReadableStream<Uint8Array>({
            async pull(controller) {
              if (index < chunks.length) {
                controller.enqueue(chunks[index++])
                return
              }
              const next = await reader.read()
              if (next.done) controller.close()
              else controller.enqueue(next.value)
            },
            cancel(reason) {
              return reader.cancel(reason)
            },
          }),
          { headers: response.headers },
        ),
        "BYPASS-SIZE",
      )
    }
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  const metadata: Metadata = {
    createdAt: Date.now(),
    contentType,
    etag: `"${await digest(bytes)}"`,
  }
  try {
    await store.put(key, bytes.buffer, {
      metadata,
      expirationTtl: RETENTION_SECONDS,
    })
  } catch (error) {
    console.error("KV image write failed", error)
    return markResponse(
      new Response(bytes, { headers: response.headers }),
      "BYPASS-KV",
    )
  }
  return cachedResponse(
    { value: new Response(bytes).body!, metadata },
    new Request("https://cache/"),
    "MISS",
  )
}
