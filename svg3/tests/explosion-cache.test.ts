import { test } from "node:test"
import { strict as assert } from "node:assert"
import { cacheKey } from "../src/cache"
import { assetCacheKey, modelCacheKey } from "../src/model-cache"

test("explosion stages and progress have distinct image/model cache entries", async () => {
  const request = (stage: string, progress: number, format: string) =>
    new Request(
      `https://svg3.tscircuit.com/?svg_type=3d&format=${format}&explosion_stage=${stage}&explosion_progress=${progress}`,
      {
        method: "POST",
        body: JSON.stringify({ circuit_json: "compressed-board" }),
      },
    )
  const first = await modelCacheKey(request("case.lift-cover", 1, "png"), "v1")
  assert.equal(
    first,
    await assetCacheKey(request("case.lift-cover", 1, "glb"), "v1"),
  )
  assert.notEqual(
    first,
    await modelCacheKey(request("case.remove-bolts", 1, "png"), "v1"),
  )
  assert.notEqual(
    first,
    await modelCacheKey(request("case.lift-cover", 0.5, "png"), "v1"),
  )
  assert.notEqual(
    await assetCacheKey(request("case.lift-cover", 1, "png"), "v1"),
    await assetCacheKey(request("case.lift-cover", 0.5, "png"), "v1"),
  )
})

test("3D render revision expires guide-less images and models while preserving 2D cache", async () => {
  const image = new Request(
    "https://svg3.tscircuit.com/?svg_type=3d&code=assembly&format=png&explosion_stage=case.lift-cover",
  )
  const model = new Request(image.url.replace("format=png", "format=glb"))
  assert.notEqual(await assetCacheKey(image, "v1"), await cacheKey(image, "v1"))
  assert.match((await assetCacheKey(image, "v1"))!, /^image:v1:3d-v2:/)
  assert.match((await assetCacheKey(model, "v1"))!, /^glb:v1:3d-v2:/)
  const pcb = new Request(image.url.replace("svg_type=3d", "svg_type=pcb"))
  assert.equal(await assetCacheKey(pcb, "v1"), await cacheKey(pcb, "v1"))
})
