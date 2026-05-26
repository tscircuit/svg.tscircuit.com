import { expect, test } from "bun:test"
import { base64ToBytes, bytesToBase64 } from "../lib/base64"
import { encodeFsMapToHash } from "../lib/fsMap"

test("bytesToBase64 handles large payloads without exceeding call stack limit", () => {
  const largeArray = new Uint8Array(1000000)
  for (let i = 0; i < largeArray.length; i++) {
    largeArray[i] = i % 256
  }

  // Under the new Buffer-backed implementation, this runs successfully and stack-safely!
  const encoded = bytesToBase64(largeArray)
  expect(encoded).toBeDefined()
  expect(encoded.length).toBeGreaterThan(0)

  const decoded = base64ToBytes(encoded)
  expect(decoded).toEqual(largeArray)
})

test("encodeFsMapToHash encodes large fsMap payloads successfully (production scenario)", () => {
  const fsMap: Record<string, string> = {
    "index.tsx": 'export default () => <board width="10mm" height="10mm" />',
  }
  // Generate a 1.2MB non-compressible project file
  let nonRepetitive = ""
  for (let i = 0; i < 240000; i++) {
    nonRepetitive += Math.random().toString(36).substring(2, 7)
  }
  fsMap["large_project_file.txt"] = nonRepetitive

  // Under the new Buffer-backed implementation, encoding large projects runs perfectly and successfully!
  const encodedFsMap = encodeFsMapToHash(fsMap)
  expect(encodedFsMap).toBeDefined()
  expect(encodedFsMap.length).toBeGreaterThan(0)
})
