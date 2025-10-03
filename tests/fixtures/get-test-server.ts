import getPort from "get-port"
import endpoint from "../../endpoint"

export const getTestServer = async () => {
  const port = await getPort()

  const serverUrl = `http://localhost:${port}`

  const server = Bun.serve({
    port,
    fetch: endpoint,
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
