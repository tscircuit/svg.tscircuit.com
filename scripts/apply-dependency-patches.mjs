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

const evalModuleFallbackPaths = [
  path.join(
    projectRoot,
    "node_modules",
    "@tscircuit",
    "eval",
    "dist",
    "lib",
    "index.js",
  ),
  path.join(
    projectRoot,
    "node_modules",
    "@tscircuit",
    "eval",
    "dist",
    "eval",
    "index.js",
  ),
  path.join(
    projectRoot,
    "node_modules",
    "@tscircuit",
    "eval",
    "dist",
    "platform-config",
    "getPlatformConfig.js",
  ),
]

const evalModuleFallbackOriginalSnippet =
  'const blob = new Blob([code], { type: "application/javascript" });\n        const url = URL.createObjectURL(blob);\n        try {\n          const { default: loadedModule } = await import(url);\n          return loadedModule;\n        } finally {\n          URL.revokeObjectURL(url);\n        }'

const evalModuleFallbackPatchedSnippet =
  'const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;\n        const { default: loadedModule } = await import(url);\n        return loadedModule;'

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

function patchEvalBlobImports() {
  for (const filePath of evalModuleFallbackPaths) {
    if (!existsSync(filePath)) {
      console.warn(
        `[postinstall] Skipping @tscircuit/eval blob import patch, file not found: ${filePath}`,
      )
      continue
    }

    const source = readFileSync(filePath, "utf8")

    if (source.includes(evalModuleFallbackPatchedSnippet)) {
      console.log(`[postinstall] @tscircuit/eval already patched: ${filePath}`)
      continue
    }

    if (!source.includes(evalModuleFallbackOriginalSnippet)) {
      throw new Error(
        `[postinstall] @tscircuit/eval patch target not found in ${filePath}; upstream file changed`,
      )
    }

    writeFileSync(
      filePath,
      source.replace(
        evalModuleFallbackOriginalSnippet,
        evalModuleFallbackPatchedSnippet,
      ),
    )
    console.log(
      `[postinstall] patched @tscircuit/eval CDN fallback imports in ${filePath}`,
    )
  }
}

patchOcctImportJs()
patchEvalBlobImports()
