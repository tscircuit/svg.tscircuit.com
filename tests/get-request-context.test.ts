import { expect, test } from "bun:test"
import { getRequestContext } from "../lib/getRequestContext"

test("getRequestContext preserves plus signs from x-original-url", async () => {
  const normalizedUrl = "http://localhost/?svg_type=schsim&code=abc+def"
  const request = new Request(normalizedUrl, {
    headers: {
      "x-original-url": "/?svg_type=schsim&code=abc+def",
    },
  })

  const context = await getRequestContext(request)
  expect(context).not.toBeInstanceOf(Response)

  if (context instanceof Response) {
    throw new Error("Expected request context, received Response")
  }

  expect(context.compressedCode).toBe("abc+def")
})
