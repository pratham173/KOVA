import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  assertTestModeRazorpayKey,
  evaluatePaymentTransition,
  hashPassword,
  signRazorpayPayload,
  verifyPassword,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
} from './paymentCrypto';

test('assertTestModeRazorpayKey allows rzp_test_ and rejects rzp_live_', () => {
  assert.equal(assertTestModeRazorpayKey('rzp_test_1234567890').valid, true);
  assert.equal(assertTestModeRazorpayKey('rzp_live_1234567890').valid, false);
  assert.equal(assertTestModeRazorpayKey('').valid, false);
  assert.equal(assertTestModeRazorpayKey('pk_test_123').valid, false);
});

test('verifyRazorpaySignature accepts valid HMAC-SHA256 and rejects tampered signatures', () => {
  const secret = 'test_secret_xyz';
  const orderId = 'order_Test123';
  const paymentId = 'pay_Test456';
  const sig = signRazorpayPayload(orderId, paymentId, secret);

  assert.equal(verifyRazorpaySignature(orderId, paymentId, sig, secret), true);
  assert.equal(verifyRazorpaySignature(orderId, paymentId, sig.slice(0, -1) + '0', secret), false);
  assert.equal(verifyRazorpaySignature(orderId, 'pay_Tampered', sig, secret), false);
  assert.equal(verifyRazorpaySignature(orderId, paymentId, 'short', secret), false);
});

test('verifyRazorpayWebhookSignature verifies webhook payloads safely', () => {
  const payload = JSON.stringify({ event: 'payment.captured', payload: {} });
  const secret = 'whsec_test_123';
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  assert.equal(verifyRazorpayWebhookSignature(payload, sig, secret), true);
  assert.equal(verifyRazorpayWebhookSignature(payload + ' ', sig, secret), false);
});

test('hashPassword and verifyPassword use scrypt with per-password random salt', () => {
  const hashA = hashPassword('StrongPass123!');
  const hashB = hashPassword('StrongPass123!');
  assert.notEqual(hashA, hashB);
  assert.equal(verifyPassword('StrongPass123!', hashA), true);
  assert.equal(verifyPassword('WrongPass123!', hashA), false);
  assert.equal(verifyPassword('StrongPass123!', null), false);
});

test('evaluatePaymentTransition prevents duplicate orders and blocks unverified confirmations', () => {
  assert.deepEqual(
    evaluatePaymentTransition('succeeded', true, { type: 'gateway_captured' }),
    { action: 'duplicate_already_confirmed' }
  );

  assert.equal(
    evaluatePaymentTransition('created', false, { type: 'signature_invalid' }).action,
    'mark_uncertain'
  );
  assert.equal(
    evaluatePaymentTransition('created', false, { type: 'gateway_pending' }).action,
    'mark_pending'
  );
  assert.equal(
    evaluatePaymentTransition('pending', false, { type: 'gateway_captured' }).action,
    'confirm_order'
  );
  assert.equal(
    evaluatePaymentTransition('created', false, { type: 'customer_cancelled' }).action,
    'mark_cancelled'
  );
  assert.equal(
    evaluatePaymentTransition('created', false, { type: 'gateway_failed', reason: 'Insufficient funds' }).action,
    'mark_failed'
  );
});
