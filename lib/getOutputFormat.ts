import type { RequestContext } from "./RequestContext"

export type OutputFormat = "svg" | "png"

export function getOutputFormat(
  url: URL,
  ctx: RequestContext,
): OutputFormat | null {
  const rawFormat =
    url.searchParams.get("format") ||
    url.searchParams.get("output") ||
    url.searchParams.get("response_format") ||
    ctx.outputFormat ||
    "svg"

  if (typeof rawFormat !== "string") {
    return null
  }

  const normalized = rawFormat.toLowerCase()

  if (normalized === "svg") {
    return "svg"
  }

  if (normalized === "png") {
    return "png"
  }

  return null
}
