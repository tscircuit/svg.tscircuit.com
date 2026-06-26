const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

export const getErrorSvg = (
  err: string,
  title: string = "Compilation Error",
) => {
  const splitMessage = (msg: string): string[] => {
    if (msg.startsWith("Error:")) {
      msg = msg.replace(/^Error:\s*/, "")
    }
    const chunks: string[] = []
    let currentChunk = ""
    msg.split(" ").forEach((word) => {
      if ((currentChunk + word).length > 33) {
        chunks.push(currentChunk.trim())
        currentChunk = ""
      }
      currentChunk += `${word} `
    })
    chunks.push(currentChunk.trim())
    return chunks
  }

  const errorLines = splitMessage(err)
  const lineHeight = 24
  const topMargin = 50
  const bottomMargin = 20
  const horizontalPadding = 40
  const estimatedCharWidth = 8
  const maxLineLength = errorLines.reduce(
    (max, line) => Math.max(max, line.length),
    0,
  )

  const dynamicWidth = Math.max(
    maxLineLength * estimatedCharWidth + horizontalPadding,
    480,
  )
  const dynamicHeight =
    topMargin + errorLines.length * lineHeight + bottomMargin

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dynamicWidth} ${dynamicHeight}" width="100%" height="100%">
    <!-- Outer Premium Background -->
    <rect width="100%" height="100%" fill="#FAF7F7" />
    
    <!-- Shadow Effect for Card -->
    <rect x="16" y="16" width="${dynamicWidth - 32}" height="${dynamicHeight - 32}" rx="12" fill="rgba(0, 0, 0, 0.04)" />
    
    <!-- White Card Container -->
    <rect x="15" y="15" width="${dynamicWidth - 30}" height="${dynamicHeight - 30}" rx="12" fill="#FFFFFF" stroke="#F3EBEB" stroke-width="1.5" />
    
    <!-- Left Accent Danger Strip -->
    <path d="M15,27 C15,20.37 20.37,15 27,15 L27,15 L27,${dynamicHeight - 15} L27,${dynamicHeight - 15} C20.37,${dynamicHeight - 15} 15,${dynamicHeight - 20.37} 15,${dynamicHeight - 27} Z" fill="#EF4444" />
    
    <g transform="translate(38, 38)">
      <!-- Warning Icon -->
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      
      <!-- Title -->
      <text x="36" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="16" font-weight="600" fill="#7F1D1D">${escapeXml(title)}</text>
    </g>
    
    <!-- Monospace Error Text Block -->
    <text x="38" y="82" font-family="Menlo, Monaco, Consolas, 'SF Mono', monospace" font-size="13.5" fill="#B91C1C" letter-spacing="-0.2">
      ${errorLines.map((line, i) => `<tspan x="38" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join("")}
    </text>
  </svg>`.trim()
}
