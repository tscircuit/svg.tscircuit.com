# syntax=docker/dockerfile:1
# Stage source files separately so each COPY does not duplicate the installed
# dependency tree on Docker daemons using the vfs storage driver.
FROM scratch AS sources
COPY shared shared
COPY lib lib
COPY handlers handlers
COPY get-index-page-html.ts get-html-for-generated-url-page.ts getErrorSvg.ts ./
COPY svg3/server.ts svg3/server.ts

FROM oven/bun:1.3.14-debian
WORKDIR /app
COPY --chown=bun:bun package.json bun.lock ./
COPY --chown=bun:bun scripts/apply-dependency-patches.mjs scripts/apply-dependency-patches.mjs
# Optional CA mount is for local builds in a managed/proxied environment only.
# Keep Bun's download cache out of the image and install only renderer packages.
# Shipping the full development tree/cache makes the registry upload layer huge.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then \
      NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca bun install --frozen-lockfile --production; \
    else bun install --frozen-lockfile --production; fi
COPY --from=sources --chown=bun:bun / /app/
ENV NODE_ENV=production PORT=8080
USER bun
EXPOSE 8080
CMD ["bun", "run", "svg3/server.ts"]
