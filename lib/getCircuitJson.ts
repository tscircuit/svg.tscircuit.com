import "@tscircuit/ngspice-spice-engine"
import { getUncompressedSnippetString } from "@tscircuit/create-snippet-url"
import { getPlatformConfig as getPlatformConfigFromEval } from "@tscircuit/eval"
import { CircuitRunner } from "@tscircuit/eval/eval"
import type { PlatformConfig } from "@tscircuit/props"
import { withBuiltInEvalModuleResolver } from "./builtInEvalModules"
import { decodeUrlHashToFsMap } from "./fsMap"
import { createPrivateAddressGuardedFetch } from "./guardProjectFetch"
import { getNgspiceSpiceEngineMap, preloadNgspice } from "./ngspice"
import type { RequestContext } from "./RequestContext"

void preloadNgspice().catch((error) => {
  console.error("Failed to preload ngspice:", error)
})

const createPlatformConfig = (): PlatformConfig => {
  const basePlatformConfig = getPlatformConfigFromEval()

  return withBuiltInEvalModuleResolver({
    ...basePlatformConfig,
    platformFetch: createPrivateAddressGuardedFetch(
      (basePlatformConfig as any).platformFetch,
    ),
    spiceEngineMap: {
      ...basePlatformConfig.spiceEngineMap,
      ...getNgspiceSpiceEngineMap(),
    },
  })
}

const createCircuitRunner = async () => {
  const worker = new CircuitRunner()
  await worker.setDisableCdnLoading(true)
  return worker
}

export async function getCircuitJsonFromContext(
  ctx: RequestContext,
): Promise<any> {
  const {
    circuitJson,
    fsMap,
    compressedCode,
    entrypoint,
    projectBaseUrl,
    mainComponentPath,
  } = ctx

  if (circuitJson) {
    return circuitJson
  }

  if (fsMap) {
    const worker = await createCircuitRunner()

    const platformConfig = createPlatformConfig()
    await worker.setPlatformConfig(platformConfig)

    const projectConfig: Partial<PlatformConfig> = {}
    if (projectBaseUrl) {
      projectConfig.projectBaseUrl = projectBaseUrl
    }
    if (Object.keys(projectConfig).length > 0) {
      await worker.setProjectConfig(projectConfig)
    }

    await worker.executeWithFsMap({
      fsMap,
      entrypoint: entrypoint ?? undefined,
      mainComponentPath: mainComponentPath || undefined,
    })
    await worker.renderUntilSettled()
    return await worker.getCircuitJson()
  }

  if (compressedCode) {
    const worker = await createCircuitRunner()

    const platformConfig = createPlatformConfig()
    await worker.setPlatformConfig(platformConfig)

    const projectConfig: Partial<PlatformConfig> = {}
    if (projectBaseUrl) {
      projectConfig.projectBaseUrl = projectBaseUrl
    }
    if (Object.keys(projectConfig).length > 0) {
      await worker.setProjectConfig(projectConfig)
    }

    const decodedFsMap = decodeUrlHashToFsMap(compressedCode)

    if (decodedFsMap) {
      await worker.executeWithFsMap({
        fsMap: decodedFsMap,
        mainComponentPath: mainComponentPath ?? undefined,
        entrypoint: entrypoint ?? undefined,
      })
    } else {
      const userCode = getUncompressedSnippetString(compressedCode)
      await worker.executeWithFsMap({
        fsMap: {
          "index.tsx": userCode,
        },
        mainComponentPath: mainComponentPath ?? undefined,
        entrypoint: entrypoint ?? undefined,
      })
    }

    await worker.renderUntilSettled()
    return await worker.getCircuitJson()
  }

  throw new Error("No circuit data provided")
}
