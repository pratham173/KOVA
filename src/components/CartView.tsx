import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../lib/commerce';
import { ProductImage } from './ProductImage';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function CartView() {
  const {
    cart,
    cartLoading,
    updateCartQuantity,
    removeFromCart,
    navigate,
    user,
  } = useStore();

  const handleCheckout = () => {
    if (!user) {
      navigate('/login?next=/checkout');
    } else {
      navigate('/checkout');
    }
  };

  const freeShippingProgress =
    cart.totals.freeShippingThresholdMinor > 0
      ? Math.min(
          100,
          Math.round((cart.totals.subtotalMinor / cart.totals.freeShippingThresholdMinor) * 100)
        )
      : 100;

  return (
    <main
      data-testid="cart-page"
      className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-24"
    >
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
          <p className="text-xs font-mono uppercase tracking-wider text-[#6B665D] dark:text-[#9A968E] mb-1.5">
            Shopping Bag
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-[#171716] dark:text-[#F3F1EC]">
            Your Cart
          </h1>
        </div>
        <p className="text-xs sm:text-sm font-mono text-[#5C5851] dark:text-[#A4A097] tabular-nums">
          {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
        </p>
      </div>

      {cart.adjustments.length > 0 && (
        <div
          role="status"
          className="mb-6 rounded-sm glass-surface px-5 py-3.5 text-xs sm:text-sm text-[#5C5851] dark:text-[#A4A097] border-l-2 border-l-[#3B66F5]"
        >
          {cart.adjustments.map((msg, idx) => (
            <p key={idx}>{msg}</p>
          ))}
        </div>
      )}

      {cartLoading && cart.items.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse">
          <div className="lg:col-span-8 space-y-4">
            <div className="h-32 glass-surface rounded-sm" />
            <div className="h-32 glass-surface rounded-sm" />
          </div>
          <div className="lg:col-span-4 h-72 glass-surface rounded-sm" />
        </div>
      ) : cart.items.length === 0 ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="glass-surface rounded-sm py-20 px-6 text-center max-w-2xl mx-auto"
        >
          <div className="w-14 h-14 mx-auto rounded-sm bg-[#171716]/6 dark:bg-white/8 flex items-center justify-center text-[#5C5851] dark:text-[#A4A097] mb-5">
            <ShoppingBag className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-[#171716] dark:text-[#F3F1EC]">
            Your cart is currently empty
          </h2>
          <p className="text-sm text-[#5C5851] dark:text-[#A4A097] max-w-md mx-auto mt-2 mb-7">
            Explore our small-batch spun aluminum lighting, high-fired stoneware, and milled desk
            objects.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Explore Collection</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </motion.section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Full-Width Line Items List */}
          <div className="lg:col-span-8 space-y-5">
            {/* Free Shipping Progress Strip */}
            <div className="glass-surface rounded-sm px-5 py-4 space-y-2.5">
              <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                <span className="inline-flex items-center gap-2 text-[#171716] dark:text-[#F3F1EC] font-medium">
                  <Truck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {cart.totals.remainingForFreeShippingMinor > 0 ? (
                    <span>
                      Add{' '}
                      <span className="font-mono font-semibold tabular-nums">
                        {formatCurrency(cart.totals.remainingForFreeShippingMinor, cart.currency)}
                      </span>{' '}
                      more for complimentary courier delivery
                    </span>
                  ) : (
                    <span className="text-[#166534] dark:text-[#4ADE80]">
                      Complimentary courier delivery unlocked
                    </span>
                  )}
                </span>
                <span className="font-mono text-xs text-[#6B665D] dark:text-[#9A968E] tabular-nums shrink-0">
                  {freeShippingProgress}%
                </span>
              </div>
              <div className="h-1 w-full bg-[#171716]/10 dark:bg-white/10 overflow-hidden rounded-[1px]">
                <motion.div
                  initial={false}
                  animate={{ width: `${freeShippingProgress}%` }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className={`h-full ${
                    cart.totals.remainingForFreeShippingMinor === 0
                      ? 'bg-[#166534] dark:bg-[#4ADE80]'
                      : 'bg-[#171716] dark:bg-[#F3F1EC]'
                  }`}
                />
              </div>
            </div>

            {/* Items Table / List */}
            <section className="glass-surface rounded-sm overflow-hidden">
              <ul className="divide-y divide-[#171716]/10 dark:divide-white/10">
                {cart.items.map((item) => (
                  <li
                    key={item.productId}
                    className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5"
                  >
                    <a
                      href={`/product/${item.slug}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/product/${item.slug}`);
                      }}
                      aria-label={`View ${item.name}`}
                      className="w-full sm:w-28 aspect-[4/3] sm:aspect-square rounded-[3px] overflow-hidden bg-[#DFD9CE] dark:bg-[#232328] shrink-0 block"
                    >
                      <ProductImage
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                      />
                    </a>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs text-[#6B665D] dark:text-[#9A968E]">
                            {item.categoryName} · <span className="font-mono">{item.sku}</span>
                          </p>
                          <a
                            href={`/product/${item.slug}`}
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/product/${item.slug}`);
                            }}
                            className="font-display text-lg font-semibold text-[#171716] dark:text-[#F3F1EC] hover:text-[#3B66F5] dark:hover:text-[#7BA1FF] transition-colors block truncate mt-0.5"
                          >
                            {item.name}
                          </a>
                        </div>

                        <span className="font-mono text-base sm:text-lg font-semibold text-[#171716] dark:text-[#F3F1EC] tabular-nums shrink-0">
                          {formatCurrency(item.lineTotalMinor, item.currency)}
                        </span>
                      </div>

                      <p className="text-xs font-mono text-[#5C5851] dark:text-[#A4A097] tabular-nums">
                        {formatCurrency(item.unitPriceMinor, item.currency)} each · {item.stock} in
                        stock
                      </p>

                      <div className="pt-3 flex items-center justify-between gap-4">
                        <div className="inline-flex items-center border border-[#171716]/15 dark:border-white/15 rounded-[3px] bg-white/70 dark:bg-white/[0.04]">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="w-9 h-9 flex items-center justify-center text-[#171716] dark:text-[#F3F1EC] hover:bg-[#171716]/8 dark:hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span
                            className="w-10 text-center text-sm font-mono font-medium text-[#171716] dark:text-[#F3F1EC] tabular-nums"
                            aria-label={`Quantity of ${item.name}`}
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                            disabled={item.quantity >= item.stock}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="w-9 h-9 flex items-center justify-center text-[#171716] dark:text-[#F3F1EC] hover:bg-[#171716]/8 dark:hover:bg-white/10 disabled:opacity-35 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          aria-label={`Remove ${item.name} from cart`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-xs font-medium text-[#5C5851] dark:text-[#A4A097] hover:text-[#B91C1C] dark:hover:text-[#F87171] hover:bg-[#FEF2F2] dark:hover:bg-[#B91C1C]/15 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Right: Sticky Architectural Order Summary */}
          <aside className="lg:col-span-4 glass-surface rounded-sm p-6 sm:p-8 space-y-6 lg:sticky lg:top-24">
            <h2 className="font-display text-xl font-semibold text-[#171716] dark:text-[#F3F1EC]">
              Order Summary
            </h2>

            <div className="space-y-2.5 text-sm">
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
                <span>Estimated GST (12%)</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(cart.totals.taxMinor, cart.currency)}
                </span>
              </div>
              <div className="flex justify-between pt-3.5 border-t border-[#171716]/10 dark:border-white/10 font-semibold text-base text-[#171716] dark:text-[#F3F1EC]">
                <span>Estimated Total</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(cart.totals.totalMinor, cart.currency)}
                </span>
              </div>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              data-testid="cart-checkout-btn"
              onClick={handleCheckout}
              className="w-full h-12 px-5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{user ? 'Proceed to Checkout' : 'Sign In & Checkout'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </motion.button>

            <div className="pt-4 border-t border-[#171716]/10 dark:border-white/10 space-y-2.5 text-xs text-[#5C5851] dark:text-[#A4A097]">
              <div className="flex items-start gap-2.5">
                <Banknote
                  className="w-4 h-4 text-[#171716] dark:text-[#F3F1EC] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>Cash on Delivery &amp; online Razorpay checkout available.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck
                  className="w-4 h-4 text-[#171716] dark:text-[#F3F1EC] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  {user
                    ? 'Server-verified catalogue pricing and instant stock reservation.'
                    : 'Your guest cart merges automatically into your account when you sign in.'}
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
