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
// These paths require the runtime packages that a production-only install must
// retain; circuit-JSON rendering alone does not exercise the evaluator/engine.
const evaluated = await fetch(`${base}/?svg_type=pcb`, {
  signal: AbortSignal.timeout(60_000),
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fs_map: {
      "index.tsx": `export default () => (
        <board width="10mm" height="10mm">
          <resistor resistance="1k" footprint="0402" name="R1" />
        </board>
      )`,
    },
  }),
})
assert.equal(evaluated.status, 200, await evaluated.clone().text())
assert.match(await evaluated.text(), /<svg/)
console.log("TSX evaluation renders a PCB")

const simulated = await fetch(`${base}/?format=circuit_json`, {
  signal: AbortSignal.timeout(60_000),
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fs_map: {
      "index.tsx": `export default () => (
        <board routingDisabled>
          <voltagesource name="V1" voltage="5V" />
          <resistor name="R1" resistance="1k" />
          <trace from=".V1 > .pin1" to=".R1 > .pin1" />
          <trace from=".R1 > .pin2" to=".V1 > .pin2" />
          <voltageprobe name="PROBE" connectsTo=".V1 > .pin1" />
          <analogsimulation duration="1ms" timePerStep="100us" spiceEngine="ngspice" />
        </board>
      )`,
    },
  }),
})
assert.equal(simulated.status, 200, await simulated.clone().text())
assert(
  (await simulated.json()).some(
    (element) => element.type === "simulation_transient_voltage_graph",
  ),
  "ngspice must produce a voltage graph in the production image",
)
console.log("ngspice simulation produces a voltage graph")

const generated = await fetch(`${base}/generate_url?code=test`, {
  headers: { "X-Svg-Origin": "https://svg3.tscircuit.com" },
})
assert.equal(generated.status, 200)
assert.match(await generated.text(), /https:\/\/svg3\.tscircuit\.com/)
console.log("Generated URLs preserve the public HTTPS origin")
