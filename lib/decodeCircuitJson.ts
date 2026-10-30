import { decompressSync } from "fflate"
import type { CircuitJson } from "circuit-json"
import { base64ToBytes } from "./base64"

/** Accept JSON records or the same base64/gzip representation used in GET URLs. */
export function decodeCircuitJson(input: unknown): CircuitJson {
  let json = input
  if (typeof input === "string") {
    const bytes = base64ToBytes(input)
    const decoded =
      bytes[0] === 0x1f && bytes[1] === 0x8b ? decompressSync(bytes) : bytes
    json = JSON.parse(new TextDecoder().decode(decoded))
  }
  if (!Array.isArray(json))
    throw new Error("circuit_json must contain an array of records")
  return json
}
