import { getUncompressedSnippetString } from "@tscircuit/create-snippet-url"
import { CircuitRunner } from "@tscircuit/eval/eval"
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg"
import { getHtmlForGeneratedUrlPage } from "./get-html-for-generated-url-page"
import { getErrorSvg } from "./getErrorSvg"
import { getIndexPageHtml } from "./get-index-page-html"

type Result<T, E = Error> = [T, null] | [null, E]

async function unwrapPromise<T>(promise: Promise<T>): Promise<Result<T>> {
  return promise
    .then<[T, null]>((data) => [data, null])
    .catch<[null, Error]>((err) => [null, err])
}

function unwrapSyncError<T>(fn: () => T): Result<T> {
  try {
    return [fn(), null]
  } catch (err) {
    return [null, err as Error]
  }
}

export default async (req: Request) => {
  const url = new URL(req.url.replace("/api", "/"))
  const host = `${url.protocol}//${url.host}`

  if (url.pathname === "/health") {
    return new Response(JSON.stringify({ ok: true }))
  }

  if (url.pathname === "/generate_url") {
    const code = url.searchParams.get("code")
    return new Response(getHtmlForGeneratedUrlPage(code!, host), {
      headers: { "Content-Type": "text/html" },
    })
  }

  if (url.pathname === "/" && !url.searchParams.get("code")) {
    return new Response(getIndexPageHtml(), {
      headers: { "Content-Type": "text/html" },
    })
  }

  const compressedCode = url.searchParams.get("code")
  if (!compressedCode) {
    return new Response(
      JSON.stringify({ ok: false, error: "No code parameter provided" }),
      { status: 400 },
    )
  }

  const [userCode, userCodeErr] = unwrapSyncError(() =>
    getUncompressedSnippetString(compressedCode),
  )
  if (userCodeErr) return errorResponse(userCodeErr)
  const worker = new CircuitRunner()

  const [, executeError] = await unwrapPromise(
    worker.executeWithFsMap({
      fsMap: {
        "entrypoint.tsx": `
          import * as UserComponents from "./UserCode.tsx";
          
          const hasBoard = ${userCode.includes("<board").toString()};
          const ComponentToRender = Object.entries(UserComponents)
            .filter(([name]) => !name.startsWith("use"))
            .map(([_, component]) => component)[0] || (() => null);

          circuit.add(
            hasBoard ? (
              <ComponentToRender />
            ) : (
              <board width="10mm" height="10mm">
                <ComponentToRender name="U1" />
              </board>
            )
          );
        `,
        "UserCode.tsx": userCode,
      },
      entrypoint: "entrypoint.tsx",
    }),
  )

  if (executeError) return errorResponse(executeError)

  const [, renderError] = await unwrapPromise(worker.renderUntilSettled())
  if (renderError) return errorResponse(renderError)

  const [circuitJson, jsonError] = await unwrapPromise(worker.getCircuitJson())
  if (jsonError) return errorResponse(jsonError)

  const svgType = url.searchParams.get("svg_type")
  if (!svgType || !["pcb", "schematic"].includes(svgType)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid svg_type" }),
      { status: 400 },
    )
  }

  const [svgContent, svgError] = unwrapSyncError(() =>
    svgType === "pcb"
      ? convertCircuitJsonToPcbSvg(circuitJson)
      : convertCircuitJsonToSchematicSvg(circuitJson),
  )

  return svgError
    ? errorResponse(svgError)
    : new Response(svgContent, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
        },
      })
}

function errorResponse(err: Error) {
  return new Response(getErrorSvg(err.message), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
