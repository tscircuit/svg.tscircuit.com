import { Buffer } from "node:buffer"
import sharp, { type SharpOptions } from "sharp"

export type SvgToPngOptions = {
  width?: number
  height?: number
  density?: number
}

export async function svgToPng(
  svg: string,
  options: SvgToPngOptions,
): Promise<ArrayBuffer> {
  const sharpOptions: SharpOptions = {}

  if (options.density) {
    sharpOptions.density = options.density
  }

  let image = sharp(Buffer.from(svg), sharpOptions)

  if (options.width || options.height) {
    image = image.resize({
      width: options.width,
      height: options.height,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
  }

  const nodeBuffer = await image
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer()

  const arrayBuffer = new ArrayBuffer(nodeBuffer.byteLength)
  new Uint8Array(arrayBuffer).set(nodeBuffer)

  return arrayBuffer
}
