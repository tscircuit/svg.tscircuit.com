# svg.tscircuit.com

A server that takes encoded tscircuit code and renders it into an SVG suitable for use in docs.

## API Overview

This service converts TSCircuit code into various SVG formats (PCB, schematic, and 3D views) via HTTP requests. It's designed to be used for generating circuit diagrams, PCB layouts, and 3D visualizations for documentation and web applications.

## API Endpoints

### 1. SVG Generation (Main Endpoint)

**URL:** `GET /?svg_type={type}&code={encoded_code}`

**Parameters:**
- `svg_type` (required): The type of SVG to generate
  - `pcb` - PCB layout view
  - `schematic` - Circuit schematic view
  - `3d` - 3D visualization view
- `code` (required): Base64-encoded and compressed TSCircuit code

**Response:** SVG content with `image/svg+xml` content type

**Example Request:**
```bash
curl "https://svg.tscircuit.com/?svg_type=pcb&code=eyJjb2RlIjoiZXhwb3J0IGRlZmF1bHQgKCkgPT4gKFxuICA8Ym9hcmQgd2lkdGg9IjEwbW0iIGhlaWdodD0iMTBtbSI+XG4gICAgPHJlc2lzdG9yXG4gICAgICByZXNpc3RhbmNlPSIxayJcbiAgICAgIGZvb3RwcmludD0iMDQwMiJcbiAgICAgIG5hbWU9IlIxIlxuICAgICAgc2NoWD17M31cbiAgICAgIHBjYlg9ezN9XG4gICAgLz5cbiAgICA8Y2FwYWNpdG9yXG4gICAgICBjYXBhY2l0YW5jZT0iMTAwMHBGIiBcbiAgICAgIGZvb3RwcmludD0iMDQwMiJcbiAgICAgIG5hbWU9IkMxIlxuICAgICAgc2NoWD17LTN9XG4gICAgICBwY2JYPSstM31cbiAgICAvPlxuICAgIDx0cmFjZSBmcm9tPSIuUjEgPiAucGluMSIgdG89Ii5DNSA+IC5waW4xIiAvPlxuICA8L2JvYXJkPlxuKSJ9"
```

### 2. Health Check

**URL:** `GET /health`

**Response:** JSON with status
```json
{"ok": true}
```

### 3. URL Generation Page

**URL:** `GET /generate_url?code={encoded_code}`

**Response:** HTML page for generating shareable URLs

### 4. Index Page

**URL:** `GET /`

**Response:** HTML page with usage instructions

## Usage Examples

### TSCircuit Code

```typescript
export default () => (
  <board width="10mm" height="10mm">
    <resistor
      resistance="1k"
      footprint="0402"
      name="R1"
      schX={3}
      pcbX={3}
    />
    <capacitor
      capacitance="1000pF"
      footprint="0402"
      name="C1"
      schX={-3}
      pcbX={-3}
    />
    <trace from=".R1 > .pin1" to=".C1 > .pin1" />
  </board>
)
```

### API Calls

**PCB Layout:**
```bash
curl "https://svg.tscircuit.com/?svg_type=pcb&code=YOUR_ENCODED_CODE"
```

**Schematic View:**
```bash
curl "https://svg.tscircuit.com/?svg_type=schematic&code=YOUR_ENCODED_CODE"
```

**3D Visualization:**
```bash
curl "https://svg.tscircuit.com/?svg_type=3d&code=YOUR_ENCODED_CODE"
```

## Code Encoding

The `code` parameter must be a compressed and base64-encoded string. You can use the `@tscircuit/create-snippet-url` package to generate these:

```typescript
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

const tscircuitCode = `
export default () => (
  <board width="10mm" height="10mm">
    <led name="LED1" />
  </board>
)
`

const encodedCode = getCompressedBase64SnippetString(tscircuitCode)
const apiUrl = `https://svg.tscircuit.com/?svg_type=pcb&code=${encodeURIComponent(encodedCode)}`
```

## Response Headers

Successful SVG responses include:
- `Content-Type: image/svg+xml`
- `Cache-Control: public, max-age=86400, s-maxage=31536000, immutable`

## Error Handling

When errors occur, the API returns an SVG with error information instead of the requested circuit SVG. Error responses include:
- `Content-Type: image/svg+xml`
- `Cache-Control: public, max-age=86400, s-maxage=86400`

## Caching

The API implements aggressive caching for generated SVGs:
- Browser cache: 24 hours (`max-age=86400`)
- CDN cache: 1 year (`s-maxage=31536000`)
- Error responses: 24 hours

## Development

```bash
bun run start
```
