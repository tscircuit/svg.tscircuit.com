import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { cabledMotorAssembly } from "./fixtures/cabled-motor-assembly"
import { getTestServer } from "./fixtures/get-test-server"

test(
  "CircuitPreview evaluates and renders a mounted motor cable assembly",
  async () => {
    const { serverUrl } = await getTestServer()
    const code = encodeURIComponent(
      getCompressedBase64SnippetString(cabledMotorAssembly),
    )
    const jsonResponse = await fetch(
      `${serverUrl}?code=${code}&format=circuit_json`,
    )
    expect(jsonResponse.status).toBe(200)
    const circuitJson = await jsonResponse.json()
    const cable = circuitJson.find(
      (element: any) => element.type === "cad_cable",
    )
    expect(cable.cableprinter_string).toBe("jst_ph_pins6")
    const sourceNames = new Map(
      circuitJson
        .filter((element: any) => element.type === "source_component")
        .map((element: any) => [element.source_component_id, element.name]),
    )
    expect(sourceNames.get(cable.from_source_component_id)).toBe("MOTOR")
    expect(sourceNames.get(cable.to_source_component_id)).toBe("J_MOTOR")
    expect(
      circuitJson.some(
        (element: any) =>
          element.type === "cad_component" && element.model_jscad,
      ),
    ).toBe(true)
    // The six-wire bundle must clear the printed plate through its opening.
    const frame = circuitJson.find(
      (element: any) => element.type === "cad_component" && element.model_jscad,
    )
    const plateBottom = frame.position.z
    const platePoints = cable.path.filter(
      (point: any) => point.z >= plateBottom - 1 && point.z <= plateBottom + 5,
    )
    expect(platePoints.length).toBeGreaterThan(0)
    for (const point of platePoints) {
      expect(point.x).toBeGreaterThan(36)
      expect(point.x).toBeLessThan(48)
      expect(Math.abs(point.y)).toBeLessThan(3)
    }
    const pngResponse = await fetch(
      `${serverUrl}?svg_type=3d&format=png&width=900&height=700&code=${code}`,
    )
    expect(pngResponse.status).toBe(200)
    expect(pngResponse.headers.get("content-type")).toContain("image/png")
    await expect(
      Buffer.from(await pngResponse.arrayBuffer()),
    ).toMatchPngSnapshot(import.meta.path)
  },
  { timeout: 60000 },
)
