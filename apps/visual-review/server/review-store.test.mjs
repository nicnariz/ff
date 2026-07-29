import assert from 'node:assert/strict';
import test from 'node:test';
import { applyReview, assertPromotionAllowed } from './review-store.mjs';

function approvals() {
  return {
    reviewers: { qa: null, productOwner: null },
    reviews: [{
      key: 'device/home',
      captureHash: 'abc',
      status: 'PENDING',
      comment: '',
      comments: [],
      qa: null,
      productOwner: null,
      reviewedAt: null,
    }],
  };
}

test('exige QA antes do Product Owner', () => {
  assert.throws(() => applyReview(approvals(), {
    key: 'device/home',
    decision: 'APPROVED',
    reviewer: { name: 'PO', role: 'PRODUCT_OWNER' },
  }), /QA deve ocorrer primeiro/);
});

test('registra aprovação sequencial e comentário', () => {
  const state = approvals();
  applyReview(state, {
    key: 'device/home',
    decision: 'APPROVED',
    reviewer: { name: 'QA', role: 'QA' },
  }, '2026-07-29T12:00:00.000Z');
  applyReview(state, {
    key: 'device/home',
    decision: 'APPROVED',
    comment: 'Conforme.',
    reviewer: { name: 'PO', role: 'PRODUCT_OWNER' },
  }, '2026-07-29T12:01:00.000Z');
  assert.equal(state.reviews[0].status, 'APPROVED');
  assert.equal(state.reviews[0].comments.length, 1);
  assert.doesNotThrow(() => assertPromotionAllowed(state, { name: 'PO', role: 'PRODUCT_OWNER' }));
});

test('aprovação com notas não permite promoção', () => {
  const state = approvals();
  applyReview(state, {
    key: 'device/home',
    decision: 'APPROVED',
    reviewer: { name: 'QA', role: 'QA' },
  });
  applyReview(state, {
    key: 'device/home',
    decision: 'APPROVED_WITH_NOTES',
    comment: 'Ajustar padding na próxima versão.',
    reviewer: { name: 'PO', role: 'PRODUCT_OWNER' },
  });
  assert.throws(
    () => assertPromotionAllowed(state, { name: 'PO', role: 'PRODUCT_OWNER' }),
    /todas as capturas em APPROVED/,
  );
});

test('rejeição exige comentário', () => {
  assert.throws(() => applyReview(approvals(), {
    key: 'device/home',
    decision: 'REJECTED',
    reviewer: { name: 'QA', role: 'QA' },
  }), /Comentário obrigatório/);
});
