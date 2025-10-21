export function embedFontInSvg(svgString: string): string {
  const styleBlock = `
<defs>
  <style type="text/css">
    text {
      font-family: "DejaVu Sans", "Liberation Sans", "FreeSans", Arial, sans-serif !important;
    }
  </style>
</defs>
`

  // Insert the style block after the opening <svg> tag
  const svgWithFont = svgString.replace(/(<svg[^>]*>)/, `$1${styleBlock}`)

  return svgWithFont
}
