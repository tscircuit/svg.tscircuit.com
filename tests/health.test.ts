import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"

test("GET /health", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(`${serverUrl}/health`)
  const data = await response.json()

  expect(data).toEqual({ ok: true })
})
