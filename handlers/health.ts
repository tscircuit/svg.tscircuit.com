import type { RequestContext } from "../lib/RequestContext"

export const healthHandler = async (
  req: Request,
  ctx: RequestContext,
): Promise<Response> => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  })
}
