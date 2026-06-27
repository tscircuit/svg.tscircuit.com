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

const ngspiceEngineIndexPath = path.join(
  projectRoot,
  "node_modules",
  "@tscircuit",
  "ngspice-spice-engine",
  "dist",
  "index.js",
)

// @tscircuit/ngspice-spice-engine resolves @tscircuit/eecircuit-engine through a
// dynamic import with a *variable* specifier (`import(moduleName)`). Neither
// webpack nor @vercel/nft can statically analyze a variable specifier, so the
// engine is never bundled into the Next.js serverless function. At runtime the
// installed import fails and the engine falls back to loading the package from
// the CDN via a `blob:` URL, which Node's ESM loader rejects
// ("Only URLs with a scheme in: file, data, and node are supported ... Received
// protocol 'blob:'"). Rewriting the specifier to a literal string makes the
// import analyzable so the engine is traced/bundled and the installed path
// succeeds, avoiding the CDN fallback entirely.
const ngspiceOriginalSnippet =
  "const moduleName = EECIRCUIT_ENGINE_PACKAGE;\n    const mod = await import(moduleName);"

const ngspicePatchedSnippet =
  'const mod = await import("@tscircuit/eecircuit-engine");'

function patchNgspiceSpiceEngine() {
  if (!existsSync(ngspiceEngineIndexPath)) {
    console.warn(
      `[postinstall] Skipping ngspice-spice-engine patch, file not found: ${ngspiceEngineIndexPath}`,
    )
    return
  }

  const source = readFileSync(ngspiceEngineIndexPath, "utf8")

  if (source.includes(ngspicePatchedSnippet)) {
    console.log("[postinstall] ngspice-spice-engine already patched")
    return
  }

  if (!source.includes(ngspiceOriginalSnippet)) {
    throw new Error(
      "[postinstall] ngspice-spice-engine patch target not found; upstream file changed",
    )
  }

  writeFileSync(
    ngspiceEngineIndexPath,
    source.replace(ngspiceOriginalSnippet, ngspicePatchedSnippet),
  )
  console.log(
    "[postinstall] patched ngspice-spice-engine to use a literal eecircuit-engine import",
  )
}

patchOcctImportJs()
patchNgspiceSpiceEngine()
