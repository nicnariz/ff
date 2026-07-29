import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  applyReview,
  assertPromotionAllowed,
  createPortalData,
  ensureApprovalSchema,
  readJson,
  writeJsonAtomic,
} from './review-store.mjs';

const appRoot = resolve(import.meta.dirname, '..');
const root = resolve(appRoot, '../..');
const distRoot = resolve(appRoot, 'dist');
const reviewRoot = resolve(root, 'docs/release/visual-review');
const indexPath = resolve(reviewRoot, 'CAPTURE_INDEX.json');
const approvalsPath = resolve(reviewRoot, 'approvals.json');
const manifestPath = resolve(root, 'docs/qa/visual/visual-baselines.json');
const screenshotRoot = resolve(root, 'docs/qa/visual/screenshots');
const mockupRoot = resolve(root, 'docs/prototype-book/v1.0/thumbnails');
const exportRoot = resolve(reviewRoot, 'exports');
const port = Number(process.env.VISUAL_REVIEW_PORT ?? 4174);
const token = process.env.VISUAL_REVIEW_TOKEN ?? '';
const version = process.env.VISUAL_REVIEW_VERSION ?? 'RC1.1A';
const build = process.env.VISUAL_REVIEW_BUILD ?? 'local';

mkdirSync(exportRoot, { recursive: true });

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function send(response, status, body, type = 'application/json; charset=utf-8', headers = {}) {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
  response.end(body);
}

function json(response, status, body) {
  send(response, status, JSON.stringify(body));
}

