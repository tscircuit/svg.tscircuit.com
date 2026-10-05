import { expect, test } from "bun:test"
import { canTryWorker, renderWorkerFirst } from "../src/worker-first"
const url = "https://svg3.tscircuit.com/?svg_type=pcb&circuit_json=W10="
const image = () =>
  new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } })

test("supported Worker response never starts the container", async () => {
  const response = await renderWorkerFirst(
    new Request(url),
    { fetch: async () => image() },
    async () => {
      throw new Error("Container must stay asleep")
    },
  )
  expect(response.headers.get("X-Svg-Renderer")).toBe("worker")
  expect(await response.text()).toBe("<svg/>")
})

test("unsupported inputs bypass the Worker", async () => {
  for (const path of [
    "/?svg_type=pcb&code=x",
    "/?svg_type=3d&circuit_json=W10=",
    "/?svg_type=schsim&circuit_json=W10=",
    "/generate_url?svg_type=pcb&circuit_json=W10=",
    "/?svg_type=pcb&circuit_json=W10=&debug=1",
  ]) {
    const request = new Request(`https://svg3.tscircuit.com${path}`)
    expect(canTryWorker(request)).toBe(false)
    const response = await renderWorkerFirst(
      request,
      {
        fetch: async () => {
          throw new Error("Should not call Worker")
        },
      },
      async () => image(),
    )
    expect(response.headers.get("X-Svg-Renderer")).toBe("container")
  }
})

test("Worker failure, unsupported output and failed streams retry the original POST", async () => {
  for (const fetch of [
    async () => {
      throw new Error("Worker exceeded memory limit")
    },
    async () => new Response("too large", { status: 422 }),
    async () => new Response("error", { status: 500 }),
    async () => new Response("not an image"),
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.error(new Error("stream failed"))
          },
        }),
        { headers: { "Content-Type": "image/png" } },
      ),
  ]) {
    const request = new Request(url, {
      method: "POST",
      body: '{"circuit_json":[]}',
    })
    let calls = 0
    const response = await renderWorkerFirst(
      request,
      {
        fetch: async (req) => {
          expect(await req.text()).toBe('{"circuit_json":[]}')
          return fetch()
        },
      },
      async (req) => {
        calls++
        expect(await req.text()).toBe('{"circuit_json":[]}')
        return image()
      },
    )
    expect(calls).toBe(1)
    expect(response.headers.get("X-Svg-Renderer")).toBe("container")
    expect(await response.text()).toBe("<svg/>")
  }
})
