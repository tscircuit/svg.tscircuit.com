export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binString = ""
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binString += String.fromCodePoint(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binString)
}
export function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64)
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!)
}
