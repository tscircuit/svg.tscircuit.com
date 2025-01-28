import { CircuitRunner } from "@tscircuit/eval/eval"
import { getUncompressedSnippetString } from "@tscircuit/create-snippet-url"
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg"
import { getIndexPageHtml } from "./get-index-page-html"
import { getHtmlForGeneratedUrlPage } from "./get-html-for-generated-url-page"

type Result<T, E = Error> = [T, null] | [null, E]

async function handleError<T>(promise: Promise<T>): Promise<Result<T>> {
  return promise
    .then<[T, null]>((data) => [data, null])
    .catch<[null, Error]>((err) => [null, err])
}

function handleSyncError<T>(fn: () => T): Result<T> {
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

  let circuitJson: any
  try {
    const userCode = getUncompressedSnippetString(compressedCode)
    const worker = new CircuitRunner()

    // Execute with board wrapping logic
    const [, executeError] = await handleError(
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

    const [, renderError] = await handleError(worker.renderUntilSettled())
    if (renderError) return errorResponse(renderError)

    const [json, jsonError] = await handleError(worker.getCircuitJson())
    if (jsonError) return errorResponse(jsonError)
    circuitJson = json
  } catch (err) {
    return errorResponse(err as Error)
  }

  const svgType = url.searchParams.get("svg_type")
  if (!svgType || !["pcb", "schematic"].includes(svgType)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid svg_type" }),
      { status: 400 },
    )
  }

  const [svgContent, svgError] = handleSyncError(() =>
    svgType === "pcb"
      ? convertCircuitJsonToPcbSvg(circuitJson)
      : convertCircuitJsonToSchematicSvg(circuitJson),
  )

  return svgError
    ? errorResponse(svgError)
    : new Response(svgContent, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
}

function errorResponse(err: Error) {
  return new Response(getErrorSvg(err.message), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}

const getErrorSvg = (err: string) => {
  const splitMessage = (msg: string): string[] => {
    const chunks: string[] = []
    let currentChunk = ""

    msg.split(" ").forEach((word) => {
      if ((currentChunk + word).length > 32) {
        chunks.push(currentChunk.trim())
        currentChunk = ""
      }
      currentChunk += `${word} `
    })
    chunks.push(currentChunk.trim())
    return chunks.slice(0, 3) // Max 3 lines
  }

  const errorLines = splitMessage(err)

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
  <!-- Background color -->
  <rect width="100%" height="100%" fill="#FEF2F2"/>
  
  <style>
    .error-subtext {
      font: 400 16px/1.4 'Segoe UI', system-ui, sans-serif;
      fill: #dc2626;
    }
    * {
      margin: 0;
    }
  </style>

  <!-- Vertical centering group -->
  <g transform="translate(0, 50)">
    <!-- Error message with dynamic spacing -->
    <text x="50%" y="0" class="error-subtext" text-anchor="middle">
      ${errorLines
        .map(
          (line, i) =>
            `<tspan x="50%" dy="${i === 0 ? 0 : "1.5em"}">${line}</tspan>`,
        )
        .join("")}
    </text>
  </g>
</svg>`.trim()
}
