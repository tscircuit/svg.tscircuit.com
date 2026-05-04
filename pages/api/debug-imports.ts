import type { NextApiRequest, NextApiResponse } from "next"

let importError: string | null = null
let endpointModule: any = null

try {
  endpointModule = require("../../endpoint")
} catch (e: any) {
  importError = `${e.name}: ${e.message}\n${e.stack?.slice(0, 2000)}`
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  res.status(200).json({
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    importError,
    endpointLoaded: !!endpointModule,
  })
}
