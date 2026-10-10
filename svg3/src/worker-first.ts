export interface WorkerRenderer {
  fetch(request: Request): Promise<Response>
}

export function canTryWorker(request: Request): boolean {
  const url = new URL(request.url)
  return (
    ["GET", "HEAD", "POST"].includes(request.method) &&
    ["/", "/api", "/api/"].includes(url.pathname) &&
    !url.searchParams.has("debug") &&
    !request.headers.has("Authorization") &&
    !request.headers.has("Cookie") &&
    ["pcb", "schematic", "assembly", "pinout"].includes(
      url.searchParams.get("svg_type") || url.searchParams.get("view") || "",
    ) &&
    (request.method === "POST" || url.searchParams.has("circuit_json"))
  )
}

function withRenderer(response: Response, renderer: string) {
  const headers = new Headers(response.headers)
  headers.set("X-Svg-Renderer", renderer)
  return new Response(response.body, { status: response.status, headers })
}

export async function renderWorkerFirst(
  request: Request,
  worker: WorkerRenderer,
  container: (request: Request) => Promise<Response>,
): Promise<Response> {
  if (canTryWorker(request)) {
    try {
      // A service binding isolates CPU/memory failures from the cache Worker.
      // Preserve the original POST body for a possible container retry.
      const response = await worker.fetch(request.clone())
      if (
        response.status === 404 &&
        response.headers.get("Content-Type")?.includes("application/json")
      ) {
        const body: unknown = await response.clone().json()
        if (
          body &&
          typeof body === "object" &&
          "error_code" in body &&
          body.error_code === "schematic_not_available"
        ) {
          return withRenderer(response, "worker")
        }
      }
      if (
        response.status === 200 &&
        /^(image\/svg\+xml|image\/png)(;|$)/i.test(
          response.headers.get("Content-Type") ?? "",
        )
      ) {
        // Fully consume the bounded image here: a failed response stream must
        // fall back too, before it can replace a successful KV entry.
        const bytes = await response.arrayBuffer()
        return withRenderer(new Response(bytes, response), "worker")
      }
      await response.body?.cancel()
    } catch (error) {
      console.warn("Worker renderer failed; using container", error)
    }
  }
  return withRenderer(await container(request), "container")
}
