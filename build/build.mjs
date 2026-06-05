import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const refHtmlPath = path.join(repoRoot, 'reference', 'super-calculator-v4 2.html');
const outDir = path.join(repoRoot, 'dist');
const outHtmlPath = path.join(outDir, 'super-calculator-v6.html');

const files = [
  'src/engine/accumulation.js',
  'src/engine/drawdown.js',
  'src/engine/pension.js',
  'src/engine/tax.js',
  'src/ui/App.js',
];

function read(p) {
  return fs.readFileSync(path.join(repoRoot, p), 'utf8');
}

function extractCssFromReference(html) {
  const m = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return m ? m[1].trim() : '';
}

function stripModuleSyntax(code) {
  // remove import lines
  code = code.replace(/^\s*import\s+.*?;\s*$/gm, '');
  // remove export keyword
  code = code.replace(/\bexport\s+/g, '');
  return code;
}

function bundle() {
  const chunks = files.map(f => stripModuleSyntax(read(f)));
  return chunks.join('\n\n');
}

// --- Build ---
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const refHtml = fs.existsSync(refHtmlPath) ? fs.readFileSync(refHtmlPath, 'utf8') : '';
const css = extractCssFromReference(refHtml);

// JS bundle
const js = bundle();

// Offline HTML
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Superannuation Calculator V6 (Offline)</title>
<style>
${css || "html,body{height:100%;margin:0;background:#0f1117;color:#e8eaf0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}"}
</style>
</head>
<body>
<div id="root"></div>
<script>
(function(){
  function showFatal(msg, err){
    console.error(msg, err || '');
    var root = document.getElementById('root');
    if (!root) return;
    root.innerHTML =
      '<div style="min-height:100vh;padding:32px;background:#0f1117;color:#f06c6c;font-family:monospace">' +
      '<h2 style="margin:0 0 12px 0">⚠️ Super Calculator V6 failed to load</h2>' +
      '<div style="color:#f0b96c;margin-bottom:10px">' + msg + '</div>' +
      '<div style="color:#7a8099">Open DevTools → Console for details.</div>' +
      '</div>';
  }

  try {
${js}
    if (typeof mountApp !== 'function') {
      showFatal('mountApp() not found. Build script did not bundle UI correctly.');
      return;
    }
    var el = document.getElementById('root');
    if (!el) {
      showFatal('#root element missing in HTML.');
      return;
    }
    mountApp(el);
  } catch (e) {
    showFatal('Unhandled exception during boot: ' + (e && e.message ? e.message : String(e)), e);
  }
})();
</script>
</body>
</html>
`;

fs.writeFileSync(outHtmlPath, html, 'utf8');
console.log('✅ Built:', outHtmlPath);
