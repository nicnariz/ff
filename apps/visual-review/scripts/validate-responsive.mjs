import { createServer } from 'node:http';
import { createReadStream, mkdirSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const appRoot = resolve(import.meta.dirname, '..');
const distRoot = resolve(appRoot, 'dist');
const evidenceRoot = resolve(appRoot, 'evidence');
mkdirSync(evidenceRoot, { recursive: true });
const mime = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
};

const server = createServer((request, response) => {
  let pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
  if (pathname === '/ff' || pathname === '/ff/') pathname = '/ff/index.html';
  if (!pathname.startsWith('/ff/')) {
    response.writeHead(404).end();
    return;
  }
  const file = resolve(distRoot, pathname.slice('/ff/'.length));
  if (file !== distRoot && !file.startsWith(`${distRoot}${sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (!statSync(file).isFile()) throw new Error();
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

const port = 4198;
await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
const browser = await chromium.launch({ headless: true });

try {
  for (const profile of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height } });
    await page.goto(`http://127.0.0.1:${port}/ff/`, { waitUntil: 'networkidle' });
    await page.getByText('Visual Review Portal', { exact: true }).waitFor();
    const cards = page.locator('.capture-card');
    if (await cards.count() !== 168) throw new Error(`${profile.name}: contagem de capturas inválida.`);
    await page.getByPlaceholder('Pesquisar por nome').fill('login');
    if (await cards.count() !== 6) throw new Error(`${profile.name}: filtro de busca inválido.`);
    await page.getByPlaceholder('Pesquisar por nome').fill('');
    const promotion = page.getByRole('button', { name: 'Promover baseline' });
    if (await promotion.isEnabled()) throw new Error(`${profile.name}: promoção não está bloqueada.`);
    await page.screenshot({ path: resolve(evidenceRoot, `${profile.name}.png`), fullPage: true });
    await page.close();
  }
  console.log(JSON.stringify({ status: 'PASS', desktop: true, mobile: true, captures: 168 }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
