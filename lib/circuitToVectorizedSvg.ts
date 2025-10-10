import { trace } from "potrace"
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { renderGLTFToPNGBufferFromGLBBuffer } from "poppygl"

export const circuitToVectorizedSvg = async (
  circuitJson: any
): Promise<string> => {
  const gltf = await convertCircuitJsonToGltf(circuitJson, { format: "glb" })
  const pngBuffer = await renderGLTFToPNGBufferFromGLBBuffer(gltf)

  return new Promise((resolve, reject) => {
    trace(pngBuffer, (err, svg) => {
      if (err) return reject(err)
      resolve(svg)
    })
  })
}