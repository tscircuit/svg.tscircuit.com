import { computeWorldAABB, createSceneFromGLTF } from "poppygl"
import { presetCamera } from "./cameraPreset"

/** Fit exported GLB world geometry (+Y up, mm), including off-board parts.
 * Unlike the PCB camera helper, this sees model extents and exploded positions.
 * No extra axis mapping: both bounds and the camera are in the rendered frame.
 */
export function getAssemblyCamera(
  glb: Uint8Array,
  aspectRatio: number,
  preset?: string,
) {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength)
  const jsonLength = view.getUint32(12, true)
  const json = JSON.parse(
    new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)),
  )
  const binaryStart = 20 + jsonLength + 8
  const scene = createSceneFromGLTF(json, {
    buffers: [glb.subarray(binaryStart)],
    images: [],
  })
  const bounds = computeWorldAABB(scene.drawCalls)
  const lookAt = bounds.min.map((v, i) => (v + bounds.max[i]) / 2) as [
    number,
    number,
    number,
  ]
  // Match the docs' model-viewer orbit. A proper elevated view makes the PCB,
  // cover and fasteners legible instead of viewing the stack almost edge-on.
  const directionCamera = presetCamera(preset ?? "assembly", {
    camPos: [1, 0, 0],
    lookAt: [0, 0, 0],
    fov: 40,
  })
  const norm = (v: number[]) => {
    const length = Math.hypot(...v)
    return v.map((x) => x / length)
  }
  const cross = (a: number[], b: number[]) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
  const dot = (a: number[], b: number[]) =>
    a.reduce((sum, v, i) => sum + v * b[i], 0)
  const direction = norm([...directionCamera.camPos!])
  const right = norm(
    cross(
      direction.map((v) => -v),
      [0, 1, 0],
    ),
  )
  const up = cross(
    right,
    direction.map((v) => -v),
  )
  const fov = 40
  const tanY = Math.tan((fov * Math.PI) / 360)
  const tanX = tanY * aspectRatio
  let distance = 1
  for (const x of [bounds.min[0], bounds.max[0]])
    for (const y of [bounds.min[1], bounds.max[1]])
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const relative = [x - lookAt[0], y - lookAt[1], z - lookAt[2]]
        // A 12% frame margin, measured in projection, leaves guides clear of
        // the image edges without shrinking a tall assembly to a tiny object.
        const depth = dot(relative, direction)
        distance = Math.max(
          distance,
          depth + (Math.abs(dot(relative, right)) * 1.12) / tanX,
          depth + (Math.abs(dot(relative, up)) * 1.12) / tanY,
        )
      }
  return {
    camPos: direction.map((v, i) => lookAt[i] + v * distance) as [
      number,
      number,
      number,
    ],
    lookAt,
    fov,
  }
}
