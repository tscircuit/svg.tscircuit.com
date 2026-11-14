import { expect, test } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import fsMap from "./fixtures/cc2340r5-interface/files.json"

test("top-level CC2340R5 exposes its wired public interface through the HTTP renderer", async () => {
  const { serverUrl } = await getTestServer()
  const response = await fetch(`${serverUrl}?svg_type=schematic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fs_map: fsMap,
      main_component_path: "index.tsx",
    }),
  })
  const svg = await response.text()
  expect(response.status, svg).toBe(200)
  expect(svg.match(/class="sch-group-boundary"/g)).toHaveLength(1)
  expect(svg.match(/class="sch-group-port-terminal"/g)).toHaveLength(13)
  expect(svg).toContain("CC2340R52E0RGER")
  expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 60_000)
