import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const cornerRadiusSnippet = getCompressedBase64SnippetString(`
export default () => (
  <board width="10mm" height="10mm">
    <chip
      name="U1"
      footprint={
        <footprint>
          <smtpad
            shape="rect"
            width="2mm"
            height="1mm"
            portHints={["pin1"]}
            cornerRadius={0.25}
          />
          <smtpad
            shape="rotated_rect"
            width="2mm"
            height="1mm"
            portHints={["pin2"]}
            cornerRadius={0.25}
            ccwRotation={45}
            pcbX={3}
          />
          <smtpad
            shape="rotated_rect"
            width="2mm"
            height="1mm"
            portHints={["pin3"]}
            cornerRadius={0.25}
            ccwRotation={90}
            pcbX={-3}
          />
          <smtpad
            shape="rotated_rect"
            width="2mm"
            height="1mm"
            portHints={["pin4"]}
            cornerRadius={0.25}
            ccwRotation={45}
            pcbY={-3}
            layer={"bottom"}
          />
        </footprint>
      }
    />
  </board>
)
`)

test("rectangular and rotated-rect pads render with rounded corners", async () => {
  const { serverUrl } = await getTestServer()
  const response = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(cornerRadiusSnippet)}`,
  )

  expect(response.status).toBe(200)

  const svgContent = await response.text()

  const padElements = Array.from(
    svgContent.matchAll(/<rect[^>]*class="pcb-pad"[^>]*>/g),
  ).map((match) => match[0])

  expect(padElements.length).toBeGreaterThan(0)

  const cornerRadiusValues = padElements
    .map((element) => element.match(/rx="([0-9.]+)"/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => Number(match[1]))

  expect(cornerRadiusValues.length).toBeGreaterThanOrEqual(4)
  expect(
    cornerRadiusValues.some((value) => Math.abs(value - 12.5) < 0.05),
  ).toBe(true)
  expect(/rotate\s*\(/i.test(svgContent)).toBe(true)
  expect(svgContent).toMatchSvgSnapshot(import.meta.path + "#corner-radius")
})
