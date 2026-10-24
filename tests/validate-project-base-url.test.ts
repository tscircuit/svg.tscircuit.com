import { expect, test } from "bun:test"
import { isPublicHttpsProjectBaseUrl } from "../lib/validateProjectBaseUrl"

test("rejects non-https schemes and unparseable URLs", () => {
  expect(isPublicHttpsProjectBaseUrl("")).toBe(false)
  expect(isPublicHttpsProjectBaseUrl("not a url")).toBe(false)
  expect(isPublicHttpsProjectBaseUrl("http://assets.example.com/store")).toBe(
    false,
  )
  expect(isPublicHttpsProjectBaseUrl("ftp://assets.example.com/store")).toBe(
    false,
  )
})

test("rejects loopback, private, link-local and metadata targets", () => {
  for (const bad of [
    "https://127.0.0.1/x",
    "https://10.0.0.5/x",
    "https://172.16.0.9/x",
    "https://172.31.255.1/x",
    "https://192.168.0.1/x",
    "https://169.254.169.254/latest/meta-data",
    "https://100.100.100.100/x", // CGNAT block
    "https://0.0.0.0/x",
    "https://198.18.0.1/x",
    "https://224.0.0.1/x",
    "https://240.0.0.1/x",
    // IPv6 literals rejected wholesale:
    "https://[::1]/x",
    "https://[fe80::1]/x",
    "https://[::ffff:127.0.0.1]/x",
    // pseudo-IP encodings:
    "https://2130706433/x",
    "https://0x7f.0x0.0x0.0x1/x",
    // hostname forms resolving inside the host:
    "https://localhost/x",
    "https://something.localhost/x",
    "https://worker.internal/x",
    "https://mymac.local/x",
    "https://svc/x",
    "https://metadata.google.internal/computeMetadata/v1/",
    "https://metadata.example.internal/x",
  ]) {
    expect(isPublicHttpsProjectBaseUrl(bad)).toBe(false)
  }
})

test("accepts public https targets", () => {
  for (const good of [
    "https://example.com/assets",
    "https://assets.example1.com/store",
    "https://a.b-c.example.co.uk/x/y",
    "https://62.109.19.74/assets", // a genuinely public IP literal is fine
  ]) {
    expect(isPublicHttpsProjectBaseUrl(good)).toBe(true)
  }
})
