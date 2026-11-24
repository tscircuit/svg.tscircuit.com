import { expect, test } from "bun:test"
import { parsePositiveInt } from "../lib/parsePositiveInt"

test("parsePositiveInt rejects malformed integer strings", () => {
  expect(parsePositiveInt("96")).toBe(96)
  expect(parsePositiveInt("96px")).toBeUndefined()
  expect(parsePositiveInt("96.5")).toBeUndefined()
  expect(parsePositiveInt("96abc")).toBeUndefined()
})
