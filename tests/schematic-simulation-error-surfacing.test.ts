import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"

test(
  "schematic simulation surfaces experiment errors when no graphs are produced",
  async () => {
    const { serverUrl } = await getTestServer()
    const response = await fetch(
      `${serverUrl}?svg_type=schsim&simulation_experiment_id=simulation_experiment_0`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          circuit_json: [
            {
              type: "simulation_experiment",
              simulation_experiment_id: "simulation_experiment_0",
              name: "spice_transient_analysis",
              experiment_type: "spice_transient_analysis",
            },
            {
              type: "simulation_unknown_experiment_error",
              simulation_experiment_id: "simulation_experiment_0",
              error_type: "simulation_unknown_experiment_error",
              message: "ngspice failed to initialize",
            },
          ],
        }),
      },
    )

    const svgContent = await response.text()
    expect(response.status).toBe(200)
    expect(svgContent).toContain("Compilation Error")
    expect(svgContent).toContain("ngspice failed to initialize")
  },
  { timeout: 30000 },
)
