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

patchOcctImportJs()
