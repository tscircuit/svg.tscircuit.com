import { expect, type MatcherResult } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import looksSame from "looks-same"
import { svgToPng } from "../../lib/svgToPng"

/**
 * Matcher for 3D SVG snapshot testing using visual diff like PNG matcher.
 *
 * It stores SVG snapshots as .snap.svg files but compares them visually by
 * rasterizing both the received SVG and the snapshot SVG to PNG buffers and
 * computing a diff percentage (same logic/threshold as PNG matcher).
 *
 * Usage:
 *   expect(svgString).toMatch3dSvgSnapshot(import.meta.path, "optionalName");
 */
async function toMatch3dSvgSnapshot(
  // biome-ignore lint/suspicious/noExplicitAny: bun doesn't expose
  this: any,
  receivedMaybePromise: string | Promise<string>,
  testPathOriginal: string,
  svgName?: string,
): Promise<MatcherResult> {
  const received = await receivedMaybePromise
  const testPath = testPathOriginal
    .replace(/\.test\.tsx?$/, "")
    .replace(/\.test\.ts$/, "")
  const snapshotDir = path.join(path.dirname(testPath), "__snapshots__")
  const snapshotName = `${path.basename(testPath)}${svgName ? "-" + svgName : ""}.snap.svg`
  const filePath = path.join(snapshotDir, snapshotName)

  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true })
  }

  const updateSnapshot =
    process.argv.includes("--update-snapshots") ||
    process.argv.includes("-u") ||
    Boolean(process.env["BUN_UPDATE_SNAPSHOTS"])
  const forceUpdate = Boolean(process.env["FORCE_BUN_UPDATE_SNAPSHOTS"])

  const fileExists = fs.existsSync(filePath)

  if (!fileExists) {
    console.log("Writing 3D SVG snapshot to", filePath)
    fs.writeFileSync(filePath, received, "utf8")
    return {
      message: () => `3D SVG snapshot created at ${filePath}`,
      pass: true,
    }
  }

  const existingSnapshotSvg = fs.readFileSync(filePath, "utf8")

  // Rasterize both SVGs to PNG for visual comparison
  const [currentPngAB, referencePngAB] = await Promise.all([
    svgToPng(received, { width: 1024, height: 1024, density: 300 }),
    svgToPng(existingSnapshotSvg, { width: 1024, height: 1024, density: 300 }),
  ])
  const currentPng = Buffer.from(new Uint8Array(currentPngAB))
  const referencePng = Buffer.from(new Uint8Array(referencePngAB))

  const result: any = await looksSame(referencePng, currentPng, {
    strict: false,
    tolerance: 5,
    antialiasingTolerance: 4,
    ignoreCaret: true,
    shouldCluster: true,
    clustersSize: 10,
  })

  if (updateSnapshot) {
    if (!forceUpdate && result.equal) {
      return {
        message: () => "3D SVG snapshot matches",
        pass: true,
      }
    }
    console.log("Updating 3D SVG snapshot at", filePath)
    fs.writeFileSync(filePath, received, "utf8")
    return {
      message: () => `3D SVG snapshot updated at ${filePath}`,
      pass: true,
    }
  }

  if (result.equal) {
    return {
      message: () => "3D SVG snapshot matches",
      pass: true,
    }
  }

  // Calculate diff percentage for cross-platform tolerance (same as PNG matcher)
  if (result.diffBounds) {
    // Extract image dimensions from the PNG buffer
    const width = referencePng.readUInt32BE(16)
    const height = referencePng.readUInt32BE(20)
    const totalPixels = width * height

    const diffArea =
      (result.diffBounds.right - result.diffBounds.left) *
      (result.diffBounds.bottom - result.diffBounds.top)
    const diffPercentage = (diffArea / totalPixels) * 100

    // Keep parity with PNG matcher threshold
    const ACCEPTABLE_DIFF_PERCENTAGE = 20.0

    if (diffPercentage <= ACCEPTABLE_DIFF_PERCENTAGE) {
      console.log(
        `✓ 3D SVG snapshot matches (${diffPercentage.toFixed(3)}% difference, within ${ACCEPTABLE_DIFF_PERCENTAGE}% threshold)`,
      )
      return {
        message: () =>
          `3D SVG snapshot matches (${diffPercentage.toFixed(3)}% difference)`,
        pass: true,
      }
    }

    // If difference is too large, create diff image
    const diffPath = filePath.replace(/\.snap\.svg$/, ".diff.png")
    await looksSame.createDiff({
      reference: referencePng,
      current: currentPng,
      diff: diffPath,
      highlightColor: "#ff00ff",
    })

    return {
      message: () =>
        `3D SVG snapshot differs by ${diffPercentage.toFixed(3)}% (threshold: ${ACCEPTABLE_DIFF_PERCENTAGE}%). Diff saved at ${diffPath}. Use BUN_UPDATE_SNAPSHOTS=1 to update the snapshot.`,
      pass: false,
    }
  }

  // Fallback if diffBounds isn't available
  const diffPath = filePath.replace(/\.snap\.svg$/, ".diff.png")
  await looksSame.createDiff({
    reference: referencePng,
    current: currentPng,
    diff: diffPath,
    highlightColor: "#ff00ff",
  })

  console.log(`📸 3D SVG Snapshot mismatch (no diff bounds available)`)
  console.log(`   Diff saved: ${diffPath}`)

  return {
    message: () => `3D SVG snapshot does not match. Diff saved at ${diffPath}`,
    pass: false,
  }
}

// Register the matcher globally for Bun's expect
expect.extend({
  toMatch3dSvgSnapshot: toMatch3dSvgSnapshot as any,
})

declare module "bun:test" {
  interface Matchers<T = unknown> {
    toMatch3dSvgSnapshot(
      testPath: string,
      svgName?: string,
    ): Promise<MatcherResult>
  }
}
