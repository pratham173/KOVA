import crypto from 'node:crypto';

export type PaymentAttemptStatus =
  | 'created'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'uncertain';

export type PaymentVerificationEvent =
  | { type: 'signature_invalid' }
  | { type: 'gateway_captured' }
  | { type: 'gateway_pending' }
  | { type: 'gateway_failed'; reason: string }
  | { type: 'customer_cancelled' };

export type PaymentTransitionResult =
  | { action: 'duplicate_already_confirmed' }
  | { action: 'confirm_order'; nextStatus: 'succeeded' }
  | { action: 'mark_pending'; nextStatus: 'pending' }
  | { action: 'mark_failed'; nextStatus: 'failed'; reason: string }
  | { action: 'mark_cancelled'; nextStatus: 'cancelled'; reason: string }
  | { action: 'mark_uncertain'; nextStatus: 'uncertain'; reason: string };

/**
 * Strictly enforces Razorpay Test Mode.
 * Live keys (rzp_live_*) are unconditionally rejected so live charges can never occur.
 */
export function assertTestModeRazorpayKey(keyId: string): {
  valid: boolean;
  reason?: string;
} {
  const trimmed = keyId.trim();
  if (!trimmed) {
    return { valid: false, reason: 'RAZORPAY_KEY_ID is empty' };
  }
  if (trimmed.startsWith('rzp_live_')) {
    return {
      valid: false,
      reason: 'Live Razorpay keys (rzp_live_*) are strictly disabled. Use a Test Mode key (rzp_test_*).',
    };
  }
  if (!trimmed.startsWith('rzp_test_')) {
    return {
      valid: false,
      reason: 'Invalid Razorpay Test Mode key prefix. Expected rzp_test_*.',
    };
  }
  return { valid: true };
}

export function signRazorpayPayload(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  secret: string
): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
}

export function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  providedSignature: string,
  secret: string
): boolean {
  if (!razorpayOrderId || !razorpayPaymentId || !providedSignature || !secret) {
    return false;
  }
  const expected = signRazorpayPayload(razorpayOrderId, razorpayPaymentId, secret);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(providedSignature.trim(), 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export function verifyRazorpayWebhookSignature(
  rawBody: string | Buffer,
  providedSignature: string,
  webhookSecret: string
): boolean {
  if (!providedSignature || !webhookSecret) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(providedSignature.trim(), 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null): boolean {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) {
    return false;
  }
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expected);
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function evaluatePaymentTransition(
  currentStatus: PaymentAttemptStatus,
  hasOrder: boolean,
  event: PaymentVerificationEvent
): PaymentTransitionResult {
  if (currentStatus === 'succeeded' || hasOrder) {
    return { action: 'duplicate_already_confirmed' };
  }

  switch (event.type) {
    case 'signature_invalid':
      return {
        action: 'mark_uncertain',
        nextStatus: 'uncertain',
        reason: 'Payment signature verification failed on the server.',
      };
    case 'gateway_captured':
      return {
        action: 'confirm_order',
        nextStatus: 'succeeded',
      };
    case 'gateway_pending':
      return {
        action: 'mark_pending',
        nextStatus: 'pending',
      };
    case 'gateway_failed':
      return {
        action: 'mark_failed',
        nextStatus: 'failed',
        reason: event.reason || 'Payment was declined by the payment provider.',
      };
    case 'customer_cancelled':
      return {
        action: 'mark_cancelled',
        nextStatus: 'cancelled',
        reason: 'Payment was cancelled before completion.',
      };
  }
}
