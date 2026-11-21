import { lookup } from "node:dns/promises"
import {
  isDisallowedHostname,
  isPublicIpv4,
  isPublicIpv6,
  parseIpv4Octets,
} from "./validateProjectBaseUrl"

export interface DnsLookupRecord {
  address: string
  family: number
}

export type DnsLookupFn = (hostname: string) => Promise<DnsLookupRecord[]>

export interface GuardedFetchOptions {
  fetchImpl?: typeof fetch
  lookupFn?: DnsLookupFn
  maxRedirects?: number
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const SCHEME_PREFIX_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/

const defaultLookup: DnsLookupFn = (hostname) =>
  lookup(hostname, { all: true, verbatim: true })

function isResolvedAddressPublic(record: DnsLookupRecord): boolean {
  const ipv4 = parseIpv4Octets(record.address)
  if (ipv4) {
    return isPublicIpv4(ipv4)
  }
  return isPublicIpv6(record.address)
}

async function assertPublicHttpUrl(
  parsed: URL,
  lookupFn: DnsLookupFn,
): Promise<void> {
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(
      `Blocked fetch with unsupported protocol "${parsed.protocol}"`,
    )
  }

  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error("Blocked fetch with embedded URL credentials")
  }

  const rawHost = parsed.hostname.trim()
  if (!rawHost) {
    throw new Error("Blocked fetch to empty host")
  }

  if (rawHost.startsWith("[") && rawHost.endsWith("]")) {
    if (!isPublicIpv6(rawHost)) {
      throw new Error("Blocked fetch to non-public IPv6 address")
    }
    return
  }

  const normalizedHost = rawHost.toLowerCase().replace(/\.+$/, "")
  const literalIpv4 = parseIpv4Octets(normalizedHost)
  if (literalIpv4) {
    if (!isPublicIpv4(literalIpv4)) {
      throw new Error("Blocked fetch to non-public IPv4 address")
    }
    return
  }

  if (isDisallowedHostname(normalizedHost)) {
    throw new Error("Blocked fetch to non-public host")
  }

  let records: DnsLookupRecord[]
  try {
    records = await lookupFn(normalizedHost)
  } catch {
    throw new Error("Blocked fetch: failed to resolve host")
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Blocked fetch: host resolved to no addresses")
  }

  for (const record of records) {
    if (!isResolvedAddressPublic(record)) {
      throw new Error("Blocked fetch to host resolving to a non-public address")
    }
  }
}

export function createPrivateAddressGuardedFetch(
  options: GuardedFetchOptions = {},
): typeof fetch {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const lookupFn = options.lookupFn ?? defaultLookup
  const maxRedirects = options.maxRedirects ?? 5

  const guardedFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

    // Allow relative URLs and in-memory blob:/data: assets without network DNS checks
    if (
      !SCHEME_PREFIX_RE.test(rawUrl) ||
      rawUrl.startsWith("blob:") ||
      rawUrl.startsWith("data:")
    ) {
      return fetchImpl(input, init)
    }

    let currentUrl: URL
    try {
      currentUrl = new URL(rawUrl)
    } catch {
      throw new Error("Blocked fetch to invalid URL")
    }

    const callerRedirectMode =
      init?.redirect ??
      (typeof Request !== "undefined" && input instanceof Request
        ? input.redirect
        : "follow")

    let currentInit: RequestInit = {
      ...init,
      redirect: "manual",
    }
    let currentInput: RequestInfo | URL = input

    for (let hop = 0; hop <= maxRedirects; hop++) {
      await assertPublicHttpUrl(currentUrl, lookupFn)

      const response = await fetchImpl(
        hop === 0 ? currentInput : currentUrl.toString(),
        currentInit,
      )

      if (!REDIRECT_STATUSES.has(response.status)) {
        return response
      }

      if (callerRedirectMode === "manual") {
        return response
      }

      if (callerRedirectMode === "error") {
        throw new TypeError("Failed to fetch: unexpected redirect")
      }

      const location = response.headers.get("location")
      if (!location) {
        return response
      }

      if (hop === maxRedirects) {
        throw new Error("Blocked fetch: too many redirects")
      }

      currentUrl = new URL(location, currentUrl)
      const prevMethod = (
        currentInit.method ??
        (typeof Request !== "undefined" && currentInput instanceof Request
          ? currentInput.method
          : "GET")
      ).toUpperCase()

      if (
        response.status === 303 ||
        ((response.status === 301 || response.status === 302) &&
          prevMethod === "POST")
      ) {
        const nextHeaders = new Headers(currentInit.headers)
        nextHeaders.delete("content-length")
        nextHeaders.delete("content-type")
        currentInit = {
          ...currentInit,
          method: "GET",
          body: undefined,
          headers: nextHeaders,
          redirect: "manual",
        }
      }
    }

    throw new Error("Blocked fetch: too many redirects")
  }

  return guardedFetch as typeof fetch
}
