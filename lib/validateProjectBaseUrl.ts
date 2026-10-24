/**
 * Validation for the user-supplied `project_base_url` request parameter.
 *
 * That parameter is forwarded into the eval platform config, where imports
 * of `__STATIC_ASSET__`-marked files are fetched server-side as
 * `${projectBaseUrl}/${path}`. Without validation an unauthenticated client
 * can make the server issue GETs to internal-only URLs (loopback ports,
 * private-range services, cloud metadata endpoints) and, through the error
 * path, read the HTTP status of those internal endpoints — a probing oracle.
 *
 * The deployable rule here is https-only plus a denylist of private,
 * loopback, link-local and metadata address spaces. IP-literal hosts are
 * checked directly; IPv6 literals are rejected wholesale because public
 * IPv6 services are addressed by domain. Conventional internally-resolving
 * hostname forms (localhost, .internal, .local, metadata names) are also
 * rejected. This is a request-side guard, not a full DNS-rebinding defense;
 * resolving DNS names to private addresses would additionally require
 * fetch-layer enforcement.
 */

export const INVALID_PROJECT_BASE_URL_MESSAGE =
  "Invalid project_base_url: must be an https:// URL pointing at a public host"

export function isPublicHttpsProjectBaseUrl(rawUrl: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }

  if (url.protocol !== "https:") return false
  if (url.username || url.password) return false

  const hostname = url.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "")

  if (!hostname) return false

  // IPv6 literals: reject wholesale (avoids mapped/embedded forms obfuscating
  // addresses; legitimate services use domain names).
  if (hostname.includes(":")) return false

  if (isIpv4Literal(hostname) && !isPublicIpv4(hostname)) return false

  // Numeric pseudo-IP forms (bare integer, hex/octal/binary encodings).
  if (/^\d+$/.test(hostname)) return false
  if (/^0[xob]/.test(hostname)) return false

  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false
  if (
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".arpa") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".home")
  )
    return false
  if (/^metadata/.test(hostname)) return false
  // Single-label hostnames (no dot) rely on the search-domain list and can
  // resolve to internal services; public assets are addressed by FQDN.
  if (!hostname.includes(".")) return false

  return true
}

function isIpv4Literal(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
}

function isPublicIpv4(ip: string): boolean {
  const octets = ip.split(".").map((p) => parseInt(p, 10))
  if (octets.length !== 4) return false
  const [a, b] = octets
  if (octets.some((v) => Number.isNaN(v))) return false

  if (a === 0) return false // "this network"
  if (a === 10) return false // private
  if (a === 127) return false // loopback
  if (a === 100 && b >= 64 && b <= 127) return false // 100.64/10 CGNAT
  if (a === 169 && b === 254) return false // link-local incl. EC2 metadata
  if (a === 172 && b >= 16 && b <= 31) return false // private
  if (a === 192 && b === 168) return false // private
  if (a === 192 && b === 0) return false // 192.0.0.0/24 + doc ranges
  if (a === 198 && (b === 18 || b === 19)) return false // benchmark range
  if (a >= 224) return false // multicast + reserved
  return true
}
