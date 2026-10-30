export const explosionAssemblyCode = `
import { assembly } from "@tscircuit/core"
export default () => (
  <assembly.device name="case">
    <board width={30} height={24} />
    <assembly.part name="cover" cadModel={{
      jscad: { type: "cuboid", size: [28, 22, 2] },
      positionOffset: { x: 0, y: 0, z: 6 },
    }} />
    {[-10, 10].map((x, i) => (
      <assembly.part key={i} name={\`bolt\${i + 1}\`} cadModel={{
        jscad: { type: "cylinder", radius: 1.5, height: 8 },
        positionOffset: { x, y: 0, z: 4 },
      }} />
    ))}
    <assembly.explosion.stage name="lift-cover">
      <assembly.explosion.move targetRefs={["cover", "remove-bolts"]} offZ={12} />
    </assembly.explosion.stage>
    <assembly.explosion.stage name="remove-bolts" prevStageRef="lift-cover">
      <assembly.explosion.move targetRefs="bolt1, bolt2" offZ={10} />
    </assembly.explosion.stage>
  </assembly.device>
)`
