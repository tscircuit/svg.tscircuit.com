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
const ngspiceSpiceEngineDistPath = path.join(
  projectRoot,
  "node_modules",
  "@tscircuit",
  "ngspice-spice-engine",
  "dist",
  "index.js",
)

const occtOriginalSnippet =
  'scriptDirectory=__dirname+"/";readBinary=filename=>{filename=isFileURI(filename)?new URL(filename):nodePath.normalize(filename);var ret=fs.readFileSync(filename);return ret};readAsync=(filename,binary=true)=>{filename=isFileURI(filename)?new URL(filename):nodePath.normalize(filename);return new Promise((resolve,reject)=>{fs.readFile(filename,binary?undefined:"utf8",(err,data)=>{if(err)reject(err);else resolve(binary?data.buffer:data)})})};'

const occtPatchedSnippet =
  'scriptDirectory=__dirname+"/";if(!Module["wasmBinary"]){Module["wasmBinary"]=fs.readFileSync(nodePath.join(__dirname,"occt-import-js.wasm"))}readBinary=filename=>{filename=isFileURI(filename)?new URL(filename):nodePath.normalize(filename);var ret=fs.readFileSync(filename);return ret};readAsync=(filename,binary=true)=>{filename=isFileURI(filename)?new URL(filename):nodePath.normalize(filename);return new Promise((resolve,reject)=>{fs.readFile(filename,binary?undefined:"utf8",(err,data)=>{if(err)reject(err);else resolve(binary?data.buffer:data)})})};'

const ngspiceOriginalSnippet = `var EECIRCUIT_ENGINE_URL = "https://jscdn.tscircuit.com/@tscircuit/eecircuit-engine/1.7.4/+esm";
var modulePromise = null;
var importEecircuitEngine = async () => {
  if (!modulePromise) {
    modulePromise = fetch(EECIRCUIT_ENGINE_URL).then(async (response) => {
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
    });
  }
  return modulePromise;
};`

const ngspicePatchedSnippet = `var EECIRCUIT_ENGINE_PACKAGE = "@tscircuit/eecircuit-engine";
var EECIRCUIT_ENGINE_URL = "https://jscdn.tscircuit.com/@tscircuit/eecircuit-engine/1.7.4/+esm";
var modulePromise = null;
var isNodeLikeRuntime = () => {
  const globals = globalThis;
  const hasNodeProcess = globals.process?.versions?.node != null;
  const hasDom = typeof globals.document?.createElement === "function";
  return hasNodeProcess && !hasDom;
};
var importFromInstalledPackage = async () => {
  try {
    const moduleName = EECIRCUIT_ENGINE_PACKAGE;
    const mod = await import(moduleName);
    const Simulation = mod.Simulation ?? mod.default?.Simulation;
    if (typeof Simulation === "function") {
      return { Simulation };
    }
    return null;
  } catch {
    return null;
  }
};
var importFromCdn = async () => {
  const response = await fetch(EECIRCUIT_ENGINE_URL);
  if (!response.ok) {
    throw new Error(
      \`Failed to load \${EECIRCUIT_ENGINE_PACKAGE} from \${EECIRCUIT_ENGINE_URL}: \${response.status} \${response.statusText}\`
    );
  }
  const source = await response.text();
  if (isNodeLikeRuntime()) {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { pathToFileURL } = await import("node:url");
    const filePath = join(
      mkdtempSync(join(tmpdir(), "eecircuit-engine-")),
      "eecircuit-engine.mjs"
    );
    writeFileSync(filePath, source);
    return import(pathToFileURL(filePath).href);
  }
  const moduleUrl = URL.createObjectURL(
    new Blob([source], { type: "text/javascript" })
  );
  return import(moduleUrl);
};
var importEecircuitEngine = async () => {
  if (!modulePromise) {
    modulePromise = (async () => {
      const installed = await importFromInstalledPackage();
      return installed ?? importFromCdn();
    })();
  }
  return modulePromise;
};`

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

function patchNgspiceSpiceEngine() {
  if (!existsSync(ngspiceSpiceEngineDistPath)) {
    console.warn(
      `[postinstall] Skipping ngspice-spice-engine patch, file not found: ${ngspiceSpiceEngineDistPath}`,
    )
    return
  }

  const source = readFileSync(ngspiceSpiceEngineDistPath, "utf8")

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
    ngspiceSpiceEngineDistPath,
    source.replace(ngspiceOriginalSnippet, ngspicePatchedSnippet),
  )
  console.log(
    "[postinstall] patched ngspice-spice-engine to use local-import-first and Node-safe CDN fallback",
  )
}

patchOcctImportJs()
patchNgspiceSpiceEngine()
