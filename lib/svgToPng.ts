export const svgToPng = async (
  svg: string,
  options: {
    width?: number
    height?: number
    density?: number
  },
) => {
  const { default: sharp } = await import("sharp")
  let chain = sharp(Buffer.from(svg), {
    density: options.density,
  })

  if (options.width || options.height) {
    chain = chain.resize({
      width: options.width,
      height: options.height,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
  }

  return chain.png().toBuffer()
}
