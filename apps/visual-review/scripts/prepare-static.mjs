import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');
const root = resolve(appRoot, '../..');
const staticRoot = resolve(appRoot, 'static');
const index = JSON.parse(readFileSync(resolve(root, 'docs/release/visual-review/CAPTURE_INDEX.json'), 'utf8'));
const approvals = JSON.parse(readFileSync(resolve(root, 'docs/release/visual-review/approvals.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/qa/visual/visual-baselines.json'), 'utf8'));
const reviews = new Map(approvals.reviews.map((review) => [review.key, review]));

if (staticRoot !== resolve(root, 'apps/visual-review/static')) {
  throw new Error('Diretório estático inesperado; limpeza cancelada.');
}

rmSync(staticRoot, { recursive: true, force: true });
mkdirSync(resolve(staticRoot, 'data'), { recursive: true });
mkdirSync(resolve(staticRoot, 'captures'), { recursive: true });
mkdirSync(resolve(staticRoot, 'mockups'), { recursive: true });

const copiedMockups = new Set();
const captures = index.captures.map((capture) => {
  const candidateTarget = resolve(staticRoot, 'captures', capture.device, `${capture.screen}.png`);
  mkdirSync(resolve(staticRoot, 'captures', capture.device), { recursive: true });
  cpSync(resolve(root, capture.path), candidateTarget);

  if (!copiedMockups.has(capture.screen)) {
    cpSync(resolve(root, capture.prototype), resolve(staticRoot, 'mockups', `${capture.screen}.png`));
    copiedMockups.add(capture.screen);
  }

  return {
    ...capture,
    version: approvals.baselineVersion,
    candidateUrl: `captures/${encodeURIComponent(capture.device)}/${encodeURIComponent(capture.screen)}.png`,
    mockupUrl: `mockups/${encodeURIComponent(capture.screen)}.png`,
    review: reviews.get(capture.key),
  };
});

const portal = {
  version: process.env.VISUAL_REVIEW_VERSION ?? 'RC1.1C',
  build: process.env.GITHUB_SHA?.slice(0, 7) ?? 'local',
  baseline: manifest.baselines.length ? manifest.baselineVersion : null,
  readOnly: true,
  captures,
};

if (captures.length !== 168) throw new Error(`Esperadas 168 capturas; encontradas ${captures.length}.`);
if (captures.some((capture) => !capture.review)) throw new Error('Existem capturas sem registro de revisão.');

writeFileSync(resolve(staticRoot, 'data', 'portal.json'), `${JSON.stringify(portal, null, 2)}\n`);
writeFileSync(resolve(staticRoot, '.nojekyll'), '');
console.log(JSON.stringify({ captures: captures.length, mockups: copiedMockups.size, staticRoot }, null, 2));
