import type { NextApiRequest, NextApiResponse } from "next"
import endpoint from "../../endpoint"

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

  // Call the endpoint handler
  const response = await endpoint(request)

  // Convert response back to NextJS format
  const body = await response.text()

  // @ts-ignore
  const headers = Object.fromEntries(response.headers.entries())

  res.status(response.status)
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value)
  })
  res.send(body)
}
