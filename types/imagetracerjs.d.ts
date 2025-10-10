declare module "imagetracerjs" {
  interface ImageDataInput {
    width: number
    height: number
    data: Uint8ClampedArray
  }

  interface ImageTracerOptions {
    scale?: number
    ltres?: number
    qtres?: number
    pathomit?: number
    colorsampling?: number
    numberofcolors?: number
    mincolorratio?: number
    colorquantcycles?: number
    linefilter?: boolean
    roundcoords?: number
    desc?: boolean
    viewbox?: boolean
    strokewidth?: number
  }

  interface ImageTracerInstance {
    imagedataToSVG(
      imageData: ImageDataInput,
      options?: ImageTracerOptions,
    ): string
  }

  const ImageTracer: ImageTracerInstance

  export default ImageTracer
}
