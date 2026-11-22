import crypto from 'node:crypto';
import {
  assertTestModeRazorpayKey,
  signRazorpayPayload,
  verifyRazorpaySignature,
} from './paymentCrypto.ts';

export type PaymentGatewayMode = 'razorpay_test' | 'razorpay_sandbox';

export interface PublicPaymentConfig {
  mode: PaymentGatewayMode;
  keyId: string | null;
  currency: string;
  livePaymentsBlocked: true;
  configError: string | null;
}

export interface CreatedGatewayOrder {
  provider: PaymentGatewayMode;
  providerOrderId: string;
  keyId: string | null;
  amountMinor: number;
  currency: string;
}

export interface GatewayPaymentInspection {
  verifiedStatus: 'captured' | 'pending' | 'failed';
  failureReason?: string;
}

function getSandboxSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    `kova_local_razorpay_sandbox_secret_${process.env.SQL_DB_NAME || 'dev'}`
  );
}

export function getPublicPaymentConfig(): PublicPaymentConfig {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';

  if (keyId && keySecret) {
    const check = assertTestModeRazorpayKey(keyId);
    if (!check.valid) {
      return {
        mode: 'razorpay_sandbox',
        keyId: null,
        currency: 'INR',
        livePaymentsBlocked: true,
        configError: check.reason || 'Invalid Razorpay key configuration.',
      };
    }
    return {
      mode: 'razorpay_test',
      keyId,
      currency: 'INR',
      livePaymentsBlocked: true,
      configError: null,
    };
  }

  return {
    mode: 'razorpay_sandbox',
    keyId: null,
    currency: 'INR',
    livePaymentsBlocked: true,
    configError: null,
  };
}

export async function createGatewayOrder(params: {
  amountMinor: number;
  currency: string;
  receipt: string;
}): Promise<CreatedGatewayOrder> {
  const config = getPublicPaymentConfig();

  if (config.configError) {
    throw new Error(config.configError);
  }

  if (config.mode === 'razorpay_test' && config.keyId) {
    const secret = process.env.RAZORPAY_KEY_SECRET!.trim();
    const basic = Buffer.from(`${config.keyId}:${secret}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amountMinor,
        currency: params.currency,
        receipt: params.receipt.slice(0, 40),
        payment_capture: 1,
      }),
    });

    const data = (await response.json()) as { id?: string; error?: { description?: string } };
    if (!response.ok || !data.id) {
      throw new Error(
        data.error?.description || 'Failed to create Razorpay Test Mode order.'
      );
    }

    return {
      provider: 'razorpay_test',
      providerOrderId: data.id,
      keyId: config.keyId,
      amountMinor: params.amountMinor,
      currency: params.currency,
    };
  }

  // Honest local Razorpay Test Sandbox fallback (when Razorpay Test API keys are not yet supplied)
  const sandboxOrderId = `order_sandbox_${crypto.randomBytes(8).toString('hex')}`;
  return {
    provider: 'razorpay_sandbox',
    providerOrderId: sandboxOrderId,
    keyId: null,
    amountMinor: params.amountMinor,
    currency: params.currency,
  };
}

/**
 * Generates a signed payload for the local sandbox modal to simulate Razorpay's callback.
 * Signature verification still happens server-side on /api/payments/verify.
 */
export function issueSandboxSignedCallback(
  providerOrderId: string,
  outcome: 'captured' | 'pending' | 'tampered'
): { providerPaymentId: string; signature: string } {
  const suffix = outcome === 'pending' ? 'pending' : 'pay';
  const providerPaymentId = `pay_sandbox_${suffix}_${crypto.randomBytes(6).toString('hex')}`;
  const validSig = signRazorpayPayload(
    providerOrderId,
    providerPaymentId,
    getSandboxSecret()
  );

  if (outcome === 'tampered') {
    const flipped = validSig.startsWith('0') ? '1' + validSig.slice(1) : '0' + validSig.slice(1);
    return { providerPaymentId, signature: flipped };
  }

  return { providerPaymentId, signature: validSig };
}

export function verifyGatewaySignature(params: {
  provider: PaymentGatewayMode;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}): boolean {
  const secret =
    params.provider === 'razorpay_test'
      ? process.env.RAZORPAY_KEY_SECRET?.trim() || ''
      : getSandboxSecret();

  return verifyRazorpaySignature(
    params.providerOrderId,
    params.providerPaymentId,
    params.signature,
    secret
  );
}

export async function inspectGatewayPaymentStatus(params: {
  provider: PaymentGatewayMode;
  providerPaymentId: string;
  expectedAmountMinor: number;
  expectedCurrency: string;
  recheckAfterDelay?: boolean;
}): Promise<GatewayPaymentInspection> {
  if (params.provider === 'razorpay_test') {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
    const check = assertTestModeRazorpayKey(keyId);
    if (!check.valid || !keySecret) {
      return {
        verifiedStatus: 'failed',
        failureReason: 'Razorpay Test Mode credentials are not valid.',
      };
    }

    const basic = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(params.providerPaymentId)}`,
      {
        headers: {
          Authorization: `Basic ${basic}`,
        },
      }
    );

    if (!response.ok) {
      return {
        verifiedStatus: 'pending',
        failureReason: 'Unable to confirm payment capture status with Razorpay yet.',
      };
    }

    const payment = (await response.json()) as {
      status?: string;
      amount?: number;
      currency?: string;
      error_description?: string;
    };

    if (
      payment.amount !== params.expectedAmountMinor ||
      (payment.currency || '').toUpperCase() !== params.expectedCurrency.toUpperCase()
    ) {
      return {
        verifiedStatus: 'failed',
        failureReason: 'Payment amount or currency did not match the server order total.',
      };
    }

    if (payment.status === 'captured') {
      return { verifiedStatus: 'captured' };
    }
    if (payment.status === 'authorized' || payment.status === 'created') {
      return {
        verifiedStatus: 'pending',
        failureReason: 'Payment is authorized and awaiting final bank capture.',
      };
    }
    return {
      verifiedStatus: 'failed',
      failureReason: payment.error_description || `Gateway reported status: ${payment.status}`,
    };
  }

  // Local Razorpay Test Sandbox status inspection
  if (params.providerPaymentId.includes('_pending_') && !params.recheckAfterDelay) {
    return {
      verifiedStatus: 'pending',
      failureReason: 'Bank confirmation is delayed. Please re-check payment status shortly.',
    };
  }
  return { verifiedStatus: 'captured' };
}
