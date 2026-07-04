import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

test("RaspberryPiHatBoard schematic svg", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=schematic&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
import { RaspberryPiHatBoard } from "@tscircuit/common"

export default () => (
  <RaspberryPiHatBoard name="HAT1">
    <chip
      name="BZ1"
      footprint="0603"
      manufacturerPartNumber="Passive Buzzer"
      pcbX={10}
      pcbY={-10}
    />
  </RaspberryPiHatBoard>
)
    `),
    )}`,
  )
  const svgContent = await response.text()

  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
