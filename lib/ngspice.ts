import { Simulation } from "@tscircuit/eecircuit-engine"
import {
  eecircuitResultToSimulationGraphs,
  rewritePspiceCompatibilitySyntax,
  simulationGraphsToCircuitJson,
} from "@tscircuit/ngspice-spice-engine"
import type { PlatformConfig } from "@tscircuit/props"

type NgspiceEngine = NonNullable<PlatformConfig["spiceEngineMap"]>[string]

let simulationPromise: Promise<Simulation> | undefined

const getSimulation = async () => {
  if (!simulationPromise) {
    simulationPromise = (async () => {
      const simulation = new Simulation({ ngBehavior: "psa" })
      await simulation.start()
      return simulation
    })().catch((error) => {
      simulationPromise = undefined
      throw error
    })
  }

  return simulationPromise
}

const createNgspiceEngine = async (): Promise<NgspiceEngine> => ({
  simulate: async (spiceString) => {
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

let ngspiceEnginePromise: Promise<NgspiceEngine> | undefined

const getNgspiceEngine = () => {
  if (!ngspiceEnginePromise) {
    ngspiceEnginePromise = createNgspiceEngine().catch((error) => {
      ngspiceEnginePromise = undefined
      throw error
    })
  }

  return ngspiceEnginePromise
}

export const preloadNgspice = () => getNgspiceEngine()

export const getNgspiceSpiceEngineMap =
  (): PlatformConfig["spiceEngineMap"] => ({
    ngspice: {
      simulate: async (spice) => {
        const engine = await getNgspiceEngine()
        return engine.simulate(spice)
      },
    },
  })
