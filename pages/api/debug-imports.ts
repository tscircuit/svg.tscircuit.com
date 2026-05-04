import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  const results: Record<string, string> = {}

  // Test each import that endpoint.ts uses
  try {
    await import("@tscircuit/ngspice-spice-engine")
    results["ngspice-spice-engine"] = "OK"
  } catch (e: any) {
    results["ngspice-spice-engine"] = e.stack?.slice(0, 500) || e.message
  }

  try {
    await import("@tscircuit/eval/eval")
    results["eval/eval"] = "OK"
  } catch (e: any) {
    results["eval/eval"] = e.stack?.slice(0, 500) || e.message
  }

  try {
    await import("@tscircuit/eval")
    results["eval"] = "OK"
  } catch (e: any) {
    results["eval"] = e.stack?.slice(0, 500) || e.message
  }

  try {
    await import("circuit-to-svg")
    results["circuit-to-svg"] = "OK"
  } catch (e: any) {
    results["circuit-to-svg"] = e.stack?.slice(0, 500) || e.message
  }

  try {
    await import("circuit-json-to-gltf")
    results["circuit-json-to-gltf"] = "OK"
  } catch (e: any) {
    results["circuit-json-to-gltf"] = e.stack?.slice(0, 500) || e.message
  }

  try {
    await import("@resvg/resvg-js")
    results["resvg-js"] = "OK"
  } catch (e: any) {
    results["resvg-js"] = e.stack?.slice(0, 500) || e.message
  }

  try {
    await import("@neplex/vectorizer")
    results["vectorizer"] = "OK"
  } catch (e: any) {
    results["vectorizer"] = e.stack?.slice(0, 500) || e.message
  }

  try {
    await import("poppygl")
    results["poppygl"] = "OK"
  } catch (e: any) {
    results["poppygl"] = e.stack?.slice(0, 500) || e.message
  }

  try {
    await import("fflate")
    results["fflate"] = "OK"
  } catch (e: any) {
    results["fflate"] = e.stack?.slice(0, 500) || e.message
  }

  res.status(200).json({
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    results,
  })
}
