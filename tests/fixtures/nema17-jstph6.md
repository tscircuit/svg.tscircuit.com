# Pinned NEMA17 mesh

`nema17-jstph6.glb.gz` is copied unchanged from [tscircuit/core's assembly fixture](https://github.com/tscircuit/core/blob/main/tests/assembly/fixtures/nema17-jstph6.glb.gz), as used with core 0.0.2376. It is the actual NEMA17 JST-PH six-pin motor model, in motor-local coordinates with +Z along the shaft.

The cable regression substitutes this mesh after TSX evaluation, preserving emitted placement and connector coordinates. This prevents transient model-CDN failures from producing snapshots without a motor.
