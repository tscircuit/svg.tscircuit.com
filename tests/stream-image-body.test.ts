import { expect, test } from "bun:test"
import { Writable } from "node:stream"
import { streamImageBody } from "../lib/streamImageBody"

test("large SVG streams preserve Unicode and stay within bounded chunk sizes", async () => {
  const svg = `<svg><text>${"日本語 αβγ &amp; ".repeat(250_000)}</text></svg>`
  const expected = Buffer.from(svg)
  expect(expected.byteLength).toBeGreaterThan(4.5 * 1024 * 1024)
  const chunks: Buffer[] = []
  const response = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(Buffer.from(chunk))
      done()
    },
  })
  await streamImageBody(svg, response)
  expect(response.writableFinished).toBe(true)
  expect(chunks.every((chunk) => chunk.length <= 64 * 1024)).toBe(true)
  expect(Buffer.concat(chunks).equals(expected)).toBe(true)
})

test("PNG binary bytes survive backpressure and disconnected clients reject", async () => {
  const bytes = Buffer.alloc(150_000)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  const chunks: Buffer[] = []
  const response = new Writable({
    highWaterMark: 1024,
    write(chunk, _encoding, done) {
      chunks.push(Buffer.from(chunk))
      setTimeout(done, 1)
    },
  })
  await streamImageBody(bytes, response)
  expect(Buffer.concat(chunks).equals(bytes)).toBe(true)
  const disconnected = new Writable({
    write(_chunk, _encoding, done) {
      done(new Error("Client disconnected"))
    },
  })
  await expect(streamImageBody(bytes, disconnected)).rejects.toThrow(
    "Client disconnected",
  )
})
