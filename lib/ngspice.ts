import { Simulation } from "@tscircuit/eecircuit-engine"
import {
  eecircuitResultToSimulationGraphs,
  rewritePspiceCompatibilitySyntax,
  simulationGraphsToCircuitJson,
} from "@tscircuit/ngspice-spice-engine"
import type { PlatformConfig } from "@tscircuit/props"

type NgspiceEngine = NonNullable<PlatformConfig["spiceEngineMap"]>[string]

let simulationPromise: Promise<Simulation> | undefined
let simulationRunQueue: Promise<void> = Promise.resolve()
let ngspiceWindowShim: unknown

// EEcircuit's Emscripten runtime leaves globalThis.window = { prompt } in Node.
// Next's server router then sees window but fails because window.location is missing.
const isNgspiceWindowShim = (value: unknown) =>
  !!value &&
  typeof value === "object" &&
  typeof Reflect.get(value, "prompt") === "function" &&
  !("location" in value)

const getGlobalWindow = (): unknown => Reflect.get(globalThis, "window")
const setGlobalWindow = (value: unknown) => {
  Reflect.set(globalThis, "window", value)
}
const deleteGlobalWindow = () => {
  Reflect.deleteProperty(globalThis, "window")
}

const restoreNgspiceWindowShim = () => {
  if (typeof getGlobalWindow() === "undefined" && ngspiceWindowShim) {
    setGlobalWindow(ngspiceWindowShim)
  }
}

const hideNgspiceWindowShim = () => {
  const windowValue = getGlobalWindow()
  if (isNgspiceWindowShim(windowValue)) {
    ngspiceWindowShim = windowValue
    deleteGlobalWindow()
  }
}

const runWithSimulationLock = async <T>(operation: () => Promise<T>) => {
  const previousRun = simulationRunQueue
  let releaseQueue = () => {}
  simulationRunQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve
  })

  await previousRun

  try {
    return await operation()
  } finally {
    releaseQueue()
  }
}

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
    return runWithSimulationLock(async () => {
      restoreNgspiceWindowShim()

      try {
        const simulation = await getSimulation()
        const windowValue = getGlobalWindow()
        if (isNgspiceWindowShim(windowValue)) {
          ngspiceWindowShim = windowValue
        }
        const simulationSpiceString =
          rewritePspiceCompatibilitySyntax(spiceString)

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
      } finally {
        hideNgspiceWindowShim()
      }
    })
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
