import { expect, test } from "bun:test"
import { createPlatformConfig } from "../lib/getCircuitJson"

// This is the SPICE netlist tscircuit generates for a V1(15V) -> ammeter ->
// R1(2ohm) loop with a VOUT probe.
const spiceString = `* Circuit JSON to SPICE Netlist
RR1 N2 0 2
Vsimulation_voltage_source_0 N1 0 DC 15
Vsense_simulation_current_probe_0 N1 N2 DC 0
* tscircuit_probe {"simulation_voltage_probe_id":"simulation_voltage_probe_0","name":"VOUT","spice_vector":"V(N2)","source_node_name":"N2","reference_node_name":"0"}
* tscircuit_current_probe {"simulation_current_probe_id":"simulation_current_probe_0","name":"AM1","spice_vector":"I(Vsense_simulation_current_probe_0)","sense_voltage_source_name":"Vsense_simulation_current_probe_0","positive_node_name":"N1","negative_node_name":"N2"}
.PRINT TRAN V(N2) I(Vsense_simulation_current_probe_0)
.SAVE V(N2) I(Vsense_simulation_current_probe_0)
.tran 0.0001 0.001 UIC
.END
`

test(
  "eval platform ngspice engine emits voltage and current transient graphs",
  async () => {
    const engine = createPlatformConfig().spiceEngineMap?.ngspice
    expect(engine).toBeDefined()

    const { simulationResultCircuitJson } = await engine!.simulate(spiceString)
    const types = simulationResultCircuitJson.map((graph: any) => graph.type)

    expect(types).toContain("simulation_transient_voltage_graph")
    expect(types).toContain("simulation_transient_current_graph")
  },
  { timeout: 30_000 },
)
