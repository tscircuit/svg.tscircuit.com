# CC2340R5 exposed-interface fixture

Sources copied from [core PR #5445](https://github.com/tscircuit/core/pull/5445),
commit `aa9041887ab2d0cfd76a7d9c55db58a119994a42`, under
`tests/fixtures/cc2340r5-reference`.

This adapts the real ShiboSoftwareDev/cc2340r5-reference-design 1.4.0 release
`bff7bbb1-c0df-4b3e-8cb2-5f5c706caa87`. It preserves all 27 components and 16
original nets, adds eight named GPIO nets in place of their NC declarations,
and exposes those GPIOs plus power, ground, reset and SWD: 13 terminals.
Core tests verify the original electrical signature plus the explicit GPIO
addition and each terminal's wire path. PCB rendering is disabled for this
schematic-only HTTP regression.
