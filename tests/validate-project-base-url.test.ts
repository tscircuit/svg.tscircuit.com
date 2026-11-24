import { expect, test } from "bun:test"
import {
  isPublicIpv4,
  isPublicIpv6,
  parseIpv4Octets,
  validateProjectBaseUrl,
} from "../lib/validateProjectBaseUrl"

test("accepts public https project_base_url values", () => {
  const allowed = [
    "https://raw.githubusercontent.com/tscircuit/core/main",
    "https://cdn.example.com/project-assets",
    "https://8.8.8.8/static",
    "https://1.1.1.1:8443/files",
  ]

  for (const url of allowed) {
    const result = validateProjectBaseUrl(url)
    expect(result).toEqual({ ok: true, url })
  }
})

test("rejects non-https schemes, credentials, and malformed URLs", () => {
  const denied = [
    "",
    "   ",
    "not-a-url",
    "http://raw.githubusercontent.com/tscircuit/core/main",
    "file:///etc/passwd",
    "ftp://example.com/assets",
    "data:text/plain;base64,SGVsbG8=",
    "https://user:pass@example.com/assets",
    "https://token@example.com/assets",
  ]

  for (const url of denied) {
    const result = validateProjectBaseUrl(url)
    expect(result.ok).toBe(false)
  }
})

test("rejects loopback, private, link-local, metadata, CGNAT, and reserved IP/host forms", () => {
  const denied = [
    "https://localhost/assets",
    "https://localhost./assets",
    "https://api.localhost/assets",
    "https://127.0.0.1:8080/assets",
    "https://127.0.0.1./assets",
    "https://0.0.0.0/assets",
    "https://10.0.0.5/assets",
    "https://172.16.0.1/assets",
    "https://172.31.255.254/assets",
    "https://192.168.1.10/assets",
    "https://169.254.169.254/latest/meta-data",
    "https://100.64.0.1/assets",
    "https://100.100.100.200/latest/meta-data",
    "https://192.0.2.1/assets",
    "https://198.18.0.1/assets",
    "https://198.51.100.1/assets",
    "https://203.0.113.1/assets",
    "https://224.0.0.1/assets",
    "https://255.255.255.255/assets",
    "https://[::1]/assets",
    "https://[fe80::1]/assets",
    "https://[2606:4700:4700::1111]/assets",
    "https://2130706433/assets",
    "https://0x7f000001/assets",
    "https://0177.0.0.1/assets",
    "https://127.1/assets",
    "https://metadata/computeMetadata/v1",
    "https://metadata.google.internal/computeMetadata/v1",
    "https://host.docker.internal:8080",
    "https://printer.local/assets",
    "https://router.lan/assets",
    "https://nas.home/assets",
    "https://10.in-addr.arpa/assets",
    "https://intranet-box/assets",
  ]

  for (const url of denied) {
    const result = validateProjectBaseUrl(url)
    expect(result.ok).toBe(false)
  }
})

test("validates IPv4 and IPv6 public address boundaries accurately", () => {
  expect(isPublicIpv4(parseIpv4Octets("172.15.255.255")!)).toBe(true)
  expect(isPublicIpv4(parseIpv4Octets("172.16.0.0")!)).toBe(false)
  expect(isPublicIpv4(parseIpv4Octets("172.31.255.255")!)).toBe(false)
  expect(isPublicIpv4(parseIpv4Octets("172.32.0.0")!)).toBe(true)

  expect(isPublicIpv4(parseIpv4Octets("100.63.255.255")!)).toBe(true)
  expect(isPublicIpv4(parseIpv4Octets("100.64.0.0")!)).toBe(false)
  expect(isPublicIpv4(parseIpv4Octets("100.127.255.255")!)).toBe(false)
  expect(isPublicIpv4(parseIpv4Octets("100.128.0.0")!)).toBe(true)

  expect(isPublicIpv6("2606:4700:4700::1111")).toBe(true)
  expect(isPublicIpv6("2001:4860:4860::8888")).toBe(true)
  expect(isPublicIpv6("::1")).toBe(false)
  expect(isPublicIpv6("::ffff:127.0.0.1")).toBe(false)
  expect(isPublicIpv6("::ffff:8.8.8.8")).toBe(false)
  expect(isPublicIpv6("fe80::1")).toBe(false)
  expect(isPublicIpv6("fc00::1")).toBe(false)
  expect(isPublicIpv6("fd12:3456:789a::1")).toBe(false)
  expect(isPublicIpv6("2001:db8::1")).toBe(false)
  expect(isPublicIpv6("2001::1")).toBe(false)
  expect(isPublicIpv6("2002:7f00:1::1")).toBe(false)
})
