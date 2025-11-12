import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

const cadModelBoardSnippet = `
import { PushButton } from "@tsci/seveibar.push-button"
import { SmdUsbC } from "@tsci/seveibar.smd-usb-c"

export default () => {
return (
  <board width="12mm" height="30mm">
    <SmdUsbC
      name="J1"
      connections={{
        GND1: "net.GND",
        GND2: "net.GND",
        VBUS1: "net.VBUS",
        VBUS2: "net.VBUS",
      }}
      pcbY={-10.5}
    />
    <led
      name="LED"
      supplierPartNumbers={{
        jlcpcb: ["965799"],
      }}
      color="red"
      footprint="0603"
      pcbY={12}
    />
    <pushbutton
      name="SW1"
      pcbRotation="90deg"
      footprint="pushbutton_id1.3mm_od2mm"
      connections={{ pin1: ".R1 > .pos", pin2: "net.VBUS" }}
      supplierPartNumbers={{
        jlcpcb: ["C110153"],
      }}
    />
    <resistor name="R1" footprint="0603" resistance="1k" pcbY={7} />

    <trace from="R1.neg" to="LED.pos" />
    <trace from="LED.neg" to="net.GND" />
  </board>
)
}
`

test(
  "renders 3d view with model with infinite grid to png",
  async () => {
    const { serverUrl } = await getTestServer()
    const encodedSnippet = encodeURIComponent(
      getCompressedBase64SnippetString(cadModelBoardSnippet),
    )

    const response = await fetch(
      `${serverUrl}?svg_type=3d&format=png&show_infinite_grid=true&code=${encodedSnippet}`,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("image/png")
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=86400, s-maxage=31536000, immutable",
    )

    const buffer = new Uint8Array(await response.arrayBuffer())
    expect(Array.from(buffer.slice(0, pngSignature.length))).toEqual(
      pngSignature,
    )
    expect(buffer.byteLength).toBeGreaterThan(1000)

    // PNG snapshot test
    await expect(Buffer.from(buffer)).toMatchPngSnapshot(import.meta.path)
  },
  { timeout: 30000 },
)
