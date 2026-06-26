import createNgspiceSpiceEngine from "@tscircuit/ngspice-spice-engine"
import type { PlatformConfig } from "@tscircuit/props"

let ngspiceEnginePromise:
  | ReturnType<typeof createNgspiceSpiceEngine>
  | undefined

const getNgspiceEngine = () => {
  if (!ngspiceEnginePromise) {
    ngspiceEnginePromise = createNgspiceSpiceEngine().catch((error) => {
      ngspiceEnginePromise = undefined
      throw error
    })
  }

  return ngspiceEnginePromise
}

export const preloadNgspice = () => getNgspiceEngine()

export const createNgspicePlatformConfig = (): Pick<
  PlatformConfig,
  "spiceEngineMap"
> => ({
  spiceEngineMap: {
    ngspice: {
      simulate: async (spice) => {
        const engine = await getNgspiceEngine()
        return engine.simulate(spice)
      },
    },
  },
})
