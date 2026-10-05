import type { NextApiRequest, NextApiResponse } from "next"
import { handleRequest } from "../shared/handle-request"
import { streamImageBody } from "../lib/streamImageBody"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Convert NextJS request to standard Request object
  const url = new URL(req.url!, `http://${req.headers.host}`)
  const request = new Request(url, {
    method: req.method,
    headers: new Headers(req.headers as any),
    body: req.body ? JSON.stringify(req.body) : undefined,
  })

  // Call the shared request handler.
  const response = await handleRequest(request)

  // Convert response back to NextJS format
  const contentType = response.headers.get("Content-Type") || ""

  // Handle binary data (PNG images) differently from text responses
  let body: string | Buffer
  if (contentType.includes("image/png")) {
    const arrayBuffer = await response.arrayBuffer()
    body = Buffer.from(arrayBuffer)
  } else {
    body = await response.text()
  }

  // @ts-ignore
  const headers = Object.fromEntries(response.headers.entries())

  res.status(response.status)
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value)
  })
  // Large diagrams can exceed Vercel's 4.5 MB buffered response limit.
  // Streaming keeps their original image bytes and permits CDN caching.
  if (
    contentType.startsWith("image/") &&
    Buffer.byteLength(body) > 1024 * 1024
  ) {
    res.removeHeader("Content-Length")
    await streamImageBody(body, res)
  } else {
    res.send(body)
  }
}
