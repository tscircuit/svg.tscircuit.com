import { createCircuitWebWorker } from "@tscircuit/eval-webworker"
import webWorkerBlobUrl from "@tscircuit/eval-webworker/blob-url"
import { getUncompressedSnippetString } from "@tscircuit/create-snippet-url"
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg"

export default async (req: Request) => {
  if (req.url.includes("/health")) {
    return new Response(JSON.stringify({ ok: true }))
  }

  const url = new URL(req.url)
  const compressedCode = url.searchParams.get("code")
  const svgType = url.searchParams.get("svg_type")

  if (!compressedCode) {
    return new Response(
      JSON.stringify({ ok: false, error: "No code parameter provided" }),
    )
  }

  const userCode = getUncompressedSnippetString(compressedCode)

  const worker = await createCircuitWebWorker({
    webWorkerBlobUrl,
  })

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
