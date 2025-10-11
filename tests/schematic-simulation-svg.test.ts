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
    <inductor name="L1" inductance={"1H"} schY={3} pcbY={3} />
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
      schRotation={270}
      voltage={"10V"}
      waveShape="square"
      dutyCycle={0.68}
      frequency={"1kHz"}
      schX={-3}
    />
    <mosfet
      channelType="n"
      footprint={"sot23"}
      name="M1"
      mosfetMode="enhancement"
      pcbX={-4}
    />
    <analogsimulation />
  </board>
)
`

test(
  "schematic simulation svg conversion",
  async () => {
    const { serverUrl } = await getTestServer()
    const circuitJson = await runTscircuitCode(simulationCircuitCode)
    const simulationExperimentId = "simulation-experiment-id"
    const simulationGraphId = "transient-graph-id"
    const queryGraphIdA = "query-graph-a"
    const queryGraphIdB = "query-graph-b"
    const circuitJsonWithSimulation = [
      ...circuitJson,
      {
        type: "simulation_experiment",
        simulation_experiment_id: simulationExperimentId,
        name: "Transient Simulation",
        experiment_type: "transient",
      },
      {
        type: "simulation_transient_voltage_graph",
        simulation_transient_voltage_graph_id: simulationGraphId,
        simulation_experiment_id: simulationExperimentId,
        timestamps_ms: [0, 1, 2, 3, 4],
        voltage_levels: [0, 2.5, 5, 2.5, 0],
        time_per_step: 1,
        start_time_ms: 0,
        end_time_ms: 4,
        name: "V(out)",
      },
      {
        type: "simulation_transient_voltage_graph",
        simulation_transient_voltage_graph_id: queryGraphIdA,
        simulation_experiment_id: simulationExperimentId,
        timestamps_ms: [0, 1, 2, 3],
        voltage_levels: [5, 4, 3, 2],
        time_per_step: 1,
        start_time_ms: 0,
        end_time_ms: 3,
        name: "V(gate)",
      },
      {
        type: "simulation_transient_voltage_graph",
        simulation_transient_voltage_graph_id: queryGraphIdB,
        simulation_experiment_id: simulationExperimentId,
        timestamps_ms: [0, 1, 2, 3],
        voltage_levels: [0, -1, -2, -3],
        time_per_step: 1,
        start_time_ms: 0,
        end_time_ms: 3,
        name: "V(source)",
      },
      {
        type: "simulation_voltage_probe",
        simulation_voltage_probe_id: "probe-out",
        name: "Output Probe",
        source_net_id: "net.D1.cathode",
      },
    ]

    const response = await fetch(`${serverUrl}?svg_type=schsim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        circuit_json: circuitJsonWithSimulation,
        simulation_experiment_id: simulationExperimentId,
        simulation_transient_voltage_graph_ids: [simulationGraphId],
        schematic_height_ratio: 0.6,
      }),
    })

    const svgContent = await response.text()
    expect(response.status).toBe(200)
    expect(svgContent).toContain(simulationExperimentId)
    expect(svgContent).toContain(simulationGraphId)
    expect(svgContent).toMatchSvgSnapshot(import.meta.path)

    const queryResponse = await fetch(
      `${serverUrl}?svg_type=schsim&simulation_experiment_id=${simulationExperimentId}&simulation_transient_voltage_graph_ids=${queryGraphIdA}&simulation_transient_voltage_graph_ids=${queryGraphIdB}&schematic_height_ratio=0.5`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ circuit_json: circuitJsonWithSimulation }),
      },
    )
    const querySvg = await queryResponse.text()
    expect(queryResponse.status).toBe(200)
    expect(querySvg).toContain(simulationExperimentId)
    expect(querySvg).toContain(queryGraphIdA)
    expect(querySvg).toContain(queryGraphIdB)
  },
  { timeout: 30000 },
)
