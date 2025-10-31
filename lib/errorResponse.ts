import { getErrorSvg } from "../getErrorSvg"
import { svgToPng } from "./svgToPng"

export function circuitJsonErrorResponse(circuitJson: any): Response | null {
  const errorElements = circuitJson?.filter(
    (e: any) => e.type?.includes("error") && e.type !== "pcb_autorouting_error",
  )
  if (!errorElements || errorElements.length === 0) {
    return null
  }
  return new Response(
    JSON.stringify({
      ok: false,
      error: `Errors during circuit evaluation`,
      errors: errorElements.map((e: any) => ({
        type: e.type,
        message: e.message,
      })),
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" },
    },
  )
}

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
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  }

  return new Response(errorSvg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
