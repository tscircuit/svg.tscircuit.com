import type { NextApiRequest, NextApiResponse } from "next"
import { handleRequest } from "../../handle-request"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Convert NextJS request to standard Request object
  const url = new URL(req.url!, `http://${req.headers.host}`)
  const headers = new Headers(req.headers as any)
  headers.set("x-original-url", req.url ?? "")
  const request = new Request(url, {
    method: req.method,
    headers,
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
  res.send(body)
}
