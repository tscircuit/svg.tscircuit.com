export const multipleSimulationCircuitCode = `
export default () => (
  <board routingDisabled>
    <voltagesource name="V1" voltage="5V" />
    <resistor name="R1" resistance="1k" />
    <resistor name="R2" resistance="2k" />
    <resistor name="R3" resistance="3k" />
    <trace from=".V1 > .pin1" to=".R1 > .pin1" />
    <trace from=".R1 > .pin2" to=".R2 > .pin1" />
    <trace from=".R2 > .pin2" to=".R3 > .pin1" />
    <trace from=".R3 > .pin2" to=".V1 > .pin2" />

    <voltageprobe name="ROOT_PROBE" connectsTo=".V1 > .pin1" />
    <analogsimulation
      name="Root Fast"
      duration="1ms"
      timePerStep="100us"
      spiceEngine="ngspice"
    />
    <analogsimulation
      name="Root Slow"
      duration="2ms"
      timePerStep="200us"
      spiceEngine="ngspice"
    />

    <group name="first-stage">
      <voltageprobe name="FIRST_STAGE_PROBE" connectsTo=".R1 > .pin2" />
      <analogsimulation
        name="Input Group"
        duration="3ms"
        timePerStep="300us"
        spiceEngine="ngspice"
      />
    </group>
    <group name="second-stage">
      <voltageprobe name="SECOND_STAGE_PROBE" connectsTo=".R2 > .pin2" />
      <analogsimulation
        name="Output Group"
        duration="4ms"
        timePerStep="400us"
        spiceEngine="ngspice"
      />
    </group>
  </board>
)
`
