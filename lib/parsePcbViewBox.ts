export interface PcbViewBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const isValidPcbViewBox = (viewBox: PcbViewBox) =>
  Object.values(viewBox).every(Number.isFinite) &&
  viewBox.maxX > viewBox.minX &&
  viewBox.maxY > viewBox.minY

export const parsePcbViewBox = (input: unknown): PcbViewBox | null => {
  let values: unknown[]

  if (typeof input === "string") {
    const trimmedInput = input.trim()
    if (!trimmedInput) return null

    if (trimmedInput.startsWith("{")) {
      try {
        return parsePcbViewBox(JSON.parse(trimmedInput))
      } catch {
        return null
      }
    }

    values = trimmedInput.split(/[\s,]+/)
  } else if (Array.isArray(input)) {
    values = input
  } else if (input && typeof input === "object") {
    const viewBox = input as Record<string, unknown>
    values = [viewBox.minX, viewBox.minY, viewBox.maxX, viewBox.maxY]
  } else {
    return null
  }

  if (values.length !== 4) return null

  const [minX, minY, maxX, maxY] = values.map(Number)
  const viewBox = { minX: minX!, minY: minY!, maxX: maxX!, maxY: maxY! }
  return isValidPcbViewBox(viewBox) ? viewBox : null
}
