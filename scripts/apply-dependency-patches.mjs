import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, "..")

const occtImportJsPath = path.join(
  projectRoot,
  "node_modules",
  "occt-import-js",
  "dist",
  "occt-import-js.js",
)

const occtOriginalSnippet =
  'scriptDirectory=__dirname+"/";readBinary=filename=>{filename=isFileURI(filename)?new URL(filename):nodePath.normalize(filename);var ret=fs.readFileSync(filename);return ret};readAsync=(filename,binary=true)=>{filename=isFileURI(filename)?new URL(filename):nodePath.normalize(filename);return new Promise((resolve,reject)=>{fs.readFile(filename,binary?undefined:"utf8",(err,data)=>{if(err)reject(err);else resolve(binary?data.buffer:data)})})};'

const occtPatchedSnippet =
  'scriptDirectory=__dirname+"/";if(!Module["wasmBinary"]){Module["wasmBinary"]=fs.readFileSync(nodePath.join(__dirname,"occt-import-js.wasm"))}readBinary=filename=>{filename=isFileURI(filename)?new URL(filename):nodePath.normalize(filename);var ret=fs.readFileSync(filename);return ret};readAsync=(filename,binary=true)=>{filename=isFileURI(filename)?new URL(filename):nodePath.normalize(filename);return new Promise((resolve,reject)=>{fs.readFile(filename,binary?undefined:"utf8",(err,data)=>{if(err)reject(err);else resolve(binary?data.buffer:data)})})};'

const fanoutTypesPath = path.join(
  projectRoot,
  "node_modules",
  "@tscircuit",
  "fanout-solver",
  "lib",
  "types.ts",
)

// Vercel's Bun install can flatten fanout-solver's router dependency, exposing
// this readonly property override to Next.js's strict type check.
const fanoutOriginalSnippet =
  "export interface FanoutBusSpec extends SimpleRouteBus {"
const fanoutPatchedSnippet =
  'export interface FanoutBusSpec extends Omit<SimpleRouteBus, "allowedLayers"> {'

function patchOcctImportJs() {
  if (!existsSync(occtImportJsPath)) {
    console.warn(
      `[postinstall] Skipping occt-import-js patch, file not found: ${occtImportJsPath}`,
    )
    return
  }

  const source = readFileSync(occtImportJsPath, "utf8")

  if (source.includes(occtPatchedSnippet)) {
    console.log("[postinstall] occt-import-js already patched")
    return
  }

  if (!source.includes(occtOriginalSnippet)) {
    throw new Error(
      "[postinstall] occt-import-js patch target not found; upstream file changed",
    )
  }

  writeFileSync(
    occtImportJsPath,
    source.replace(occtOriginalSnippet, occtPatchedSnippet),
  )
  console.log("[postinstall] patched occt-import-js to preload STEP wasm")
}

function patchFanoutSolverTypes() {
  if (!existsSync(fanoutTypesPath)) {
    console.warn(
      `[postinstall] Skipping @tscircuit/fanout-solver patch, file not found: ${fanoutTypesPath}`,
    )
    return
  }

  const source = readFileSync(fanoutTypesPath, "utf8")

  if (source.includes(fanoutPatchedSnippet)) {
    console.log("[postinstall] @tscircuit/fanout-solver already patched")
    return
  }

  if (!source.includes(fanoutOriginalSnippet)) {
    throw new Error(
      "[postinstall] @tscircuit/fanout-solver patch target not found; upstream file changed",
    )
  }

  writeFileSync(
    fanoutTypesPath,
    source.replace(fanoutOriginalSnippet, fanoutPatchedSnippet),
  )
  console.log(
    "[postinstall] patched @tscircuit/fanout-solver allowedLayers type",
  )
}

patchOcctImportJs()
patchFanoutSolverTypes()
