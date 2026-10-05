import { describe, expect, test } from "bun:test"
import {
  cacheKey,
  FRESH_SECONDS,
  MAX_CACHE_BYTES,
  RETENTION_SECONDS,
  storeImage,
  type ImageStore,
  type Metadata,
} from "../src/cache"
import { serve, type RefreshJob } from "../src/service"

class MemoryStore implements ImageStore {
  values = new Map<string, { bytes: ArrayBuffer; metadata: Metadata }>()
  writes = 0
  failReads = false
  failWrites = false
  async getWithMetadata<T>(key: string) {
    if (this.failReads) throw new Error("offline")
    const entry = this.values.get(key)
    return {
      value: entry ? new Response(entry.bytes).body : null,
      metadata: (entry?.metadata ?? null) as T | null,
    }
  }
  async put(
    key: string,
    bytes: ArrayBuffer,
    options: { metadata: Metadata; expirationTtl: number },
  ) {
    if (this.failWrites) throw new Error("offline")
    expect(options.expirationTtl).toBe(RETENTION_SECONDS)
    this.writes++
    this.values.set(key, { bytes, metadata: options.metadata })
  }
}
const image = (body = "<svg>Ω µ π</svg>") =>
  new Response(body, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public" },
  })
const url = "https://svg3.tscircuit.com/?code=abc&svg_type=pcb"
function harness() {
  const store = new MemoryStore()
  const jobs: RefreshJob[] = []
  const background: Promise<unknown>[] = []
  const env = {
    IMAGES: store,
    CACHE_VERSION: "v1",
    REFRESH_QUEUE: {
      async send(job: RefreshJob) {
        jobs.push(job)
      },
    },
  }
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
      background.push(promise)
    },
  }
  let renders = 0
  const run = (
    request = new Request(url),
    renderer?: (req: Request) => Promise<Response>,
  ) =>
    serve(
      request,
      env,
      ctx,
      renderer ??
        (async (req) => {
          renders++
          return storeImage(store, (await cacheKey(req, "v1"))!, image())
        }),
    )
  const age = (seconds: number) => {
    for (const entry of store.values.values())
      entry.metadata.createdAt -= seconds * 1000
  }
  return { store, jobs, background, env, run, age, renders: () => renders }
}

describe("KV render keys", () => {
  test("normalizes query order, host, API alias, and HEAD", async () => {
    const key = await cacheKey(new Request(url), "v1")
    expect(
      await cacheKey(
        new Request("https://svg2.tscircuit.com/api?svg_type=pcb&code=abc", {
          method: "HEAD",
        }),
        "v1",
      ),
    ).toBe(key)
  })
  test("includes all render options, method, body, duplicate ordering, and version", async () => {
    const key = await cacheKey(new Request(url), "v1")
    for (const request of [
      new Request(`${url}&realistic=true`),
      new Request(`${url}&png_width=800`),
      new Request(url, { method: "POST", body: "{}" }),
    ]) {
      expect(await cacheKey(request, "v1")).not.toBe(key)
    }
    expect(await cacheKey(new Request(url), "v2")).not.toBe(key)
    expect(await cacheKey(new Request(`${url}&code=xyz`), "v1")).not.toBe(
      await cacheKey(
        new Request(
          "https://svg3.tscircuit.com/?code=xyz&code=abc&svg_type=pcb",
        ),
        "v1",
      ),
    )
    expect(
      await cacheKey(
        new Request(url, { method: "POST", body: '{"a":1}' }),
        "v1",
      ),
    ).not.toBe(
      await cacheKey(
        new Request(url, { method: "POST", body: '{"a":2}' }),
        "v1",
      ),
    )
  })
  test("bypasses private requests and non-render routes", async () => {
    for (const request of [
      new Request(`${url}&debug`),
      new Request(url, { headers: { Authorization: "Bearer test" } }),
      new Request(url, { headers: { Cookie: "session=test" } }),
      new Request("https://svg3.tscircuit.com/generate_urls"),
      new Request(url, { method: "DELETE" }),
    ]) {
      expect(await cacheKey(request, "v1")).toBeNull()
    }
  })
})

