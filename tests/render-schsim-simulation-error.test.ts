import { test, expect } from "bun:test"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"

// When a SPICE simulation fails, @tscircuit/core records the cause as a
// `simulation_unknown_experiment_error` and emits no transient graphs.
// circuit-to-svg only sees the missing graphs and throws a generic
// "No ...graph elements found" message. renderCircuitToSvg should surface the
// recorded error message instead.

const simulationExperimentId = "simulation_experiment_0"

const failedSimulationCircuitJson = [
  {
    type: "simulation_experiment",
    simulation_experiment_id: simulationExperimentId,
    name: "analog1",
  },
  {
    type: "simulation_unknown_experiment_error",
    simulation_unknown_experiment_error_id:
      "simulation_unknown_experiment_error_0",
    simulation_experiment_id: simulationExperimentId,
    error_type: "simulation_unknown_experiment_error",
    message: "ngspice failed: singular matrix at node N1",
  },
]

test("schsim render surfaces the real simulation error when graphs are missing", async () => {
  let thrown: Error | undefined
  try {
    await renderCircuitToSvg(failedSimulationCircuitJson, "schsim", {
      simulationExperimentId,
    })
  } catch (err) {
    thrown = err as Error
  }

  expect(thrown).toBeDefined()
  // The real ngspice message must be surfaced...
  expect(thrown!.message).toContain(
    "ngspice failed: singular matrix at node N1",
  )
  // ...instead of the generic circuit-to-svg message.
  expect(thrown!.message).not.toContain("No simulation_transient_voltage_graph")
})

test("schsim render keeps the original error when no simulation error is recorded", async () => {
  const circuitJsonWithoutGraphsOrError = [
    {
      type: "simulation_experiment",
      simulation_experiment_id: simulationExperimentId,
      name: "analog1",
    },
  ]

  let thrown: Error | undefined
  try {
    await renderCircuitToSvg(circuitJsonWithoutGraphsOrError, "schsim", {
      simulationExperimentId,
    })
  } catch (err) {
    thrown = err as Error
  }

  expect(thrown).toBeDefined()
  expect(thrown!.message).toContain("No simulation_transient_voltage_graph")
})
