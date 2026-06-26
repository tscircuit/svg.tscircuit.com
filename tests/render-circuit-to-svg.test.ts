import { expect, test } from "bun:test"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"

test("schsim rendering surfaces simulation experiment errors", async () => {
  const circuitJson = [
    {
      type: "simulation_experiment",
      simulation_experiment_id: "exp-1",
    },
    {
      type: "simulation_unknown_experiment_error",
      error_type: "simulation_unknown_experiment_error",
      simulation_experiment_id: "exp-1",
      message: "Timestep too small",
    },
  ]

  await expect(
    renderCircuitToSvg(circuitJson, "schsim", {
      simulationExperimentId: "exp-1",
    }),
  ).rejects.toThrow('Simulation failed for "exp-1": Timestep too small')
})
