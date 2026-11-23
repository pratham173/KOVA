import { Suspense, lazy } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Check, AlertTriangle, X } from 'lucide-react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';

const CartView = lazy(() =>
  import('./components/CartView').then((m) => ({ default: m.CartView }))
);
const ProductDetailView = lazy(() =>
  import('./components/ProductDetailView').then((m) => ({ default: m.ProductDetailView }))
);
const AuthView = lazy(() =>
  import('./components/AuthView').then((m) => ({ default: m.AuthView }))
);
const CheckoutView = lazy(() =>
  import('./components/CheckoutView').then((m) => ({ default: m.CheckoutView }))
);
const AccountView = lazy(() =>
  import('./components/AccountView').then((m) => ({ default: m.AccountView }))
);
const AdminView = lazy(() =>
  import('./components/AdminView').then((m) => ({ default: m.AdminView }))
);

const PAGE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function RouteFallback() {
  return (
    <div
      className="min-h-[60vh] flex items-center justify-center pt-24 px-4"
      aria-busy="true"
      aria-label="Loading view"
    >
      <div className="w-full max-w-[1440px] space-y-5">
        <div className="h-7 w-40 rounded-sm bg-black/8 dark:bg-white/10 animate-pulse" />
        <div className="h-64 rounded-sm bg-black/5 dark:bg-white/5 animate-pulse" />
      </div>
    </div>
  );
}

function AppRouter() {
  const { path, toast, dismissToast } = useStore();
  const pathname = path.split('?')[0].replace(/\/+$/, '') || '/';

  let view = <HomeView />;
  let routeKey = pathname;

  if (pathname.startsWith('/product/')) {
    const slug = decodeURIComponent(pathname.slice('/product/'.length));
    view = <ProductDetailView slug={slug} />;
    routeKey = `/product/${slug}`;
  } else if (pathname === '/login') {
    view = <AuthView mode="login" />;
  } else if (pathname === '/signup') {
    view = <AuthView mode="signup" />;
  } else if (pathname === '/cart') {
    view = <CartView />;
  } else if (pathname === '/checkout') {
    view = <CheckoutView />;
  } else if (pathname.startsWith('/account/orders/')) {
    const orderNumber = decodeURIComponent(pathname.slice('/account/orders/'.length));
    view = <AccountView orderNumber={orderNumber} />;
    routeKey = `/account/orders/${orderNumber}`;
  } else if (pathname === '/account') {
    view = <AccountView />;
  } else if (pathname === '/admin') {
    view = <AdminView />;
  }

  return (
    <div className="min-h-screen text-[#171716] dark:text-[#F3F1EC] selection:bg-[#3B66F5] selection:text-white transition-colors duration-200">
      <Navbar />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={routeKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.26, ease: PAGE_EASE }}
        >
          <Suspense fallback={<RouteFallback />}>{view}</Suspense>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            aria-live="polite"
            data-testid="toast-notification"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: PAGE_EASE }}
            className={`fixed bottom-5 right-5 z-50 max-w-md pl-3.5 pr-2.5 py-2.5 rounded-sm text-sm font-medium shadow-2xl border flex items-center gap-3 backdrop-blur-xl ${
              toast.tone === 'error'
                ? 'bg-[#991B1B]/95 text-white border-[#F87171]/35'
                : 'bg-[#161618]/88 dark:bg-[#232327]/90 text-[#FAF9F6] border-white/15'
            }`}
          >
            {toast.tone === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-white shrink-0" aria-hidden="true" />
            ) : toast.tone === 'success' ? (
              <span className="w-4 h-4 bg-[#22C55E] text-[#0B1F11] rounded-[2px] flex items-center justify-center shrink-0">
                <Check className="w-3 h-3" aria-hidden="true" />
              </span>
            ) : null}

            <span className="leading-snug">{toast.message}</span>

            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                onClick={() => {
                  const action = toast.onAction;
                  dismissToast();
                  action?.();
                }}
                className="ml-1 px-2.5 py-1 rounded-[2px] bg-white text-[#171716] text-xs font-semibold hover:bg-[#3B66F5] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {toast.actionLabel}
              </button>
            )}

            <button
              type="button"
              onClick={dismissToast}
              aria-label="Dismiss notification"
              className="p-1 rounded-[2px] text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <AppRouter />
      </StoreProvider>
    </MotionConfig>
  );
}
