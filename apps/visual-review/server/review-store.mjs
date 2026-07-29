import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const decisions = new Set(['APPROVED', 'APPROVED_WITH_NOTES', 'REJECTED']);
const roles = new Set(['QA', 'PRODUCT_OWNER']);

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJsonAtomic(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
}

export function createPortalData({ index, approvals, manifest, version, build, readOnly }) {
  const reviewByKey = new Map(approvals.reviews.map((review) => [review.key, review]));
  return {
    version,
    build,
    baseline: manifest.baselines.length ? manifest.baselineVersion : null,
    readOnly,
    captures: index.captures.map((capture) => ({
      ...capture,
      version: approvals.baselineVersion,
      candidateUrl: `/media/candidate/${encodeURIComponent(capture.device)}/${encodeURIComponent(capture.screen)}.png`,
      mockupUrl: `/media/mockup/${encodeURIComponent(capture.screen)}.png`,
      review: reviewByKey.get(capture.key),
    })),
  };
}

export function applyReview(approvals, payload, now = new Date().toISOString()) {
  const { key, decision, comment = '', reviewer } = payload ?? {};
  if (!key || !decisions.has(decision)) throw new Error('Decisão visual inválida.');
  if (!reviewer?.name?.trim() || !roles.has(reviewer.role)) throw new Error('Identidade do revisor inválida.');
  if (decision !== 'APPROVED' && !comment.trim()) {
    throw new Error('Comentário obrigatório para rejeição ou aprovação com notas.');
  }
  const review = approvals.reviews.find((item) => item.key === key);
  if (!review) throw new Error('Captura não encontrada.');
  const identity = { name: reviewer.name.trim(), role: reviewer.role, at: now };

  if (reviewer.role === 'QA') {
    if (decision === 'APPROVED_WITH_NOTES') throw new Error('APPROVED_WITH_NOTES é uma decisão do Product Owner.');
    review.qa = decision === 'APPROVED' ? identity : null;
    review.productOwner = null;
    review.status = decision === 'REJECTED' ? 'REJECTED' : 'PENDING';
    approvals.reviewers.qa ??= identity.name;
    if (approvals.reviewers.qa !== identity.name) throw new Error('O ciclo já possui outro QA responsável.');
  } else {
    if (!review.qa) throw new Error('A aprovação do QA deve ocorrer primeiro.');
    review.productOwner = identity;
    review.status = decision;
    approvals.reviewers.productOwner ??= identity.name;
    if (approvals.reviewers.productOwner !== identity.name) {
      throw new Error('O ciclo já possui outro Product Owner responsável.');
    }
  }

  if (comment.trim()) {
    review.comments ??= [];
    review.comments.push({
      id: randomUUID(),
      author: identity.name,
      role: identity.role,
      message: comment.trim(),
      createdAt: now,
    });
  }
  review.comment = comment.trim();
  review.reviewedAt = now;
  approvals.updatedAt = now;
  return approvals;
}

export function assertPromotionAllowed(approvals, reviewer) {
  if (reviewer?.role !== 'PRODUCT_OWNER' || !reviewer.name?.trim()) {
    throw new Error('Somente o Product Owner pode promover a baseline.');
  }
  if (approvals.reviewers.productOwner !== reviewer.name.trim()) {
    throw new Error('O Product Owner informado não corresponde ao ciclo de aprovação.');
  }
  if (!approvals.reviews.length || approvals.reviews.some((review) =>
    review.status !== 'APPROVED' || !review.qa || !review.productOwner)) {
    throw new Error('A promoção exige todas as capturas em APPROVED, com QA e Product Owner.');
  }
}

export function ensureApprovalSchema(path) {
  if (!existsSync(path)) throw new Error('Arquivo approvals.json ausente.');
  const approvals = readJson(path);
  for (const review of approvals.reviews) review.comments ??= [];
  return approvals;
}
