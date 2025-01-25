import { CircuitRunner } from "@tscircuit/eval-webworker/eval";
import { getUncompressedSnippetString } from "@tscircuit/create-snippet-url";
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg";
import { getIndexPageHtml } from "./get-index-page-html";
import { getHtmlForGeneratedUrlPage } from "./get-html-for-generated-url-page";

export default async (req: Request) => {
  try {
    const url = new URL(req.url.replace("/api", "/"));

    const host = `${url.protocol}//${url.host}`;

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }));
    }

    if (url.pathname === "/generate_url") {
      const code = url.searchParams.get("code");

      return new Response(getHtmlForGeneratedUrlPage(code!, host), {
        headers: {
          "Content-Type": "text/html",
        },
      });
    }

    if (url.pathname === "/" && !url.searchParams.get("code")) {
      return new Response(getIndexPageHtml(), {
        headers: {
          "Content-Type": "text/html",
        },
      });
    }

    const compressedCode = url.searchParams.get("code");
    const svgType = url.searchParams.get("svg_type");

    if (!compressedCode) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No code parameter provided",
        }),
      );
    }

    const userCode = getUncompressedSnippetString(compressedCode);

    const worker = new CircuitRunner();

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
    });

    await worker.renderUntilSettled();

    const circuitJson = await worker.getCircuitJson();

    let svgContent: string;

    if (svgType === "pcb") {
      svgContent = convertCircuitJsonToPcbSvg(circuitJson);
    } else if (svgType === "schematic") {
      svgContent = convertCircuitJsonToSchematicSvg(circuitJson);
    } else {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { message: "Invalid svg_type" },
        }),
      );
    }

    return new Response(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e: any) {
    return new Response(getErrorSvg(e.message.toString()), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
};
const getErrorSvg = (err: string) => {
  const splitMessage = (msg: string): string[] => {
    const chunks: string[] = [];
    let currentChunk = "";

    msg.split(" ").forEach((word) => {
      if ((currentChunk + word).length > 24) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      currentChunk += `${word} `;
    });
    chunks.push(currentChunk.trim());
    return chunks.slice(0, 3); // Max 3 lines
  };

  const errorLines = splitMessage(err);

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 220" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
<style>
  .error-primary { fill: #dc2626; }
  .error-secondary { fill: #991b1b; }
  .error-text { font: 600 16px 'Segoe UI', Arial, sans-serif; }
  .error-subtext { font: 400 12px 'Segoe UI', Arial, sans-serif; }
  .container { filter: drop-shadow(0 2px 8px rgba(0,0,0,0.1)); }
</style>

<!-- Container with padding -->
<g class="container" transform="translate(30, 20)">
  <rect x="0" y="0" width="240" height="180" rx="8" fill="#ffffff" stroke="#fecaca" stroke-width="2"/>
  
  <!-- Centered Icon -->
  <g transform="translate(120, 60)">
    <circle cx="0" cy="0" r="30" fill="#fee2e2"/>
    <path class="error-primary" 
          d="M -4,-18 L 4,-18 0,12 Z M 0,16 A 2 2 0 0 1 0,20 2 2 0 0 1 0,16 Z"
          transform="translate(0 2)"/>
  </g>

  <!-- Text with padding -->
  <text x="120" y="120" class="error-text error-primary" text-anchor="middle">
    Error Occurred
  </text>
  
  <text x="120" y="140" class="error-subtext error-secondary" text-anchor="middle">
    ${errorLines
      .map(
        (line, i) =>
          `<tspan x="120" dy="${i === 0 ? 0 : "1.4em"}">${line}</tspan>`,
      )
      .join("")}
  </text>
</g>
</svg>`.trim();
};
