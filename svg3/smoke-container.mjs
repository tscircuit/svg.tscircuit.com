import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
const base = process.env.SVG3_URL ?? "http://localhost:8080"
const circuit = JSON.parse(
  readFileSync(
    new URL("../tests/fixtures/test-circuit.json", import.meta.url),
    "utf8",
  ),
)
assert.equal((await fetch(`${base}/health`)).status, 200)
for (const [view, format] of [
  ["pcb", "svg"],
  ["schematic", "svg"],
  ["pcb", "png"],
  ["3d", "png"],
]) {
  const response = await fetch(`${base}/?svg_type=${view}&format=${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      circuit_json: circuit,
      png_width: 160,
      png_height: 120,
    }),
  })
  assert.equal(
    response.status,
    200,
    `${view}/${format}: ${await response.clone().text()}`,
  )
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (format === "png")
    assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  else assert.match(new TextDecoder().decode(bytes), /<svg/)
  console.log(`${view}/${format}: ${bytes.length} bytes`)
}
const generated = await fetch(`${base}/generate_url?code=test`, {
  headers: { "X-Svg-Origin": "https://svg3.tscircuit.com" },
})
assert.equal(generated.status, 200)
assert.match(await generated.text(), /https:\/\/svg3\.tscircuit\.com/)
console.log("Generated URLs preserve the public HTTPS origin")
