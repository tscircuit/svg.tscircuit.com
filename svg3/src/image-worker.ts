import { Resvg, initWasm } from "@resvg/resvg-wasm"
import wasm from "@resvg/resvg-wasm/index_bg.wasm"
import font from "../../lib/fonts/DejaVuSans.ttf"
import { getRequestContext } from "../../lib/getRequestContext"
import { getOutputFormat } from "../../lib/getOutputFormat"
import { parsePositiveInt } from "../../lib/parsePositiveInt"
import { renderCircuitTo2dSvg } from "../../shared/render-2d"
import { getPngFitTo } from "../../shared/png-options"
import { canTryWorker } from "./worker-first"

let wasmReady: Promise<void> | undefined
const MAX_PIXELS = 2048 * 2048
const MAX_IMAGE_BYTES = 24 * 1024 * 1024
function fallback() {
  return new Response("Use container renderer", { status: 422 })
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (!canTryWorker(request)) return fallback()
    const ctx = await getRequestContext(request)
    if (ctx instanceof Response) return fallback()
    if (!Array.isArray(ctx.circuitJson)) return fallback()
    const format = getOutputFormat(ctx.url, ctx)
    if (format !== "svg" && format !== "png") return fallback()
    const view =
      ctx.url.searchParams.get("svg_type") || ctx.url.searchParams.get("view")
    if (
      view !== "pcb" &&
      view !== "schematic" &&
      view !== "assembly" &&
      view !== "pinout"
    )
      return fallback()
    const svg = await renderCircuitTo2dSvg(ctx.circuitJson, view, {
      showSolderMask: ctx.showSolderMask,
      showCourtyards: ctx.showCourtyards,
      showDebugObjects: ctx.showDebugObjects,
      pcbViewBox: ctx.pcbViewBox,
    })
    if (format === "svg") {
      const bytes = new TextEncoder().encode(svg)
      if (bytes.byteLength > MAX_IMAGE_BYTES) return fallback()
      return new Response(bytes, {
        headers: { "Content-Type": "image/svg+xml" },
      })
    }
    await (wasmReady ??= initWasm(wasm))
    const fitTo = getPngFitTo({
      width: parsePositiveInt(
        ctx.url.searchParams.get("png_width") ?? ctx.pngWidth,
      ),
      height: parsePositiveInt(
        ctx.url.searchParams.get("png_height") ?? ctx.pngHeight,
      ),
      density: parsePositiveInt(
        ctx.url.searchParams.get("png_density") ?? ctx.pngDensity,
      ),
    })
    const renderer = new Resvg(svg, {
      fitTo,
      font: { fontBuffers: [new Uint8Array(font)], loadSystemFonts: false },
    })
    try {
      // Resvg's width/height getters describe the original SVG, not fitTo.
      // Bound the scaled raster before allocating its pixel buffers.
      const scale =
        fitTo.mode === "width"
          ? fitTo.value / renderer.width
          : fitTo.mode === "height"
            ? fitTo.value / renderer.height
            : fitTo.mode === "zoom"
              ? fitTo.value
              : 1
      const pixels =
        Math.ceil(renderer.width * scale) * Math.ceil(renderer.height * scale)
      if (!Number.isFinite(pixels) || pixels > MAX_PIXELS) return fallback()
      const rendered = renderer.render()
      try {
        const bytes = rendered.asPng()
        if (bytes.byteLength > MAX_IMAGE_BYTES) return fallback()
        return new Response(bytes, { headers: { "Content-Type": "image/png" } })
      } finally {
        rendered.free()
      }
    } finally {
      renderer.free()
    }
  },
} satisfies ExportedHandler
