import {
  createGeneratedSvgUrls,
  type GeneratedUrlInput,
  type GeneratedSvgUrls,
} from "./lib/createGeneratedSvgUrls"

const renderUrlRow = (label: string, url: string) => `
        <tr>
          <td>${label}</td>
          <td><a href="${url}" target="_blank">${url}</a></td>
        </tr>`

const renderGeneratedUrlRows = (urls: GeneratedSvgUrls) =>
  [
    renderUrlRow("Package URL", urls.packageUrl),
    renderUrlRow("PCB SVG URL", urls.pcbSvgUrl),
    renderUrlRow("PCB PNG URL", urls.pcbPngUrl),
    renderUrlRow("Schematic SVG URL", urls.schSvgUrl),
    renderUrlRow("Schematic Simulation SVG URL", urls.schSimSvgUrl),
    renderUrlRow("Simulation Graph SVG URL", urls.simSvgUrl),
    renderUrlRow("Schematic PNG URL", urls.schPngUrl),
    renderUrlRow("Assembly SVG URL", urls.assemblySvgUrl),
    renderUrlRow("Assembly PNG URL", urls.assemblyPngUrl),
    renderUrlRow("Pinout SVG URL", urls.pinoutSvgUrl),
    renderUrlRow("Pinout PNG URL", urls.pinoutPngUrl),
    renderUrlRow("3D SVG URL", urls.threeDSvgUrl),
    renderUrlRow("3D PNG URL", urls.threeDPngUrl),
  ].join("")

export const getHtmlForGeneratedUrlPage = (
  codeOrFsMap: GeneratedUrlInput,
  urlPrefix = "https://svg.tscircuit.com",
) => {
  const urls = createGeneratedSvgUrls(codeOrFsMap, urlPrefix)

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
      <tbody>${renderGeneratedUrlRows(urls)}
      </tbody>
    </table>
  </div>
</body>
</html>
  `
}
