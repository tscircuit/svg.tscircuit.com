const DISALLOWED_EXACT_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "broadcasthost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "instance-data",
])

const DISALLOWED_HOST_SUFFIXES = [
  ".localhost",
  ".internal",
  ".local",
  ".localdomain",
  ".arpa",
  ".lan",
  ".home",
  ".corp",
  ".intranet",
  ".invalid",
  ".test",
  ".onion",
]

export function parseIpv4Octets(
  host: string,
): [number, number, number, number] | null {
  const parts = host.split(".")
  if (parts.length !== 4) return null

  const octets: number[] = []
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) {
      return null
    }
    const value = Number(part)
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      return null
    }
    octets.push(value)
  }

  return octets as [number, number, number, number]
}

export function isPublicIpv4(
  octets: readonly [number, number, number, number],
): boolean {
  const [a, b, c] = octets

  // 0.0.0.0/8 ("this network")
  if (a === 0) return false
  // 10.0.0.0/8 (RFC 1918 private)
  if (a === 10) return false
  // 100.64.0.0/10 (RFC 6598 carrier-grade NAT / cloud metadata)
  if (a === 100 && b >= 64 && b <= 127) return false
  // 127.0.0.0/8 (loopback)
  if (a === 127) return false
  // 169.254.0.0/16 (link-local & cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) return false
  // 172.16.0.0/12 (RFC 1918 private)
  if (a === 172 && b >= 16 && b <= 31) return false
  // 192.0.0.0/24 (IETF protocol assignments) & 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false
  // 192.88.99.0/24 (6to4 relay anycast)
  if (a === 192 && b === 88 && c === 99) return false
  // 192.168.0.0/16 (RFC 1918 private)
  if (a === 192 && b === 168) return false
  // 198.18.0.0/15 (benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return false
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return false
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return false
  // 224.0.0.0/4 (multicast) & 240.0.0.0/4 (reserved / broadcast)
  if (a >= 224) return false

  return true
}

export function parseIpv6Hextets(rawAddress: string): number[] | null {
  const unbracketed =
    rawAddress.startsWith("[") && rawAddress.endsWith("]")
      ? rawAddress.slice(1, -1)
      : rawAddress

  if (!unbracketed || unbracketed.includes("%")) {
    return null
  }

  let working = unbracketed.toLowerCase()
  let embeddedIpv4Hextets: [number, number] | null = null

  if (working.includes(".")) {
    const lastColon = working.lastIndexOf(":")
    if (lastColon === -1) return null
    const ipv4Part = working.slice(lastColon + 1)
    const octets = parseIpv4Octets(ipv4Part)
    if (!octets) return null
    embeddedIpv4Hextets = [
      (octets[0] << 8) | octets[1],
      (octets[2] << 8) | octets[3],
    ]
    working = working.slice(0, lastColon) + ":0:0"
  }

  const doubleColonParts = working.split("::")
  if (doubleColonParts.length > 2) return null

  const parseGroupList = (segment: string): number[] | null => {
    if (segment === "") return []
    const groups = segment.split(":")
    const out: number[] = []
    for (const group of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null
      out.push(Number.parseInt(group, 16))
    }
    return out
  }

  let hextets: number[]
  if (doubleColonParts.length === 2) {
    const left = parseGroupList(doubleColonParts[0]!)
    const right = parseGroupList(doubleColonParts[1]!)
    if (!left || !right) return null
    const missing = 8 - (left.length + right.length)
    if (missing < 1) return null
    hextets = [...left, ...new Array<number>(missing).fill(0), ...right]
  } else {
    const parsed = parseGroupList(working)
    if (!parsed || parsed.length !== 8) return null
    hextets = parsed
  }

  if (embeddedIpv4Hextets) {
    hextets[6] = embeddedIpv4Hextets[0]
    hextets[7] = embeddedIpv4Hextets[1]
  }

  return hextets
}

export function isPublicIpv6(rawAddress: string): boolean {
  const hextets = parseIpv6Hextets(rawAddress)
  if (!hextets || hextets.length !== 8) return false

  const h0 = hextets[0]!
  const h1 = hextets[1]!
  const h2 = hextets[2]!

  // Must be within IANA Global Unicast 2000::/3
  // (excludes ::/128, ::1/128, ::ffff:0:0/96 IPv4-mapped, fc00::/7 ULA, fe80::/10 link-local, ff00::/8 multicast)
  if ((h0 & 0xe000) !== 0x2000) {
    return false
  }

  // 2001:0000::/32 (Teredo), 2001:0db8::/32 (documentation),
  // 2001:0002:0000::/48 (benchmarking), 2001:0010::/28 & 2001:0020::/28 (ORCHID)
  if (h0 === 0x2001) {
    if (h1 === 0x0000 || h1 === 0x0db8) return false
    if (h1 === 0x0002 && h2 === 0x0000) return false
    if ((h1 & 0xfff0) === 0x0010 || (h1 & 0xfff0) === 0x0020) return false
  }

  // 2002::/16 (6to4 embeds an IPv4 address in h1:h2)
  if (h0 === 0x2002) {
    return false
  }

  // 64:ff9b::/96 & 64:ff9b:1::/48 NAT64 are already outside 2000::/3
  return true
}

export function isDisallowedHostname(rawHostname: string): boolean {
  const normalized = rawHostname.trim().toLowerCase().replace(/\.+$/, "")
  if (!normalized) return true

  if (normalized.startsWith("[") || normalized.includes(":")) {
    return true
  }

  if (DISALLOWED_EXACT_HOSTS.has(normalized)) {
    return true
  }

  if (normalized.startsWith("metadata.")) {
    return true
  }

  for (const suffix of DISALLOWED_HOST_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      return true
    }
  }

  const ipv4Octets = parseIpv4Octets(normalized)
  if (ipv4Octets) {
    return !isPublicIpv4(ipv4Octets)
  }

  // Reject single-label hostnames (no dot)
  const labels = normalized.split(".")
  if (labels.length < 2 || labels.some((label) => label.length === 0)) {
    return true
  }

  // Reject pseudo-IP encodings (bare integers, hex 0x..., octal 0177..., short IPv4 127.1):
  // valid DNS top-level domains never start with a digit (IDN punycode starts with "xn--").
  const tld = labels[labels.length - 1]!
  if (/^\d/.test(tld)) {
    return true
  }

  return false
}

export const INVALID_PROJECT_BASE_URL_ERROR =
  "Invalid project_base_url: must be an https:// URL pointing to a public host"

export function validateProjectBaseUrl(
  rawInput: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = rawInput.trim()
  if (!trimmed) {
    return { ok: false, error: INVALID_PROJECT_BASE_URL_ERROR }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: INVALID_PROJECT_BASE_URL_ERROR }
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: INVALID_PROJECT_BASE_URL_ERROR }
  }

  if (parsed.username !== "" || parsed.password !== "") {
    return { ok: false, error: INVALID_PROJECT_BASE_URL_ERROR }
  }

  if (isDisallowedHostname(parsed.hostname)) {
    return { ok: false, error: INVALID_PROJECT_BASE_URL_ERROR }
  }

  return { ok: true, url: trimmed }
}
