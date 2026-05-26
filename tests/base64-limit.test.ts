import { test, expect } from "bun:test"
import { bytesToBase64, base64ToBytes } from "../lib/base64"

test("bytesToBase64 handles large payloads without exceeding call stack limit", () => {
  // 1MB payload (which triggers the crash in buggy code)
  const largeArray = new Uint8Array(1000000)
  for (let i = 0; i < largeArray.length; i++) {
    largeArray[i] = i % 256
  }

  const encoded = bytesToBase64(largeArray)
  expect(encoded).toBeDefined()
  expect(encoded.length).toBeGreaterThan(0)

  const decoded = base64ToBytes(encoded)
  expect(decoded).toEqual(largeArray)
})
