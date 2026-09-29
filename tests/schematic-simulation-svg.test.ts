import { test, expect } from "bun:test"
import { runTscircuitCode } from "tscircuit"
import { getTestServer } from "./fixtures/get-test-server"

const simulationCircuitCode = `
export default () => (
      <board width={30} height={30} schMaxTraceDistance={5}>
        <voltagesource
          name="V1"
          voltage={"5V"}
          schY={2}
          schX={-5}
          schRotation={270}
        />
        <trace from={".V1 > .pin1"} to={".L1 > .pin1"} />
        <trace from={".L1 > .pin2"} to={".D1 > .anode"} />
        <trace from={".D1 > .cathode"} to={".C1 > .pin1"} />
        <trace from={".D1 > .cathode"} to={".R1 > .pin1"} />
        <trace from={".C1 > .pin2"} to={".R1 > .pin2"} />
        <trace from={".R1 > .pin2"} to={".V1 > .pin2"} />
        <trace from={".L1 > .pin2"} to={".M1 > .drain"} />
        <trace from={".M1 > .source"} to={".V1 > .pin2"} />
        <trace from={".M1 > .source"} to={"net.GND"} />
        <trace from={".M1 > .gate"} to={".V2 > .pin1"} />
        <trace from={".V2 > .pin2"} to={".V1 > .pin2"} />
        <inductor name="L1" inductance={"1mH"} schY={3} pcbY={3} />
        <diode
          name="D1"
          footprint={"0603"}
          schY={3}
          schX={3}
          pcbY={6}
          pcbX={3}
        />
        <capacitor
          polarized
          schRotation={270}
          name="C1"
          capacitance={"10uF"}
          footprint={"0603"}
          schX={3}
          pcbX={3}
        />
        <resistor
          schRotation={270}
          name="R1"
          resistance={"1k"}
          footprint={"0603"}
          schX={6}
          pcbX={9}
        />
        <voltagesource
          name="V2"
          voltage={"10V"}
          waveShape="square"
          dutyCycle={0.68}
          frequency={"1kHz"}
          schX={-3}
          schRotation={270}
        />
        <mosfet
          channelType="n"
          footprint={"sot23"}
          name="M1"
          mosfetMode="enhancement"
          pcbX={-4}
        />
        <voltageprobe connectsTo={".V1 > .pin1"} />
        <voltageprobe connectsTo={".R1 > .pin1"} />

        <analogsimulation
          duration={100}
          timePerStep={0.01}
          spiceEngine="ngspice"
        />
      </board>
      )
`

test(
  "schematic simulation svg conversion",
  async () => {
    const { serverUrl } = await getTestServer()
    const circuitJson = await runTscircuitCode(simulationCircuitCode)
    const simulationTransientVoltageGraphs = circuitJson.filter(
      (element) => element.type === "simulation_transient_voltage_graph",
    )
    const graph1 = simulationTransientVoltageGraphs[0]
    const graph2 = simulationTransientVoltageGraphs[1]
    const simulationExperiments = circuitJson.filter(
      (element) => element.type === "simulation_experiment",
    )
    const simulationExperiment = simulationExperiments[0]

    const response = await fetch(`${serverUrl}?svg_type=schsim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        circuit_json: circuitJson,
        simulation_experiment_id: simulationExperiment.simulation_experiment_id,
        schematic_height_ratio: 0.6,
      }),
    })

    const svgContent = await response.text()
    expect(response.status).toBe(200)
    expect(svgContent).toContain(simulationExperiment.simulation_experiment_id)
    expect(svgContent).toContain(graph1.simulation_transient_voltage_graph_id)
    expect(svgContent).toContain(graph2.simulation_transient_voltage_graph_id)
    expect(svgContent).toMatchSvgSnapshot(import.meta.path)

    const queryResponse = await fetch(
      `${serverUrl}?svg_type=schsim&simulation_experiment_id=${simulationExperiment.simulation_experiment_id}&simulation_transient_voltage_graph_ids=${graph1.simulation_transient_voltage_graph_id}&simulation_transient_voltage_graph_ids=${graph2.simulation_transient_voltage_graph_id}&schematic_height_ratio=0.5`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ circuit_json: circuitJson }),
      },
    )
    const querySvg = await queryResponse.text()
    expect(queryResponse.status).toBe(200)
    expect(querySvg).toContain(simulationExperiment.simulation_experiment_id)
    expect(querySvg).toContain(graph1.simulation_transient_voltage_graph_id)
    expect(querySvg).toContain(graph2.simulation_transient_voltage_graph_id)
  },
  { timeout: 30000 },
)
