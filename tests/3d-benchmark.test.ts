import { expect, test } from "bun:test"
import { Buffer } from "node:buffer"
import testCircuitJson from "./fixtures/test-circuit.json"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"
import { convertCircuitJsonToSimple3dSvg } from "circuit-json-to-simple-3d"

test(
  "3d rendering benchmark and size comparison",
  async () => {
    // Vectorized 3D (PNG -> @neplex/vectorizer)
    const startVectorized = performance.now()
    const vectorizedSvg = await renderCircuitToSvg(
      testCircuitJson as any,
      "3d",
      {
        backgroundColor: "#ffffff",
        backgroundOpacity: 0.0,
        zoomMultiplier: 1.2,
      },
    )
    const durationVectorized = performance.now() - startVectorized

    expect(typeof vectorizedSvg).toBe("string")
    expect(vectorizedSvg).toContain("<svg")

    const sizeVectorized = Buffer.byteLength(vectorizedSvg, "utf8")

    // Deprecated simple 3D SVG
    const startSimple3d = performance.now()
    const simple3dSvg = (await convertCircuitJsonToSimple3dSvg(
      testCircuitJson as any,
      {
        background: {
          color: "#ffffff",
          opacity: 0.0,
        },
        defaultZoomMultiplier: 1.2,
      },
    )) as string
    const durationSimple3d = performance.now() - startSimple3d

    expect(typeof simple3dSvg).toBe("string")
    expect(simple3dSvg).toContain("<svg")

    const sizeSimple3d = Buffer.byteLength(simple3dSvg, "utf8")

    // Basic sanity checks
    expect(durationVectorized).toBeGreaterThan(0)
    expect(durationSimple3d).toBeGreaterThan(0)
    expect(sizeVectorized).toBeGreaterThan(0)
    expect(sizeSimple3d).toBeGreaterThan(0)

    // Log benchmark results for visibility in CI
    console.log(
      `[3d benchmark] vectorized: ${durationVectorized.toFixed(1)}ms, size=${sizeVectorized}B; simple3d: ${durationSimple3d.toFixed(1)}ms, size=${sizeSimple3d}B`,
    )
  },
  { timeout: 30000 },
)