describe("durable image cache", () => {
  test("miss then hit preserves Unicode bytes and skips rendering", async () => {
    const h = harness()
    const first = await h.run()
    expect(first.headers.get("X-Svg-Cache")).toBe("MISS")
    expect(await first.text()).toBe("<svg>Ω µ π</svg>")
    const second = await h.run()
    expect(second.headers.get("X-Svg-Cache")).toBe("HIT")
    expect(await second.text()).toBe("<svg>Ω µ π</svg>")
    expect(h.renders()).toBe(1)
    expect(h.store.writes).toBe(1)
  })
  test("stale GET returns immediately and queues long-running refresh", async () => {
    const h = harness()
    await h.run()
    h.age(FRESH_SECONDS + 1)
    const response = await h.run()
    expect(response.headers.get("X-Svg-Cache")).toBe("STALE")
    expect(h.renders()).toBe(1)
    await Promise.all(h.background)
    expect(h.jobs).toEqual([{ url, version: "v1" }])
    expect(await response.text()).toContain("Ω")
  })
  test("no-cache warmer waits for rendering even on a fresh hit", async () => {
    const h = harness()
    await h.run()
    await h.run(new Request(url, { headers: { Pragma: "no-cache" } }))
    expect(h.renders()).toBe(2)
    expect(h.jobs).toHaveLength(0)
  })
  test("renderer exceptions and 500s preserve last successful image", async () => {
    const h = harness()
    await h.run()
    h.age(FRESH_SECONDS + 1)
    const request = new Request(url, {
      headers: { "Cache-Control": "no-cache" },
    })
    for (const render of [
      async () => new Response("broken", { status: 500 }),
      async () => {
        throw new Error("OOM")
      },
    ]) {
      const response = await h.run(request, render)
      expect(response.headers.get("X-Svg-Cache")).toBe("STALE-ERROR")
      expect(await response.text()).toContain("Ω")
      expect(h.store.writes).toBe(1)
    }
  })
  test("cold exceptions are uncached 502s", async () => {
    const response = await harness().run(new Request(url), async () => {
      throw new Error("offline")
    })
    expect(response.status).toBe(502)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
  test("expired data is not served", async () => {
    const h = harness()
    await h.run()
    h.age(RETENTION_SECONDS + 1)
    expect((await h.run()).headers.get("X-Svg-Cache")).toBe("MISS")
    expect(h.renders()).toBe(2)
  })
  test("HEAD and conditional GET skip rendering and return no body", async () => {
    const h = harness()
    const first = await h.run()
    const head = await h.run(new Request(url, { method: "HEAD" }))
    expect(await head.text()).toBe("")
    const conditional = await h.run(
      new Request(url, {
        headers: { "If-None-Match": `W/${first.headers.get("ETag")}` },
      }),
    )
    expect(conditional.status).toBe(304)
    expect(await conditional.text()).toBe("")
    expect(h.renders()).toBe(1)
  })
  test("POST images are cached privately by body without CDN caching", async () => {
    const h = harness()
    for (let i = 0; i < 2; i++) {
      const response = await h.run(
        new Request(url, { method: "POST", body: '{"circuit_json":[]}' }),
      )
      expect(response.headers.get("Cache-Control")).toBe("no-store")
    }
    expect(h.renders()).toBe(1)
    await h.run(
      new Request(url, { method: "POST", body: '{"circuit_json":[1]}' }),
    )
    expect(h.renders()).toBe(2)
  })
  test("failed queue send still serves stale content", async () => {
    const h = harness()
    await h.run()
    h.age(FRESH_SECONDS + 1)
    h.env.REFRESH_QUEUE.send = async () => {
      throw new Error("queue offline")
    }
    expect((await h.run()).headers.get("X-Svg-Cache")).toBe("STALE")
    await Promise.all(h.background)
  })
  test("KV outage does not prevent rendering", async () => {
    const h = harness()
    h.store.failReads = true
    h.store.failWrites = true
    const response = await h.run()
    expect(response.status).toBe(200)
    expect(response.headers.get("X-Svg-Cache")).toBe("BYPASS-KV")
    expect(await response.text()).toContain("Ω")
  })
  test("health does not start a container", async () => {
    const h = harness()
    expect(
      (await h.run(new Request("https://svg3.tscircuit.com/health"))).status,
    ).toBe(200)
    expect(h.renders()).toBe(0)
  })
})

describe("KV writes", () => {
  test("never stores errors, HTML, cookies, private, or no-store responses", async () => {
    const store = new MemoryStore()
    for (const response of [
      new Response("error", {
        status: 500,
        headers: { "Content-Type": "image/svg+xml" },
      }),
      new Response("html", { headers: { "Content-Type": "text/html" } }),
      ...["no-store", "private"].map(
        (policy) =>
          new Response("svg", {
            headers: {
              "Content-Type": "image/svg+xml",
              "Cache-Control": policy,
            },
          }),
      ),
      new Response("svg", {
        headers: { "Content-Type": "image/svg+xml", "Set-Cookie": "x=y" },
      }),
    ]) {
      const result = await storeImage(store, "key", response)
      expect(result.headers.get("Cache-Control")).toBe("no-store")
    }
    expect(store.writes).toBe(0)
  })
  test("stores binary PNG bytes without conversion", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255, 128])
    const store = new MemoryStore()
    const result = await storeImage(
      store,
      "png",
      new Response(bytes, { headers: { "Content-Type": "image/png" } }),
    )
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(bytes)
    expect(new Uint8Array(store.values.get("png")!.bytes)).toEqual(bytes)
  })
  test("images above the KV limit stream intact and are not stored", async () => {
    const store = new MemoryStore()
    let emitted = 0
    const size = MAX_CACHE_BYTES + 17
    const response = new Response(
      new ReadableStream({
        pull(controller) {
          if (emitted === size) {
            controller.close()
            return
          }
          const chunk = new Uint8Array(
            Math.min(64 * 1024, size - emitted),
          ).fill(65)
          emitted += chunk.length
          controller.enqueue(chunk)
        },
      }),
      { headers: { "Content-Type": "image/svg+xml" } },
    )
    const result = await storeImage(store, "large", response)
    expect(result.headers.get("X-Svg-Cache")).toBe("BYPASS-SIZE")
    const body = new Uint8Array(await result.arrayBuffer())
    expect(body.length).toBe(size)
    expect(body.every((byte) => byte === 65)).toBe(true)
    expect(store.writes).toBe(0)
  })
})

test("oversized POST is rejected before hashing, KV access, or rendering", async () => {
  const h = harness()
  const response = await h.run(
    new Request(url, { method: "POST", body: "x".repeat(1024 * 1024 + 1) }),
  )
  expect(response.status).toBe(413)
  expect(h.renders()).toBe(0)
  expect(h.store.writes).toBe(0)
})
