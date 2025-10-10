import sharp from "sharp"

export const svgToPng = async (
  svg: string,
  options: {
    width?: number
    height?: number
    density?: number
  }
) => {
  let chain = sharp(Buffer.from(svg), {
    density: options.density,
  })

  if (options.width || options.height) {
    chain = chain.resize(options.width, options.height)
  }

  return chain.png().toBuffer()
}