function authorized(request) {
  return Boolean(token) && request.headers.authorization === `Bearer ${token}`;
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function portalData() {
  return createPortalData({
    index: readJson(indexPath),
    approvals: ensureApprovalSchema(approvalsPath),
    manifest: readJson(manifestPath),
    version,
    build,
    readOnly: !token,
  });
}

function safeFile(response, base, segments) {
  const path = resolve(base, ...segments);
  if (path !== base && !path.startsWith(`${base}${sep}`)) return json(response, 403, { message: 'Caminho inválido.' });
  try {
    if (!statSync(path).isFile()) throw new Error();
    send(response, 200, readFileSync(path), mime[extname(path)] ?? 'application/octet-stream', {
      'Cache-Control': 'public, max-age=300',
    });
  } catch {
    json(response, 404, { message: 'Arquivo não encontrado.' });
  }
}

function reportRows(approvals) {
  return approvals.reviews.map((review) => ({
    key: review.key,
    status: review.status,
    qa: review.qa?.name ?? '',
    productOwner: review.productOwner?.name ?? '',
    comment: review.comment ?? '',
    reviewedAt: review.reviewedAt ?? '',
  }));
}

async function exportReport(format) {
  const approvals = ensureApprovalSchema(approvalsPath);
  const rows = reportRows(approvals);
  const summary = {
    total: rows.length,
    approved: rows.filter(({ status }) => status === 'APPROVED').length,
    approvedWithNotes: rows.filter(({ status }) => status === 'APPROVED_WITH_NOTES').length,
    rejected: rows.filter(({ status }) => status === 'REJECTED').length,
    pending: rows.filter(({ status }) => status === 'PENDING').length,
  };
  const payload = { exportedAt: new Date().toISOString(), baselineVersion: approvals.baselineVersion, summary, rows };
  if (format === 'json') return { bytes: Buffer.from(`${JSON.stringify(payload, null, 2)}\n`), type: mime['.json'] };
  const markdown = [
    '# Visual Review Report', '', `Versão: ${approvals.baselineVersion}`, '',
    `Aprovadas: ${summary.approved} | Com notas: ${summary.approvedWithNotes} | Rejeitadas: ${summary.rejected} | Pendentes: ${summary.pending}`, '',
    '| Captura | Status | QA | Product Owner | Comentário |', '| --- | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.key} | ${row.status} | ${row.qa} | ${row.productOwner} | ${row.comment.replaceAll('|', '\\|')} |`),
    '',
  ].join('\n');
  if (format === 'md') return { bytes: Buffer.from(markdown), type: 'text/markdown; charset=utf-8' };
  if (format === 'html') {
    const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Visual Review Report</title>
    <style>body{font:14px Arial;margin:32px;color:#1e2a3a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd3dc;padding:7px;text-align:left}</style>
    <h1>Visual Review Report</h1><p>${summary.approved} aprovadas · ${summary.approvedWithNotes} com notas · ${summary.rejected} rejeitadas · ${summary.pending} pendentes</p>
    <table><thead><tr><th>Captura</th><th>Status</th><th>QA</th><th>Product Owner</th><th>Comentário</th></tr></thead><tbody>
    ${rows.map((row) => `<tr><td>${row.key}</td><td>${row.status}</td><td>${row.qa}</td><td>${row.productOwner}</td><td>${row.comment}</td></tr>`).join('')}
    </tbody></table></html>`;
    return { bytes: Buffer.from(html), type: mime['.html'] };
  }
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([842, 595]);
  let y = 560;
  page.drawText('Familia Feliz - Visual Review Report', { x: 34, y, size: 16, font, color: rgb(.12, .16, .23) });
  y -= 24;
  page.drawText(`Approved ${summary.approved} | With notes ${summary.approvedWithNotes} | Rejected ${summary.rejected} | Pending ${summary.pending}`, { x: 34, y, size: 9, font });
  for (const row of rows) {
    y -= 15;
    if (y < 28) { page = pdf.addPage([842, 595]); y = 560; }
    page.drawText(`${row.key} | ${row.status} | QA: ${row.qa || '-'} | PO: ${row.productOwner || '-'}`.slice(0, 135), { x: 34, y, size: 8, font });
  }
  return { bytes: Buffer.from(await pdf.save()), type: 'application/pdf' };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  try {
    if (request.method === 'GET' && url.pathname === '/api/portal') return json(response, 200, portalData());
    if (request.method === 'POST' && url.pathname === '/api/reviews') {
      if (!authorized(request)) return json(response, 401, { message: 'Token de revisão inválido ou ausente.' });
      const approvals = ensureApprovalSchema(approvalsPath);
      applyReview(approvals, await body(request));
      writeJsonAtomic(approvalsPath, approvals);
      return json(response, 200, portalData());
    }
    if (request.method === 'POST' && url.pathname === '/api/promote') {
      if (!authorized(request)) return json(response, 401, { message: 'Token de revisão inválido ou ausente.' });
      const payload = await body(request);
      const approvals = ensureApprovalSchema(approvalsPath);
      assertPromotionAllowed(approvals, payload.reviewer);
      execFileSync(process.execPath, [resolve(root, 'scripts/visual-pipeline.mjs'), 'promote'], {
        cwd: root,
        env: {
          ...process.env,
          VISUAL_BASELINE_VERSION: approvals.baselineVersion,
          VISUAL_QA_APPROVER: approvals.reviewers.qa,
          VISUAL_PRODUCT_OWNER: approvals.reviewers.productOwner,
        },
        stdio: 'pipe',
      });
      return json(response, 200, { message: `Baseline ${approvals.baselineVersion} promovida com sucesso.` });
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/export/')) {
      const format = url.pathname.split('/').at(-1);
      if (!['pdf', 'html', 'json', 'md'].includes(format)) return json(response, 404, { message: 'Formato inválido.' });
      const report = await exportReport(format);
      const path = resolve(exportRoot, `visual-review-${version}.${format}`);
      writeFileSync(path, report.bytes);
      return send(response, 200, report.bytes, report.type, {
        'Content-Disposition': `attachment; filename="${relative(exportRoot, path)}"`,
      });
    }
    if (request.method === 'GET' && url.pathname.startsWith('/media/candidate/')) {
      const [, , , device, file] = url.pathname.split('/');
      return safeFile(response, screenshotRoot, [decodeURIComponent(device), decodeURIComponent(file)]);
    }
    if (request.method === 'GET' && url.pathname.startsWith('/media/mockup/')) {
      const slug = decodeURIComponent(url.pathname.split('/').at(-1).replace(/\.png$/, ''));
      const index = readJson(indexPath);
      const capture = index.captures.find(({ screen }) => screen === slug);
      if (!capture?.prototype) return json(response, 404, { message: 'Mockup não encontrado.' });
      return safeFile(response, root, [capture.prototype]);
    }
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const path = resolve(distRoot, requested);
    try {
      if (statSync(path).isFile()) return safeFile(response, distRoot, [requested]);
    } catch {}
    return safeFile(response, distRoot, ['index.html']);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Falha interna.';
    json(response, 422, { message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Visual Review Portal: http://127.0.0.1:${port}`);
  console.log(token ? 'Mutacoes protegidas por VISUAL_REVIEW_TOKEN.' : 'Modo somente leitura: defina VISUAL_REVIEW_TOKEN.');
});
