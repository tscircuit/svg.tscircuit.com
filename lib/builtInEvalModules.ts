import type { PlatformConfig } from "@tscircuit/props"
import QRCode from "qrcode-svg"
import * as tiPartsEngine from "@tscircuit/ti-parts-engine"

const BUILT_IN_EVAL_MODULES = {
  "@tscircuit/ti-parts-engine": tiPartsEngine,
  "qrcode-svg": QRCode,
} as const

const BUILT_IN_EVAL_MODULE_SHIMS: Record<
  keyof typeof BUILT_IN_EVAL_MODULES,
  string
> = {
  "@tscircuit/ti-parts-engine": `
const mod = globalThis.__svgTscircuitBuiltInEvalModules["@tscircuit/ti-parts-engine"]

export const createTiPartsEngine = mod.createTiPartsEngine
export const createTiFootprintLibrary = mod.createTiFootprintLibrary
export const createTiPlatformConfig = mod.createTiPlatformConfig
export const createTiPlatformPartsEngine = mod.createTiPlatformPartsEngine
export const createUltraLibrarianBridgeClient = mod.createUltraLibrarianBridgeClient
export const createDefaultBridgeFetch = mod.createDefaultBridgeFetch
export const DEFAULT_BASE_URL = mod.DEFAULT_BASE_URL
export const DEFAULT_KICAD_VERSION = mod.DEFAULT_KICAD_VERSION
export default mod
`,
  "qrcode-svg": `
const QRCode = globalThis.__svgTscircuitBuiltInEvalModules["qrcode-svg"]

export { QRCode }
export default QRCode
`,
}

declare global {
  // eslint-disable-next-line no-var
  var __svgTscircuitBuiltInEvalModules: typeof BUILT_IN_EVAL_MODULES | undefined
}

export const installBuiltInEvalModules = () => {
  globalThis.__svgTscircuitBuiltInEvalModules = BUILT_IN_EVAL_MODULES
}

export const withBuiltInEvalModuleResolver = (
  platformConfig: PlatformConfig,
): PlatformConfig => {
  installBuiltInEvalModules()

  const existingNodeModulesResolver = platformConfig.nodeModulesResolver

  return {
    ...platformConfig,
    nodeModulesResolver: async (modulePath) => {
      if (modulePath in BUILT_IN_EVAL_MODULE_SHIMS) {
        return BUILT_IN_EVAL_MODULE_SHIMS[
          modulePath as keyof typeof BUILT_IN_EVAL_MODULE_SHIMS
        ]
      }

      return (await existingNodeModulesResolver?.(modulePath)) ?? null
    },
  }
}
