import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"

test("endpoint error handling for generate_url", async () => {
  const { serverUrl } = await getTestServer()

  // Test missing code parameter for generate_url
  const response = await fetch(`${serverUrl}/generate_url`)
  expect(response.status).toBe(400)

  const errorData = await response.json()
  expect(errorData.ok).toBe(false)
  expect(errorData.error).toContain(
    "No code parameter provided for URL generation",
  )
})
