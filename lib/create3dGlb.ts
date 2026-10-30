import type { CircuitJson } from "circuit-json"
import { convertCircuitJsonTo3dGlb } from "circuit-json-to-3d-png"
import {
  convertCircuitJsonToGltf,
  type AssemblyExplosionOptions,
} from "circuit-json-to-gltf"

/** Keep the authored explosion program until GLTF conversion so the downloaded
 * model includes the same motion guides as the image renderer. */
export async function create3dGlb(
  circuitJson: CircuitJson,
  explosion?: AssemblyExplosionOptions,
) {
  if (!explosion) return convertCircuitJsonTo3dGlb(circuitJson)
  return new Uint8Array(
    (await convertCircuitJsonToGltf(circuitJson, {
      format: "glb",
      explosion,
    })) as ArrayBuffer,
  )
}
