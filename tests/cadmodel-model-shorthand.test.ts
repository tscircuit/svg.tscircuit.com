import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

for (const inAssembly of [false, true]) {
  test(
    `cadmodel model shorthand preserves circuit JSON in ${inAssembly ? "assembly" : "chip"} CAD`,
    async () => {
      const { serverUrl } = await getTestServer()
      const render = async (modelProp: string) => {
        const cad = `<cadmodel ${modelProp} pcbX={2} pcbZ={4} rotationOffset={{ x: 0, y: 0, z: 45 }} modelUnitToMmScale={1} />`
        const code = inAssembly
          ? `import { assembly } from "@tscircuit/core"
export default () => <assembly.device name="device"><assembly.subassembly name="part">${cad}</assembly.subassembly></assembly.device>`
          : `export default () => <board width="20mm" height="20mm"><chip name="U1" footprint="soic8" doNotPlace cadModel={${cad}} /></board>`
        const encoded = encodeURIComponent(
          getCompressedBase64SnippetString(code),
        )
        const response = await fetch(
          `${serverUrl}?code=${encoded}&format=circuit_json`,
        )
        expect(response.status).toBe(200)
        const circuitJson = await response.json()
        expect(
          circuitJson.some(
            (element: { type: string }) => element.type === "cad_component",
          ),
        ).toBe(true)
        return circuitJson
      }

      for (const model of ["soic8", "pinrow3", "pinrow4"]) {
        const url = `https://modelcdn.tscircuit.com/jscad_models/${model}.glb`
        expect(await render(`model="${model}"`)).toEqual(
          await render(`modelUrl="${url}"`),
        )
      }
    },
    { timeout: 30000 },
  )
}
