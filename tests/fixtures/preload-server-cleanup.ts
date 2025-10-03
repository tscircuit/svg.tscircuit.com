import { afterEach } from "bun:test"

declare global {
  // Keep a list of servers to close after each test
  var servers: { url: string; close: () => void }[] | undefined
}

if (!globalThis.servers) {
  globalThis.servers = []
}

afterEach(() => {
  if (!globalThis.servers) return
  for (const server of globalThis.servers) {
    try {
      server.close()
    } catch {
      // ignore cleanup errors
    }
  }
  globalThis.servers = []
})
