import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const dataPath = resolve(dist, 'data', 'portal.json');
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('index.html ausente.');
if (!existsSync(dataPath)) throw new Error('portal.json ausente.');

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
if (data.captures.length !== 168) throw new Error(`Esperadas 168 capturas; recebidas ${data.captures.length}.`);
if (!data.readOnly) throw new Error('A publicação deve permanecer em modo somente leitura.');

for (const capture of data.captures) {
  for (const relativePath of [capture.candidateUrl, capture.mockupUrl]) {
    const path = resolve(dist, relativePath);
    if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Asset ausente: ${relativePath}`);
  }
}

const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
if (!html.includes('/ff/')) throw new Error('Base path /ff/ ausente do build.');
console.log(JSON.stringify({ status: 'PASS', captures: 168, readOnly: true }, null, 2));
