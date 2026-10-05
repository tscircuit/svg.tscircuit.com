import { Container, getContainer } from "@cloudflare/containers"
import {
  cacheKey,
  cachedResponse,
  FRESH_SECONDS,
  markResponse,
  readImage,
  storeImage,
  wantsRefresh,
  type Metadata,
} from "./cache"
import { serve, type RefreshJob } from "./service"

interface Env {
  IMAGES: KVNamespace
  RENDERER: DurableObjectNamespace<Renderer>
  REFRESH_QUEUE: Queue<RefreshJob>
  CACHE_VERSION: string
}

// Use a bounded pool, not a new VM per image URL. Each VM renders one circuit at
// a time so concurrent routing jobs cannot exhaust its memory.
const POOL_SIZE = 4
export class Renderer extends Container<Env> {
  defaultPort = 8080
  sleepAfter = "10m"
  private tail: Promise<void> = Promise.resolve()
  private pending = 0
  private lastStored?: { key: string; bytes: ArrayBuffer; metadata: Metadata }

  override async fetch(request: Request): Promise<Response> {
    if (this.pending >= 8)
      return new Response("Renderer busy", {
        status: 503,
        headers: { "Retry-After": "10", "Cache-Control": "no-store" },
      })
    this.pending++
    const previous = this.tail
    let release!: () => void
    this.tail = new Promise<void>((resolve) => {
      release = resolve
    })
    try {
      await previous
      const key = await cacheKey(request, this.env.CACHE_VERSION)
      if (key) {
        // Also covers KV's eventual consistency and its one-write/second/key
        // limit when concurrent clients or duplicate queue messages arrive.
        const local = this.lastStored
        if (
          local?.key === key &&
          Date.now() - local.metadata.createdAt < 60_000
        ) {
          return cachedResponse(
            {
              value: new Response(local.bytes).body!,
              metadata: local.metadata,
            },
            request,
            "HIT",
          )
        }
        try {
          const entry = await readImage(this.env.IMAGES, key)
          if (
            entry &&
            !wantsRefresh(request) &&
            Date.now() - entry.metadata.createdAt < FRESH_SECONDS * 1000
          ) {
            return cachedResponse(entry, request, "HIT")
          }
          await entry?.value.cancel()
        } catch (error) {
          console.error("Renderer KV read failed", error)
        }
      }
      // Keep cached client validators away from the actual renderer.
      const headers = new Headers(request.headers)
      headers.delete("If-None-Match")
      headers.delete("If-Modified-Since")
      const response = await super.fetch(new Request(request, { headers }))
      if (!key) return markResponse(response, "BYPASS")
      this.lastStored = undefined
      return await storeImage(
        {
          getWithMetadata: this.env.IMAGES.getWithMetadata.bind(
            this.env.IMAGES,
          ),
          put: async (cacheKey, bytes, options) => {
            await this.env.IMAGES.put(cacheKey, bytes, options)
            this.lastStored = {
              key: cacheKey,
              bytes,
              metadata: options.metadata,
            }
          },
        },
        key,
        response,
      )
    } finally {
      this.pending--
      release()
    }
  }
}

async function render(request: Request, env: Env): Promise<Response> {
  const key = await cacheKey(request, env.CACHE_VERSION)
  const slot = key
    ? Number.parseInt(key.slice(-8), 16) % POOL_SIZE
    : Math.floor(Math.random() * POOL_SIZE)
  return getContainer(env.RENDERER, `renderer-${slot}`).fetch(request)
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return serve(request, env, ctx, (req) => render(req, env))
  },
  async queue(batch: MessageBatch<RefreshJob>, env: Env) {
    for (const message of batch.messages) {
      // Do not let queued work from an old release populate a new cache version.
      if (message.body.version !== env.CACHE_VERSION) {
        message.ack()
        continue
      }
      try {
        const response = await render(new Request(message.body.url), env)
        await response.body?.cancel()
        if (
          response.status >= 500 ||
          response.headers.get("X-Svg-Cache") === "BYPASS-KV"
        ) {
          message.retry({ delaySeconds: 60 })
        } else message.ack()
      } catch (error) {
        console.error("Image refresh failed", error)
        message.retry({ delaySeconds: 60 })
      }
    }
  },
} satisfies ExportedHandler<Env, RefreshJob>
