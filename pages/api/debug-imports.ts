import type { NextApiRequest, NextApiResponse } from "next"
import fs from "node:fs"
import path from "node:path"

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  const results: Record<string, any> = {}

  // Check if manifold-3d exists in node_modules
  const nodeModulesPath = path.join(process.cwd(), "node_modules")
  const manifoldPath = path.join(nodeModulesPath, "manifold-3d")
  const copperPourPath = path.join(
    nodeModulesPath,
    "@tscircuit",
    "copper-pour-solver",
  )

  results["cwd"] = process.cwd()
  results["manifold-3d_exists"] = fs.existsSync(manifoldPath)
  results["copper-pour-solver_exists"] = fs.existsSync(copperPourPath)

  // Check /var/task/node_modules directly
  results["/var/task/node_modules/manifold-3d"] = fs.existsSync(
    "/var/task/node_modules/manifold-3d",
  )
  results["/var/task/node_modules/@tscircuit/copper-pour-solver"] =
    fs.existsSync("/var/task/node_modules/@tscircuit/copper-pour-solver")

  // List what's in @tscircuit/ dir
  try {
    const tscircuitDir = path.join("/var/task/node_modules", "@tscircuit")
    results["@tscircuit_packages"] = fs.readdirSync(tscircuitDir)
  } catch (e: any) {
    results["@tscircuit_packages"] = e.message
  }

  // Check copper-pour-solver's package.json deps
  try {
    const cpPkg = JSON.parse(
      fs.readFileSync(
        path.join(
          "/var/task/node_modules/@tscircuit/copper-pour-solver",
          "package.json",
        ),
        "utf-8",
      ),
    )
    results["copper-pour-solver_version"] = cpPkg.version
    results["copper-pour-solver_deps"] = cpPkg.dependencies
  } catch (e: any) {
    results["copper-pour-solver_pkg"] = e.message
  }

  res.status(200).json({
    nodeVersion: process.version,
    platform: process.platform,
    results,
  })
}
