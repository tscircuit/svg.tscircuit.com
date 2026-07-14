import {
  createGeneratedSvgUrls,
  type GeneratedUrlInput,
  type GeneratedSvgUrls,
} from "./lib/createGeneratedSvgUrls"
import type { SimulationExperiment } from "circuit-json"

type SimulationExperimentForGeneratedUrl = Pick<
  SimulationExperiment,
  "simulation_experiment_id" | "name"
>

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  )

const renderUrlRow = (label: string, url: string) => `
        <tr>
          <td>${escapeHtml(label)}</td>
          <td><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url)}</a></td>
        </tr>`

const selectSimulationExperiment = (
  url: string,
  experiment: SimulationExperimentForGeneratedUrl,
  useName: boolean,
) => {
  const selectedUrl = new URL(url)
  if (useName) {
    selectedUrl.searchParams.set("simulation_experiment_name", experiment.name)
  } else {
    selectedUrl.searchParams.set(
      "simulation_experiment_id",
      experiment.simulation_experiment_id,
    )
  }
  return selectedUrl.toString()
}

const renderSimulationUrlRows = (
  urls: GeneratedSvgUrls,
  simulationExperiments: SimulationExperimentForGeneratedUrl[],
) => {
  if (simulationExperiments.length === 0) {
    return [
      renderUrlRow("Schematic Simulation SVG URL", urls.schSimSvgUrl),
      renderUrlRow("Simulation Graph SVG URL", urls.simSvgUrl),
    ]
  }

  const nameCounts = new Map<string, number>()
  for (const experiment of simulationExperiments) {
    const name = experiment.name.trim()
    if (name) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
  }

  return simulationExperiments.flatMap((experiment) => {
    const name = experiment.name.trim()
    const useName = Boolean(name) && nameCounts.get(name) === 1
    const label = useName
      ? name
      : name
        ? `${name} (${experiment.simulation_experiment_id})`
        : experiment.simulation_experiment_id

    return [
      renderUrlRow(
        `Schematic Simulation SVG URL — ${label}`,
        selectSimulationExperiment(urls.schSimSvgUrl, experiment, useName),
      ),
      renderUrlRow(
        `Simulation Graph SVG URL — ${label}`,
        selectSimulationExperiment(urls.simSvgUrl, experiment, useName),
      ),
    ]
  })
}

const renderGeneratedUrlRows = (
  urls: GeneratedSvgUrls,
  simulationExperiments: SimulationExperimentForGeneratedUrl[],
) =>
  [
    renderUrlRow("Package URL", urls.packageUrl),
    renderUrlRow("PCB SVG URL", urls.pcbSvgUrl),
    renderUrlRow("PCB PNG URL", urls.pcbPngUrl),
    renderUrlRow("Schematic SVG URL", urls.schSvgUrl),
    ...renderSimulationUrlRows(urls, simulationExperiments),
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
  simulationExperiments: SimulationExperimentForGeneratedUrl[] = [],
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
      <tbody>${renderGeneratedUrlRows(urls, simulationExperiments)}
      </tbody>
    </table>
  </div>
</body>
</html>
  `
}
