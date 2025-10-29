import {
  getCompressedBase64SnippetString,
  createSnippetUrl,
} from "@tscircuit/create-snippet-url"
import { encodeFsMapToHash } from "./lib/fsMap"

export const getHtmlForGeneratedUrlPage = (
  codeOrFsMap: string | { fsMap: Record<string, string>; entrypoint?: string },
  urlPrefix = "https://svg.tscircuit.com",
) => {
  let code: string
  let packgaeUrl: string
  let compressedCode: string

  if (typeof codeOrFsMap === "string") {
    code = codeOrFsMap
    packgaeUrl = createSnippetUrl(code)
    compressedCode = getCompressedBase64SnippetString(code)
  } else {
    const { fsMap, entrypoint } = codeOrFsMap
    const mainFile = entrypoint || Object.keys(fsMap)[0]
    code = fsMap[mainFile]
    const fsMapHash = encodeFsMapToHash(fsMap)
    packgaeUrl = `https://tscircuit.com/editor?#data:application/gzip;base64,${fsMapHash}`
    compressedCode = fsMapHash
  }

  const pcbSvgUrl = `${urlPrefix}/?svg_type=pcb&code=${encodeURIComponent(compressedCode)}`
  const pcbPngUrl = `${urlPrefix}/?svg_type=pcb&format=png&code=${encodeURIComponent(compressedCode)}`
  const schSvgUrl = `${urlPrefix}/?svg_type=schematic&code=${encodeURIComponent(compressedCode)}`
  const schPngUrl = `${urlPrefix}/?svg_type=schematic&format=png&code=${encodeURIComponent(compressedCode)}`
  const schSimSvgUrl = `${urlPrefix}/?svg_type=schsim&code=${encodeURIComponent(compressedCode)}`
  const assemblySvgUrl = `${urlPrefix}/?svg_type=assembly&code=${encodeURIComponent(compressedCode)}`
  const assemblyPngUrl = `${urlPrefix}/?svg_type=assembly&format=png&code=${encodeURIComponent(compressedCode)}`
  const pinoutSvgUrl = `${urlPrefix}/?svg_type=pinout&code=${encodeURIComponent(compressedCode)}`
  const pinoutPngUrl = `${urlPrefix}/?svg_type=pinout&format=png&code=${encodeURIComponent(compressedCode)}`
  const threeDSvgUrl = `${urlPrefix}/?svg_type=3d&code=${encodeURIComponent(compressedCode)}`
  const threeDPngUrl = `${urlPrefix}/?svg_type=3d&format=png&code=${encodeURIComponent(compressedCode)}`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>svg.tscircuit.com - Generated URLs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
      font-family: system-ui, -apple-system, sans-serif;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 { margin-bottom: 0.5rem; }
    .container {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .url-table {
      width: 100%;
      border-collapse: collapse;
    }
    .url-table th,
    .url-table td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    .url-table th {
      background: #f5f5f5;
      font-weight: 600;
    }
    .url-table td a {
      color: #0066cc;
      word-break: break-all;
    }
    @media (max-width: 768px) {
      body { padding: 0.5rem; }
      .header, .container { padding: 1rem; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>svg.tscircuit.com</h1>
  </div>
  <div class="container">
    <table class="url-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>URL</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Package URL</td>
          <td><a href="${packgaeUrl}" target="_blank">${packgaeUrl}</a></td>
        </tr>
        <tr>
          <td>PCB SVG URL</td>
          <td><a href="${pcbSvgUrl}" target="_blank">${pcbSvgUrl}</a></td>
        </tr>
        <tr>
          <td>PCB PNG URL</td>
          <td><a href="${pcbPngUrl}" target="_blank">${pcbPngUrl}</a></td>
        </tr>
        <tr>
          <td>Schematic SVG URL</td>
          <td><a href="${schSvgUrl}" target="_blank">${schSvgUrl}</a></td>
        </tr>
        <tr>
          <td>Schematic Simulation SVG URL</td>
          <td><a href="${schSimSvgUrl}" target="_blank">${schSimSvgUrl}</a></td>
        </tr>
        <tr>
          <td>Schematic PNG URL</td>
          <td><a href="${schPngUrl}" target="_blank">${schPngUrl}</a></td>
        </tr>
        <tr>
          <td>Assembly SVG URL</td>
          <td><a href="${assemblySvgUrl}" target="_blank">${assemblySvgUrl}</a></td>
        </tr>
        <tr>
          <td>Assembly PNG URL</td>
          <td><a href="${assemblyPngUrl}" target="_blank">${assemblyPngUrl}</a></td>
        </tr>
        <tr>
          <td>Pinout SVG URL</td>
          <td><a href="${pinoutSvgUrl}" target="_blank">${pinoutSvgUrl}</a></td>
        </tr>
        <tr>
          <td>Pinout PNG URL</td>
          <td><a href="${pinoutPngUrl}" target="_blank">${pinoutPngUrl}</a></td>
        </tr>
        <tr>
          <td>3D SVG URL</td>
          <td><a href="${threeDSvgUrl}" target="_blank">${threeDSvgUrl}</a></td>
        </tr>
        <tr>
          <td>3D PNG URL</td>
          <td><a href="${threeDPngUrl}" target="_blank">${threeDPngUrl}</a></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>
  `
}
