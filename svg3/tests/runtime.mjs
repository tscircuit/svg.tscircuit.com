// Runs the real workerd/WASM renderer against the existing Bun/native handlers.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { createServer } from "node:net"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"
const root = fileURLToPath(new URL("../../", import.meta.url))
const fixture = JSON.parse(
  readFileSync(`${root}/tests/fixtures/test-circuit.json`),
)
const query = gzipSync(JSON.stringify(fixture)).toString("base64")
async function port() {
  const server = createServer()
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  const p = server.address().port
  await new Promise((r) => server.close(r))
  return p
}
const [workerPort, nativePort] = await Promise.all([port(), port()])
const logs = []
function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  })
  child.stdout.on("data", (d) => logs.push(d.toString()))
  child.stderr.on("data", (d) => logs.push(d.toString()))
  return child
}
const processes = [
  start(process.execPath, [
    `${root}/svg3/node_modules/wrangler/bin/wrangler.js`,
    "dev",
    "--config",
    `${root}/svg3/wrangler.images.jsonc`,
    "--local",
    "--port",
    String(workerPort),
  ]),
  start(process.env.BUN_BIN || "bun", ["run", "svg3/server.ts"], {
    PORT: String(nativePort),
  }),
]
async function ready(p) {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`http://127.0.0.1:${p}/health`)
      return
    } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Server ${p} did not start`)
}
try {
  await Promise.all([ready(workerPort), ready(nativePort)])
  let checked = 0
  for (const view of ["pcb", "schematic", "assembly", "pinout"]) {
    for (const format of ["svg", "png"]) {
      const q = new URLSearchParams({
        circuit_json: query,
        svg_type: view,
        format,
        png_width: "160",
        png_height: "120",
      })
      const [worker, native] = await Promise.all(
        [workerPort, nativePort].map((p) =>
          fetch(`http://127.0.0.1:${p}/?${q}`),
        ),
      )
      assert.equal(worker.status, 200, `${view} ${format}`)
      assert.equal(native.status, 200)
      assert.deepEqual(
        Buffer.from(await worker.arrayBuffer()),
        Buffer.from(await native.arrayBuffer()),
        `${view} ${format} output differs`,
      )
      checked++
    }
  }
  for (const options of [
    { png_height: 256 },
    { png_width: 300, png_height: 999 },
    { png_density: 144 },
    {
      show_solder_mask: false,
      show_courtyards: true,
      viewbox: "-5,-5,5,5",
      png_width: 160,
    },
  ]) {
    const body = JSON.stringify({
      circuit_json: fixture,
      format: "png",
      ...options,
    })
    const responses = await Promise.all(
      [workerPort, nativePort].map((p) =>
        fetch(`http://127.0.0.1:${p}/api?svg_type=pcb`, {
          method: "POST",
          body,
        }),
      ),
    )
    for (const r of responses) assert.equal(r.status, 200)
    assert.deepEqual(
      Buffer.from(await responses[0].arrayBuffer()),
      Buffer.from(await responses[1].arrayBuffer()),
      JSON.stringify(options),
    )
    checked++
  }
  for (const q of [
    "svg_type=pcb&code=abc",
    `svg_type=3d&circuit_json=${encodeURIComponent(query)}`,
    `svg_type=pcb&format=png&png_width=10000&circuit_json=${encodeURIComponent(query)}`,
  ]) {
    const response = await fetch(`http://127.0.0.1:${workerPort}/?${q}`)
    assert.equal(response.status, 422, q.slice(0, 70))
    await response.body.cancel()
  }
  console.log(
    `${checked} native/Worker byte-for-byte comparisons passed; unsupported and oversized renders defer to container`,
  )
} catch (error) {
  console.error(logs.join(""))
  throw error
} finally {
  for (const child of processes) child.kill("SIGTERM")
}
