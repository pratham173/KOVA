import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { COD_MAX_ORDER_MINOR, formatCurrency, isCodEligible } from '../lib/commerce';
import type { OrderRecord } from '../types/store';
import { ProductImage } from './ProductImage';

interface PaymentConfig {
  mode: 'razorpay_test' | 'razorpay_sandbox';
  keyId: string | null;
  currency: string;
  livePaymentsBlocked: boolean;
  configError: string | null;
}

interface ActiveAttempt {
  id: number;
  provider: 'razorpay_test' | 'razorpay_sandbox';
  providerOrderId: string;
  amountMinor: number;
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  currency: string;
  status: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (resp: any) => void) => void;
    };
  }
}

function loadRazorpayCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const INPUT_CLASS =
  'w-full h-11 px-3.5 rounded-[3px] bg-white/85 dark:bg-white/[0.05] border border-[#171716]/15 dark:border-white/15 text-sm text-[#171716] dark:text-[#F3F1EC] placeholder:text-[#7B766C] dark:placeholder:text-[#8E8A81] focus:outline-none focus:border-[#3B66F5] transition-colors';

export function CheckoutView() {
  const { user, authReady, cart, refreshCart, navigate, showToast, bumpCatalogVersion } =
    useStore();

  const [, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('India');

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Online payment attempt lifecycle states
  const [activeAttempt, setActiveAttempt] = useState<ActiveAttempt | null>(null);
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<{
    kind: 'failed' | 'cancelled' | 'pending' | 'uncertain';
    message: string;
    attemptId: number;
  } | null>(null);

  const codAllowed = isCodEligible(cart.totals.totalMinor);

  useEffect(() => {
    if (!codAllowed && paymentMethod === 'cod') {
      setPaymentMethod('online');
    }
  }, [codAllowed, paymentMethod]);

  useEffect(() => {
    if (user) {
      setFullName((prev) => prev || user.name);
      setEmail((prev) => prev || user.email);
    }
  }, [user]);

  useEffect(() => {
    apiFetch<PaymentConfig>('/api/payments/config')
      .then(setPaymentConfig)
      .catch(() => {
        // fallback handled on submit
      });
  }, []);

  if (!authReady) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 text-center text-sm text-[#5C5851] dark:text-[#A4A097]">
        Preparing checkout…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-lg mx-auto glass-surface rounded-sm p-10 text-center"
        >
          <h1 className="font-display text-2xl font-bold text-[#171716] dark:text-[#F3F1EC]">
            Sign in to continue to checkout
          </h1>
          <p className="text-sm text-[#5C5851] dark:text-[#A4A097] mt-2 mb-6">
            Your guest cart will automatically merge into your customer account so we can attach
            order receipts, Cash on Delivery confirmation, and fulfilment tracking.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login?next=/checkout')}
            className="px-6 py-3 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors cursor-pointer"
          >
            Sign In or Create Account
          </button>
        </motion.div>
      </main>
    );
  }

  if (cart.items.length === 0 && !paymentFeedback) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md mx-auto glass-surface rounded-sm p-10"
        >
          <h1 className="font-display text-3xl font-bold text-[#171716] dark:text-[#F3F1EC]">
            Your cart is empty
          </h1>
          <p className="text-sm text-[#5C5851] dark:text-[#A4A097] mt-2 mb-6">
            Add objects from the catalogue before starting checkout.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors cursor-pointer"
          >
            Browse Catalogue
          </button>
        </motion.div>
      </main>
    );
  }

  const completeVerifiedOrder = async (order: OrderRecord, isCod = false) => {
    setGatewayModalOpen(false);
    setActiveAttempt(null);
    setPaymentFeedback(null);
    await refreshCart();
    bumpCatalogVersion();
    showToast(
      isCod
        ? `Order ${order.orderNumber} confirmed with Cash on Delivery.`
        : `Order ${order.orderNumber} confirmed.`
    );
    navigate(`/account/orders/${order.orderNumber}`);
  };

  const launchRazorpayModal = async (attempt: ActiveAttempt, keyId: string) => {
    const loaded = await loadRazorpayCheckoutScript();
    if (!loaded || !window.Razorpay) {
      setPaymentFeedback({
        kind: 'failed',
        attemptId: attempt.id,
        message: 'Could not load Razorpay Checkout script. Your cart has been preserved.',
      });
      return;
    }

    const rzp = new window.Razorpay({
      key: keyId,
      amount: attempt.amountMinor,
      currency: attempt.currency,
      name: 'KOVA Studio',
      description: 'Studio order payment',
      order_id: attempt.providerOrderId,
      prefill: {
        name: fullName.trim(),
        email: email.trim(),
        contact: phone.replace(/[^\d+]/g, ''),
      },
      theme: { color: '#171716' },
      modal: {
        ondismiss: async () => {
          await apiFetch(`/api/payments/${attempt.id}/mark-outcome`, {
            method: 'POST',
            body: JSON.stringify({
              outcome: 'cancelled',
              reason: 'Customer closed Razorpay checkout before completing payment.',
            }),
          }).catch(() => {});
          setPaymentFeedback({
            kind: 'cancelled',
            attemptId: attempt.id,
            message: 'Payment was cancelled. Your bag items are untouched — you can retry anytime.',
          });
        },
      },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        setVerifying(true);
        try {
          const verified = await apiFetch<{
            status: 'succeeded' | 'pending' | 'failed' | 'uncertain';
            order?: OrderRecord;
            message?: string;
            error?: string;
          }>('/api/payments/verify', {
            method: 'POST',
            body: JSON.stringify({
              attemptId: attempt.id,
              providerOrderId: response.razorpay_order_id,
              providerPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          });

          if (verified.status === 'succeeded' && verified.order) {
            await completeVerifiedOrder(verified.order);
          } else if (verified.status === 'pending') {
            setPaymentFeedback({
              kind: 'pending',
              attemptId: attempt.id,
              message:
                verified.message ||
                'Payment is pending final bank confirmation. Order is not confirmed yet.',
            });
          } else {
            setPaymentFeedback({
              kind: 'failed',
              attemptId: attempt.id,
              message: verified.error || 'Payment could not be verified.',
            });
          }
        } catch (err: any) {
          setPaymentFeedback({
            kind: 'uncertain',
            attemptId: attempt.id,
            message:
              err.message ||
              'Server verification failed. Your cart has been preserved — no order was confirmed.',
          });
        } finally {
          setVerifying(false);
        }
      },
    });

    rzp.on('payment.failed', async (resp: any) => {
      const reason = resp?.error?.description || 'Card or UPI authorization failed.';
      await apiFetch(`/api/payments/${attempt.id}/mark-outcome`, {
        method: 'POST',
        body: JSON.stringify({ outcome: 'failed', reason }),
      }).catch(() => {});
      setPaymentFeedback({
        kind: 'failed',
        attemptId: attempt.id,
        message: `${reason} Your shopping bag has been preserved.`,
      });
    });

    rzp.open();
  };

  const handleStartCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setPaymentFeedback(null);

    if (
      fullName.trim().length < 2 ||
      !email.includes('@') ||
      phone.trim().length < 7 ||
      address.trim().length < 5 ||
      city.trim().length < 2 ||
      postalCode.trim().length < 3
    ) {
      setFormError('Please fill in all required shipping fields before continuing.');
      return;
    }

    const shipping = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      postalCode: postalCode.trim(),
      country: country.trim() || 'India',
    };

    setSubmitting(true);
    try {
      if (paymentMethod === 'cod') {
        if (!codAllowed) {
          setFormError(
            `Cash on Delivery is available for orders up to ${formatCurrency(COD_MAX_ORDER_MINOR, cart.currency)}. Please choose Online Payment.`
          );
          return;
        }
        const res = await apiFetch<{ order: OrderRecord }>('/api/checkout/cod', {
          method: 'POST',
          body: JSON.stringify({ shipping }),
        });
        await completeVerifiedOrder(res.order, true);
        return;
      }

      const res = await apiFetch<{
        attempt: ActiveAttempt;
        gateway: { mode: 'razorpay_test' | 'razorpay_sandbox'; keyId: string | null };
      }>('/api/checkout/create-attempt', {
        method: 'POST',
        body: JSON.stringify({ shipping }),
      });

      setActiveAttempt(res.attempt);

      if (res.gateway.mode === 'razorpay_test' && res.gateway.keyId) {
        await launchRazorpayModal(res.attempt, res.gateway.keyId);
      } else {
        setGatewayModalOpen(true);
      }
    } catch (err: any) {
      setFormError(err.message || 'Unable to start checkout. Please review your bag.');
      await refreshCart();
    } finally {
      setSubmitting(false);
    }
  };

  const handleGatewayAction = async (
    action: 'captured' | 'failed' | 'cancelled' | 'pending' | 'tampered'
  ) => {
    if (!activeAttempt) return;
    setVerifying(true);
    try {
      if (action === 'failed' || action === 'cancelled') {
        await apiFetch(`/api/payments/${activeAttempt.id}/mark-outcome`, {
          method: 'POST',
          body: JSON.stringify({
            outcome: action,
            reason:
              action === 'failed'
                ? 'Card declined by issuing bank.'
                : 'Checkout closed before payment authorization.',
          }),
        });
        setGatewayModalOpen(false);
        setPaymentFeedback({
          kind: action,
          attemptId: activeAttempt.id,
          message:
            action === 'failed'
              ? 'Payment failed: card was declined. Your bag has been preserved so you can retry.'
              : 'Payment was cancelled before completion. Your bag has been preserved.',
        });
        return;
      }

      const callback = await apiFetch<{
        providerOrderId: string;
        providerPaymentId: string;
        signature: string;
      }>(`/api/payments/${activeAttempt.id}/sandbox-authorize`, {
        method: 'POST',
        body: JSON.stringify({ outcome: action }),
      });

      const verified = await apiFetch<{
        status: 'succeeded' | 'pending' | 'failed' | 'uncertain';
        order?: OrderRecord;
        message?: string;
        error?: string;
      }>('/api/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          attemptId: activeAttempt.id,
          providerOrderId: callback.providerOrderId,
          providerPaymentId: callback.providerPaymentId,
          signature: callback.signature,
        }),
      });

      if (verified.status === 'succeeded' && verified.order) {
        await completeVerifiedOrder(verified.order);
      } else if (verified.status === 'pending') {
        setGatewayModalOpen(false);
        setPaymentFeedback({
          kind: 'pending',
          attemptId: activeAttempt.id,
          message:
            verified.message ||
            'Bank settlement is delayed. No confirmed order has been created yet — use Re-check Status below.',
        });
      }
    } catch (err: any) {
      setGatewayModalOpen(false);
      setPaymentFeedback({
        kind: 'uncertain',
        attemptId: activeAttempt.id,
        message:
          err.message ||
          'Server signature verification rejected this payment. Your cart has been preserved.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleRecheckPending = async () => {
    if (!paymentFeedback) return;
    setVerifying(true);
    try {
      const res = await apiFetch<{
        status: 'succeeded' | 'pending' | 'failed';
        order?: OrderRecord;
        message?: string;
        error?: string;
      }>(`/api/payments/${paymentFeedback.attemptId}/recheck`, {
        method: 'POST',
      });

      if (res.status === 'succeeded' && res.order) {
        await completeVerifiedOrder(res.order);
      } else if (res.status === 'failed') {
        setPaymentFeedback({
          kind: 'failed',
          attemptId: paymentFeedback.attemptId,
          message: res.error || 'Delayed payment failed. Your bag is preserved.',
        });
      } else {
        setPaymentFeedback({
          kind: 'pending',
          attemptId: paymentFeedback.attemptId,
          message: res.message || 'Still awaiting confirmation from the payment gateway.',
        });
      }
    } catch (err: any) {
      showToast(err.message || 'Could not re-check payment status.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[3px] glass-surface text-xs sm:text-sm font-medium text-[#171716] dark:text-[#F3F1EC] hover:border-[#171716]/25 dark:hover:border-white/25 transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Continue Shopping</span>
      </button>

      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-[#171716] dark:text-[#F3F1EC]">
            Checkout
          </h1>
          <p className="text-sm text-[#5C5851] dark:text-[#A4A097] mt-1">
            Order totals are calculated from studio catalogue prices on the server.
          </p>
        </div>
        <p className="text-xs font-mono text-[#5C5851] dark:text-[#A4A097]">
          Razorpay &amp; Cash on Delivery · Server-Verified Totals
        </p>
      </div>

      {/* Payment Outcome Banner */}
      <AnimatePresence>
        {paymentFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="alert"
            className="mb-8 rounded-sm glass-surface p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-2 border-l-[#B91C1C]"
          >
            <div className="flex items-start gap-3.5">
              {paymentFeedback.kind === 'pending' ? (
                <Clock className="w-5 h-5 text-[#B45309] dark:text-[#F59E0B] shrink-0 mt-0.5" aria-hidden="true" />
              ) : paymentFeedback.kind === 'uncertain' ? (
                <AlertTriangle className="w-5 h-5 text-[#B91C1C] dark:text-[#F87171] shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <XCircle className="w-5 h-5 text-[#B91C1C] dark:text-[#F87171] shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div>
                <h2 className="font-display text-base font-semibold text-[#171716] dark:text-[#F3F1EC]">
                  {paymentFeedback.kind === 'pending'
                    ? 'Payment Pending Bank Confirmation'
                    : paymentFeedback.kind === 'cancelled'
                      ? 'Payment Cancelled'
                      : paymentFeedback.kind === 'uncertain'
                        ? 'Unverified Payment Rejected'
                        : 'Payment Failed'}
                </h2>
                <p className="text-sm text-[#5C5851] dark:text-[#A4A097] mt-0.5">
                  {paymentFeedback.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {paymentFeedback.kind === 'pending' ? (
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleRecheckPending}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-xs font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{verifying ? 'Checking…' : 'Re-check Payment Status'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPaymentFeedback(null)}
                  className="px-4 py-2.5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-xs font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white cursor-pointer"
                >
                  Retry Payment
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Shipping + Payment Method Form */}
        <form
          onSubmit={handleStartCheckout}
          noValidate
          className="lg:col-span-7 glass-surface rounded-sm p-6 sm:p-8 space-y-6"
        >
          <h2 className="font-display text-xl font-semibold text-[#171716] dark:text-[#F3F1EC]">
            Shipping Destination
          </h2>

          {formError && (
            <div
              role="alert"
              className="rounded-[3px] bg-[#FEF2F2] dark:bg-[#B91C1C]/15 border border-[#B91C1C]/25 dark:border-[#F87171]/30 px-4 py-3 text-sm text-[#991B1B] dark:text-[#FCA5A5]"
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="ship-name"
                className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
              >
                Full Name
              </label>
              <input
                id="ship-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Maya Deshmukh"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="ship-email"
                className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
              >
                Email for Receipt
              </label>
              <input
                id="ship-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maya@example.com"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="ship-phone"
                className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
              >
                Phone Number
              </label>
              <input
                id="ship-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={INPUT_CLASS}
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="ship-address"
                className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
              >
                Street Address
              </label>
              <input
                id="ship-address"
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="14 Indiranagar 100 Feet Road, Apt 4B"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="ship-city"
                className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
              >
                City
              </label>
              <input
                id="ship-city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Bengaluru"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="ship-postal"
                className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
              >
                Postal Code
              </label>
              <input
                id="ship-postal"
                type="text"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="560038"
                className={INPUT_CLASS}
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="ship-country"
                className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
              >
                Country
              </label>
              <input
                id="ship-country"
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <fieldset className="pt-5 border-t border-[#171716]/10 dark:border-white/10 space-y-3">
            <legend className="font-display text-lg font-semibold text-[#171716] dark:text-[#F3F1EC] mb-1">
              Payment Method
            </legend>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="payment-method-online"
                aria-pressed={paymentMethod === 'online'}
                onClick={() => setPaymentMethod('online')}
                className={`p-4 rounded-[3px] border text-left transition-all cursor-pointer ${
                  paymentMethod === 'online'
                    ? 'border-[#3B66F5] bg-[#3B66F5]/[0.07] dark:bg-[#3B66F5]/[0.14] ring-1 ring-[#3B66F5]/40'
                    : 'border-[#171716]/12 dark:border-white/12 bg-white/50 dark:bg-white/[0.03] hover:border-[#171716]/30 dark:hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <CreditCard
                    className={`w-4 h-4 ${
                      paymentMethod === 'online'
                        ? 'text-[#3B66F5]'
                        : 'text-[#171716] dark:text-[#F3F1EC]'
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      paymentMethod === 'online'
                        ? 'border-[#3B66F5]'
                        : 'border-[#171716]/30 dark:border-white/30'
                    }`}
                  >
                    {paymentMethod === 'online' && (
                      <span className="w-2 h-2 rounded-full bg-[#3B66F5]" />
                    )}
                  </span>
                </div>
                <p className="font-display text-sm font-semibold text-[#171716] dark:text-[#F3F1EC]">
                  Pay Online
                </p>
                <p className="text-xs text-[#5C5851] dark:text-[#A4A097] mt-0.5">
                  Cards, UPI &amp; Netbanking via Razorpay
                </p>
              </button>

              <button
                type="button"
                data-testid="payment-method-cod"
                disabled={!codAllowed}
                aria-pressed={paymentMethod === 'cod'}
                onClick={() => {
                  if (codAllowed) setPaymentMethod('cod');
                }}
                className={`p-4 rounded-[3px] border text-left transition-all ${
                  !codAllowed
                    ? 'opacity-50 cursor-not-allowed border-[#171716]/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]'
                    : paymentMethod === 'cod'
                      ? 'border-[#3B66F5] bg-[#3B66F5]/[0.07] dark:bg-[#3B66F5]/[0.14] ring-1 ring-[#3B66F5]/40 cursor-pointer'
                      : 'border-[#171716]/12 dark:border-white/12 bg-white/50 dark:bg-white/[0.03] hover:border-[#171716]/30 dark:hover:border-white/25 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Banknote
                    className={`w-4 h-4 ${
                      paymentMethod === 'cod'
                        ? 'text-[#3B66F5]'
                        : 'text-[#171716] dark:text-[#F3F1EC]'
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      paymentMethod === 'cod'
                        ? 'border-[#3B66F5]'
                        : 'border-[#171716]/30 dark:border-white/30'
                    }`}
                  >
                    {paymentMethod === 'cod' && (
                      <span className="w-2 h-2 rounded-full bg-[#3B66F5]" />
                    )}
                  </span>
                </div>
                <p className="font-display text-sm font-semibold text-[#171716] dark:text-[#F3F1EC]">
                  Cash on Delivery
                </p>
                <p className="text-xs text-[#5C5851] dark:text-[#A4A097] mt-0.5">
                  {codAllowed
                    ? 'Pay in cash or UPI at your doorstep'
                    : `Available up to ${formatCurrency(COD_MAX_ORDER_MINOR, cart.currency)}`}
                </p>
              </button>
            </div>
          </fieldset>

          <div className="pt-2 space-y-4">
            <div className="rounded-[3px] bg-[#171716]/[0.04] dark:bg-white/[0.05] border border-[#171716]/8 dark:border-white/10 p-4 text-xs text-[#5C5851] dark:text-[#A4A097] flex items-start gap-3">
              {paymentMethod === 'cod' ? (
                <>
                  <Banknote
                    className="w-4 h-4 text-[#171716] dark:text-[#F3F1EC] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <p>
                    Pay{' '}
                    <span className="font-mono font-semibold text-[#171716] dark:text-[#F3F1EC]">
                      {formatCurrency(cart.totals.totalMinor, cart.currency)}
                    </span>{' '}
                    in cash or UPI when your order arrives. No prepayment required — studio stock is
                    reserved immediately upon confirmation.
                  </p>
                </>
              ) : (
                <>
                  <ShieldCheck
                    className="w-4 h-4 text-[#171716] dark:text-[#F3F1EC] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <p>
                    Orders are confirmed immediately after our server verifies the Razorpay
                    signature and payment capture status.
                  </p>
                </>
              )}
            </div>

            <motion.button
              whileTap={{ scale: 0.99 }}
              type="submit"
              data-testid="checkout-submit-btn"
              disabled={submitting || verifying}
              className="w-full h-13 px-6 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {paymentMethod === 'cod' ? (
                <Banknote className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Lock className="w-4 h-4" aria-hidden="true" />
              )}
              <span>
                {submitting
                  ? paymentMethod === 'cod'
                    ? 'Confirming COD Order…'
                    : 'Preparing Checkout…'
                  : paymentMethod === 'cod'
                    ? `Place COD Order · ${formatCurrency(cart.totals.totalMinor, cart.currency)}`
                    : `Pay ${formatCurrency(cart.totals.totalMinor, cart.currency)}`}
              </span>
            </motion.button>
          </div>
        </form>

        {/* Right: Trusted Server-Calculated Order Summary */}
        <aside className="lg:col-span-5 glass-surface rounded-sm p-6 sm:p-8 space-y-5 lg:sticky lg:top-24">
          <h2 className="font-display text-xl font-semibold text-[#171716] dark:text-[#F3F1EC]">
            Order Summary
          </h2>

          <ul className="divide-y divide-[#171716]/10 dark:divide-white/10">
            {cart.items.map((item) => (
              <li key={item.productId} className="py-3.5 flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-[3px] overflow-hidden bg-[#E7E2D8] dark:bg-[#232328] shrink-0">
                  <ProductImage
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#171716] dark:text-[#F3F1EC] truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-[#6B675E] dark:text-[#9A968E] tabular-nums">
                    Qty {item.quantity} × {formatCurrency(item.unitPriceMinor, item.currency)}
                  </p>
                </div>
                <span className="font-mono text-sm font-medium text-[#171716] dark:text-[#F3F1EC] tabular-nums">
                  {formatCurrency(item.lineTotalMinor, item.currency)}
                </span>
              </li>
            ))}
          </ul>

          <div className="pt-4 border-t border-[#171716]/10 dark:border-white/10 space-y-2 text-sm">
            <div className="flex justify-between text-[#5C5851] dark:text-[#A4A097]">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(cart.totals.subtotalMinor, cart.currency)}
              </span>
            </div>
            <div className="flex justify-between text-[#5C5851] dark:text-[#A4A097]">
              <span>Courier Shipping</span>
              <span className="font-mono tabular-nums">
                {cart.totals.shippingMinor === 0
                  ? 'Free'
                  : formatCurrency(cart.totals.shippingMinor, cart.currency)}
              </span>
            </div>
            <div className="flex justify-between text-[#5C5851] dark:text-[#A4A097]">
              <span>GST (12%)</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(cart.totals.taxMinor, cart.currency)}
              </span>
            </div>
            <div className="flex justify-between text-[#5C5851] dark:text-[#A4A097]">
              <span>Payment Method</span>
              <span className="font-medium text-[#171716] dark:text-[#F3F1EC]">
                {paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online (Razorpay)'}
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t border-[#171716]/10 dark:border-white/10 font-semibold text-base text-[#171716] dark:text-[#F3F1EC]">
              <span>{paymentMethod === 'cod' ? 'Total Due on Delivery' : 'Total Due'}</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(cart.totals.totalMinor, cart.currency)}
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Online Payment Verification Modal */}
      <AnimatePresence>
        {gatewayModalOpen && activeAttempt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Razorpay Checkout"
          >
            <div className="fixed inset-0 bg-[#0E0E10]/65 backdrop-blur-md" />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-md bg-[#FAF9F6]/95 dark:bg-[#17171A]/95 backdrop-blur-2xl rounded-sm border border-[#171716]/15 dark:border-white/15 shadow-2xl overflow-hidden"
            >
              <div className="bg-[#171716] dark:bg-[#0E0E10] text-[#FAF9F6] p-6 border-b border-white/10">
                <p className="text-xs text-[#B8B4AA]">
                  Razorpay Checkout · Server-Verified Payment
                </p>
                <div className="mt-2 flex items-baseline justify-between gap-4">
                  <h2 className="font-display text-xl font-semibold">KOVA Studio</h2>
                  <span className="font-mono text-xl font-semibold tabular-nums">
                    {formatCurrency(activeAttempt.amountMinor, activeAttempt.currency)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-[#9C988E]">
                  Order Ref: {activeAttempt.providerOrderId}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs text-[#5C5851] dark:text-[#A4A097] leading-relaxed">
                  Confirm payment authorization to complete server-side signature verification.
                </p>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => handleGatewayAction('captured')}
                    className="w-full py-3 px-4 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors flex items-center justify-between cursor-pointer disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>Authorize &amp; Capture</span>
                    </span>
                    <span className="text-xs opacity-75">Verified</span>
                  </button>

                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => handleGatewayAction('failed')}
                    className="w-full py-2.5 px-4 rounded-[3px] bg-white/80 dark:bg-white/[0.05] border border-[#171716]/15 dark:border-white/15 text-sm font-medium text-[#171716] dark:text-[#F3F1EC] hover:bg-[#FEF2F2] dark:hover:bg-[#B91C1C]/15 hover:border-[#B91C1C]/30 transition-colors text-left cursor-pointer disabled:opacity-50"
                  >
                    Declined Card (Preserves Bag)
                  </button>

                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => handleGatewayAction('pending')}
                    className="w-full py-2.5 px-4 rounded-[3px] bg-white/80 dark:bg-white/[0.05] border border-[#171716]/15 dark:border-white/15 text-sm font-medium text-[#171716] dark:text-[#F3F1EC] hover:bg-[#FFFBEB] dark:hover:bg-[#B45309]/15 transition-colors text-left cursor-pointer disabled:opacity-50"
                  >
                    Delayed Bank Confirmation (Pending)
                  </button>

                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => handleGatewayAction('tampered')}
                    className="w-full py-2.5 px-4 rounded-[3px] bg-white/80 dark:bg-white/[0.05] border border-[#171716]/15 dark:border-white/15 text-sm font-medium text-[#171716] dark:text-[#F3F1EC] hover:bg-[#FEF2F2] dark:hover:bg-[#B91C1C]/15 transition-colors text-left cursor-pointer disabled:opacity-50"
                  >
                    Invalid Signature (Must Reject)
                  </button>
                </div>

                <div className="pt-3 border-t border-[#171716]/10 dark:border-white/10 flex justify-end">
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => handleGatewayAction('cancelled')}
                    className="text-xs font-medium text-[#5C5851] dark:text-[#A4A097] hover:text-[#171716] dark:hover:text-[#F3F1EC] py-2 px-3 cursor-pointer"
                  >
                    Cancel &amp; Return to Checkout
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
