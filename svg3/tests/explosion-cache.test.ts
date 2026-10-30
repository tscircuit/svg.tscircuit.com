import { test } from "node:test"
import { strict as assert } from "node:assert"
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
