import getPort from "get-port"
import { handleRequest } from "../../handle-request"

export const getTestServer = async () => {
  const port = await getPort()

  const serverUrl = `http://localhost:${port}`

  const server = Bun.serve({
    port,
    fetch: handleRequest,
    idleTimeout: 20,
  })
  ;(globalThis as any).servers?.push({
    url: serverUrl,
    close: () => server.stop(),
  })

  return {
    serverUrl,
  }
}
