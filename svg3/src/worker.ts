import { renderWorkerFirst } from "./worker-first"
import { Container, getContainer } from "@cloudflare/containers"
import {
  cachedResponse,
  FRESH_SECONDS,
  markResponse,
  readImage,
  storeImage,
  wantsRefresh,
  type Metadata,
} from "./cache"
import { assetCacheKey as cacheKey, modelCacheKey } from "./model-cache"
import { serve, type RefreshJob } from "./service"

interface Env {
  IMAGE_RENDERER: Fetcher
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
  private lastModel?: { key: string; bytes: ArrayBuffer; metadata: Metadata }

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
        const local = key.startsWith("glb:") ? this.lastModel : this.lastStored
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
      const modelKey =
        key && !key.startsWith("glb:")
          ? await modelCacheKey(request, this.env.CACHE_VERSION)
          : null
      // Keep cached client validators away from the actual renderer.
      const headers = new Headers(request.headers)
      headers.delete("If-None-Match")
      headers.delete("If-Modified-Since")
      // The SDK uses HTTP inside the VM. Preserve the public HTTPS origin for
      // generated URLs, overwriting any client-supplied forwarding header.
      headers.set("X-Svg-Origin", new URL(request.url).origin)
      const response = await renderWorkerFirst(
        new Request(request, { headers }),
        this.env.IMAGE_RENDERER,
        (req) => super.fetch(req),
      )
      const token = response.headers.get("X-Svg-Glb-Token")
      response.headers.delete("X-Svg-Glb-Token")
      // The container retains the exact GLB it already converted for this
      // render. Retrieve those bytes, rather than evaluating/converting again.
      if (token && modelKey && response.status === 200) {
        try {
          const model = await super.fetch(
            new Request(`http://container/__glb/${token}`),
          )
          const existing = await readImage(this.env.IMAGES, modelKey)
          const fresh =
            existing &&
            Date.now() - existing.metadata.createdAt < FRESH_SECONDS * 1000
          await existing?.value.cancel()
          if (
            fresh ||
            (this.lastModel?.key === modelKey &&
              Date.now() - this.lastModel.metadata.createdAt < 60_000)
          ) {
            await model.body?.cancel()
          } else {
            const stored = await storeImage(
              {
                getWithMetadata: this.env.IMAGES.getWithMetadata.bind(
                  this.env.IMAGES,
                ),
                put: async (modelKey, bytes, options) => {
                  await this.env.IMAGES.put(modelKey, bytes, options)
                  this.lastModel = {
                    key: modelKey,
                    bytes,
                    metadata: options.metadata,
                  }
                },
              },
              modelKey,
              model,
            )
            await stored.body?.cancel()
          }
        } catch (error) {
          console.error("GLB cache write failed", error)
        }
      }
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
            if (cacheKey.startsWith("glb:")) this.lastModel = this.lastStored
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
  // Images and GLB downloads for a circuit share a serialized lane, including
  // different cameras, to avoid races during the PNG-to-GLB cache handoff.
  const key =
    (await modelCacheKey(request, env.CACHE_VERSION)) ??
    (await cacheKey(request, env.CACHE_VERSION))
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
