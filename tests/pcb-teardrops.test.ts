import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const code = `export default () => (
  <board width="16mm" height="10mm">
    <resistor name="R1" resistance="100" footprint="0603" pcbX={-3} />
    <capacitor name="C1" capacitance="10nF" footprint="0603" pcbX={3} />
    <trace from="R1.2" to="C1.1" thickness="0.2mm" pcbPath={[]}
      pcbTeardrops pcbTeardropEnd={false} />
    <pcbnotetext pcbX={0} pcbY={2} text="Teardrop at R1 only" fontSize={0.35} />
    <pcbnotepath strokeWidth={0.04} route={[
      {x: -0.5, y: 1.6}, {x: -1.6, y: 0.15},
      {x: -1.62, y: 0.5}, {x: -1.6, y: 0.15}, {x: -1.25, y: 0.28}
    ]} />
  </board>
)`

test("code endpoint renders an automatic teardrop and honors the disabled end", async () => {
  const { serverUrl } = await getTestServer()
  const url = (source: string) =>
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(getCompressedBase64SnippetString(source))}`
  const response = await fetch(url(code))
  expect(response.status).toBe(200)
  const svg = await response.text()
  expect(svg.match(/data-width-interpolation-mode="quadratic"/g)).toHaveLength(
    1,
  )
  expect(svg).toMatchSvgSnapshot(import.meta.path)
  const plain = await fetch(
    url(
      code.replace(
        "pcbTeardrops pcbTeardropEnd={false}",
        "pcbTeardrops={false}",
      ),
    ),
  )
  expect(plain.status).toBe(200)
  expect(await plain.text()).not.toContain(
    'data-width-interpolation-mode="quadratic"',
  )
}, 60_000)
