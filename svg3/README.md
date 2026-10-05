# svg3: Cloudflare rendering service

`svg3.tscircuit.com` runs a Worker in front of Workers KV and a bounded pool of
Cloudflare Containers. Native Resvg, WASM/STEP imports, circuit evaluation, and
large autorouting jobs execute under Bun in the containers, using the same
`shared/handle-request.ts`, `handlers/`, and `lib/` code as Vercel.

The existing Vercel deployment remains at its current domain. Its adapter lives
in `svg2/`; `pages/api/[...anyroute].ts` is the Next.js discovery shim. Adding the
`svg2.tscircuit.com` domain to Vercel and cutting over `svg.tscircuit.com` are
separate operations. This configuration claims only `svg3.tscircuit.com`.

## Cache behavior

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
  refresh. The container retains its most recent successful result for 60 seconds
  to collapse repeated requests and avoid KV's one-write/second/key limit.
  Explicit refreshes within that window reuse that result.
- Responses expose `X-Svg-Cache`, `Age`, and `ETag`. Conditional GET and HEAD work
  on cache hits. Browser freshness is five minutes; another CDN cache is disabled
  so that the Worker controls refreshes. POST responses are `no-store` downstream.
- KV's 25 MiB value limit is handled with a 24 MiB storage cutoff. Larger images
  stream unchanged without being cached; the Worker does not buffer their full
  bodies. If such images become common, add R2 overflow storage. POST bodies are
  limited to 1 MiB, matching the existing Next.js API default.
- Four deterministically selected containers render one circuit at a time each.
  Each uses `standard-3` and sleeps after 10 minutes idle. Each lane allows eight
  active/waiting requests, returning retryable 503s beyond that. This bounds cost
  and concurrent routing memory; it does not establish that the DDR example fits
  until the real workload is measured in Cloudflare.

Bump `CACHE_VERSION` when a renderer change must invalidate existing images.
Old versions expire naturally; queued jobs for older versions are discarded.

## Development and validation

From the repository root (Bun 1.3.14 and Node 22+):

```sh
bun install --frozen-lockfile
cd svg3
bun install
bun run check
bun run test
bun run dry-run
bun run dev
```

Docker must be available for local container development and deployment.
`bun run svg3/server.ts` from the repository root starts the shared renderer alone
on port 8080. `/health` on the Worker is an edge liveness check; render a real image
to verify the container, native dependencies, and KV.

## First deployment

Authenticate with Wrangler after the build and tests pass:

```sh
cd svg3
bunx wrangler login
bunx wrangler whoami
bunx wrangler queues create svg3-image-refresh
bunx wrangler queues create svg3-image-refresh-failed
bun run deploy
```

Choose the Cloudflare account that owns the `tscircuit.com` zone. The account needs
Workers Paid with Containers enabled. Wrangler builds and uploads the image,
creates the SQLite Durable Object namespace, provisions the `IMAGES` KV binding,
and attaches the `svg3.tscircuit.com` custom domain. Keep the returned KV namespace
ID in `wrangler.jsonc` for explicit subsequent deployments. Queue creation is only
needed once. Review the selected account before running the deployment.

Smoke check the same image URL twice: expect `MISS` then `HIT` with identical
bytes. Repeat with `Pragma: no-cache`, PNG, `realistic=true`, and the full DDR docs
example. Check the dead-letter queue and Worker logs for failed refreshes. The
existing docs warmer must target `svg3.tscircuit.com` to warm this separate cache.
No production domain cutover or docs warmer changes are performed by this PR.
