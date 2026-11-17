// Build: node build.js [--dev]   → index.html (single self-contained file)
// Dev-time only. The output has zero dependencies.
const fs = require('fs'), path = require('path');
const dev = process.argv.includes('--dev');
const rd = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

function glsl(s) {
  s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  let out = '';
  for (let l of s.split('\n')) {
    l = l.trim().replace(/\s+/g, ' ');
    if (!l) continue;
    if (l[0] == '#') { out += (out && !out.endsWith('\n') ? '\n' : '') + l + '\n'; continue; }
    l = l.replace(/ ?([^\w.]) ?/g, (m, c, i, str) => {
      // keep a space between "+ +" / "- -" so we never create ++ or --
      const a = str[i] == ' ' ? str[i - 1] : '', b = m.endsWith(' ') ? str[i + m.length] : '';
      return (a == c && (c == '+' || c == '-') ? ' ' : '') + c + (b == c && (c == '+' || c == '-') ? ' ' : '');
    });
    // a newline between two identifier chars must stay a separator
    out += (out && /\w$/.test(out) && /^\w/.test(l) ? ' ' : '') + l;
  }
  return out;
}

(async () => {
  let js = ['geo.js', 'atmo.js', 'life.js', 'ctrl.js', 'main.js'].map(rd).join('\n');
  js = js.replace(/\/\*glsl\*\/`([^`]*)`/g, (m, g) => {
    if (g.includes('${')) throw new Error('interpolation in glsl literal');
    return '`' + glsl(g) + '`';
  });
  if (!dev) {
    const r = await require('terser').minify(js, {
      ecma: 2020, toplevel: true,
      compress: { passes: 3, unsafe: true, unsafe_math: true, unsafe_arrows: true, booleans_as_integers: true, ecma: 2020 },
      mangle: { toplevel: true }, format: { ecma: 2020, comments: false },
    });
    js = r.code;
  }
  let ui = rd('ui.html').replace(/<!--[\s\S]*?-->/g, '');
  ui = ui.replace(/<style>([\s\S]*?)<\/style>/g, (m, c) => '<style>' + c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
    .replace(/ ?([{};:,>]) ?/g, '$1').replace(/;}/g, '}').trim() + '</style>');
  ui = ui.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
  const html = '<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">' +
    '<title>Abyssal Labyrinth</title>' + ui + '<script>' + js + '</script>';
  fs.writeFileSync(path.join(__dirname, 'index.html'), html);
  console.log('index.html', Buffer.byteLength(html), 'bytes (js ' + Buffer.byteLength(js) + ', ui ' + Buffer.byteLength(ui) + ')');
})();
