# svg.tscircuit.com

A server that takes encoded tscircuit code or circuit JSON and renders it into SVG or PNG assets suitable for use in docs.

## API Overview

This service converts TSCircuit code or pre-generated circuit JSON into various visual formats (PCB, schematic, and 3D views) via HTTP requests. It's designed to be used for generating circuit diagrams, PCB layouts, and 3D visualizations for documentation and web applications.

## API Endpoints

### 1. SVG Generation (Main Endpoint)

**URL:** `GET /?svg_type={type}&code={encoded_code}` or `POST /?svg_type={type}` with circuit_json in body

**Parameters:**
- `svg_type` (required): The type of SVG to generate
  - `pcb` - PCB layout view
  - `schematic` - Circuit schematic view
  - `pinout` - Pinout diagram view
  - `3d` - 3D visualization view
- `format` (optional): Output format. Defaults to `svg`. Set `format=png` to receive a PNG rasterized version. PNG-specific query parameters:
  - `png_width` / `png_height`
  - `png_density`

**Input Methods:**
- `code` (GET/POST query parameter): Base64-encoded and compressed TSCircuit code
- `circuit_json` (POST body only): Raw circuit JSON object - pass as `{"circuit_json": {...}}`

Either `code` or `circuit_json` must be provided.

**Response:** SVG content with `image/svg+xml` content type (default) or PNG content with `image/png` when `format=png`

**Example Request with Code:**
```bash
curl "https://svg.tscircuit.com/?svg_type=pcb&code=eyJjb2RlIjoiZXhwb3J0IGRlZmF1bHQgKCkgPT4gKFxuICA8Ym9hcmQgd2lkdGg9IjEwbW0iIGhlaWdodD0iMTBtbSI+XG4gICAgPHJlc2lzdG9yXG4gICAgICByZXNpc3RhbmNlPSIxayJcbiAgICAgIGZvb3RwcmludD0iMDQwMiJcbiAgICAgIG5hbWU9IlIxIlxuICAgICAgc2NoWD17M31cbiAgICAgIHBjYlg9ezN9XG4gICAgLz5cbiAgICA8Y2FwYWNpdG9yXG4gICAgICBjYXBhY2l0YW5jZT0iMTAwMHBGIiBcbiAgICAgIGZvb3RwcmludD0iMDQwMiJcbiAgICAgIG5hbWU9IkMxIlxuICAgICAgc2NoWD17LTN9XG4gICAgICBwY2JYPSstM31cbiAgICAvPlxuICAgIDx0cmFjZSBmcm9tPSIuUjEgPiAucGluMSIgdG89Ii5DNSA+IC5waW4xIiAvPlxuICA8L2JvYXJkPlxuKSJ9"
```

**Example Request with Circuit JSON:**
```bash
curl "https://svg.tscircuit.com/?svg_type=pcb&circuit_json=BASE64_ENCODED_JSON"
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

**PNG Output:**
```bash
curl "https://svg.tscircuit.com/?svg_type=pcb&format=png&code=YOUR_ENCODED_CODE"
```

**Schematic View:**
```bash
curl "https://svg.tscircuit.com/?svg_type=schematic&code=YOUR_ENCODED_CODE"
```

**Pinout View:**
```bash
curl "https://svg.tscircuit.com/?svg_type=pinout&code=YOUR_ENCODED_CODE"
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

To use `circuit_json`, base64 encode the circuit JSON:

```typescript
const circuitJson = { /* ... */ }
const encodedJson = Buffer.from(JSON.stringify(circuitJson)).toString("base64")
const apiUrl = `https://svg.tscircuit.com/?svg_type=pcb&circuit_json=${encodeURIComponent(encodedJson)}`
```

## Response Headers

Successful responses include:
- `Content-Type: image/svg+xml` (SVG) or `image/png` (PNG)
- `Cache-Control: public, max-age=86400, s-maxage=31536000, immutable`

## Error Handling

When errors occur, the API returns an image with error information instead of the requested circuit asset. Error responses include:
- `Content-Type: image/svg+xml` (or `image/png` when `format=png`)
- `Cache-Control: public, max-age=86400, s-maxage=86400`

## Caching

The API implements aggressive caching for generated assets:
- Browser cache: 24 hours (`max-age=86400`)
- CDN cache: 1 year (`s-maxage=31536000`)
- Error responses: 24 hours

## Development

```bash
bun run start
```
