import { CircuitRunner } from "@tscircuit/eval-webworker/eval"
import { getUncompressedSnippetString } from "@tscircuit/create-snippet-url"
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg"
import { getIndexPageHtml } from "./get-index-page-html"
import { getHtmlForGeneratedUrlPage } from "./get-html-for-generated-url-page"

export default async (req: Request) => {
  const url = new URL(req.url.replace("/api", "/"))

  const host = `${url.protocol}//${url.host}`

  if (url.pathname === "/health") {
    return new Response(JSON.stringify({ ok: true }))
  }

  if (url.pathname === "/generate_url") {
    const code = url.searchParams.get("code")

    return new Response(getHtmlForGeneratedUrlPage(code!, host), {
      headers: {
        "Content-Type": "text/html",
      },
    })
  }

  if (url.pathname === "/" && !url.searchParams.get("code")) {
    return new Response(getIndexPageHtml(), {
      headers: {
        "Content-Type": "text/html",
      },
    })
  }

  const compressedCode = url.searchParams.get("code")
  const svgType = url.searchParams.get("svg_type")

  if (!compressedCode) {
    return new Response(
      JSON.stringify({ ok: false, error: "No code parameter provided" }),
    )
  }

  const userCode = getUncompressedSnippetString(compressedCode)

  const worker = new CircuitRunner()

  await worker.executeWithFsMap({
    fsMap: {
      "entrypoint.tsx": `
      import UserCode from "./UserCode.tsx"

      circuit.add(
        <UserCode />
      )
      `,
      "UserCode.tsx": userCode,
    },
    entrypoint: "entrypoint.tsx",
  })

  await worker.renderUntilSettled()

  const circuitJson = await worker.getCircuitJson()

  let svgContent: string

  if (svgType === "pcb") {
    svgContent = convertCircuitJsonToPcbSvg(circuitJson)
  } else if (svgType === "schematic") {
    svgContent = convertCircuitJsonToSchematicSvg(circuitJson)
  } else {
    return new Response(
      JSON.stringify({ ok: false, error: { message: "Invalid svg_type" } }),
    )
  }

  return new Response(svgContent, {
    headers: {
      "Content-Type": "image/svg+xml",
      // "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
