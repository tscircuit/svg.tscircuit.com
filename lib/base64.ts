export function bytesToBase64(bytes: Uint8Array): string {
  const binString = String.fromCodePoint(...bytes)
  return btoa(binString)
}
export function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64)
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!)
}
