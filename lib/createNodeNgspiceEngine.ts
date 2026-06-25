import type { SpiceEngine } from "@tscircuit/props"
import {
  eecircuitResultToSimulationGraphs,
  rewritePspiceCompatibilitySyntax,
  simulationGraphsToCircuitJson,
} from "@tscircuit/ngspice-spice-engine"

// @tscircuit/ngspice-spice-engine loads its WASM engine with `import("blob:…")`,
// which Node's ESM loader rejects ("Only URLs with a scheme in: file, data, and
// node are supported … Received protocol 'blob:'"). Under Next.js's Node runtime
// that makes every analog simulation fail. We instead drive the locally
// installed @tscircuit/eecircuit-engine directly (a normal Node import — no
// blob:, no CDN fetch) and reuse the package's exported result converters, so
// the simulation output matches the upstream engine exactly.

let simulationPromise: Promise<any> | null = null

const getSimulation = async (): Promise<any> => {
  if (!simulationPromise) {
    simulationPromise = (async () => {
      const { Simulation } = await import("@tscircuit/eecircuit-engine")
      const simulation = new Simulation({ ngBehavior: "psa" })
      await simulation.start()
      return simulation
    })().catch((error) => {
      // Reset so a transient failure (e.g. WASM init) can be retried.
      simulationPromise = null
      throw error
    })
  }
  return simulationPromise
}

export const createNodeNgspiceEngine = (): SpiceEngine => ({
  simulate: async (spiceString: string) => {
    const simulation = await getSimulation()
    const simulationSpiceString = rewritePspiceCompatibilitySyntax(spiceString)
    simulation.setNetList(simulationSpiceString)

    const result = await simulation.runSim()
    if (!result) {
      return { simulationResultCircuitJson: [] }
    }

    const graphs = eecircuitResultToSimulationGraphs(
      result,
      simulationSpiceString,
    )

    return {
      simulationResultCircuitJson: simulationGraphsToCircuitJson(
        graphs,
        simulationSpiceString,
      ),
    }
  },
})
