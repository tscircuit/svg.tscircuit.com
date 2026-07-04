import type { PlatformConfig } from "@tscircuit/props"
import * as tscircuitCommon from "@tscircuit/common"
import * as tiPartsEngine from "@tscircuit/ti-parts-engine"
import { createRequire } from "node:module"

type QRCodeConstructor = new (
  options: string | Record<string, unknown>,
) => { svg(): string }

// qrcode-svg is CommonJS and does not ship TypeScript declarations.
// Load it through require so the runtime module works without adding a project
// declaration file just for this built-in eval shim.
const require = createRequire(import.meta.url)
const QRCode = require("qrcode-svg") as QRCodeConstructor

const BUILT_IN_EVAL_MODULES = {
  "@tscircuit/common": tscircuitCommon,
  "@tscircuit/ti-parts-engine": tiPartsEngine,
  "qrcode-svg": QRCode,
} as const

const BUILT_IN_EVAL_MODULE_SHIMS: Record<
  keyof typeof BUILT_IN_EVAL_MODULES,
  string
> = {
  "@tscircuit/common": `
const mod = globalThis.__svgTscircuitBuiltInEvalModules["@tscircuit/common"]

export const ArduinoShield = mod.ArduinoShield
export const MicroModBoard = mod.MicroModBoard
export const ProMicroBoard = mod.ProMicroBoard
export const RaspberryPiHatBoard = mod.RaspberryPiHatBoard
export const ViaGridBoard = mod.ViaGridBoard
export const XiaoBoard = mod.XiaoBoard
export const XiaoReceiver = mod.XiaoReceiver
export default mod
`,
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
