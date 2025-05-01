import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

test("PCB layout should render correctly", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
import type { CommonLayoutProps } from "tscircuit"

interface Props extends CommonLayoutProps {
name: string
}

export const A555Timer = (props: Props) => {
  return (
    <chip
      name="U1"
      footprint="soic8"
      pinLabels={{
        pin1: "VCC",
        pin2: "DISCH",
        pin3: "THRES",
        pin4: "CTRL",
        pin5: "GND",
        pin6: "TRIG",
        pin7: "OUT",
        pin8: "RESET"
      }}
      {...props}
    />
  )
}
      `),
    )}`,
  )
  const svgContent = await response.text()

  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
