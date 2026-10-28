import type { CircuitJson, SchematicSheet } from "circuit-json"

export const getSchematicSheets = (circuitJson: CircuitJson) =>
  circuitJson
    .filter((element): element is SchematicSheet => {
      return element.type === "schematic_sheet"
    })
    .sort((a, b) => (a.sheet_index ?? 0) - (b.sheet_index ?? 0))

// Matches the label circuit-to-svg draws above each stacked sheet.
export const getSchematicSheetName = (sheet: SchematicSheet, index: number) =>
  (sheet as SchematicSheet & { display_name?: string }).display_name ??
  sheet.name ??
  `Sheet ${sheet.sheet_index ?? index + 1}`

export const selectSchematicSheet = (
  sheets: SchematicSheet[],
  rawSheet: string,
) => {
  if (!/^[1-9]\d*$/.test(rawSheet))
    throw new Error("schematic_sheet must be a positive integer")
  const sheet = sheets[Number(rawSheet) - 1]
  if (!sheet)
    throw new Error(
      sheets.length
        ? `Schematic sheet must be between 1 and ${sheets.length}`
        : "No schematic sheets found",
    )
  return sheet
}
