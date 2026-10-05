import { Readable, type Writable } from "node:stream"
import { pipeline } from "node:stream/promises"

export async function streamImageBody(
  body: string | Buffer,
  response: Writable,
) {
  const bytes = typeof body === "string" ? Buffer.from(body) : body
  function* chunks() {
    for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
      yield bytes.subarray(offset, offset + 64 * 1024)
    }
  }
  await pipeline(Readable.from(chunks()), response)
}
