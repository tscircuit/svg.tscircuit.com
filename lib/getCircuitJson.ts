import { CircuitRunner } from "@tscircuit/eval/eval"
import { getUncompressedSnippetString } from "@tscircuit/create-snippet-url"
import { decodeUrlHashToFsMap } from "./fsMap"
import type { RequestContext } from "./RequestContext"

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
    const worker = new CircuitRunner()

    const projectConfig: any = {}
    if (projectBaseUrl) {
      projectConfig.projectBaseUrl = projectBaseUrl
    }
    if (Object.keys(projectConfig).length > 0) {
      worker.setProjectConfig(projectConfig)
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
    const worker = new CircuitRunner()

    const projectConfig: any = {}
    if (projectBaseUrl) {
      projectConfig.projectBaseUrl = projectBaseUrl
    }
    if (Object.keys(projectConfig).length > 0) {
      worker.setProjectConfig(projectConfig)
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
