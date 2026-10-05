export const cabledMotorAssembly = `import { assembly, jscad } from "tscircuit"

const Frame = () => (
  <>
    <jscad.subtract>
      <jscad.cuboid size={[110, 44, 4]} center={[30, 0, 2]} />
      <jscad.cylinder radius={11.5} height={6} center={[0, 0, 2]} />
    </jscad.subtract>
    <jscad.rotate angles={[Math.PI, 0, 0]}>
      <jscad.rectangle name="motor" size={[42, 42]} reference />
    </jscad.rotate>
    <jscad.translate offset={[65, 0, 14]}>
      <jscad.rectangle name="controller" size={[44, 34]} reference />
    </jscad.translate>
  </>
)

export default () => (
  <assembly.device>
    <assembly.printedpart name="FRAME" jscad={<Frame />}>
      <assembly.motor name="MOTOR" standard="nema17"
        wireConnection="jst-ph-6" mountedTo="FRAME.motor"
        mountFace="frontface" />
    </assembly.printedpart>
    <board name="CONTROLLER" width={44} height={34} pcbX={65}
      mountedTo="FRAME.controller" routingDisabled>
      <connector name="J_MOTOR" standard="jst_ph" pinCount={6}
        footprint="jst6_ph" />
    </board>
    <assembly.cable name="MOTOR_CABLE"
      from="MOTOR.wireside" to=".CONTROLLER > .J_MOTOR" />
  </assembly.device>
)`
