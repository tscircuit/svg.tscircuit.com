import { gunzipSync, gzipSync, strFromU8, strToU8 } from "fflate"
import { base64ToBytes, bytesToBase64 } from "./base64"

export const decodeUrlHashToFsMap = (
  hash: string,
): Record<string, string> | null => {
  try {
    const compressedData = base64ToBytes(hash)
    const decompressedData = gunzipSync(compressedData)
    const text = strFromU8(decompressedData)
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const encodeFsMapToHash = (fsMap: Record<string, string>): string => {
  const text = JSON.stringify(fsMap)
  const compressedData = gzipSync(strToU8(text))
  return bytesToBase64(compressedData)
}
