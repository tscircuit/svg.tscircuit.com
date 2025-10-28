import { getUncompressedSnippetString } from "@tscircuit/create-snippet-url"
import type { RequestContext } from "./RequestContext"
import { decodeUrlHashToFsMap } from "./fsMap"

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const formatFsMapContent = (value: string): string => {
  const newlineMatches = value.match(/\r\n|\n|\r/g) ?? []
  const segments = value.split(/\r\n|\n|\r/)

  return segments
    .map((segment, index) => {
      const newline = newlineMatches[index]
      const newlineIndicator = newline
        ? `<span class="newline-symbol">↵</span>`
        : ""
      const newlineCharacters =
        newline === "\r\n" ? "\r\n" : newline ? "\n" : ""

      return `${escapeHtml(segment)}${newlineIndicator}${newlineCharacters}`
    })
    .join("")
}

export function getDebugHtml(ctx: RequestContext): string {
  const queryParams = Array.from(ctx.url.searchParams.entries()).map(
    ([key, value]) => ({ key, value }),
  )

  let decodedFsMap: Record<string, string> | null = null
  let decompressedCode: string | null = null
  let decompressionError: string | null = null

  if (ctx.compressedCode) {
    decodedFsMap = decodeUrlHashToFsMap(ctx.compressedCode)
    if (!decodedFsMap) {
      try {
        decompressedCode = getUncompressedSnippetString(ctx.compressedCode)
      } catch (err) {
        decompressionError = err instanceof Error ? err.message : String(err)
      }
    }
  }

  const contextSummary: Record<string, unknown> = {
    method: ctx.method,
    host: ctx.host,
    entrypoint: ctx.entrypoint,
    projectBaseUrl: ctx.projectBaseUrl,
    mainComponentPath: ctx.mainComponentPath,
    backgroundColor: ctx.backgroundColor,
    backgroundOpacity: ctx.backgroundOpacity,
    zoomMultiplier: ctx.zoomMultiplier,
    pngWidth: ctx.pngWidth,
    pngHeight: ctx.pngHeight,
    pngDensity: ctx.pngDensity,
    outputFormat: ctx.outputFormat,
    svgType: ctx.svgType,
    showSolderMask: ctx.showSolderMask,
    simulationExperimentId: ctx.simulationExperimentId,
    simulationTransientVoltageGraphIds: ctx.simulationTransientVoltageGraphIds,
    schematicHeightRatio: ctx.schematicHeightRatio,
    hasCompressedCode: Boolean(ctx.compressedCode),
    hasFsMap: Boolean(ctx.fsMap),
  }

  const requestBodyString =
    ctx.requestBody !== undefined
      ? JSON.stringify(ctx.requestBody, null, 2)
      : undefined

  const fsMapForDisplay = ctx.fsMap ?? decodedFsMap ?? null

  const decompressedCodeSection = decompressedCode
    ? `<h2>Decompressed Code</h2><pre>${escapeHtml(decompressedCode)}</pre>`
    : ""

  const decodedFsMapSection = fsMapForDisplay
    ? `<section>
        <h2>Decoded fs_map</h2>
        <table class="fs-map-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Contents</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(fsMapForDisplay)
              .map(
                ([filePath, content]) => `
                  <tr>
                    <td><code>${escapeHtml(filePath)}</code></td>
                    <td><pre class="fs-content">${formatFsMapContent(content)}</pre></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </section>`
    : ""

  const decompressionErrorSection = decompressionError
    ? `<h2>Decompression Error</h2><pre>${escapeHtml(decompressionError)}</pre>`
    : ""

  const requestBodySection = requestBodyString
    ? `<h2>Request Body</h2><pre>${escapeHtml(requestBodyString)}</pre>`
    : ""

  const hasCircuitData = Boolean(
    ctx.compressedCode || ctx.circuitJson || ctx.fsMap,
  )
  const circuitJsonDownloadLink = hasCircuitData
    ? (() => {
        const downloadUrl = new URL(ctx.url.toString())
        downloadUrl.searchParams.delete("debug")
        downloadUrl.searchParams.delete("response_format")
        downloadUrl.searchParams.delete("output")
        downloadUrl.searchParams.set("format", "circuit_json")
        return `<a class="download-link" href="${escapeHtml(
          downloadUrl.toString(),
        )}" download="circuit.json">Download circuit.json</a>`
      })()
    : ""

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>svg.tscircuit.com Debug Information</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        padding: 24px;
        background: #111;
        color: #f5f5f5;
      }
      h1 {
        margin-top: 0;
      }
      section {
        margin-bottom: 32px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        padding: 8px;
        border-bottom: 1px solid #333;
        vertical-align: top;
      }
      .fs-map-table {
        margin-top: 12px;
      }
      .fs-map-table th:first-child,
      .fs-map-table td:first-child {
        width: 220px;
        white-space: nowrap;
      }
      pre {
        background: #1e1e1e;
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
        max-height: 400px;
      }
      .fs-content {
        margin: 0;
      }
      code {
        font-family: "Fira Code", "SFMono-Regular", "Consolas", monospace;
        font-size: 13px;
      }
      .newline-symbol {
        color: #8b8b8b;
        margin-left: 6px;
      }
      .download-container {
        margin: 16px 0;
      }
      .download-link {
        display: inline-block;
        padding: 8px 12px;
        background: #0ea5e9;
        color: #111;
        border-radius: 4px;
        text-decoration: none;
        font-weight: 600;
      }
      .download-link:hover {
        background: #38bdf8;
      }
    </style>
  </head>
  <body>
    <h1>Request Debug Information</h1>
    ${
      circuitJsonDownloadLink
        ? `<div class="download-container">${circuitJsonDownloadLink}</div>`
        : ""
    }
    <section>
      <h2>Query Parameters</h2>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          ${queryParams
            .map(
              ({ key, value }) =>
                `<tr><td><code>${escapeHtml(key)}</code></td><td><code>${escapeHtml(
                  value,
                )}</code></td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </section>
    <section>
      <h2>Context Summary</h2>
      <pre>${escapeHtml(JSON.stringify(contextSummary, null, 2))}</pre>
    </section>
    ${requestBodySection}
    ${decodedFsMapSection}
    ${decompressedCodeSection}
    ${decompressionErrorSection}
  </body>
</html>`
}
