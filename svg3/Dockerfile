# syntax=docker/dockerfile:1
FROM oven/bun:1.3.14-debian
WORKDIR /app
COPY package.json bun.lock ./
COPY scripts/apply-dependency-patches.mjs scripts/apply-dependency-patches.mjs
# Optional CA mount is for local builds in a managed/proxied environment only.
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then \
      NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca bun install --frozen-lockfile; \
    else bun install --frozen-lockfile; fi
COPY shared shared
COPY lib lib
COPY handlers handlers
COPY get-index-page-html.ts get-html-for-generated-url-page.ts getErrorSvg.ts ./
COPY svg3/server.ts svg3/server.ts
ENV NODE_ENV=production PORT=8080
USER bun
EXPOSE 8080
CMD ["bun", "run", "svg3/server.ts"]
