import { test, expect } from "bun:test"
import { runTscircuitCode } from "tscircuit"
import { getTestServer } from "./fixtures/get-test-server"

const ammeterSimulationCode = `
export default () => (
  <board routingDisabled>
    <voltagesource name="V1" voltage="15V" schX={-3} />
    <ammeter
      name="AM1"
      color="#ff0000"
      graphDisplayName="I_LOAD"
      connections={{
        pos: ".V1 > .pin1",
        neg: ".R1 > .pin1",
      }}
    />
    <resistor name="R1" resistance="2" schX={3} footprint="0402" />

    <trace from=".R1 > .pin2" to=".V1 > .pin2" />

    <voltageprobe
      name="VOUT"
      color="#315cff"
      connectsTo=".R1 > .pin1"
      referenceTo=".V1 > .pin2"
    />

    <analogsimulation
      duration="1ms"
      timePerStep="100us"
      spiceEngine="ngspice"
    />
  </board>
)
`

test(
  "schematic simulation svg renders ammeter board with voltage probe",
  async () => {
    const { serverUrl } = await getTestServer()
    const circuitJson = await runTscircuitCode(ammeterSimulationCode)

    const simulationExperiment = circuitJson.find(
      (element) => element.type === "simulation_experiment",
    )
    const voltageGraph = circuitJson.find(
      (element) => element.type === "simulation_transient_voltage_graph",
    )
    expect(simulationExperiment).toBeDefined()
    expect(voltageGraph).toBeDefined()

    const response = await fetch(`${serverUrl}?svg_type=schsim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        circuit_json: circuitJson,
        simulation_experiment_id:
          simulationExperiment!.simulation_experiment_id,
      }),
    })

    const svgContent = await response.text()
    expect(response.status).toBe(200)
    expect(svgContent).toContain(simulationExperiment!.simulation_experiment_id)
    expect(svgContent).toContain(
      voltageGraph!.simulation_transient_voltage_graph_id,
    )
  },
  { timeout: 30000 },
)

test(
  "schematic simulation svg surfaces the real simulation error instead of the generic 'no graphs' message",
  async () => {
    const { serverUrl } = await getTestServer()
    const circuitJson = await runTscircuitCode(ammeterSimulationCode)

    const simulationExperiment = circuitJson.find(
      (element) => element.type === "simulation_experiment",
    )
    expect(simulationExperiment).toBeDefined()

    // Reproduce what tscircuit-core does when the SPICE engine throws: drop the
    // graphs that would normally be produced and insert the real failure
    // message as a simulation_unknown_experiment_error element.
    const failureMessage =
      "ngspice transient analysis failed: singular_matrix_detected"
    const circuitJsonWithError = [
      ...circuitJson.filter(
        (element) =>
          element.type !== "simulation_transient_voltage_graph" &&
          element.type !== "simulation_transient_current_graph",
      ),
      {
        type: "simulation_unknown_experiment_error",
        error_type: "simulation_unknown_experiment_error",
        simulation_experiment_id:
          simulationExperiment!.simulation_experiment_id,
        message: failureMessage,
      },
    ]

    const response = await fetch(`${serverUrl}?svg_type=schsim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        circuit_json: circuitJsonWithError,
        simulation_experiment_id:
          simulationExperiment!.simulation_experiment_id,
      }),
    })

    const svgContent = await response.text()
    // The real error message is surfaced...
    expect(svgContent).toContain("singular_matrix_detected")
    // ...and the generic masking message is not.
    expect(svgContent).not.toContain(
      "No simulation_transient_voltage_graph elements found",
    )
  },
  { timeout: 30000 },
)
