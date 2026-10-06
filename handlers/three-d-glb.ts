import { convertCircuitJsonTo3dGlb } from "circuit-json-to-3d-png"
import type { RequestContext } from "../lib/RequestContext"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import { imageCacheHeaders } from "../lib/imageCacheHeaders"

export async function threeDGlbHandler(
  _req: Request,
  ctx: RequestContext,
): Promise<Response> {
  try {
    const glb = await convertCircuitJsonTo3dGlb(
      await getCircuitJsonFromContext(ctx),
    )
    ctx.onGlb?.(glb)
    return new Response(glb as BodyInit, {
      headers: {
        ...imageCacheHeaders,
        "Content-Type": "model/gltf-binary",
        "Content-Disposition": 'attachment; filename="circuit.glb"',
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "GLB conversion failed",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "CDN-Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  }
}
