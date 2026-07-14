import type { RequestContext } from "../lib/RequestContext"
import { getHtmlForGeneratedUrlPage } from "../get-html-for-generated-url-page"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import type { SimulationExperiment } from "circuit-json"

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
    const body = ctx.requestBody
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid or missing JSON body",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }

    const { fs_map, entrypoint } = body as {
      fs_map?: Record<string, string>
      entrypoint?: string
    }

    const fsMap = fs_map ?? ctx.fsMap
    const resolvedEntrypoint = entrypoint ?? ctx.entrypoint

    if (!fsMap) {
      return new Response(
        JSON.stringify({ ok: false, error: "No fsMap provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }

    const circuitJson = await getCircuitJsonFromContext({
      ...ctx,
      fsMap,
      entrypoint: undefined,
      mainComponentPath: ctx.mainComponentPath ?? resolvedEntrypoint,
    })
    const simulationExperiments = circuitJson.filter(
      (element: unknown): element is SimulationExperiment =>
        typeof element === "object" &&
        element !== null &&
        "type" in element &&
        element.type === "simulation_experiment",
    )

    return new Response(
      getHtmlForGeneratedUrlPage(
        { fsMap, entrypoint: resolvedEntrypoint },
        ctx.host,
        simulationExperiments,
      ),
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
