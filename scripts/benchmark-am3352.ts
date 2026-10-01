import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import fsMap from "../tests/fixtures/am3352/files.json"

// With AM3352_BASE_URL, exercise the deployed function over HTTP. Otherwise use
// the real request handler locally. Both requests compute routes from TSX.
const baseUrl = process.env.AM3352_BASE_URL ?? "http://localhost"
const handler = process.env.AM3352_BASE_URL
  ? undefined
  : (await import("../handle-request")).handleRequest
const report: Record<string, unknown> = {}
const deadlineMs = Number(process.env.AM3352_MAX_MS ?? 30_000)
for (const format of ["svg", "circuit_json"]) {
  const url = new URL("/", baseUrl)
  url.searchParams.set("svg_type", "pcb")
  url.searchParams.set("format", format)
  url.searchParams.set("main_component_path", "index.tsx")
  url.searchParams.set("__benchmark", randomUUID())
  const request = new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fs_map: fsMap }),
  })
  const start = performance.now()
  const response = handler ? await handler(request) : await fetch(request)
  const body = await response.text()
  const milliseconds = performance.now() - start
  assert.equal(response.status, 200, body.slice(0, 500))
  if (format === "svg") {
    assert.match(response.headers.get("content-type") ?? "", /image\/svg\+xml/)
    assert.match(response.headers.get("cache-control") ?? "", /immutable/)
    assert.match(body, /data-type="pcb_trace"/)
    assert.match(body, /data-type="pcb_via"/)
  } else {
    const json = JSON.parse(body)
    const errors = json.filter((e: any) => e.type.endsWith("_error"))
    const traces = json.filter((e: any) => e.type === "pcb_trace")
    assert.deepEqual(errors, [])
    assert.equal(traces.length, 47)
    report.traces = traces.length
    report.errors = errors.length
  }
  report[format] = {
    milliseconds,
    bytes: body.length,
    serverTiming: response.headers.get("server-timing"),
  }
  // Write before asserting so a timeout remains diagnosable.
  await Bun.write("/tmp/am3352-benchmark.json", JSON.stringify(report, null, 2))
  assert(
    milliseconds < deadlineMs,
    `${format} took ${milliseconds.toFixed(0)} ms (limit ${deadlineMs} ms)`,
  )
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
