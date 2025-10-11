import type { RequestContext } from "../lib/RequestContext"
import { getHtmlForGeneratedUrlPage } from "../get-html-for-generated-url-page"

export const generateUrlHandler = async (
  req: Request,
  ctx: RequestContext,
): Promise<Response> => {
  const code = ctx.url.searchParams.get("code")
  if (!code) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "No code parameter provided for URL generation",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }
  return new Response(getHtmlForGeneratedUrlPage(code, ctx.host), {
    headers: { "Content-Type": "text/html" },
  })
}
