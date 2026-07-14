import { expect, test } from "bun:test"
import type { CircuitJson, SimulationExperiment } from "circuit-json"
import { getTestServer } from "./fixtures/get-test-server"
import { multipleSimulationCircuitCode } from "./fixtures/multiple-simulation-circuit-code"

const getExperiment = (circuitJson: CircuitJson, name: string) => {
  const experiment = circuitJson.find(
    (element): element is SimulationExperiment =>
      element.type === "simulation_experiment" && element.name === name,
  )
  if (!experiment) throw new Error(`Missing simulation experiment: ${name}`)
  return experiment
}

test(
  "renders each named simulation from a real multi-simulation ngspice run",
  async () => {
    const { serverUrl } = await getTestServer()
    const circuitJsonResponse = await fetch(
      `${serverUrl}?format=circuit_json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fs_map: { "index.tsx": multipleSimulationCircuitCode },
          main_component_path: "index.tsx",
        }),
      },
    )

    const circuitJsonResponseText = await circuitJsonResponse.text()
    if (!circuitJsonResponse.ok) {
      throw new Error(
        `Circuit JSON request failed (${circuitJsonResponse.status}): ${circuitJsonResponseText}`,
      )
    }
    const circuitJson = JSON.parse(circuitJsonResponseText) as CircuitJson
    const experiments = circuitJson.filter(
      (element): element is SimulationExperiment =>
        element.type === "simulation_experiment",
    )
    expect(experiments.map((experiment) => experiment.name)).toEqual([
      "Root Fast",
      "Root Slow",
      "Input Group",
      "Output Group",
    ])
    expect(
      circuitJson.filter(
        (element) => element.type === "simulation_transient_voltage_graph",
      ),
    ).toHaveLength(8)
    expect(
      circuitJson.filter(
        (element) => element.type === "simulation_unknown_experiment_error",
      ),
    ).toHaveLength(0)

    const rootFast = getExperiment(circuitJson, "Root Fast")
    const defaultResponse = await fetch(`${serverUrl}?svg_type=sim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circuit_json: circuitJson }),
    })
    const defaultSvg = await defaultResponse.text()
    expect(defaultResponse.status).toBe(200)
    expect(defaultSvg).toContain(rootFast.simulation_experiment_id)

    const outputGroup = getExperiment(circuitJson, "Output Group")
    const namedResponse = await fetch(
      `${serverUrl}?svg_type=sim&simulation_experiment_name=${encodeURIComponent("Output Group")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ circuit_json: circuitJson }),
      },
    )
    const namedSvg = await namedResponse.text()
    expect(namedResponse.status).toBe(200)
    expect(namedSvg).toContain(outputGroup.simulation_experiment_id)
    expect(namedSvg).toContain("SECOND_STAGE_PROBE")
    expect(namedSvg).not.toContain("ROOT_PROBE")
    expect(namedSvg).not.toContain("FIRST_STAGE_PROBE")

    const inputGroup = getExperiment(circuitJson, "Input Group")
    const bodyNameResponse = await fetch(`${serverUrl}?svg_type=schsim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        circuit_json: circuitJson,
        simulation_experiment_name: "Input Group",
      }),
    })
    const bodyNameSvg = await bodyNameResponse.text()
    expect(bodyNameResponse.status).toBe(200)
    expect(bodyNameSvg).toContain(inputGroup.simulation_experiment_id)

    const missingResponse = await fetch(
      `${serverUrl}?svg_type=sim&simulation_experiment_name=Missing`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ circuit_json: circuitJson }),
      },
    )
    const missingBody = await missingResponse.json()
    expect(missingResponse.status).toBe(400)
    expect(missingBody.error).toContain('name "Missing" was not found')
    expect(missingBody.available_simulation_experiments).toHaveLength(4)

    const circuitJsonWithDuplicateNames = circuitJson.map((element) =>
      element.type === "simulation_experiment" &&
      ["Root Fast", "Root Slow"].includes(element.name)
        ? { ...element, name: "Duplicate" }
        : element,
    ) as CircuitJson
    const ambiguousResponse = await fetch(
      `${serverUrl}?svg_type=sim&simulation_experiment_name=Duplicate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ circuit_json: circuitJsonWithDuplicateNames }),
      },
    )
    const ambiguousBody = await ambiguousResponse.json()
    expect(ambiguousResponse.status).toBe(400)
    expect(ambiguousBody.error).toContain("is ambiguous")
  },
  { timeout: 60_000 },
)
