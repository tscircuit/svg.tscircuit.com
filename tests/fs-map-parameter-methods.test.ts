import { test, expect } from "bun:test"
import { encodeFsMapToHash } from "../lib/fsMap"
import { getTestServer } from "./fixtures/get-test-server"

test("fs_map parameter works with both GET and POST methods", async () => {
  const { serverUrl } = await getTestServer()

  const fsMap = {
    "index.tsx": `export default () => (
  <board width="10mm" height="10mm">
    <resistor resistance="1k" footprint="0402" name="R1" schX={3} pcbX={3} />
  </board>
)`,
  }

  const encodedFsMap = encodeFsMapToHash(fsMap)

  const getResponse = await fetch(
    `${serverUrl}?svg_type=pcb&fs_map=${encodeURIComponent(encodedFsMap)}`,
  )
  expect(getResponse.headers.get("content-type")).toBe("image/svg+xml")
  const getSvgContent = await getResponse.text()
  expect(getSvgContent).toContain("<svg")

  const postResponse = await fetch(`${serverUrl}?svg_type=pcb`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fs_map: fsMap,
      entrypoint: "index.tsx",
    }),
  })
  expect(postResponse.headers.get("content-type")).toBe("image/svg+xml")
  const postSvgContent = await postResponse.text()
  expect(postSvgContent).toContain("<svg")
})
