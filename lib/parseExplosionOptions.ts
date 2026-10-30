import type { AssemblyExplosionOptions } from "circuit-json-to-gltf"

/** Parse the requested pose; omitted options retain the assembled geometry. */
export function parseExplosionOptions(
  stage: unknown,
  progress: unknown,
): AssemblyExplosionOptions | undefined {
  if (stage === undefined && progress === undefined) return undefined
  if (stage !== undefined && (typeof stage !== "string" || !stage.trim()))
    throw new Error("explosion_stage must be a nonempty stage name")
  const fraction =
    progress === undefined
      ? 1
      : typeof progress === "number"
        ? progress
        : typeof progress === "string" && progress.trim()
          ? Number(progress)
          : NaN
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1)
    throw new Error("explosion_progress must be a number between 0 and 1")
  return {
    ...(typeof stage === "string" ? { throughStageRef: stage.trim() } : {}),
    stageProgress: fraction,
  }
}
