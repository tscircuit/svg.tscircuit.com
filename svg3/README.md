# svg3: Cloudflare rendering service

`svg3.tscircuit.com` uses a cache-facing Worker, Workers KV, a private image
Worker, and a bounded container fallback. Cache misses with circuit JSON render
PCB, schematic, assembly, and pinout SVG/PNG in the image Worker. It imports the
same `shared/render-2d.ts` and PNG sizing rules as Vercel and the Bun container;
PNG uses Resvg WASM with the same bundled DejaVu font.

The image Worker has no public route. A service binding isolates its CPU/memory
failures from the cache-facing Worker. Unsupported requests, errors, failed image
streams, and PNGs above 4,194,304 pixels fall back to the existing Bun renderer.
TSX evaluation, simulation, 3D/STEP, and large autorouting jobs still use containers.
Direct circuit-JSON SVG/PNG rendering is the production rollout here; the successful
Dynamic Workers TSX and realistic-3D experiments are not a complete replacement for
the evaluator's import resolution or native CAD pipeline. The full DDR experiment
exceeded the 128 MiB Dynamic Worker memory limit even with a 300-second CPU budget.

The existing Vercel deployment remains at its current domain. Its adapter lives
in `svg2/`; `pages/api/[...anyroute].ts` is the Next.js discovery shim. Adding the
`svg2.tscircuit.com` domain to Vercel and cutting over `svg.tscircuit.com` are
separate operations. This configuration claims only `svg3.tscircuit.com`.

## Cache behavior

3D PNG/SVG renders also retain their computed GLB under a separate `glb:` KV
key. `?format=glb` (no `svg_type` required) reads this model directly. The key preserves the
circuit input, project origin, entrypoint, method, and cache version while
excluding image format, camera, lighting, background, zoom, and raster size.
Different image views therefore share a downloadable model. GET and POST
remain distinct, and private/debug requests bypass both image and model storage.

The private container hands off the exact converted model through a one-use
random token; the Durable Object stores it before completing the image request.
Images and model downloads for the same input use the same serialized lane.
The model also stays in that lane's memory for 60 seconds to cover KV propagation
lag. Models use the same 12-hour freshness, 30-day retention, ETag/HEAD behavior,
and 24 MiB cutoff as images. Oversized models download normally but cannot be
stored in KV. Existing image-only cache entries populate the model on the next
image refresh or first model request. Failed KV writes do not prevent delivery.

`camera_preset=bottom-center-angled` shows bottom-mounted parts and stiffeners;
all camera presets affect the image key but leave the model key unchanged.

- Successful SVG/PNG responses are stored as binary KV values for **30 days**.
  They are fresh for **12 hours**. Error, HTML, debug, authenticated, cookie-bearing,
  private, and `no-store` responses bypass storage.
- Keys hash the full sorted query string, method, exact POST bytes, and
  `CACHE_VERSION`. Query order and GET/HEAD share keys; duplicate query values
  retain their order. All rendering options remain part of the key. POST and GET
  intentionally have distinct keys because the existing parser handles them differently.
- A stale GET/HEAD serves immediately and enqueues a refresh. Cloudflare Queue
  consumers perform long renders without depending on the HTTP Worker's 30-second
  `waitUntil` lifetime. Failed jobs retry three times and then go to the dead-letter
  queue. Duplicate jobs recheck freshness in the renderer before doing work.
- `Cache-Control: no-cache` or `Pragma: no-cache` waits for revalidation, matching
  the docs warmer. POST revalidates synchronously. Failed renders preserve and
  serve the previous success until its 30-day retention ends.
- KV is eventually consistent: a region can briefly see an older value after a
  refresh. The Durable Object retains its most recent successful result for 60 seconds
  to collapse repeated requests and avoid KV's one-write/second/key limit.
  Explicit refreshes within that window reuse that result.
- Responses expose `X-Svg-Cache`, `X-Svg-Renderer` (`worker` or `container`),
  `Age`, and `ETag`. Renderer provenance is retained in KV, including cache hits. Conditional GET and HEAD work
  on cache hits. Browser freshness is five minutes; another CDN cache is disabled
  so that the Worker controls refreshes. POST responses are `no-store` downstream.
- KV's 25 MiB value limit is handled with a 24 MiB storage cutoff. Larger images
  stream unchanged without being cached; the Worker does not buffer their full
  bodies. If such images become common, add R2 overflow storage. POST bodies are
  limited to 1 MiB, matching the existing Next.js API default.
- Four deterministically selected Durable Object lanes serialize renders and
  collapse duplicate work. Worker renders do not start a container. Each lane's
  fallback container uses `standard-3`, starts on demand, and sleeps after 10 minutes
  idle. Each lane allows eight active/waiting requests, returning retryable 503s
  beyond that. The full DDR example has completed on the deployed container.


Bump `CACHE_VERSION` when a renderer change must invalidate existing images.
Old versions expire naturally; queued jobs for older versions are discarded.

## Development and validation

From the repository root (Bun 1.3.14 and Node 22+):

```sh
bun install --frozen-lockfile
cd svg3
bun install --frozen-lockfile
bun run check
bun run test
bun run test:runtime
bun run dry-run
bun run dev
```

`test:runtime` starts the actual local workerd renderer and Bun handlers, compares
SVG/PNG bytes across all four supported views and sizing/options, and checks that
oversized/unsupported requests defer to containers. Unit tests cover service
failures, interrupted bodies, original POST preservation, and cached provenance.

Docker must be available for local container development and deployment.
`bun run svg3/server.ts` from the repository root starts the shared renderer alone
on port 8080. `/health` on the Worker is an edge liveness check; render a real image
to verify the container, native dependencies, and KV.

## Deployment

Authenticate with Wrangler after the build and tests pass:

```sh
cd svg3
bunx wrangler login
bunx wrangler whoami
bun run deploy
```

Choose the Cloudflare account that owns the `tscircuit.com` zone. The account needs
Workers Paid with Containers enabled. `bun run deploy` deploys the private image
Worker first (`wrangler.images.jsonc`), then the cache Worker (`wrangler.jsonc`).
The latter binds `IMAGE_RENDERER` to `svg3-image-renderer`. Deploy both when shared
rendering code changes. Wrangler builds and uploads the fallback container image,
uses the SQLite Durable Object namespace and the committed production `IMAGES` KV
binding, and attaches the `svg3.tscircuit.com` custom domain. The queues and KV
namespace already exist in the tscircuit account; queue creation is only needed
once. For a separate deployment, change the Worker/domain/queue names and remove
the KV namespace ID so Wrangler provisions a separate cache. Review the selected
account before running the deployment.

Smoke check a circuit-JSON PCB/PNG URL (`X-Svg-Renderer: worker`) and a TSX/3D
URL (`X-Svg-Renderer: container`). Request the same URL twice: expect `MISS` then `HIT` with identical
bytes. Repeat with `Pragma: no-cache`, PNG, `realistic=true`, and the full DDR docs
example. Check the dead-letter queue and Worker logs for failed refreshes. The
existing docs warmer must target `svg3.tscircuit.com` to warm this separate cache.
No production domain cutover or docs warmer changes are performed by this PR.
