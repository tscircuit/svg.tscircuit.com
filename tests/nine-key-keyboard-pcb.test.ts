import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

test(
  "import package component without board wrapper",
  async () => {
    if (process.env.CI) {
      return
    }

    const { serverUrl } = await getTestServer()

    const response = await fetch(
      `${serverUrl}?view=pcb&code=${encodeURIComponent(
        getCompressedBase64SnippetString(`
import NineKeyKeyboard from "@tsci/seveibar.nine-key-keyboard"

export default () => (
    <NineKeyKeyboard />
)
    `),
      )}`,
    )
    const svgContent = await response.text()

    expect(svgContent).toMatchSvgSnapshot(import.meta.path)
  },
  {
    timeout: 25000,
  },
)
