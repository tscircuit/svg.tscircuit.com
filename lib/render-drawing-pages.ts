import { buildSubtree } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, DrawingPage } from "circuit-json"
import type { DrawingScenePart } from "@tscircuit/circuit-json-to-drawing"
import { mat4 } from "gl-matrix"

export const getDrawingPages = (circuitJson: AnyCircuitElement[]) => {
  const pages = circuitJson.filter(
    (e): e is DrawingPage => e.type === "drawing_page",
  )
  return pages.map((page, index) => {
    const stem = (page.name?.trim() || `drawing-${index + 1}`)
      .replace(/\.svg$/i, "")
      .replace(/[^a-zA-Z0-9_.-]+/g, "-")
      .replace(/^\.+|\.+$/g, "")
    return { page, fileName: `${stem || `drawing-${index + 1}`}.svg` }
  })
}

export const selectDrawingPages = (
  circuitJson: AnyCircuitElement[],
  selector?: string,
) => {
  const pages = getDrawingPages(circuitJson)
  const selected = selector
    ? pages.filter(
        ({ page, fileName }) => page.name === selector || fileName === selector,
      )
    : pages
  if (selector && selected.length !== 1) {
    throw new Error(
      selected.length
        ? `Drawing "${selector}" is ambiguous. Use a unique drawing name.`
        : `Drawing "${selector}" not found. Available drawings: ${pages.map(({ page, fileName }) => page.name || fileName).join(", ") || "none"}`,
    )
  }
  const names = selected.map(({ fileName }) => fileName.toLowerCase())
  if (new Set(names).size !== names.length)
    throw new Error(
      "Drawing filenames collide. Give each drawing a unique name.",
    )
  return selected
}

/** Input geometry is CAD world mm (+Z up); glTF conversion supplies the drawing
 * renderer's +Y-up frame. Paper-space view placement never transforms the model.
 */
export const renderDrawingPages = async (
  circuitJson: AnyCircuitElement[],
  selector?: string,
  drawingPageId?: string,
  projectBaseUrl?: string,
) => {
  const pages = drawingPageId
    ? getDrawingPages(circuitJson).filter(
        ({ page }) => page.drawing_page_id === drawingPageId,
      )
    : selectDrawingPages(circuitJson, selector)
  if (!pages.length) return []
  const { convertCircuitJsonToDrawingPages } = await import(
    "@tscircuit/circuit-json-to-drawing"
  )
  const { convertCircuitJsonToGltf } = await import("circuit-json-to-gltf")
  const { createSceneFromGLTF, loadGLTFWithResourcesFromURL } = await import(
    "poppygl"
  )
  const geometry = circuitJson.filter((e) => !e.type.startsWith("drawing_"))
  const scenes = new Map<string, ReturnType<typeof createSceneFromGLTF>>()
  // Keep assembled identities across pages. The renderer clones these draw calls
  // before applying each view's resolved explosion, so poses cannot accumulate.
  let sceneParts: Promise<DrawingScenePart[]> | undefined
  const resolveSceneParts = () =>
    (sceneParts ??= (async () => {
      const parts: DrawingScenePart[] = []
      const sourceIds = new Set(
        geometry.flatMap((e) =>
          e.type === "cad_component" ? [e.source_component_id] : [],
        ),
      )
      const boards = geometry.filter((e) => e.type === "pcb_board")
      const selections = [
        ...[...sourceIds].map((source_component_id) => ({
          identity: { source_component_id },
          elements: geometry.filter(
            (e) =>
              (e.type === "cad_component" || e.type === "source_component") &&
              e.source_component_id === source_component_id,
          ),
        })),
        ...boards.map((board) => ({
          identity: { pcb_board_id: board.pcb_board_id },
          // Keep substrate, copper and drills, including component-owned drills.
          // CAD models are separate identities and must not be duplicated here.
          elements: geometry.filter(
            (e) =>
              e.type.startsWith("pcb_") &&
              e.type !== "pcb_component" &&
              ("pcb_board_id" in e && e.pcb_board_id
                ? e.pcb_board_id === board.pcb_board_id
                : "subcircuit_id" in e &&
                  e.subcircuit_id === board.subcircuit_id),
          ),
        })),
      ]
      // circuit-json-to-gltf exports (-x,z,y). Assembly drawings require
      // canonical CAD-to-scene (x,z,-y), including the placed translations.
      const canonicalFrame = mat4.fromYRotation(mat4.create(), Math.PI)
      for (const { identity, elements } of selections) {
        const glb = await convertCircuitJsonToGltf(elements, {
          format: "glb",
          projectBaseUrl,
          includeModels: true,
          showBoundingBoxes: false,
        })
        const { gltf, resources } = await loadGLTFWithResourcesFromURL(
          `data:model/gltf-binary;base64,${Buffer.from(glb as ArrayBuffer).toString("base64")}`,
        )
        const scene = createSceneFromGLTF(gltf, resources)
        parts.push({
          ...identity,
          drawCalls: scene.drawCalls.map((call) => ({
            ...call,
            model: mat4.multiply(mat4.create(), canonicalFrame, call.model),
          })),
        })
      }
      return parts
    })())
  const rendered = []
  for (const { page, fileName } of pages) {
    const outputs = await convertCircuitJsonToDrawingPages(circuitJson, {
      drawingPageId: page.drawing_page_id,
      resolveSceneParts,
      resolveScene: async (view) => {
        const key = JSON.stringify([
          view.source_group_id,
          view.source_component_ids,
        ])
        const cached = scenes.get(key)
        if (cached) return cached
        const ids = new Set(view.source_component_ids)
        const selected: AnyCircuitElement[] = view.source_group_id
          ? buildSubtree(geometry, { source_group_id: view.source_group_id })
          : view.source_component_ids
            ? geometry.filter(
                (e) =>
                  (e.type === "source_component" ||
                    e.type === "cad_component") &&
                  ids.has(e.source_component_id),
              )
            : [...geometry]
        if (view.source_group_id) {
          const subcircuits = new Set(
            selected.flatMap((e) =>
              e.type === "source_group" && e.subcircuit_id
                ? [e.subcircuit_id]
                : [],
            ),
          )
          const included = new Set(selected)
          selected.push(
            ...geometry.filter(
              (e) =>
                e.type.startsWith("pcb_") &&
                "subcircuit_id" in e &&
                subcircuits.has(e.subcircuit_id!) &&
                !("pcb_component_id" in e && e.pcb_component_id) &&
                !included.has(e),
            ),
          )
        }
        const glb = await convertCircuitJsonToGltf(selected, {
          format: "glb",
          projectBaseUrl,
          includeModels: true,
          showBoundingBoxes: false,
        })
        const { gltf, resources } = await loadGLTFWithResourcesFromURL(
          `data:model/gltf-binary;base64,${Buffer.from(glb as ArrayBuffer).toString("base64")}`,
        )
        const scene = createSceneFromGLTF(gltf, resources)
        scenes.set(key, scene)
        return scene
      },
    })
    rendered.push({ fileName, svg: outputs[0]!.svg })
  }
  return rendered
}
