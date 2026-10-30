import { expect, test } from "bun:test"
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { buildCamera, computeWorldAABB, createSceneFromGLTF } from "poppygl"
import { getAssemblyCamera } from "../lib/getAssemblyCamera"

test("assembly camera frames tall, offset meshes for wide and narrow images", async () => {
  const input = [
    {
      type: "source_component",
      source_component_id: "part",
      ftype: "subassembly",
      name: "offset tall assembly",
    },
    {
      type: "cad_component",
      cad_component_id: "cad",
      source_component_id: "part",
      position: { x: 70, y: -30, z: 45 },
      rotation: { x: 0, y: 0, z: 35 },
      model_origin_position: { x: 0, y: 0, z: 0 },
      model_jscad: { type: "cuboid", size: [45, 25, 120] },
    },
  ] as any
  const glb = new Uint8Array(
    (await convertCircuitJsonToGltf(input, { format: "glb" })) as ArrayBuffer,
  )
  const jsonLength = new DataView(glb.buffer).getUint32(12, true)
  const gltf = JSON.parse(
    new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)),
  )
  const scene = createSceneFromGLTF(gltf, {
    buffers: [glb.subarray(28 + jsonLength)],
    images: [],
  })
  const bounds = computeWorldAABB(scene.drawCalls)
  for (const [width, height] of [
    [800, 600],
    [400, 800],
  ]) {
    for (const preset of [
      undefined,
      "assembly",
      "top-left-corner",
      "right-sideview",
      "bottom-center-angled",
    ]) {
      const options = getAssemblyCamera(glb, width! / height!, preset)
      expect(options.lookAt[0]).toBeCloseTo(-70, 4)
      expect(options.lookAt[1]).toBeCloseTo(45, 4)
      expect(options.lookAt[2]).toBeCloseTo(-30, 4)
      const camera = buildCamera(
        scene.drawCalls,
        width!,
        height!,
        options.fov,
        options.camPos,
        options.lookAt,
      )
      // Project actual exported mesh corners through the renderer's camera.
      // All geometry must be in frame, with a useful margin in portrait too.
      for (const x of [bounds.min[0], bounds.max[0]])
        for (const y of [bounds.min[1], bounds.max[1]])
          for (const z of [bounds.min[2], bounds.max[2]]) {
            let point = [x, y, z, 1]
            for (const matrix of [camera.view, camera.proj])
              point = [0, 1, 2, 3].map((row) =>
                point.reduce(
                  (sum, p, col) => sum + p * matrix[col * 4 + row]!,
                  0,
                ),
              )
            expect(point[3]).toBeGreaterThan(0)
            expect(Math.abs(point[0]! / point[3]!)).toBeLessThan(0.9)
            expect(Math.abs(point[1]! / point[3]!)).toBeLessThan(0.9)
          }
    }
  }
})

test("camera includes guide endpoints left behind outside the moved mesh bounds", async () => {
  const glb = new Uint8Array(
    (await convertCircuitJsonToGltf(
      [
        {
          type: "cad_component",
          cad_component_id: "part",
          position: { x: 10, y: 20, z: 30 },
          rotation: { x: 0, y: 0, z: 0 },
          model_jscad: { type: "cuboid", size: [10, 10, 10] },
        },
        {
          type: "cad_explosion_stage",
          cad_explosion_stage_id: "move",
          name: "move",
          order: 0,
          cad_component_ids: ["part"],
        },
        {
          type: "cad_explosion_move",
          cad_explosion_move_id: "move-part",
          cad_explosion_stage_id: "move",
          order: 0,
          targets: [{ type: "cad_component", cad_component_id: "part" }],
          translation: { x: 200, y: 0, z: 0 },
        },
      ] as any,
      { format: "glb", explosion: {} },
    )) as ArrayBuffer,
  )
  const length = new DataView(glb.buffer).getUint32(12, true)
  const json = JSON.parse(
    new TextDecoder().decode(glb.subarray(20, 20 + length)),
  )
  const scene = createSceneFromGLTF(json, {
    buffers: [glb.subarray(28 + length)],
    images: [],
  })
  expect(scene.explosionLines?.[0]?.points).toEqual([
    [-10, 30, 20],
    [-210, 30, 20],
  ])
  const bounds = computeWorldAABB(scene.drawCalls)
  expect(bounds.max[0]).toBeCloseTo(-205)
  for (const [width, height] of [
    [800, 600],
    [400, 800],
  ]) {
    const options = getAssemblyCamera(glb, width! / height!)
    const camera = buildCamera(
      scene.drawCalls,
      width!,
      height!,
      options.fov,
      options.camPos,
      options.lookAt,
    )
    for (const endpoint of scene.explosionLines![0]!.points) {
      let point = [...endpoint, 1]
      for (const matrix of [camera.view, camera.proj])
        point = [0, 1, 2, 3].map((row) =>
          point.reduce((sum, p, col) => sum + p * matrix[col * 4 + row]!, 0),
        )
      expect(point[3]).toBeGreaterThan(0)
      expect(Math.abs(point[0]! / point[3]!)).toBeLessThan(0.9)
      expect(Math.abs(point[1]! / point[3]!)).toBeLessThan(0.9)
    }
  }
})
