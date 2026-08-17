import { expect, test } from "bun:test"
import { gzipSync, strToU8 } from "fflate"
import { bytesToBase64 } from "../lib/base64"
import { getTestServer } from "./fixtures/get-test-server"
import testCircuitJson from "./fixtures/test-circuit.json"

test("compressed Circuit JSON GET renders a focused PCB viewbox", async () => {
  const { serverUrl } = await getTestServer()
  const url = new URL(serverUrl)
  url.searchParams.set("svg_type", "pcb")
  url.searchParams.set(
    "circuit_json",
    bytesToBase64(gzipSync(strToU8(JSON.stringify(testCircuitJson)))),
  )
  url.searchParams.set("viewbox", "-4,-2,0,2")

  const response = await fetch(url)
  const svgContent = await response.text()

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toBe("image/svg+xml")
  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
