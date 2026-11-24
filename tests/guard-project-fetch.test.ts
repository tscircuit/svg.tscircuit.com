import { expect, test } from "bun:test"
import { createPrivateAddressGuardedFetch } from "../lib/guardProjectFetch"

test("denies literal private/loopback/metadata/IPv6 addresses without issuing network requests", async () => {
  let networkCalls = 0
  const guardedFetch = createPrivateAddressGuardedFetch({
    fetchImpl: (async () => {
      networkCalls++
      return new Response("unexpected")
    }) as unknown as typeof fetch,
    lookupFn: async () => [{ address: "93.184.216.34", family: 4 }],
  })

  const blockedUrls = [
    "http://127.0.0.1:8080/probe",
    "https://169.254.169.254/latest/meta-data/",
    "https://10.0.0.1/secret",
    "https://100.64.0.1/internal",
    "https://[::1]:8080/probe",
    "https://[::ffff:127.0.0.1]/probe",
    "https://localhost:3000/probe",
    "https://metadata.google.internal/computeMetadata/v1/",
  ]

  for (const url of blockedUrls) {
    await expect(guardedFetch(url)).rejects.toThrow(/Blocked fetch/)
  }

  expect(networkCalls).toBe(0)
})

test("denies public hostnames that DNS-resolve to private IPv4 or IPv6 addresses (DNS rebinding)", async () => {
  let networkCalls = 0
  const guardedFetch = createPrivateAddressGuardedFetch({
    fetchImpl: (async () => {
      networkCalls++
      return new Response("unexpected")
    }) as unknown as typeof fetch,
    lookupFn: async (host) => {
      if (host === "rebind-v4.example.com") {
        return [
          { address: "93.184.216.34", family: 4 },
          { address: "169.254.169.254", family: 4 },
        ]
      }
      if (host === "rebind-v6.example.com") {
        return [{ address: "fd00::1", family: 6 }]
      }
      throw new Error("ENOTFOUND")
    },
  })

  await expect(
    guardedFetch("https://rebind-v4.example.com/probe.kicad_pcb"),
  ).rejects.toThrow(/Blocked fetch/)
  await expect(
    guardedFetch("https://rebind-v6.example.com/probe.kicad_pcb"),
  ).rejects.toThrow(/Blocked fetch/)
  await expect(
    guardedFetch("https://unresolvable.example.com/probe.kicad_pcb"),
  ).rejects.toThrow(/Blocked fetch/)

  expect(networkCalls).toBe(0)
})

test("blocks redirect hops from a public host to an internal address while allowing public assets and blob/relative URLs", async () => {
  const seenUrls: string[] = []
  const guardedFetch = createPrivateAddressGuardedFetch({
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      seenUrls.push(url)

      if (url === "https://public.example.com/redirect-to-metadata") {
        return new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        })
      }

      return new Response("ok-asset", { status: 200 })
    }) as unknown as typeof fetch,
    lookupFn: async () => [{ address: "93.184.216.34", family: 4 }],
  })

  await expect(
    guardedFetch("https://public.example.com/redirect-to-metadata"),
  ).rejects.toThrow(/Blocked fetch/)
  expect(seenUrls).toEqual(["https://public.example.com/redirect-to-metadata"])

  const publicRes = await guardedFetch("https://public.example.com/part.step")
  expect(await publicRes.text()).toBe("ok-asset")

  const relativeRes = await guardedFetch("/internal/proxy/asset")
  expect(await relativeRes.text()).toBe("ok-asset")

  const blobRes = await guardedFetch("blob:http://localhost/model-id")
  expect(await blobRes.text()).toBe("ok-asset")
})
