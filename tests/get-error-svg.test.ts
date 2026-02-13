import { expect, test } from "bun:test"
import { getErrorSvg } from "../getErrorSvg"

test("keeps message content after inner colons", () => {
  const svg = getErrorSvg("Error: Missing ports in net NET1: R3, R4")

  expect(svg).toContain("Missing ports in net NET1:")
  expect(svg).toContain("R3, R4")
})

test("strips Error prefix only when present", () => {
  const svg = getErrorSvg("Error: Invalid svg_type or view parameter")

  expect(svg).toContain("Invalid svg_type or view")
  expect(svg).toContain("parameter")
  expect(svg).not.toContain("Error:")
})
