import { cacheKey } from "./cache"

// These affect the rendered image, never the model geometry. Keep every other
// query/body field (including project origin, entrypoint and unknown options).
const IMAGE_OPTIONS = [
  "format",
  "output",
  "response_format",
  "output_format",
  "camera_preset",
  "png_width",
  "png_height",
  "png_density",
  "background_color",
  "background_opacity",
  "zoom_multiplier",
  "show_infinite_grid",
  "realistic",
]

export function is3dRequest(request: Request): boolean {
  const params = new URL(request.url).searchParams
  return (params.get("svg_type") || params.get("view")) === "3d"
}

export async function isGlbRequest(request: Request): Promise<boolean> {
  const params = new URL(request.url).searchParams
  let bodyFormat: unknown
  if (request.method === "POST") {
    try {
      const body = (await request.clone().json()) as Record<string, unknown>
      bodyFormat = body.output_format ?? body.format
    } catch {
      return false
    }
  }
  const format =
    params.get("format") ||
    params.get("output") ||
    params.get("response_format") ||
    bodyFormat
  return (
    is3dRequest(request) &&
    typeof format === "string" &&
    format.toLowerCase() === "glb"
  )
}

export async function modelCacheKey(
  request: Request,
  version: string,
): Promise<string | null> {
  if (!is3dRequest(request)) return null
  // Apply the same private/debug/path/size exclusions before normalizing.
  if (!(await cacheKey(request, version))) return null
  const url = new URL(request.url)
  for (const option of IMAGE_OPTIONS) url.searchParams.delete(option)
  url.searchParams.delete("view")
  url.searchParams.set("svg_type", "3d")
  let body: string | undefined
  if (request.method === "POST") {
    try {
      const input = (await request.clone().json()) as Record<string, unknown>
      if (!input || Array.isArray(input) || typeof input !== "object")
        return null
      for (const option of IMAGE_OPTIONS) delete input[option]
      body = JSON.stringify(input)
    } catch {
      return null
    }
  }
  const key = await cacheKey(
    new Request(url, {
      method: request.method,
      headers: request.headers,
      body,
    }),
    version,
  )
  return key?.replace(/^image:/, "glb:") ?? null
}

export async function assetCacheKey(
  request: Request,
  version: string,
): Promise<string | null> {
  return (await isGlbRequest(request))
    ? modelCacheKey(request, version)
    : cacheKey(request, version)
}
