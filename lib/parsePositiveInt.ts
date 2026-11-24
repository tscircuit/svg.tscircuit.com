export function parsePositiveInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const intValue = Math.trunc(value)
    return intValue > 0 ? intValue : undefined
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed = value.trim()
    if (!/^\+?\d+$/.test(trimmed)) return undefined
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return undefined
}
