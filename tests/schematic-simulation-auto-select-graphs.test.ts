import { test, expect } from "bun:test"
import { runTscircuitCode } from "tscircuit"
import { getTestServer } from "./fixtures/get-test-server"

test(
  "schematic simulation auto-selects transient current and voltage graphs when ids are omitted",
  async () => {
    const { serverUrl } = await getTestServer()
    const circuitJson = await runTscircuitCode(`
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
    `)

    const simulationExperiment = circuitJson.find(
      (element) => element.type === "simulation_experiment",
    )
    const voltageGraph = circuitJson.find(
      (element) => element.type === "simulation_transient_voltage_graph",
    )
    const currentGraph = circuitJson.find(
      (element) => element.type === "simulation_transient_current_graph",
    )

    expect(simulationExperiment).toBeDefined()
    expect(voltageGraph).toBeDefined()
    expect(currentGraph).toBeDefined()

    const response = await fetch(
      `${serverUrl}?svg_type=schsim&simulation_experiment_id=${simulationExperiment!.simulation_experiment_id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ circuit_json: circuitJson }),
      },
    )

    const svgContent = await response.text()
    expect(response.status).toBe(200)
    expect(svgContent).toContain(simulationExperiment!.simulation_experiment_id)
    expect(svgContent).toContain(
      voltageGraph!.simulation_transient_voltage_graph_id,
    )
    expect(svgContent).toContain(
      currentGraph!.simulation_transient_current_graph_id,
    )
  },
  { timeout: 30000 },
)
