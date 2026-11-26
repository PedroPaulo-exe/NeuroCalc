import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('src/index.html', 'utf8');
const js = readFileSync('dist/main.js', 'utf8');
const out = html.replace('<script src="main.js"></script>', () => `<script>\n${js}\n</script>`);
writeFileSync('dist/soroban.html', out);
console.log('dist/soroban.html pronto');
