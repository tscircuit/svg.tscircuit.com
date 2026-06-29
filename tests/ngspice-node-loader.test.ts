import { test, expect } from "bun:test"
import { execFileSync } from "node:child_process"
import path from "node:path"

const projectRoot = path.join(import.meta.dir, "..")

// Regression guard for the "Received protocol 'blob:'" failure during schematic
// simulation. @tscircuit/ngspice-spice-engine loaded its WASM engine via
// `import("blob:...")`, which the Node ESM loader rejects (bun supports it, so a
// normal bun test does NOT catch this). We patch the package in postinstall to
// import the bundled @tscircuit/eecircuit-engine instead. This test runs the
// engine in a real Node process to exercise the loader that fails in production.
test(
  "ngspice engine simulates under the Node ESM loader (no blob: import)",
  () => {
    const script = [
      'import createNgspiceSpiceEngine from "@tscircuit/ngspice-spice-engine"',
      'const spice = "* test\\nV1 1 0 5\\nR1 1 0 1k\\n.op\\n.end\\n"',
      "const engine = await createNgspiceSpiceEngine()",
      "await engine.simulate(spice)",
      'console.log("NGSPICE_NODE_OK")',
    ].join("\n")

    // Must run under Node (not the bun test runtime): bun accepts blob: imports,
    // so only a real Node process reproduces the production failure.
    const stdout = execFileSync("node", ["--input-type=module", "-e", script], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })

    expect(stdout).toContain("NGSPICE_NODE_OK")
  },
  { timeout: 60000 },
)
