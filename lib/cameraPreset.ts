import {
  CAMERA_PRESET_NAMES,
  applyCameraPreset,
  type CameraOptions,
  type CameraPreset,
} from "circuit-json-to-3d-png"

export function isCameraPreset(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value === "bottom" ||
      value === "bottom-up" ||
      value === "bottom-center-angled" ||
      CAMERA_PRESET_NAMES.includes(value as CameraPreset))
  )
}

export function presetCamera(
  preset: string | undefined,
  camera: Partial<CameraOptions>,
) {
  if (!preset) return camera
  if (!isCameraPreset(preset)) throw new Error("Invalid camera_preset")
  const fitted = camera as CameraOptions
  if (
    preset === "bottom" ||
    preset === "bottom-up" ||
    preset === "bottom-center-angled"
  ) {
    const direction =
      preset === "bottom-center-angled" ? [0, -1, -1] : [0.00000001, -1, -0.001]
    const distance = Math.hypot(
      ...fitted.camPos.map((v, i) => v - fitted.lookAt[i]),
    )
    const length = Math.hypot(...direction)
    return {
      ...fitted,
      camPos: direction.map(
        (v, i) => fitted.lookAt[i] + (v * distance) / length,
      ) as [number, number, number],
    }
  }
  return applyCameraPreset(preset as CameraPreset, fitted)
}
