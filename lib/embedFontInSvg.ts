export function embedFontInSvg(svgString: string): string {
  const fontStack = "DejaVu Sans, Liberation Sans, FreeSans, Arial, sans-serif"
  const svgWithFont = svgString.replace(
    /font-family="[^"]*"/g,
    `font-family="${fontStack}"`,
  )

  return svgWithFont
}
