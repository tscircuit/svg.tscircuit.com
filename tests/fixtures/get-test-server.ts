import getPort from "get-port"
import endpoint from "../../endpoint"
import { afterEach } from "bun:test"

const activeServers = new Set<ReturnType<typeof Bun.serve>>()

afterEach(() => {
  for (const server of activeServers) {
    server.stop()
  }

  activeServers.clear()
})

export const getTestServer = async () => {
  const port = await getPort()

  const serverUrl = `http://localhost:${port}`

  const server = Bun.serve({
    port,
    fetch: endpoint,
    idleTimeout: 20,
  })

  activeServers.add(server)

  return {
    serverUrl,
  }
}
