import { test } from "node:test"
import { strict as assert } from "node:assert"
import { assetCacheKey, modelCacheKey } from "../src/model-cache"
import { storeImage, type ImageStore, type Metadata } from "../src/cache"
import { serve } from "../src/service"

test("a GLB produced for an image serves downloads across cameras without rendering again", async () => {
  const values = new Map<string, { bytes: ArrayBuffer; metadata: Metadata }>()
  const store: ImageStore = {
    async getWithMetadata<T>(key: string) {
      const value = values.get(key)
      return {
        value: value ? new Response(value.bytes).body : null,
        metadata: (value?.metadata as T) ?? null,
      }
    },
    async put(key, bytes, options) {
      values.set(key, { bytes, metadata: options.metadata })
    },
  }
  const png = new Request(
    "https://svg3.tscircuit.com/?svg_type=3d&code=design&format=png&camera_preset=top-down&realistic=true&png_width=800",
  )
  const download = new Request(
    "https://svg3.tscircuit.com/?code=design&format=glb",
  )
  const modelKey = await modelCacheKey(png, "v1")
  assert.equal(modelKey, await assetCacheKey(download, "v1"))
  assert.equal(
    modelKey,
    await modelCacheKey(
      new Request(png.url.replace("top-down", "bottom").replace("800", "400")),
      "v1",
    ),
  )
  assert.notEqual(
    await assetCacheKey(png, "v1"),
    await assetCacheKey(
      new Request(png.url.replace("top-down", "bottom")),
      "v1",
    ),
  )
  assert.notEqual(
    modelKey,
    await modelCacheKey(new Request(png.url.replace("design", "other")), "v1"),
  )
  assert.equal(
    await modelCacheKey(
      new Request(png, { headers: { Authorization: "private" } }),
      "v1",
    ),
    null,
  )
  const post = (format: string, camera: string) =>
    new Request(
      `https://svg3.tscircuit.com/${format === "glb" ? "" : "?svg_type=3d"}`,
      {
        method: "POST",
        body: JSON.stringify({
          code: "design",
          format,
          camera_preset: camera,
          png_width: 200,
        }),
      },
    )
  assert.equal(
    await modelCacheKey(post("png", "top-down"), "v1"),
    await assetCacheKey(post("glb", "bottom"), "v1"),
  )
  assert.notEqual(modelKey, await modelCacheKey(post("png", "top-down"), "v1"))

  const bytes = new Uint8Array([
    0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0,
  ])
  const stored = await storeImage(
    store,
    modelKey!,
    new Response(bytes, {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Cache-Control": "public",
        "X-Svg-Renderer": "container",
      },
    }),
  )
  await stored.body?.cancel()
  const response = await serve(
    download,
    { IMAGES: store, CACHE_VERSION: "v1", REFRESH_QUEUE: { async send() {} } },
    {
      waitUntil() {},
    },
    async () => {
      throw new Error("The model must come from KV, not conversion")
    },
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("X-Svg-Cache"), "HIT")
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*")
  assert.equal(
    response.headers.get("Content-Disposition"),
    'attachment; filename="circuit.glb"',
  )
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
  const head = await serve(
    new Request(download, { method: "HEAD" }),
    {
      IMAGES: store,
      CACHE_VERSION: "v1",
      REFRESH_QUEUE: { async send() {} },
    },
    { waitUntil() {} },
    async () => {
      throw new Error("unexpected render")
    },
  )
  assert.equal(head.status, 200)
  assert.equal((await head.arrayBuffer()).byteLength, 0)
  const conditional = await serve(
    new Request(download, {
      headers: { "If-None-Match": head.headers.get("ETag")! },
    }),
    {
      IMAGES: store,
      CACHE_VERSION: "v1",
      REFRESH_QUEUE: { async send() {} },
    },
    { waitUntil() {} },
    async () => {
      throw new Error("unexpected render")
    },
  )
  assert.equal(conditional.status, 304)
})
