// Junta cada página HTML com o seu JavaScript compilado num único arquivo em dist/
import { readFileSync, writeFileSync } from 'node:fs';
const pages = [
  ['src/index.html', 'main.js', 'dist/soroban.html'],
  ['src/sessao.html', 'sessao.js', 'dist/sessao.html'],
];
for (const [src, js, out] of pages) {
  const html = readFileSync(src, 'utf8');
  const code = readFileSync('dist/' + js, 'utf8');
  writeFileSync(out, html.replace(`<script src="${js}"></script>`, () => `<script>\n${code}\n</script>`));
  console.log(out + ' pronto');
}
