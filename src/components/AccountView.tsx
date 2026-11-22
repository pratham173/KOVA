import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  LogOut,
  Package,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatCurrency } from '../lib/commerce';
import type { OrderRecord, PaymentAttemptSummary } from '../types/store';
import { ProductImage } from './ProductImage';

interface AccountViewProps {
  orderNumber?: string;
}

const FULFILMENT_STEPS = ['confirmed', 'processing', 'shipped', 'delivered'] as const;

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatStatusLabel(status: string): string {
  if (status === 'cod_pending') return 'Pay on Delivery';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

function formatPaymentMethodLabel(method?: string): string {
  return method === 'cod' ? 'Cash on Delivery' : 'Online Payment';
}

export function AccountView({ orderNumber }: AccountViewProps) {
  const { user, authReady, navigate, logout, refreshCart, showToast } = useStore();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [attempts, setAttempts] = useState<PaymentAttemptSummary[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recheckingId, setRecheckingId] = useState<number | null>(null);

  const loadAccountOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      if (orderNumber) {
        const res = await apiFetch<{ order: OrderRecord }>(
          `/api/orders/${encodeURIComponent(orderNumber)}`
        );
        setSelectedOrder(res.order);
      } else {
        const res = await apiFetch<{
          orders: OrderRecord[];
          paymentAttempts: PaymentAttemptSummary[];
        }>('/api/orders');
        setOrders(res.orders);
        setAttempts(res.paymentAttempts);
        setSelectedOrder(null);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady || !user) return;
    loadAccountOrders();
  }, [authReady, user, orderNumber]);

  const handleRecheckAttempt = async (attemptId: number) => {
    setRecheckingId(attemptId);
    try {
      const res = await apiFetch<{
        status: string;
        order?: OrderRecord;
        message?: string;
        error?: string;
      }>(`/api/payments/${attemptId}/recheck`, { method: 'POST' });

      if (res.status === 'succeeded' && res.order) {
        await refreshCart();
        showToast(`Payment settled. Order ${res.order.orderNumber} confirmed.`);
        navigate(`/account/orders/${res.order.orderNumber}`);
      } else {
        showToast(res.error || res.message || 'Payment has not settled yet.', 'error');
        await loadAccountOrders();
      }
    } catch (err: any) {
      showToast(err.message || 'Unable to check payment status.', 'error');
    } finally {
      setRecheckingId(null);
    }
  };

  if (!authReady) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 text-center text-sm text-[#5C5851] dark:text-[#A4A097]">
        Loading account…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="max-w-lg mx-auto glass-surface rounded-sm p-10 text-center">
          <h1 className="font-display text-2xl font-bold text-[#171716] dark:text-[#F3F1EC]">
            Sign in to your account
          </h1>
          <p className="text-sm text-[#5C5851] dark:text-[#A4A097] mt-2 mb-6">
            View order receipts, shipment updates, and saved shopping cart items.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login?next=/account')}
            className="px-6 py-3 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </main>
    );
  }

  // Single Order Detail View
  if (orderNumber) {
    const isCodOrder =
      selectedOrder?.paymentMethod === 'cod' || selectedOrder?.paymentStatus === 'cod_pending';
    const isCodPending = selectedOrder?.paymentStatus === 'cod_pending';

    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <button
          type="button"
          onClick={() => navigate('/account')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[3px] glass-surface text-xs sm:text-sm font-medium text-[#171716] dark:text-[#F3F1EC] hover:border-[#171716]/25 dark:hover:border-white/25 transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Order History</span>
        </button>

        {loading && (
          <div className="glass-surface rounded-sm p-10 animate-pulse space-y-4">
            <div className="h-8 w-56 bg-[#E4DFD6] dark:bg-white/10 rounded" />
            <div className="h-4 w-72 bg-[#ECE8DF] dark:bg-white/5 rounded" />
            <div className="h-32 w-full bg-[#ECE8DF] dark:bg-white/5 rounded-[3px]" />
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="glass-surface rounded-sm border-[#B91C1C]/30 p-10 text-center">
            <p className="font-display text-xl font-semibold text-[#171716] dark:text-[#F3F1EC]">
              {error}
            </p>
            <button
              type="button"
              onClick={() => navigate('/account')}
              className="mt-5 px-5 py-2.5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-sm font-medium cursor-pointer"
            >
              Return to Orders
            </button>
          </div>
        )}

        {!loading && !error && selectedOrder && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            <div className="glass-surface rounded-sm p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B675E] dark:text-[#9A968E]">
                  <span className="font-mono font-medium text-[#171716] dark:text-[#F3F1EC]">
                    {selectedOrder.orderNumber}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Placed {formatDate(selectedOrder.createdAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#171716] dark:text-[#F3F1EC]">
                    {formatPaymentMethodLabel(selectedOrder.paymentMethod)}
                  </span>
                </div>
                <h1 className="mt-2 font-display text-3xl font-bold text-[#171716] dark:text-[#F3F1EC]">
                  {selectedOrder.fulfilmentStatus === 'cancelled'
                    ? 'Order Cancelled'
                    : `Order ${formatStatusLabel(selectedOrder.fulfilmentStatus)}`}
                </h1>
                <p className="mt-1.5 text-sm text-[#5C5851] dark:text-[#A4A097]">
                  Payment Status:{' '}
                  <span
                    className={`font-semibold ${
                      isCodPending
                        ? 'text-[#B45309] dark:text-[#FBBF24]'
                        : 'text-[#166534] dark:text-[#4ADE80]'
                    }`}
                  >
                    {isCodPending
                      ? 'Pay on Delivery (Cash / UPI)'
                      : `${formatStatusLabel(selectedOrder.paymentStatus)} (Verified)`}
                  </span>
                  <span className="mx-2 text-[#171716]/25 dark:text-white/25">·</span>
                  Fulfilment:{' '}
                  <span className="font-semibold text-[#171716] dark:text-[#F3F1EC]">
                    {formatStatusLabel(selectedOrder.fulfilmentStatus)}
                  </span>
                </p>
              </div>

              <div className="text-left md:text-right">
                <p className="text-xs text-[#6B675E] dark:text-[#9A968E]">
                  {isCodPending ? 'Total Due on Delivery' : 'Verified Total Paid'}
                </p>
                <p className="font-mono text-2xl font-bold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
                  {formatCurrency(selectedOrder.totalMinor, selectedOrder.currency)}
                </p>
              </div>
            </div>

            {/* Fulfilment Progress Bar */}
            {selectedOrder.fulfilmentStatus !== 'cancelled' && (
              <div className="glass-surface rounded-sm p-6 sm:p-8">
                <h2 className="font-display text-lg font-semibold text-[#171716] dark:text-[#F3F1EC] mb-5">
                  Fulfilment Progress
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {FULFILMENT_STEPS.map((step, index) => {
                    const currentIdx = FULFILMENT_STEPS.indexOf(
                      selectedOrder.fulfilmentStatus as (typeof FULFILMENT_STEPS)[number]
                    );
                    const reached = currentIdx >= index;
                    return (
                      <div
                        key={step}
                        className={`p-4 rounded-sm border ${
                          reached
                            ? 'bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] border-[#171716] dark:border-[#F3F1EC]'
                            : 'bg-white/40 dark:bg-white/[0.03] text-[#6B675E] dark:text-[#8E8A81] border-[#171716]/10 dark:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-xs opacity-75">0{index + 1}</span>
                          {reached && <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
                        </div>
                        <p className="font-display font-semibold text-sm">
                          {formatStatusLabel(step)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {selectedOrder.trackingNote && (
                  <p className="mt-5 text-sm text-[#5C5851] dark:text-[#A4A097] pt-4 border-t border-[#171716]/10 dark:border-white/10">
                    Studio dispatch note:{' '}
                    <span className="font-medium text-[#171716] dark:text-[#F3F1EC]">
                      {selectedOrder.trackingNote}
                    </span>
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Purchased Items Snapshot */}
              <section className="lg:col-span-8 glass-surface rounded-sm p-6 sm:p-8">
                <h2 className="font-display text-xl font-semibold text-[#171716] dark:text-[#F3F1EC] mb-2">
                  Purchased Items
                </h2>
                <p className="text-xs text-[#6B675E] dark:text-[#9A968E] mb-6">
                  Item names, SKUs, and prices are permanently recorded from the time of purchase.
                </p>

                <ul className="divide-y divide-[#171716]/10 dark:divide-white/10">
                  {selectedOrder.items.map((item) => (
                    <li key={item.id} className="py-4 flex items-center gap-4">
                      <div className="w-18 h-18 rounded-[3px] overflow-hidden bg-[#E4DFD6] dark:bg-[#232328] shrink-0">
                        <ProductImage
                          src={item.productImage}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[#171716] dark:text-[#F3F1EC]">
                          {item.productName}
                        </p>
                        <p className="text-xs text-[#6B675E] dark:text-[#9A968E] mt-0.5 font-mono">
                          {item.productSku} · Qty {item.quantity} ×{' '}
                          {formatCurrency(item.unitPriceMinor, selectedOrder.currency)}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
                        {formatCurrency(item.lineTotalMinor, selectedOrder.currency)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-5 border-t border-[#171716]/10 dark:border-white/10 space-y-2 text-sm">
                  <div className="flex justify-between text-[#5C5851] dark:text-[#A4A097]">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(selectedOrder.subtotalMinor, selectedOrder.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#5C5851] dark:text-[#A4A097]">
                    <span>Courier Shipping</span>
                    <span className="font-mono tabular-nums">
                      {selectedOrder.shippingMinor === 0
                        ? 'Free'
                        : formatCurrency(selectedOrder.shippingMinor, selectedOrder.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#5C5851] dark:text-[#A4A097]">
                    <span>GST (12%)</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(selectedOrder.taxMinor, selectedOrder.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-[#171716]/10 dark:border-white/10 font-semibold text-base text-[#171716] dark:text-[#F3F1EC]">
                    <span>{isCodPending ? 'Total Due on Delivery' : 'Total Paid'}</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(selectedOrder.totalMinor, selectedOrder.currency)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Shipping & Payment Details Side Panel */}
              <aside className="lg:col-span-4 space-y-6">
                <div className="glass-surface rounded-sm p-6 space-y-3 text-sm">
                  <h2 className="font-display text-lg font-semibold text-[#171716] dark:text-[#F3F1EC]">
                    Shipping Details
                  </h2>
                  <p className="font-medium text-[#171716] dark:text-[#F3F1EC]">
                    {selectedOrder.shippingName}
                  </p>
                  <p className="text-[#5C5851] dark:text-[#A4A097]">
                    {selectedOrder.shippingAddress}
                    <br />
                    {selectedOrder.shippingCity}, {selectedOrder.shippingPostalCode}
                    <br />
                    {selectedOrder.shippingCountry}
                  </p>
                  <p className="text-xs text-[#6B675E] dark:text-[#9A968E] pt-2 border-t border-[#171716]/10 dark:border-white/10">
                    {selectedOrder.shippingEmail} · {selectedOrder.shippingPhone}
                  </p>
                </div>

                {isCodOrder ? (
                  <div
                    data-testid="cod-payment-summary"
                    className="glass-surface rounded-sm p-6 space-y-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Banknote
                        className="w-4 h-4 text-[#171716] dark:text-[#F3F1EC]"
                        aria-hidden="true"
                      />
                      <h2 className="font-display text-base font-semibold text-[#171716] dark:text-[#F3F1EC]">
                        Payment Details
                      </h2>
                    </div>
                    <div className="flex justify-between gap-2 text-[#5C5851] dark:text-[#A4A097]">
                      <span>Method</span>
                      <span className="font-medium text-[#171716] dark:text-[#F3F1EC]">
                        Cash on Delivery
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-[#5C5851] dark:text-[#A4A097]">
                      <span>Status</span>
                      <span
                        className={`font-medium ${
                          isCodPending
                            ? 'text-[#B45309] dark:text-[#FBBF24]'
                            : 'text-[#166534] dark:text-[#4ADE80]'
                        }`}
                      >
                        {formatStatusLabel(selectedOrder.paymentStatus)}
                      </span>
                    </div>
                    <p className="text-[#5C5851] dark:text-[#A4A097] leading-relaxed pt-2 border-t border-[#171716]/10 dark:border-white/10">
                      {isCodPending
                        ? 'Please keep the exact cash amount or a UPI app ready when our courier arrives.'
                        : 'Payment has been collected upon delivery.'}
                    </p>
                  </div>
                ) : (
                  selectedOrder.paymentAttempt && (
                    <div className="glass-surface rounded-sm p-6 space-y-2.5 text-xs">
                      <h2 className="font-display text-base font-semibold text-[#171716] dark:text-[#F3F1EC]">
                        Payment Verification
                      </h2>
                      <div className="flex justify-between gap-2 text-[#5C5851] dark:text-[#A4A097]">
                        <span>Gateway</span>
                        <span className="font-mono text-[#171716] dark:text-[#F3F1EC]">
                          {selectedOrder.paymentAttempt.provider.startsWith('razorpay')
                            ? 'Razorpay'
                            : selectedOrder.paymentAttempt.provider}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 text-[#5C5851] dark:text-[#A4A097]">
                        <span>Gateway Order</span>
                        <span className="font-mono text-[#171716] dark:text-[#F3F1EC] truncate max-w-[180px]">
                          {selectedOrder.paymentAttempt.providerOrderId}
                        </span>
                      </div>
                      {selectedOrder.paymentAttempt.providerPaymentId && (
                        <div className="flex justify-between gap-2 text-[#5C5851] dark:text-[#A4A097]">
                          <span>Payment ID</span>
                          <span className="font-mono text-[#171716] dark:text-[#F3F1EC] truncate max-w-[180px]">
                            {selectedOrder.paymentAttempt.providerPaymentId}
                          </span>
                        </div>
                      )}
                      {selectedOrder.paymentAttempt.verifiedAt && (
                        <div className="flex justify-between gap-2 text-[#5C5851] dark:text-[#A4A097]">
                          <span>Verified</span>
                          <span className="text-[#171716] dark:text-[#F3F1EC]">
                            {formatDate(selectedOrder.paymentAttempt.verifiedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                )}
              </aside>
            </div>
          </motion.div>
        )}
      </main>
    );
  }

  // Main Account Overview + Order History
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 space-y-10">
      <div className="glass-surface rounded-sm p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <p className="text-xs text-[#6B675E] dark:text-[#9A968E]">
            {user.role === 'admin' ? 'Administrator Account' : 'Customer Account'} ·{' '}
            {user.authProvider === 'google' ? 'Google Sign-In' : 'Email Account'}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-[#171716] dark:text-[#F3F1EC]">
            {user.name}
          </h1>
          <p className="text-sm text-[#5C5851] dark:text-[#A4A097] mt-0.5">{user.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user.role === 'admin' && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[3px] bg-[#3B66F5] text-white text-sm font-medium hover:bg-[#2A53DC] transition-colors cursor-pointer"
            >
              <Shield className="w-4 h-4" aria-hidden="true" />
              <span>Open Admin Console</span>
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[3px] border border-[#171716]/15 dark:border-white/15 bg-white/70 dark:bg-white/[0.05] text-sm font-medium text-[#171716] dark:text-[#F3F1EC] hover:bg-white dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Pending / Unconfirmed Payment Attempts */}
      {attempts.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-[#171716] dark:text-[#F3F1EC]">
            Recent Unconfirmed Payment Attempts
          </h2>
          <div className="space-y-3">
            {attempts.map((att) => (
              <div
                key={att.id}
                className="glass-surface rounded-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B675E] dark:text-[#9A968E]">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="font-mono">{att.providerOrderId}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[#171716] dark:text-[#F3F1EC]">
                      Status: {formatStatusLabel(att.status)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(att.createdAt)}</span>
                  </div>
                  <p className="text-sm text-[#5C5851] dark:text-[#A4A097]">
                    {att.failureReason || 'No confirmed order was created for this attempt.'}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="font-mono text-sm font-medium text-[#171716] dark:text-[#F3F1EC] tabular-nums">
                    {formatCurrency(att.amountMinor, att.currency)}
                  </span>
                  {att.status === 'pending' && (
                    <button
                      type="button"
                      disabled={recheckingId === att.id}
                      onClick={() => handleRecheckAttempt(att.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-xs font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{recheckingId === att.id ? 'Checking…' : 'Re-check Status'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Confirmed Customer Orders */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-bold text-[#171716] dark:text-[#F3F1EC]">
            Order History
          </h2>
          <span className="text-xs font-mono text-[#6B675E] dark:text-[#9A968E] tabular-nums">
            {orders.length} confirmed {orders.length === 1 ? 'order' : 'orders'}
          </span>
        </div>

        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 glass-surface rounded-sm" />
            <div className="h-24 glass-surface rounded-sm" />
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-sm bg-[#FEF2F2] dark:bg-[#B91C1C]/15 border border-[#B91C1C]/25 p-6 text-sm text-[#991B1B] dark:text-[#FCA5A5]"
          >
            {error}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="glass-surface rounded-sm p-12 text-center">
            <Package
              className="w-8 h-8 mx-auto text-[#6B675E] dark:text-[#9A968E] mb-3"
              aria-hidden="true"
            />
            <h3 className="font-display text-lg font-semibold text-[#171716] dark:text-[#F3F1EC]">
              No confirmed orders yet
            </h3>
            <p className="text-sm text-[#5C5851] dark:text-[#A4A097] mt-1 mb-6">
              Once you complete checkout, your order receipts will appear here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors cursor-pointer"
            >
              Explore Studio Objects
            </button>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => {
              const codPending = order.paymentStatus === 'cod_pending';
              return (
                <article
                  key={order.id}
                  className="glass-surface rounded-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B675E] dark:text-[#9A968E]">
                      <span className="font-mono font-semibold text-[#171716] dark:text-[#F3F1EC]">
                        {order.orderNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(order.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#171716] dark:text-[#F3F1EC] font-medium">
                        {formatPaymentMethodLabel(order.paymentMethod)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-medium ${
                          codPending
                            ? 'text-[#B45309] dark:text-[#FBBF24]'
                            : 'text-[#166534] dark:text-[#4ADE80]'
                        }`}
                      >
                        Payment: {formatStatusLabel(order.paymentStatus)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#171716] dark:text-[#F3F1EC] font-medium">
                        Fulfilment: {formatStatusLabel(order.fulfilmentStatus)}
                      </span>
                    </div>

                    <p className="text-sm text-[#44423D] dark:text-[#C4C0B7]">
                      {order.items
                        .map((item) => `${item.productName} ×${item.quantity}`)
                        .join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-5 shrink-0">
                    <span className="font-mono text-base font-semibold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
                      {formatCurrency(order.totalMinor, order.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/account/orders/${order.orderNumber}`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-xs font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
