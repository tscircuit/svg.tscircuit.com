import { expect, mock, test } from "bun:test"

let backend: (request: Request) => Promise<Response>
let stub: { fetch(request: Request): Promise<Response> }
mock.module("@cloudflare/containers", () => ({
  Container: class {
    constructor(
      _ctx: unknown,
      protected env: unknown,
    ) {}
    fetch(request: Request) {
      return backend(request)
    }
  },
  getContainer: () => stub,
}))
const { Renderer, default: worker } = await import("../src/worker")
const url = "https://svg3.tscircuit.com/?code=abc&svg_type=pcb"
function setup() {
  let writes = 0
  // Intentionally stale/missing reads test protection against KV propagation lag.
  const env = {
    CACHE_VERSION: "v1",
    RENDERER: {},
    IMAGES: {
      async getWithMetadata() {
        return { value: null, metadata: null }
      },
      async put() {
        writes++
      },
    },
    REFRESH_QUEUE: { async send() {} },
  }
  const renderer = new Renderer({} as any, env as any)
  stub = renderer
  return { env, renderer, writes: () => writes }
}
const image = () =>
  new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } })

test("container collapses concurrent duplicate renders despite stale KV reads", async () => {
  const h = setup()
  let renders = 0
  backend = async () => {
    renders++
    return image()
  }
  const responses = await Promise.all(
    Array.from({ length: 4 }, () => h.renderer.fetch(new Request(url))),
  )
  for (const response of responses) expect(await response.text()).toBe("<svg/>")
  expect(renders).toBe(1)
  expect(h.writes()).toBe(1)
})

test("container serializes different renders and bounds its queue", async () => {
  const h = setup()
  let active = 0
  let peak = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  backend = async () => {
    active++
    peak = Math.max(peak, active)
    await gate
    active--
    return image()
  }
  const requests = Array.from({ length: 8 }, (_, i) =>
    h.renderer.fetch(new Request(`${url}&png_width=${i}`)),
  )
  expect(
    (await h.renderer.fetch(new Request(`${url}&png_width=9`))).status,
  ).toBe(503)
  release()
  await Promise.all(requests)
  expect(peak).toBe(1)
  expect(h.writes()).toBe(8)
})

test("failed container render releases the lane and does not write KV", async () => {
  const h = setup()
  backend = async () => {
    throw new Error("render failed")
  }
  await expect(h.renderer.fetch(new Request(url))).rejects.toThrow(
    "render failed",
  )
  expect(h.writes()).toBe(0)
  backend = async () => image()
  expect((await h.renderer.fetch(new Request(url))).status).toBe(200)
})

test("queue retries failures and discards jobs from old versions", async () => {
  const h = setup()
  let attempts = 0
  stub = {
    async fetch() {
      attempts++
      return new Response("failed", { status: 503 })
    },
  }
  let acks = 0
  let retries = 0
  const messages = ["v0", "v1"].map((version) => ({
    body: { url, version },
    ack() {
      acks++
    },
    retry() {
      retries++
    },
  }))
  await worker.queue({ messages } as any, h.env as any)
  expect(attempts).toBe(1)
  expect(acks).toBe(1)
  expect(retries).toBe(1)
})

test("queue acknowledges a successful durable refresh", async () => {
  const h = setup()
  backend = async () => image()
  let acks = 0
  await worker.queue(
    {
      messages: [
        {
          body: { url, version: "v1" },
          ack() {
            acks++
          },
          retry() {
            throw new Error("unexpected retry")
          },
        },
      ],
    } as any,
    h.env as any,
  )
  expect(acks).toBe(1)
  expect(h.writes()).toBe(1)
})

test("container forwards the real public origin instead of trusting the client", async () => {
  const h = setup()
  backend = async (request) => {
    expect(request.headers.get("X-Svg-Origin")).toBe(
      "https://svg3.tscircuit.com",
    )
    return image()
  }
  await h.renderer.fetch(
    new Request(url, { headers: { "X-Svg-Origin": "https://example.com" } }),
  )
})
