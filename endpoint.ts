import { getUncompressedSnippetString } from "@tscircuit/create-snippet-url"
import { CircuitRunner } from "@tscircuit/eval/eval"
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg"
import { convertCircuitJsonToSimple3dSvg } from "circuit-json-to-simple-3d/dist/index.js"
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
    if (!code) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No code parameter provided for URL generation",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }
    return new Response(getHtmlForGeneratedUrlPage(code, host), {
      headers: { "Content-Type": "text/html" },
    })
  }

  if (
    url.pathname === "/" &&
    !url.searchParams.get("code") &&
    !url.searchParams.get("circuit_json")
  ) {
    return new Response(getIndexPageHtml(), {
      headers: { "Content-Type": "text/html" },
    })
  }

  const compressedCode = url.searchParams.get("code")
  const circuitJsonBase64 = url.searchParams.get("circuit_json")

  if (!compressedCode && !circuitJsonBase64) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "No code or circuit_json parameter provided",
      }),
      { status: 400 },
    )
  }

  let circuitJson: any
  if (circuitJsonBase64) {
    circuitJson = await parseCircuitJsonFromBase64(circuitJsonBase64)
    if (circuitJson instanceof Response) return circuitJson // Error response
  } else if (compressedCode) {
    circuitJson = await generateCircuitJsonFromCode(compressedCode)
    if (circuitJson instanceof Response) return circuitJson // Error response
  }

  // Check for both svg_type and view parameters, with svg_type taking precedence
  const svgType =
    url.searchParams.get("svg_type") || url.searchParams.get("view")
  if (!svgType || !["pcb", "schematic", "3d"].includes(svgType)) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Invalid svg_type or view parameter",
      }),
      { status: 400 },
    )
  }

  let svgContent: string | null = null
  let svgError: Error | null = null
  if (svgType === "pcb") {
    ;[svgContent, svgError] = unwrapSyncError(() =>
      convertCircuitJsonToPcbSvg(circuitJson),
    )
  } else if (svgType === "schematic") {
    ;[svgContent, svgError] = unwrapSyncError(() =>
      convertCircuitJsonToSchematicSvg(circuitJson),
    )
  } else {
    ;[svgContent, svgError] = await unwrapPromise(
      convertCircuitJsonToSimple3dSvg(circuitJson),
    )
  }

  return svgError
    ? errorResponse(svgError)
    : new Response(svgContent, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control":
            "public, max-age=86400, s-maxage=31536000, immutable",
        },
      })
}

async function parseCircuitJsonFromBase64(
  circuitJsonBase64: string,
): Promise<any | Response> {
  const [jsonStr, base64Err] = unwrapSyncError(() =>
    Buffer.from(circuitJsonBase64, "base64").toString("utf-8"),
  )
  if (base64Err) return errorResponse(base64Err)

  const [parsedJson, parseErr] = unwrapSyncError(() => JSON.parse(jsonStr))
  if (parseErr) return errorResponse(parseErr)

  return parsedJson
}

async function generateCircuitJsonFromCode(
  compressedCode: string,
): Promise<any | Response> {
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

          const ComponentToRender = Object.entries(UserComponents)
            .filter(([name]) => !name.startsWith("use"))
            .map(([_, component]) => component)[0] || (() => null);

          circuit.add(
            <ComponentToRender />
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

  const [generatedCircuitJson, jsonError] = await unwrapPromise(
    worker.getCircuitJson(),
  )
  if (jsonError) return errorResponse(jsonError)

  return generatedCircuitJson
}

function errorResponse(err: Error) {
  return new Response(getErrorSvg(err.message), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
