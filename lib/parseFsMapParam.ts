import { Buffer } from "node:buffer"
import { decodeUrlHashToFsMap, isFsMapRecord } from "./fsMap"

export const parseFsMapParam = (
  value: string,
): Record<string, string> | null => {
  const decodedFromHash = decodeUrlHashToFsMap(value)
  if (decodedFromHash) {
    return decodedFromHash
  }

  try {
    const parsed = JSON.parse(value)
    if (isFsMapRecord(parsed)) {
      return parsed
    }
  } catch {
    // Ignore JSON parse errors and fall through
  }

  try {
    const base64Decoded = Buffer.from(value, "base64").toString("utf-8")
    const parsed = JSON.parse(base64Decoded)
    if (isFsMapRecord(parsed)) {
      return parsed
    }
  } catch {
    // Ignore Base64/JSON parse errors and fall through
  }

  return null
}
