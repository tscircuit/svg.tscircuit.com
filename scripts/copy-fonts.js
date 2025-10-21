#!/usr/bin/env node
import { copyFileSync, mkdirSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, "..")

try {
  const fontsDir = join(projectRoot, "fonts")
  mkdirSync(fontsDir, { recursive: true })

  const sourcePath = join(
    projectRoot,
    "node_modules",
    "dejavu-fonts-ttf",
    "ttf",
    "DejaVuSans.ttf",
  )
  const destPath = join(fontsDir, "DejaVuSans.ttf")

  copyFileSync(sourcePath, destPath)
  console.log("✓ Copied DejaVuSans.ttf to fonts directory")
} catch (err) {
  console.error("Warning: Could not copy font files:", err.message)
  // Don't fail the build if fonts already exist
}
