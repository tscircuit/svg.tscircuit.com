import { CircuitRunner } from "@tscircuit/eval/eval"
import { getUncompressedSnippetString } from "@tscircuit/create-snippet-url"
import { decodeUrlHashToFsMap } from "./fsMap"
import type { RequestContext } from "./RequestContext"

export async function getCircuitJsonFromContext(
  ctx: RequestContext,
): Promise<any> {
  const {
    circuitJsonFromPost,
    fsMapFromPost,
    fsMapFromQuery,
    compressedCode,
    entrypointFromPost,
    entrypointFromQuery,
    projectBaseUrlFromPost,
    projectBaseUrlFromQuery,
    mainComponentPathFromPost,
    mainComponentPathFromQuery,
  } = ctx

  if (circuitJsonFromPost) {
    return circuitJsonFromPost
  }

  if (fsMapFromPost) {
    const worker = new CircuitRunner()

    const projectConfig: any = {}
    if (projectBaseUrlFromPost) {
      projectConfig.projectBaseUrl = projectBaseUrlFromPost
    }
    if (Object.keys(projectConfig).length > 0) {
      worker.setProjectConfig(projectConfig)
    }

    await worker.executeWithFsMap({
      fsMap: fsMapFromPost,
      entrypoint: entrypointFromPost || "index.tsx",
      mainComponentPath: mainComponentPathFromPost || undefined,
    })
    await worker.renderUntilSettled()
    return await worker.getCircuitJson()
  }

  if (fsMapFromQuery) {
    const worker = new CircuitRunner()

    const projectConfig: any = {}
    if (projectBaseUrlFromQuery) {
      projectConfig.projectBaseUrl = projectBaseUrlFromQuery
    }
    if (Object.keys(projectConfig).length > 0) {
      worker.setProjectConfig(projectConfig)
    }

    await worker.executeWithFsMap({
      fsMap: fsMapFromQuery,
      mainComponentPath: mainComponentPathFromQuery ?? undefined,
      entrypoint: entrypointFromQuery ?? undefined,
    })
    await worker.renderUntilSettled()
    return await worker.getCircuitJson()
  }

  if (compressedCode) {
    const worker = new CircuitRunner()

    const projectConfig: any = {}
    if (projectBaseUrlFromQuery) {
      projectConfig.projectBaseUrl = projectBaseUrlFromQuery
    }
    if (Object.keys(projectConfig).length > 0) {
      worker.setProjectConfig(projectConfig)
    }

    const decodedFsMap = decodeUrlHashToFsMap(compressedCode)

    if (decodedFsMap) {
      await worker.executeWithFsMap({
        fsMap: decodedFsMap,
        mainComponentPath: mainComponentPathFromQuery ?? undefined,
        entrypoint: entrypointFromQuery ?? undefined,
      })
    } else {
      const userCode = getUncompressedSnippetString(compressedCode)
      await worker.executeWithFsMap({
        fsMap: {
          "index.tsx": userCode,
        },
        mainComponentPath: mainComponentPathFromQuery ?? undefined,
        entrypoint: entrypointFromQuery ?? undefined,
      })
    }

    await worker.renderUntilSettled()
    return await worker.getCircuitJson()
  }

  throw new Error("No circuit data provided")
}
