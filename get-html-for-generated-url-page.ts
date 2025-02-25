import {
  getCompressedBase64SnippetString,
  createSnippetUrl,
} from "@tscircuit/create-snippet-url"

export const getHtmlForGeneratedUrlPage = (
  code: string,
  urlPrefix = "https://svg.tscircuit.com",
) => {
  const snippetUrl = createSnippetUrl(code)
  const compressedCode = getCompressedBase64SnippetString(code)

  const pcbSvgUrl = `${urlPrefix}/?svg_type=pcb&code=${encodeURIComponent(compressedCode)}`
  const schSvgUrl = `${urlPrefix}/?svg_type=schematic&code=${encodeURIComponent(compressedCode)}`

  return `
  <!DOCTYPE html>
  <html>
    <body>
      <h1>svg.tscircuit.com</h1>
      <table>
        <tr>
          <th>Type</th>
          <th>URL</th>
        </tr>
        <tr>
          <td>Snippet URL</td>
          <td><a href="${snippetUrl}">${snippetUrl}</a></td>
        </tr>
        <tr>
          <td>PCB SVG URL</td>
          <td><a href="${pcbSvgUrl}">${pcbSvgUrl}</a></td>
        </tr>
        <tr>
          <td>Schematic SVG URL</td>
          <td><a href="${schSvgUrl}">${schSvgUrl}</a></td>
        </tr>
        <tr>
      </table>
    </body>
  </html>
  `
}
