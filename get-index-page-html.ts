export const getIndexPageHtml = () => {
  return `
  <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>svg.tscircuit.com</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
      font-family: system-ui, -apple-system, sans-serif;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 { margin-bottom: 0.5rem; }
    .info { color: #666; font-size: 0.9rem; }
    .info a { color: #0066cc; }
    .container {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .files { display: flex; flex-direction: column; gap: 1rem; }
    .file {
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 1rem;
      background: #fafafa;
    }
    .file-header {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .file-input {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: monospace;
    }
    .file-content {
      width: 100%;
      min-height: 150px;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
      resize: vertical;
    }
    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #0066cc;
      color: white;
    }
    .btn-primary:hover { background: #0052a3; }
    .btn-add {
      background: #10b981;
      color: white;
    }
    .btn-add:hover { background: #059669; }
    .btn-remove {
      background: #ef4444;
      color: white;
      padding: 0.5rem 0.75rem;
    }
    .btn-remove:hover { background: #dc2626; }
    .actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }
    @media (max-width: 768px) {
      body { padding: 0.5rem; }
      .header, .container { padding: 1rem; }
      .file { padding: 0.75rem; }
      .btn { padding: 0.4rem 0.8rem; font-size: 0.85rem; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>svg.tscircuit.com</h1>
    <p class="info">Turn your tscircuit code into SVGs automatically. See <a href="https://github.com/tscircuit/create-snippet-url">create-snippet-url</a> for programmatic usage.</p>
  </div>
  <div class="container">
    <div id="files" class="files"></div>
    <div class="actions">
      <button class="btn btn-add" onclick="addFile()">+ Add File</button>
      <button class="btn btn-primary" onclick="generate()">Generate URLs</button>
    </div>
  </div>
  <script type="module">
    import { gzipSync, strToU8 } from 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js';
    
    const bytesToBase64 = (bytes) => {
      const binString = String.fromCodePoint(...bytes);
      return btoa(binString);
    };
    
    const encodeFsMapToHash = (fsMap) => {
      const text = JSON.stringify(fsMap);
      const compressedData = gzipSync(strToU8(text));
      return bytesToBase64(compressedData);
    };
    
    let fileCount = 0;
    const filesEl = document.getElementById('files');
    
    window.addFile = (filename = '', content = '') => {
      const id = fileCount++;
      const div = document.createElement('div');
      div.className = 'file';
      div.id = \`file-\${id}\`;
      div.innerHTML = \`
        <div class="file-header">
          <input type="text" class="file-input" placeholder="index.tsx" value="\${filename}" data-id="\${id}">
          <button class="btn btn-remove" onclick="removeFile(\${id})">×</button>
        </div>
        <textarea class="file-content" placeholder="export default () => <board>...</board>" data-id="\${id}">\${content}</textarea>
      \`;
      filesEl.appendChild(div);
    };
    
    window.removeFile = (id) => {
      document.getElementById(\`file-\${id}\`)?.remove();
    };
    
    const collectFiles = () => {
      const fsMap = {};
      const filenames = document.querySelectorAll('.file-input');
      const contents = document.querySelectorAll('.file-content');
      
      filenames.forEach((input, i) => {
        const filename = input.value.trim() || \`file\${i}.tsx\`;
        fsMap[filename] = contents[i].value;
      });
      
      return { fsMap, entrypoint: filenames[0]?.value.trim() || 'index.tsx' };
    };
    
    window.generate = async () => {
      const { fsMap, entrypoint } = collectFiles();
      try {
        const res = await fetch('/generate_urls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fsMap, entrypoint })
        });
        
        if (res.ok && res.headers.get('content-type')?.includes('text/html')) {
          const html = await res.text();
          document.write(html)
        } else {
          const data = await res.json();
          alert('Error: ' + (data.error || 'Unknown error'));
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
    };
    
    window.addFile('index.tsx', \`export default () => (
  <board width="10mm" height="10mm">
    <resistor
      resistance="1k"
      footprint="0402"
      name="R1"
    />
  </board>
)\`);
  </script>
</body>
</html>
  `
}
