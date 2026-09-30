import type { RequestContext } from "../lib/RequestContext"

export const healthHandler = async (
  req: Request,
  ctx: RequestContext,
): Promise<Response> => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Runtime": process.versions.bun ? "bun" : "node",
    },
  })
}
