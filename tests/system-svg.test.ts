import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const code = await Bun.file(
  new URL("./fixtures/system-blocks.circuit.tsx", import.meta.url),
).text()

test("hosted system TSX renders the docs example from compressed code and file maps", async () => {
  const { serverUrl } = await getTestServer()
  const response = await fetch(
    `${serverUrl}?svg_type=system&code=${encodeURIComponent(getCompressedBase64SnippetString(code))}`,
  )
  expect(response.status).toBe(200)
  expect(response.headers.get("Content-Type")).toBe("image/svg+xml")
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
  expect(response.headers.get("X-System-Page")).toBe("1")
  expect(response.headers.get("X-System-Page-Count")).toBe("1")
  const svg = await response.text()
  expect(svg).toContain("Environment sensor")
  expect(svg).toContain("I2C")
  expect(svg).toMatchSvgSnapshot(import.meta.path)
  const fsMap = await fetch(`${serverUrl}?view=system`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fs_map: { "overview.tsx": code },
      main_component_path: "overview.tsx",
    }),
  })
  expect(fsMap.status).toBe(200)
  expect(await fsMap.text()).toBe(svg)
}, 30_000)
