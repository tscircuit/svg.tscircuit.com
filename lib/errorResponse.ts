import { getErrorSvg } from "../getErrorSvg"
import { svgToPng } from "./svgToPng"

export async function errorResponse(err: Error, format: "svg" | "png") {
  const errorSvg = getErrorSvg(err.message)

  if (format === "png") {
    try {
      const pngBuffer = await svgToPng(errorSvg, {})

      return new Response(pngBuffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      })
    } catch (_) {
      return new Response(
        JSON.stringify({ ok: false, error: err.message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      )
    }
  }

  return new Response(errorSvg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
