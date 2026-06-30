import { expect, test } from "bun:test"
import { Buffer } from "node:buffer"
import testCircuitJson from "./fixtures/test-circuit.json"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"
import { render3dPng } from "../lib/render3dPng"

test(
  "3d rendering benchmark and output size comparison",
  async () => {
    // SVG path: 3D PNG render vectorized back into SVG
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

    // Direct 3D PNG rendering via circuit-json-to-3d-png
    const startPng = performance.now()
    const png3d = await render3dPng(testCircuitJson as any, {
      backgroundColor: "#ffffff",
      zoomMultiplier: 1.2,
    })
    const durationPng = performance.now() - startPng

    expect(png3d).toBeInstanceOf(Uint8Array)

    const sizePng = png3d.byteLength

    // Basic sanity checks
    expect(durationVectorized).toBeGreaterThan(0)
    expect(durationPng).toBeGreaterThan(0)
    expect(sizeVectorized).toBeGreaterThan(0)
    expect(sizePng).toBeGreaterThan(0)

    // Log benchmark results for visibility in CI
    console.log(
      `[3d benchmark] vectorized-svg: ${durationVectorized.toFixed(1)}ms, size=${sizeVectorized}B; direct-png: ${durationPng.toFixed(1)}ms, size=${sizePng}B`,
    )
  },
  { timeout: 30000 },
)
