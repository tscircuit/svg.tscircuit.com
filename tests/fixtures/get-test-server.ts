import getPort from "get-port"
import endpoint from "../../endpoint"
import { afterEach } from "bun:test"

export const getTestServer = async () => {
  const port = await getPort()

  const serverUrl = `http://localhost:${port}`

  const server = Bun.serve({
    port,
    fetch: endpoint,
    idleTimeout: 20,
  })

  afterEach(() => {
    server.stop()
  })

  return {
    serverUrl,
  }
}
