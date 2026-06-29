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

const evalModuleFallbackDataOnlyPatchedSnippet =
  'const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;\n        const { default: loadedModule } = await import(url);\n        return loadedModule;'

const evalModuleFallbackNodeDataPatchedSnippet =
  'const isNodeRuntime = typeof process !== "undefined" && !!process.versions?.node;\n        let url;\n        if (isNodeRuntime) {\n          url = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;\n        } else {\n          const blob = new Blob([code], { type: "application/javascript" });\n          url = URL.createObjectURL(blob);\n        }\n        try {\n          const { default: loadedModule } = await import(url);\n          return loadedModule;\n        } finally {\n          if (!isNodeRuntime) {\n            URL.revokeObjectURL(url);\n          }\n        }'

const evalModuleFallbackPatchedSnippet =
  'const isNodeRuntime = typeof process !== "undefined" && !!process.versions?.node;\n        let url;\n        let tempDir;\n        if (isNodeRuntime) {\n          const [{ mkdtemp, rm, writeFile }, { tmpdir }, path, { pathToFileURL }] = await Promise.all([\n            import("node:fs/promises"),\n            import("node:os"),\n            import("node:path"),\n            import("node:url")\n          ]);\n          tempDir = await mkdtemp(path.join(tmpdir(), "tscircuit-eval-cdn-"));\n          const filePath = path.join(tempDir, "index.mjs");\n          await writeFile(filePath, code, "utf8");\n          url = pathToFileURL(filePath).href;\n        } else {\n          const blob = new Blob([code], { type: "application/javascript" });\n          url = URL.createObjectURL(blob);\n        }\n        try {\n          const { default: loadedModule } = await import(url);\n          return loadedModule;\n        } finally {\n          if (isNodeRuntime && tempDir) {\n            const { rm } = await import("node:fs/promises");\n            await rm(tempDir, { recursive: true, force: true });\n          } else if (!isNodeRuntime) {\n            URL.revokeObjectURL(url);\n          }\n        }'

const evalNestedBlobImportOriginalSnippet =
  'code = transformJsDelivrImports(code);'

const evalNestedBlobImportBrokenPatchedSnippet =
  'code = transformJsDelivrImports(code);\n        code = code.replace(/import\\(URL\\.createObjectURL\\(new Blob\\(\\[(.*?)\\],\\{type:"text\\\\/javascript"\\}\\)\\)\\)/g, \'import(`data:text/javascript;charset=utf-8,${encodeURIComponent($1)}`)\');'

const evalNestedBlobImportPatchedSnippet =
  'code = transformJsDelivrImports(code);\n        const nestedBlobImportPattern = new RegExp(\'import\\\\(URL\\\\.createObjectURL\\\\(new Blob\\\\(\\\\[(.*?)\\\\],\\\\{type:\"text/javascript\"\\\\}\\\\)\\\\)\\\\)\', "g");\n        code = code.replace(nestedBlobImportPattern, \'import(`data:text/javascript;charset=utf-8,${encodeURIComponent($1)}`)\');'

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

    if (
      !source.includes(evalModuleFallbackPatchedSnippet) &&
      !source.includes(evalModuleFallbackNodeDataPatchedSnippet) &&
      !source.includes(evalModuleFallbackDataOnlyPatchedSnippet) &&
      !source.includes(evalModuleFallbackOriginalSnippet)
    ) {
      throw new Error(
        `[postinstall] @tscircuit/eval fallback patch target not found in ${filePath}; upstream file changed`,
      )
    }

    let patchedSource = source

    if (patchedSource.includes(evalModuleFallbackNodeDataPatchedSnippet)) {
      patchedSource = patchedSource.replace(
        evalModuleFallbackNodeDataPatchedSnippet,
        evalModuleFallbackPatchedSnippet,
      )
    } else if (patchedSource.includes(evalModuleFallbackDataOnlyPatchedSnippet)) {
      patchedSource = patchedSource.replace(
        evalModuleFallbackDataOnlyPatchedSnippet,
        evalModuleFallbackPatchedSnippet,
      )
    } else if (!patchedSource.includes(evalModuleFallbackPatchedSnippet)) {
      patchedSource = patchedSource.replace(
        evalModuleFallbackOriginalSnippet,
        evalModuleFallbackPatchedSnippet,
      )
    }

    if (patchedSource.includes(evalNestedBlobImportBrokenPatchedSnippet)) {
      patchedSource = patchedSource.replace(
        evalNestedBlobImportBrokenPatchedSnippet,
        evalNestedBlobImportPatchedSnippet,
      )
    } else if (
      !patchedSource.includes(evalNestedBlobImportPatchedSnippet) &&
      patchedSource.includes(evalNestedBlobImportOriginalSnippet)
    ) {
      patchedSource = patchedSource.replace(
        evalNestedBlobImportOriginalSnippet,
        evalNestedBlobImportPatchedSnippet,
      )
    }

    if (patchedSource !== source) {
      writeFileSync(filePath, patchedSource)
      console.log(
        `[postinstall] patched @tscircuit/eval CDN fallback imports in ${filePath}`,
      )
    } else {
      console.log(`[postinstall] @tscircuit/eval already patched: ${filePath}`)
    }
  }
}

patchOcctImportJs()
patchEvalBlobImports()
