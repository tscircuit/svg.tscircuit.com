import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { handleRequestWithOptions } from "../shared/handle-request"
import { explosionAssemblyCode } from "./fixtures/explosion-assembly"

test("TSX explosion stages render distinct PNG poses and matching GLB downloads", async () => {
  const code = getCompressedBase64SnippetString(explosionAssemblyCode)
  const source = new URL("http://localhost/?format=circuit_json")
  source.searchParams.set("code", code)
  const exported = await handleRequestWithOptions(new Request(source))
  expect(exported.status).toBe(200)
  const circuitJson = await exported.json()
  expect(
    circuitJson.filter(
      (r: { type: string }) => r.type === "cad_explosion_stage",
    ),
  ).toHaveLength(2)
  const encodedJson = getCompressedBase64SnippetString(
    JSON.stringify(circuitJson),
  )
  const images: Uint8Array[] = []
  for (const [name, stage, progress] of [
    ["assembled", undefined, undefined],
    ["cover-and-bolts", "case.lift-cover", 1],
    ["bolts-halfway", "case.remove-bolts", 0.5],
    ["bolts-removed", "case.remove-bolts", 1],
  ] as const) {
    const url = new URL(
      "http://localhost/?svg_type=3d&format=png&png_width=500&png_height=420&realistic=false&background_color=%23ffffff",
    )
    url.searchParams.set("circuit_json", encodedJson)
    if (stage) url.searchParams.set("explosion_stage", stage)
    if (progress !== undefined)
      url.searchParams.set("explosion_progress", String(progress))
    let imageGlb: Uint8Array | undefined
    const png = await handleRequestWithOptions(new Request(url), {
      onGlb: (glb) => {
        imageGlb = glb
      },
    })
    expect(png.status).toBe(200)
    const bytes = new Uint8Array(await png.arrayBuffer())
    expect(Array.from(bytes.slice(0, 8))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ])
    await expect(Buffer.from(bytes)).toMatchPngSnapshot(
      `${import.meta.path}-${name}`,
    )
    images.push(bytes)
    expect(png.headers.get("Access-Control-Allow-Origin")).toBe("*")
    if (name === "cover-and-bolts") {
      url.searchParams.set("format", "svg")
      let svgGlb: Uint8Array | undefined
      const svg = await handleRequestWithOptions(new Request(url), {
        onGlb: (glb) => {
          svgGlb = glb
        },
      })
      expect(svg.status).toBe(200)
      expect(svg.headers.get("Content-Type")).toContain("image/svg+xml")
      expect(await svg.text()).toContain("<svg")
      expect(Buffer.from(svgGlb!)).toEqual(Buffer.from(imageGlb!))
    }
    url.searchParams.set("format", "glb")
    const download = await handleRequestWithOptions(new Request(url))
    expect(download.status).toBe(200)
    expect(Buffer.from(await download.arrayBuffer())).toEqual(
      Buffer.from(imageGlb!),
    )
    url.searchParams.delete("circuit_json")
    const post = await handleRequestWithOptions(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ circuit_json: encodedJson }),
      }),
    )
    expect(post.status).toBe(200)
    expect(post.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(Buffer.from(await post.arrayBuffer())).toEqual(
      Buffer.from(imageGlb!),
    )
  }
  for (let i = 1; i < images.length; i++)
    expect(images[i]).not.toEqual(images[i - 1])
}, 60_000)
