import { promises as dns } from "node:dns"
import { isPublicIpv4 } from "./validateProjectBaseUrl"
/**
 * Fetch guard against SSRF by DNS rebinding (the layer-2 defense for the
 * `project_base_url` vector: the request-side validation rejects private
 * hostnames, but a *public* name that resolves to a private address would
 * still let the eval runner reach internal services).
 *
 * Every absolute http(s) fetch goes through a resolved-address check first;
 * the fetch only proceeds when all resolved addresses are public. Relative
 * URLs (same-origin) and already-unreachable parse failures fall through to
 * the underlying fetch unchanged. {@link isPublicIpv4} is shared with the
 * request-side validator so both layers agree on what is public.
 */

export const BLOCKED_RESOLVED_ADDRESS_MESSAGE =
  "Fetch blocked: host resolved to a non-public address"

const isPublicIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase()
  if (normalized === "::1" || normalized.endsWith(":1")) return false
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  )
    return false // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return false // unique local
  if (normalized.startsWith("::ffff:")) return false // IPv4-mapped
  // Only global unicast (2000::/3) counts as public.
  return /^2/.test(normalized)
}

const isSelfReferentialHostname = (hostname: string): boolean =>
  hostname === "localhost" ||
  hostname.endsWith(".localhost") ||
  hostname.endsWith(".internal") ||
  hostname.endsWith(".local") ||
  hostname.endsWith(".arpa") ||
  !hostname.includes(".")

export function createPrivateAddressGuardedFetch(
  underlyingFetch: typeof fetch = globalThis.fetch,
): typeof fetch {
  const guardedFetch = async (input: any, init?: any) => {
    let host: string
    let urlLike: URL
    try {
      urlLike = new URL(typeof input === "string" ? input : (input as any).url)
      host = urlLike.hostname.toLowerCase().replace(/\.$/, "")
      if (!host) return underlyingFetch(input, init)
    } catch {
      // Not an absolute URL: same-origin relative path, safe to pass through.
      return underlyingFetch(input, init)
    }
    if (urlLike.protocol !== "https:" && urlLike.protocol !== "http:") {
      return underlyingFetch(input, init)
    }

    let denied = false
    // (a) self-referential hostname forms (avoids depending on DNS behavior)
    if (isSelfReferentialHostname(host)) {
      denied = true
    }

    if (denied) {
      throw new Error(BLOCKED_RESOLVED_ADDRESS_MESSAGE)
    }

    let addresses: { address: string; family: number }[]
    try {
      addresses = await dns.lookup(host, { all: true })
    } catch (lookupError) {
      // A hostname that cannot be resolved cannot be reached either; surface
      // the same policy error so failures stay consistent with the guard.
      throw new Error(BLOCKED_RESOLVED_ADDRESS_MESSAGE)
    }

    for (const { address, family } of addresses) {
      if (family === 4 && !isPublicIpv4(address)) {
        throw new Error(BLOCKED_RESOLVED_ADDRESS_MESSAGE)
      }
      if (family === 6 && !isPublicIpv6(address)) {
        throw new Error(BLOCKED_RESOLVED_ADDRESS_MESSAGE)
      }
    }

    return underlyingFetch(input, init)
  }
  return guardedFetch as unknown as typeof fetch
}
