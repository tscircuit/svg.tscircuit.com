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
      if ((currentChunk + word).length > 32) {
        // Increased character limit
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
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
<style>
  .error-subtext {
    font: 400 16px/1.4 'Segoe UI', system-ui, sans-serif;
    fill: #dc2626;
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
</svg>`.trim();
};
