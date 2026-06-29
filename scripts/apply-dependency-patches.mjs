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

const ngspiceSpiceEnginePath = path.join(
  projectRoot,
  "node_modules",
  "@tscircuit",
  "ngspice-spice-engine",
  "dist",
  "index.js",
)

// @tscircuit/ngspice-spice-engine@0.0.18 loads its WASM engine via an
// unconditional `URL.createObjectURL` + `import("blob:...")`, which the Node ESM
// loader rejects ("Only URLs with a scheme in: file, data, and node are
// supported... Received protocol 'blob:'"). This breaks schematic simulation on
// the server. Import the locally bundled @tscircuit/eecircuit-engine instead,
// which also avoids a runtime CDN fetch.
const ngspiceOriginalSnippet = `    modulePromise = fetch(EECIRCUIT_ENGINE_URL).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          \`Failed to load @tscircuit/eecircuit-engine from \${EECIRCUIT_ENGINE_URL}: \${response.status} \${response.statusText}\`
        );
      }
      const source = await response.text();
      const moduleUrl = URL.createObjectURL(
        new Blob([source], { type: "text/javascript" })
      );
      return import(moduleUrl);
    });`

const ngspicePatchedSnippet = `    modulePromise = import("@tscircuit/eecircuit-engine");`

function patchNgspiceSpiceEngine() {
  if (!existsSync(ngspiceSpiceEnginePath)) {
    console.warn(
      `[postinstall] Skipping ngspice-spice-engine patch, file not found: ${ngspiceSpiceEnginePath}`,
    )
    return
  }

  const source = readFileSync(ngspiceSpiceEnginePath, "utf8")

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
    ngspiceSpiceEnginePath,
    source.replace(ngspiceOriginalSnippet, ngspicePatchedSnippet),
  )
  console.log(
    "[postinstall] patched ngspice-spice-engine to import bundled eecircuit-engine",
  )
}

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
patchNgspiceSpiceEngine()
