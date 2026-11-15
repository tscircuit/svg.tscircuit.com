import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const cwd = fileURLToPath(new URL(".", import.meta.url))
const wrangler = fileURLToPath(
  new URL("node_modules/wrangler/bin/wrangler.js", import.meta.url),
)

// Workers Builds attaches its primary Worker's identity to every command.
// Keep those checks for svg3-tscircuit-com, but do not let its name replace
// the explicitly configured secondary svg3-image-renderer Worker.
const imageEnv = { ...process.env }
delete imageEnv.WRANGLER_CI_OVERRIDE_NAME
delete imageEnv.WRANGLER_CI_MATCH_TAG

execFileSync(
  process.execPath,
  [wrangler, "deploy", "-c", "wrangler.images.jsonc", ...process.argv.slice(2)],
  { cwd, env: imageEnv, stdio: "inherit" },
)
execFileSync(process.execPath, [wrangler, "deploy", ...process.argv.slice(2)], {
  cwd,
  env: process.env,
  stdio: "inherit",
})
