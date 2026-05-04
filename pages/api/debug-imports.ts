import type { NextApiRequest, NextApiResponse } from "next"
import endpoint from "../../endpoint"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const testUrl = new URL("/health", `http://${req.headers.host}`)
    const testRequest = new Request(testUrl, {
      method: "GET",
      headers: new Headers({ host: req.headers.host as string }),
    })

    const response = await endpoint(testRequest)
    const body = await response.text()

    res.status(200).json({
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      endpointStatus: response.status,
      endpointBody: body.slice(0, 500),
    })
  } catch (e: any) {
    res.status(200).json({
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      runtimeError: `${e.name}: ${e.message}`,
      stack: e.stack?.slice(0, 3000),
    })
  }
}
