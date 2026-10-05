# svg2: Vercel adapter

`next-handler.ts` adapts Next.js requests/responses to the shared renderer in
`shared/handle-request.ts`. The route shim remains in `pages/api/` so the current
Vercel project can keep its existing root directory and build configuration.

Run `bun start`, `bun run build`, and the existing production smoke tests from
the repository root. The renderer, native dependencies, and cache headers are
shared with the Cloudflare container. Vercel CDN caching is unchanged.

This directory prepares the Vercel service for the `svg2.tscircuit.com` name;
it does not change DNS or remove `svg.tscircuit.com` from the existing project.
