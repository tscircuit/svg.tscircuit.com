import type { RequestContext } from "../lib/RequestContext"
import { getHtmlForGeneratedUrlPage } from "../get-html-for-generated-url-page"

export const generateUrlsHandler = async (
  req: Request,
  ctx: RequestContext,
): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Method not allowed",
      }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    )
  }

  try {
    const body = await req.json()
    const { fs_map, entrypoint } = body

    if (!fs_map) {
      return new Response(
        JSON.stringify({ ok: false, error: "No fsMap provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }

    return new Response(
      getHtmlForGeneratedUrlPage({ fsMap: fs_map, entrypoint }, ctx.host),
      {
        headers: { "Content-Type": "text/html" },
      },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }
}
