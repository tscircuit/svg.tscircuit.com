import {
  getCompressedBase64SnippetString,
  createSnippetUrl,
} from "@tscircuit/create-snippet-url"
import { encodeFsMapToHash } from "./lib/fsMap"

const maxReliableGetUrlLength = 6000

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const escapeScriptJson = (value: unknown) =>
  JSON.stringify(value).replaceAll("</script", "<\\/script")

const getDisplayUrl = (url: string) => {
  if (url.length <= 160) return url
  return `${url.slice(0, 96)}...${url.slice(-40)}`
}

const renderUrlRow = (label: string, url: string) => `
        <tr>
          <td>${escapeHtml(label)}</td>
          <td><a href="${escapeHtml(url)}" target="_blank" title="${escapeHtml(url)}">${escapeHtml(getDisplayUrl(url))}</a></td>
        </tr>`

const renderPostActionRow = (label: string, action: string) => `
        <tr>
          <td>${escapeHtml(label)}</td>
          <td>
            <button class="render-button" type="button" data-action="${escapeHtml(action)}">Open</button>
          </td>
        </tr>`

const getOutputs = (
  urlPrefix: string,
): Array<{ label: string; action: string }> => [
  { label: "PCB SVG", action: `${urlPrefix}/?svg_type=pcb` },
  { label: "PCB PNG", action: `${urlPrefix}/?svg_type=pcb&format=png` },
  { label: "Schematic SVG", action: `${urlPrefix}/?svg_type=schematic` },
  {
    label: "Schematic Simulation SVG",
    action: `${urlPrefix}/?svg_type=schsim`,
  },
  {
    label: "Schematic PNG",
    action: `${urlPrefix}/?svg_type=schematic&format=png`,
  },
  { label: "Assembly SVG", action: `${urlPrefix}/?svg_type=assembly` },
  {
    label: "Assembly PNG",
    action: `${urlPrefix}/?svg_type=assembly&format=png`,
  },
  { label: "Pinout SVG", action: `${urlPrefix}/?svg_type=pinout` },
  { label: "Pinout PNG", action: `${urlPrefix}/?svg_type=pinout&format=png` },
  { label: "3D SVG", action: `${urlPrefix}/?svg_type=3d` },
  { label: "3D PNG", action: `${urlPrefix}/?svg_type=3d&format=png` },
]

const addCodeParam = (action: string, compressedCode: string) => {
  const separator = action.includes("?") ? "&" : "?"
  return `${action}${separator}code=${encodeURIComponent(compressedCode)}`
}

const getPostModeNotice = (usePostMode: boolean) => {
  if (!usePostMode) return ""
  return `<p class="mode-note">This project contains local files that are too large for reliable GET URLs. Use the buttons below; each output is rendered with a POST request.</p>`
}

const getPostModeScript = (postPayload: unknown) => {
  if (!postPayload) return ""
  return `<script id="post-payload" type="application/json">${escapeScriptJson(postPayload)}</script>
  <script>
    const postPayload = JSON.parse(document.getElementById("post-payload").textContent);
    const statusEl = document.getElementById("status");

    const renderOutput = async (button) => {
      const targetWindow = window.open("about:blank", "_blank");
      button.disabled = true;
      const previousText = button.textContent;
      button.textContent = "Rendering...";
      statusEl.textContent = \`Rendering \${button.closest("tr").firstElementChild.textContent}...\`;

      try {
        const response = await fetch(button.dataset.action, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(postPayload),
        });

        if (!response.ok) {
          let message = \`Render failed with status \${response.status}\`;
          try {
            const data = await response.json();
            message = data.error || message;
          } catch {}
          throw new Error(message);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        if (targetWindow) {
          targetWindow.location.href = objectUrl;
        } else {
          window.location.href = objectUrl;
        }
        statusEl.textContent = "Rendered with POST.";
      } catch (error) {
        if (targetWindow) {
          targetWindow.document.body.textContent = error.message;
        }
        statusEl.textContent = \`Error: \${error.message}\`;
      } finally {
        button.disabled = false;
        button.textContent = previousText;
      }
    };

    document.querySelectorAll(".render-button").forEach((button) => {
      button.addEventListener("click", () => renderOutput(button));
    });
  </script>`
}

export const getHtmlForGeneratedUrlPage = (
  codeOrFsMap: string | { fsMap: Record<string, string>; entrypoint?: string },
  urlPrefix = "https://svg.tscircuit.com",
) => {
  let packageUrl: string
  let compressedCode: string
  let fsMapForPost: Record<string, string> | undefined
  let mainComponentPathForPost: string | undefined

  if (typeof codeOrFsMap === "string") {
    packageUrl = createSnippetUrl(codeOrFsMap)
    compressedCode = getCompressedBase64SnippetString(codeOrFsMap)
  } else {
    const { fsMap, entrypoint } = codeOrFsMap
    const mainFile = entrypoint || Object.keys(fsMap)[0]
    fsMapForPost = fsMap
    mainComponentPathForPost = mainFile
    const fsMapHash = encodeFsMapToHash(fsMap)
    packageUrl = `https://tscircuit.com/editor?#data:application/gzip;base64,${fsMapHash}`
    compressedCode = fsMapHash
  }

  const outputs = getOutputs(urlPrefix)
  const outputsWithUrls = outputs.map((output) => ({
    ...output,
    url: addCodeParam(output.action, compressedCode),
  }))
  const usePostMode =
    Boolean(fsMapForPost) &&
    [packageUrl, ...outputsWithUrls.map((output) => output.url)].some(
      (url) => url.length > maxReliableGetUrlLength,
    )
  const postPayload = fsMapForPost
    ? {
        fs_map: fsMapForPost,
        main_component_path: mainComponentPathForPost,
      }
    : undefined
  const rows = usePostMode
    ? [
        `
        <tr>
          <td>Package URL</td>
          <td><span class="muted">Not available for large local-file projects without server-side storage.</span></td>
        </tr>`,
        ...outputs.map((output) =>
          renderPostActionRow(output.label, output.action),
        ),
      ].join("")
    : [
        renderUrlRow("Package URL", packageUrl),
        ...outputsWithUrls.map((output) =>
          renderUrlRow(`${output.label} URL`, output.url),
        ),
      ].join("")
  const modeNotice = getPostModeNotice(usePostMode)
  const postModeScript = getPostModeScript(
    usePostMode ? postPayload : undefined,
  )
  const actionColumnLabel = usePostMode ? "Action" : "URL"

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
    .muted {
      color: #64748b;
    }
    .mode-note {
      margin-bottom: 1rem;
      color: #475569;
    }
    .render-button {
      border: none;
      border-radius: 4px;
      background: #0066cc;
      color: white;
      cursor: pointer;
      font: inherit;
      padding: 0.45rem 0.85rem;
    }
    .render-button:hover { background: #0052a3; }
    .render-button[disabled] {
      cursor: wait;
      opacity: 0.7;
    }
    .status {
      margin-top: 1rem;
      color: #475569;
      font-size: 0.9rem;
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
    ${modeNotice}
    <table class="url-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>${actionColumnLabel}</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
    <div id="status" class="status"></div>
  </div>
  ${postModeScript}
</body>
</html>
  `
}
