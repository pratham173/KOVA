import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../lib/commerce';
import { ProductImage } from './ProductImage';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function CartDrawer() {
  const {
    cart,
    cartOpen,
    setCartOpen,
    updateCartQuantity,
    removeFromCart,
    navigate,
    user,
  } = useStore();

  useEffect(() => {
    if (!cartOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCartOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cartOpen, setCartOpen]);

  const handleCheckout = () => {
    setCartOpen(false);
    if (!user) {
      navigate('/login?next=/checkout');
    } else {
      navigate('/checkout');
    }
  };

  return (
    <AnimatePresence>
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Shopping cart"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-xs"
            onClick={() => setCartOpen(false)}
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.32, ease: EASE }}
            className="relative z-10 w-full max-w-md bg-white/92 dark:bg-[#161619]/92 backdrop-blur-2xl h-full flex flex-col border-l border-[#171716]/12 dark:border-white/12 shadow-2xl"
          >
            <div className="px-6 py-5 border-b border-[#171716]/10 dark:border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-baseline gap-2.5">
                <h2 className="font-display text-xl font-semibold text-[#171716] dark:text-[#F3F1EC]">
                  Your Cart
                </h2>
                <span className="text-xs font-mono text-[#5C5851] dark:text-[#A4A097] tabular-nums">
                  {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Close shopping cart"
                className="w-9 h-9 rounded-[3px] flex items-center justify-center text-[#5C5851] dark:text-[#A4A097] hover:text-[#171716] dark:hover:text-white hover:bg-[#171716]/6 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cart.adjustments.length > 0 && (
              <div className="px-6 py-3 bg-[#171716]/5 dark:bg-white/5 border-b border-[#171716]/10 dark:border-white/10 text-xs text-[#5C5851] dark:text-[#A4A097]">
                {cart.adjustments.map((msg, idx) => (
                  <p key={idx}>{msg}</p>
                ))}
              </div>
            )}

            {cart.items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                <div className="w-14 h-14 rounded-sm bg-[#171716]/6 dark:bg-white/8 flex items-center justify-center text-[#5C5851] dark:text-[#A4A097] mb-4">
                  <ShoppingBag className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="font-display text-lg font-semibold text-[#171716] dark:text-[#F3F1EC] mb-1">
                  Your cart is empty
                </h3>
                <p className="text-sm text-[#5C5851] dark:text-[#A4A097] max-w-xs mb-6">
                  Explore small-batch lamps, stoneware, and milled desk objects designed for daily
                  use.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCartOpen(false);
                    navigate('/');
                  }}
                  className="px-5 py-2.5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141416] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#6389FF] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Browse Collection
                </button>
              </div>
            ) : (
              <>
                {cart.totals.remainingForFreeShippingMinor > 0 ? (
                  <div className="px-6 py-3 bg-[#171716]/5 dark:bg-white/5 border-b border-[#171716]/8 dark:border-white/8 text-xs text-[#5C5851] dark:text-[#A4A097]">
                    Add{' '}
                    <span className="font-semibold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
                      {formatCurrency(cart.totals.remainingForFreeShippingMinor, cart.currency)}
                    </span>{' '}
                    more for complimentary courier shipping.
                  </div>
                ) : (
                  <div className="px-6 py-3 bg-[#166534]/10 dark:bg-[#22C55E]/10 border-b border-[#166534]/15 dark:border-[#22C55E]/20 text-xs font-medium text-[#166534] dark:text-[#86EFAC]">
                    Complimentary courier shipping unlocked.
                  </div>
                )}

                <ul className="flex-1 overflow-y-auto divide-y divide-[#171716]/8 dark:divide-white/8 px-6">
                  {cart.items.map((item) => (
                    <li key={item.productId} className="py-5 flex gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setCartOpen(false);
                          navigate(`/product/${item.slug}`);
                        }}
                        className="w-20 h-20 rounded-[3px] overflow-hidden bg-[#EAE5DC] dark:bg-[#232327] shrink-0 cursor-pointer"
                        aria-label={`View ${item.name}`}
                      >
                        <ProductImage
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCartOpen(false);
                              navigate(`/product/${item.slug}`);
                            }}
                            className="text-left font-medium text-sm text-[#171716] dark:text-[#F3F1EC] hover:text-[#3B66F5] dark:hover:text-[#7BA1FF] truncate cursor-pointer"
                          >
                            {item.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.productId)}
                            aria-label={`Remove ${item.name} from cart`}
                            className="text-[#5C5851] dark:text-[#A4A097] hover:text-[#B91C1C] dark:hover:text-[#F87171] p-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="text-xs text-[#5C5851] dark:text-[#A4A097] mt-0.5">
                          {item.categoryName} ·{' '}
                          {formatCurrency(item.unitPriceMinor, item.currency)}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center border border-[#171716]/15 dark:border-white/15 rounded-[3px] bg-white/60 dark:bg-black/30">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                              aria-label={`Decrease quantity of ${item.name}`}
                              className="w-8 h-8 flex items-center justify-center text-[#171716] dark:text-[#F3F1EC] hover:bg-[#171716]/8 dark:hover:bg-white/10 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span
                              className="w-9 text-center text-xs font-mono font-medium text-[#171716] dark:text-[#F3F1EC] tabular-nums"
                              aria-label={`Quantity of ${item.name}`}
                            >
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                              disabled={item.quantity >= item.stock}
                              aria-label={`Increase quantity of ${item.name}`}
                              className="w-8 h-8 flex items-center justify-center text-[#171716] dark:text-[#F3F1EC] hover:bg-[#171716]/8 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="text-sm font-mono font-semibold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
                            {formatCurrency(item.lineTotalMinor, item.currency)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="p-6 border-t border-[#171716]/10 dark:border-white/10 bg-[#171716]/4 dark:bg-white/4 space-y-3">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-[#5C5851] dark:text-[#A4A097]">
                      <span>Subtotal</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(cart.totals.subtotalMinor, cart.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#5C5851] dark:text-[#A4A097]">
                      <span>Shipping</span>
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
                    <div className="flex justify-between pt-2.5 border-t border-[#171716]/10 dark:border-white/10 font-semibold text-base text-[#171716] dark:text-[#F3F1EC]">
                      <span>Total</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(cart.totals.totalMinor, cart.currency)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#5C5851] dark:text-[#A4A097]">
                    {user
                      ? 'Online payment and Cash on Delivery both available at checkout.'
                      : 'Your cart is saved automatically and will merge into your account when you sign in.'}
                  </p>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={handleCheckout}
                    className="w-full py-3.5 px-5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141416] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#6389FF] dark:hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{user ? 'Proceed to Checkout' : 'Sign In & Checkout'}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </motion.button>
                </div>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
