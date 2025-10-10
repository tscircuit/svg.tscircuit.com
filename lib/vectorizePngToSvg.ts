import ImageTracer from "imagetracerjs"
import sharp from "sharp"

export interface VectorizePngOptions {
  backgroundColor?: string
  backgroundOpacity?: number
  paletteSize?: number
}

const DEFAULT_VECTOR_OPTIONS = {
  scale: 1,
  ltres: 1.5,
  qtres: 1,
  pathomit: 6,
  colorsampling: 2,
  numberofcolors: 12,
  mincolorratio: 0.03,
  colorquantcycles: 2,
  linefilter: true,
  roundcoords: 1,
  desc: false,
  viewbox: true,
  strokewidth: 0,
}

const HEX_COLOR_REGEX = /^#([\da-f]{3}|[\da-f]{6})$/i

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const hexToRgb = (color: string): [number, number, number] | null => {
  if (!HEX_COLOR_REGEX.test(color)) {
    return null
  }

  const hex = color.replace("#", "")
  if (hex.length === 3) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ]
  }

  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ]
}

export const vectorizePngToSvg = async (
  pngBuffer: Uint8Array,
  options: VectorizePngOptions = {},
): Promise<string> => {
  const paletteSize = options.paletteSize ?? 8
  const backgroundColorHex = HEX_COLOR_REGEX.test(options.backgroundColor ?? "")
    ? (options.backgroundColor as string)
    : "#ffffff"
  const backgroundColor = hexToRgb(backgroundColorHex) ?? [255, 255, 255]
  const backgroundOpacity = clamp01(options.backgroundOpacity ?? 0)

  const metadata = await sharp(pngBuffer).metadata()
  const maxVectorDimension = 320

  let processor = sharp(pngBuffer).ensureAlpha()
  if (metadata.width && metadata.height) {
    const largestSide = Math.max(metadata.width, metadata.height)
    if (largestSide > maxVectorDimension) {
      const resizeOptions =
        metadata.width >= metadata.height
          ? { width: maxVectorDimension }
          : { height: maxVectorDimension }
      processor = processor.resize({ ...resizeOptions, fit: "inside" })
    }
  }

  const { data, info } = await processor
    .raw()
    .toBuffer({ resolveWithObject: true })

  const clampedArray = new Uint8ClampedArray(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  )

  if (backgroundOpacity > 0) {
    for (let idx = 0; idx < clampedArray.length; idx += 4) {
      const alpha = clampedArray[idx + 3] / 255
      const outAlpha = alpha + backgroundOpacity * (1 - alpha)
      if (outAlpha <= 0) {
        clampedArray[idx] = backgroundColor[0]
        clampedArray[idx + 1] = backgroundColor[1]
        clampedArray[idx + 2] = backgroundColor[2]
        clampedArray[idx + 3] = 0
        continue
      }

      const blendedR =
        (clampedArray[idx] * alpha +
          backgroundColor[0] * backgroundOpacity * (1 - alpha)) /
        outAlpha
      const blendedG =
        (clampedArray[idx + 1] * alpha +
          backgroundColor[1] * backgroundOpacity * (1 - alpha)) /
        outAlpha
      const blendedB =
        (clampedArray[idx + 2] * alpha +
          backgroundColor[2] * backgroundOpacity * (1 - alpha)) /
        outAlpha

      clampedArray[idx] = Math.round(blendedR)
      clampedArray[idx + 1] = Math.round(blendedG)
      clampedArray[idx + 2] = Math.round(blendedB)
      clampedArray[idx + 3] = Math.round(outAlpha * 255)
    }
  }

  const vectorOptions = {
    ...DEFAULT_VECTOR_OPTIONS,
    numberofcolors: paletteSize,
  }

  const svgContent = ImageTracer.imagedataToSVG(
    {
      width: info.width,
      height: info.height,
      data: clampedArray,
    },
    vectorOptions,
  )

  const backgroundRect = backgroundOpacity
    ? `<rect width="100%" height="100%" fill="${backgroundColorHex}" fill-opacity="${backgroundOpacity}"/>`
    : ""

  const svgWithBackground = svgContent.replace(
    /(<svg[^>]*>)/i,
    `$1${backgroundRect}`,
  )

  const compactSvg = svgWithBackground
    .replace(/\s*\n\s*/g, "")
    .replace(/>\s+</g, "><")
    .trim()

  return compactSvg
}
