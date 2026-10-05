import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { readFile } from "node:fs/promises"
import { createServer } from "node:net"
import { setTimeout as delay } from "node:timers/promises"
import { gzipSync } from "node:zlib"

// Start the built server with the runtime executing this script.
// CI exercises Bun for Vercel parity and Node for fallback compatibility.
// A preview URL can be supplied to exercise the actual deployed function too.
let server
let logs = ""
let baseUrl = process.env.SMOKE_BASE_URL
const requestNonce = randomUUID()
const code = `export default () => <board width="12mm" height="8mm">
  <resistor name="R1" resistance="1k" footprint="0402" pcbX={-3} />
  <capacitor name="C1" capacitance="10nF" footprint="0402" pcbX={3} />
  <trace from="R1.2" to="C1.1" />
</board>`

async function request(path, options = {}, expectedStatus = 200) {
  const url = new URL(path, baseUrl)
  url.searchParams.set("__smoke", requestNonce)
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(60_000),
  })
  const body = Buffer.from(await response.arrayBuffer())
  assert.equal(
    response.status,
    expectedStatus,
    `${path}: ${body.toString().slice(0, 1000)}`,
  )
  return { response, body }
}

async function checkImage(path, format, options) {
  const { response, body } = await request(path, options)
  assert.match(
    response.headers.get("content-type") ?? "",
    new RegExp(`image/${format === "svg" ? "svg\\+xml" : "png"}`),
  )
  assert.match(response.headers.get("cache-control") ?? "", /\bpublic\b/)
  assert.match(
    response.headers.get("cdn-cache-control") ?? "",
    /stale-while-revalidate=604800/,
  )
  if (format === "svg") {
    assert.match(body.toString(), /<svg[ >]/)
    assert.match(body.toString(), /<(path|rect|circle|polygon|line|image)[ >]/)
  } else {
    assert(
      body
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    )
    assert(body.length > 100)
  }
  console.log(`PASS ${path.split("&code=")[0]}`)
}

try {
  if (!baseUrl) {
    const socket = createServer()
    socket.listen(0, "127.0.0.1")
    await once(socket, "listening")
    const { port } = socket.address()
    await new Promise((resolve) => socket.close(resolve))
    baseUrl = `http://127.0.0.1:${port}`
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "-H",
        "127.0.0.1",
        "-p",
        String(port),
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    )
    server.stdout.on("data", (chunk) => {
      logs += chunk
    })
    server.stderr.on("data", (chunk) => {
      logs += chunk
    })
    server.on("error", (error) => {
      logs += error.stack
    })
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null)
        throw new Error("Next.js exited before startup")
      try {
        await fetch(new URL("/404", baseUrl), {
          signal: AbortSignal.timeout(1000),
        })
        ready = true
        break
      } catch {
        await delay(100)
      }
    }
    assert(ready, "Next.js did not become ready")
  }
  const { body, response: healthResponse } = await request("/health")
  assert.deepEqual(JSON.parse(body), { ok: true })
  const expectedRuntime =
    process.env.SMOKE_EXPECT_RUNTIME ??
    (process.env.SMOKE_BASE_URL
      ? undefined
      : process.versions.bun
        ? "bun"
        : "node")
  if (expectedRuntime) {
    assert.equal(healthResponse.headers.get("x-runtime"), expectedRuntime)
  }
  console.log(
    `PASS /health (cold API load, ${healthResponse.headers.get("x-runtime")})`,
  )
  const fsMapBody = JSON.stringify({
    fs_map: { "index.tsx": code },
    main_component_path: "index.tsx",
  })
  const post = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: fsMapBody,
  }
  const circuit = JSON.parse(
    (await request("/?format=circuit_json", post)).body,
  )
  assert(
    Array.isArray(circuit) &&
      circuit.some((element) => element.type === "pcb_trace"),
  )
  assert(circuit.some((element) => element.type === "pcb_component"))
  console.log("PASS code evaluation and routing")
  const encoded = encodeURIComponent(gzipSync(code).toString("base64"))
  await checkImage(`/?svg_type=pcb&code=${encoded}`, "svg")
  for (const view of ["pcb", "schematic", "assembly"]) {
    for (const format of ["svg", "png"]) {
      await checkImage(`/?svg_type=${view}&format=${format}`, format, {
        ...post,
        body: JSON.stringify({ circuit_json: circuit }),
      })
    }
  }
  await checkImage("/?svg_type=3d&format=png", "png", post)
  await checkImage("/?svg_type=3d&format=svg", "svg", post)
  await checkImage(
    "/?svg_type=3d&format=png&realistic=true&png_width=192",
    "png",
    post,
  )
  await checkImage("/?svg_type=3d&format=svg", "svg", {
    ...post,
    body: JSON.stringify({ circuit_json: circuit, realistic: true }),
  })
  await checkImage("/?svg_type=pcb", "svg", post)
  const assemblyFixture = await readFile(
    new URL("../tests/fixtures/cabled-motor-assembly.ts", import.meta.url),
    "utf8",
  )
  const assemblyCode = assemblyFixture.match(/= `([\s\S]*)`/)?.[1]
  assert(assemblyCode, "Missing complete motor assembly fixture")
  const assemblyPost = {
    ...post,
    body: JSON.stringify({ fs_map: { "index.tsx": assemblyCode } }),
  }
  const assemblyCircuit = JSON.parse(
    (await request("/?format=circuit_json", assemblyPost)).body,
  )
  assert(assemblyCircuit.some((element) => element.type === "cad_cable"))
  await checkImage("/?svg_type=3d&format=png", "png", assemblyPost)
  await checkImage("/?svg_type=3d&format=png", "png", {
    ...post,
    body: JSON.stringify({ circuit_json: assemblyCircuit }),
  })
  console.log("PASS cabled motor assembly from TSX and Circuit JSON")
  for (const format of ["svg", "png"]) {
    const { response, body } = await request(
      `/?svg_type=pcb&format=${format}&code=invalid`,
      {},
      500,
    )
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(response.headers.get("cdn-cache-control"), "no-store")
    assert(body.length > 0)
  }
  console.log("PASS render failures return uncached HTTP 500 images")
} catch (error) {
  console.error(error)
  if (logs) console.error(logs)
  process.exitCode = 1
} finally {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit")
    server.kill("SIGTERM")
    const timeout = globalThis.setTimeout(() => server.kill("SIGKILL"), 5000)
    await exited
    clearTimeout(timeout)
  }
}
