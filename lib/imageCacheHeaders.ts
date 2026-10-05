// A daily warmer reaches stale entries after 12 hours. Visitors can continue
// seeing the last successful render while the CDN refreshes it in the background.
export const imageCacheHeaders = {
  "Cache-Control":
    "public, max-age=300, stale-while-revalidate=604800, stale-if-error=604800",
  "CDN-Cache-Control":
    "public, s-maxage=43200, stale-while-revalidate=604800, stale-if-error=604800",
}

// Failed refreshes must not replace a successfully cached image.
export const uncachedImageHeaders = {
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
}
