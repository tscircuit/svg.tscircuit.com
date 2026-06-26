import { expect, test } from "bun:test"
import { normalizeError } from "../lib/normalizeError"

test("classifies syntax failures as compilation errors", () => {
  const normalizedError = normalizeError(
    new Error('Eval compiled js error for "index.tsx": Unexpected token (1:11)'),
  )

  expect(normalizedError.title).toBe("Compilation Error")
  expect(normalizedError.status).toBe(400)
})

test("classifies non-compilation failures as rendering errors", () => {
  const normalizedError = normalizeError(
    new Error("Failed to convert GLB to PNG"),
  )

  expect(normalizedError.title).toBe("Rendering Error")
  expect(normalizedError.status).toBe(500)
})
