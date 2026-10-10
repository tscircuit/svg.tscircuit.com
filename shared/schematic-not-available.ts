import { uncachedImageHeaders } from "../lib/imageCacheHeaders"

export class SchematicNotAvailableError extends Error {
  constructor() {
    super("Schematic not available for circuit")
    this.name = "SchematicNotAvailableError"
  }
}

export const schematicNotAvailableResponse = () =>
  Response.json(
    {
      ok: false,
      error_code: "schematic_not_available",
      error: "Schematic not available for circuit",
    },
    { status: 404, headers: uncachedImageHeaders },
  )
