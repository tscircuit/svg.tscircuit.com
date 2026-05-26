import { test, expect } from "bun:test"
import { bytesToBase64 } from "../lib/base64"
import { encodeFsMapToHash } from "../lib/fsMap"

test("bytesToBase64 throws RangeError on large payloads due to call stack argument limits", () => {
  // 1MB payload (which triggers the call stack crash in the current spread-operator implementation)
  const largeArray = new Uint8Array(1000000)
  for (let i = 0; i < largeArray.length; i++) {
    largeArray[i] = i % 256
  }

  // NOTE: We intentionally expect this to throw a RangeError due to the spread operator
  // argument stack limitation. We catch and assert on the error so the test passes in CI
  // while successfully proving the existence of the process crash.
  try {
    bytesToBase64(largeArray)
    // If it didn't throw, fail the test
    expect("Should have thrown an error").toBe("but did not")
  } catch (error) {
    expect(error).toBeInstanceOf(RangeError)
    expect((error as Error).message).toContain(
      "Maximum call stack size exceeded",
    )
  }
})

test("encodeFsMapToHash throws RangeError on large fsMap payloads (production scenario)", () => {
  const fsMap: Record<string, string> = {
    "index.tsx": 'export default () => <board width="10mm" height="10mm" />',
  }
  // Generate a 1.2MB non-compressible project file
  let nonRepetitive = ""
  for (let i = 0; i < 240000; i++) {
    nonRepetitive += Math.random().toString(36).substring(2, 7)
  }
  fsMap["large_project_file.txt"] = nonRepetitive

  // NOTE: We expect encodeFsMapToHash to crash with RangeError when encoding a large project
  // because of the underlying bytesToBase64 call stack limitation. We assert on this crash
  // to prove the production scenario fails while keeping the test suite green.
  try {
    encodeFsMapToHash(fsMap)
    // If it didn't throw, fail the test
    expect("Should have thrown an error").toBe("but did not")
  } catch (error) {
    expect(error).toBeInstanceOf(RangeError)
    expect((error as Error).message).toContain(
      "Maximum call stack size exceeded",
    )
  }
})
