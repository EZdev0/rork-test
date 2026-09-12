const fs = require('fs');
const path = require('path');

const mjsPath = path.join(__dirname, '..', 'node_modules', '@ai-sdk', 'provider-utils', 'dist', 'index.mjs');
const jsPath = path.join(__dirname, '..', 'node_modules', '@ai-sdk', 'provider-utils', 'dist', 'index.js');

function patchFile(file) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // Replace the problematic importNodeModule implementation
    content = content.replace(/function importNodeModule\(id\) \{\s*return import\(id\);\s*\}/g, 'function importNodeModule(id) { return Promise.reject(new Error("Dynamic import not supported in Metro")); }');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Patched', file);
  }
}

patchFile(mjsPath);
patchFile(jsPath);

// Patch expo metro-runtime error overlay
const logContextPath = path.join(__dirname, '..', 'node_modules', '@expo', 'metro-runtime', 'src', 'error-overlay', 'Data', 'LogContext.tsx');
if (fs.existsSync(logContextPath)) {
  let content = fs.readFileSync(logContextPath, 'utf8');
  content = content.replace(/logs: raw\.logs\.map/g, 'logs: (raw.logs || []).map');
  fs.writeFileSync(logContextPath, content, 'utf8');
  console.log('Patched', logContextPath);
}

// Patch toolkit-sdk agent.js to allow fetch and api overrides
const sdkAgentPaths = [
  path.join(__dirname, '..', 'node_modules', '@rork-ai', 'toolkit-sdk', 'lib', 'module', 'agent.js'),
  path.join(__dirname, '..', 'node_modules', '@rork-ai', 'toolkit-sdk', 'lib', 'commonjs', 'agent.js')
];

for (const p of sdkAgentPaths) {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(
      /transport: new (?:_ai\.)?DefaultChatTransport\(\{[\s\S]*?fetch: expoFetch,[\s\S]*?api: AGENT_URL,/g,
      'transport: options.transport || new DefaultChatTransport({ fetch: options.fetch || expoFetch, api: options.api || AGENT_URL,'
    );
    // Also patch for commonjs which might not have _ai. or expoFetch
    content = content.replace(
      /transport: new (?:_ai\.)?DefaultChatTransport\(\{\s*fetch: (?:_fetch\.)?fetch,\s*api: AGENT_URL,/g,
      'transport: options.transport || new DefaultChatTransport({ fetch: options.fetch || expoFetch, api: options.api || AGENT_URL,'
    );
    
    // More generic replace just in case
    content = content.replace(
      /transport: new (.*?)\.DefaultChatTransport\(\{([\s\S]*?)fetch: (.*?),([\s\S]*?)api: (.*?),/g,
      'transport: options.transport || new $1.DefaultChatTransport({$2fetch: options.fetch || $3,$4api: options.api || $5,'
    );

    fs.writeFileSync(p, content, 'utf8');
    console.log('Patched', p);
  }
}
