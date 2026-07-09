import {
  createSnippetUrl,
  createSvgUrl,
  type CreateSvgUrlOptions,
} from "@tscircuit/create-snippet-url"
import { encodeFsMapToHash } from "./fsMap"

export type GeneratedUrlInput =
  | string
  | { fsMap: Record<string, string>; entrypoint?: string }

type CreateSvgUrlView = "pcb" | "schematic" | "3d" | "pinout" | "schsim" | "sim"

export type GeneratedSvgUrls = {
  packageUrl: string
  pcbSvgUrl: string
  pcbPngUrl: string
  schSvgUrl: string
  schPngUrl: string
  schSimSvgUrl: string
  simSvgUrl: string
  assemblySvgUrl: string
  assemblyPngUrl: string
  pinoutSvgUrl: string
  pinoutPngUrl: string
  threeDSvgUrl: string
  threeDPngUrl: string
}

const defaultSvgUrlPrefix = "https://svg.tscircuit.com"

const createUrlForCurrentServer = (
  url: string,
  urlPrefix: string,
  mainComponentPath?: string,
) => {
  const generatedUrl = new URL(url)
  const serverUrl = new URL(urlPrefix)

  generatedUrl.protocol = serverUrl.protocol
  generatedUrl.host = serverUrl.host

  if (mainComponentPath) {
    generatedUrl.searchParams.set("main_component_path", mainComponentPath)
  }

  return generatedUrl.toString()
}

export const createGeneratedSvgUrls = (
  input: GeneratedUrlInput,
  urlPrefix = defaultSvgUrlPrefix,
): GeneratedSvgUrls => {
  let packageUrl: string
  let svgUrlInput: string | Record<string, string>
  let mainComponentPath: string | undefined

  if (typeof input === "string") {
    packageUrl = createSnippetUrl(input)
    svgUrlInput = input
  } else {
    const encodedFsMap = encodeFsMapToHash(input.fsMap)
    packageUrl = `https://tscircuit.com/editor?#data:application/gzip;base64,${encodedFsMap}`
    svgUrlInput = input.fsMap
    mainComponentPath = input.entrypoint
  }

  const svgUrl = (view: CreateSvgUrlView, options: CreateSvgUrlOptions = {}) =>
    createUrlForCurrentServer(
      createSvgUrl(svgUrlInput, view, options),
      urlPrefix,
      mainComponentPath,
    )

  const assemblyUrl = (format?: "png") => {
    // create-snippet-url does not expose assembly yet, so reuse its encoding
    // path and switch only the view parameter.
    const url = new URL(createSvgUrl(svgUrlInput, "pcb", { format }))
    url.searchParams.set("svg_type", "assembly")
    return createUrlForCurrentServer(
      url.toString(),
      urlPrefix,
      mainComponentPath,
    )
  }

  return {
    packageUrl,
    pcbSvgUrl: svgUrl("pcb"),
    pcbPngUrl: svgUrl("pcb", { format: "png" }),
    schSvgUrl: svgUrl("schematic"),
    schPngUrl: svgUrl("schematic", { format: "png" }),
    schSimSvgUrl: svgUrl("schsim"),
    simSvgUrl: svgUrl("sim"),
    assemblySvgUrl: assemblyUrl(),
    assemblyPngUrl: assemblyUrl("png"),
    pinoutSvgUrl: svgUrl("pinout"),
    pinoutPngUrl: svgUrl("pinout", { format: "png" }),
    threeDSvgUrl: svgUrl("3d"),
    threeDPngUrl: svgUrl("3d", { format: "png" }),
  }
}
