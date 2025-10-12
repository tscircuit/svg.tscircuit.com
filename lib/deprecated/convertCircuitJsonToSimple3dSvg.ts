/**
 * DEPRECATED: prefer vectorizing 3D PNGs via @neplex/vectorizer.
 *
 * This wrapper exposes convertCircuitJsonToSimple3dSvg from circuit-json-to-simple-3d
 * for benchmarking and backward-compatibility purposes only.
 */
import { convertCircuitJsonToSimple3dSvg as upstreamConvertCircuitJsonToSimple3dSvg } from "circuit-json-to-simple-3d"

/**
 * @deprecated Use the 3D PNG + vectorizer pipeline instead.
 */
export const convertCircuitJsonToSimple3dSvg =
  upstreamConvertCircuitJsonToSimple3dSvg
