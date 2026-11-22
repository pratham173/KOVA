import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  apiFetch,
  clearGuestItemsBackup,
  getOrCreateGuestToken,
  getSessionToken,
  loadGuestItemsBackup,
  saveGuestItemsBackup,
  setFirebaseIdToken,
  setSessionToken,
} from '../lib/api';
import type { CartState, UserProfile } from '../types/store';

const EMPTY_CART: CartState = {
  items: [],
  itemCount: 0,
  totals: {
    subtotalMinor: 0,
    shippingMinor: 0,
    taxMinor: 0,
    totalMinor: 0,
    freeShippingThresholdMinor: 500000,
    remainingForFreeShippingMinor: 500000,
  },
  currency: 'INR',
  adjustments: [],
};

export interface ToastNotification {
  id: number;
  message: string;
  tone: 'neutral' | 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

export type ThemeMode = 'light' | 'dark';

interface StoreContextValue {
  path: string;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (next: ThemeMode) => void;
  user: UserProfile | null;
  authReady: boolean;
  cart: CartState;
  cartLoading: boolean;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  toast: ToastNotification | null;
  showToast: (
    message: string,
    tone?: 'neutral' | 'success' | 'error',
    action?: { label: string; onClick: () => void }
  ) => void;
  dismissToast: () => void;
  refreshCart: () => Promise<void>;
  addToCart: (productId: number, quantity?: number, productName?: string) => Promise<boolean>;
  updateCartQuantity: (productId: number, quantity: number) => Promise<void>;
  removeFromCart: (productId: number) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<UserProfile>;
  signupWithEmail: (name: string, email: string, password: string) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<UserProfile>;
  logout: () => Promise<void>;
  catalogVersion: number;
  bumpCatalogVersion: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState<string>(
    () => window.location.pathname + window.location.search
  );
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'dark';
    }
    return 'light';
  });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const googleSignInPendingRef = useRef(false);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    try {
      localStorage.setItem('kova_theme', next);
    } catch {
      // ignore storage issues
    }
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((curr) => {
      const next: ThemeMode = curr === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('kova_theme', next);
      } catch {
        // ignore storage issues
      }
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  const showToast = useCallback(
    (
      message: string,
      tone: 'neutral' | 'success' | 'error' = 'neutral',
      action?: { label: string; onClick: () => void }
    ) => {
      setToast({
        id: Date.now(),
        message,
        tone,
        actionLabel: action?.label,
        onAction: action?.onClick,
      });
    },
    []
  );

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (opts?.replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }
    setPath(to);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const syncCartState = useCallback((nextCart: CartState, isSignedIn: boolean) => {
    setCart(nextCart);
    if (!isSignedIn) {
      saveGuestItemsBackup(
        nextCart.items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      );
    } else {
      clearGuestItemsBackup();
    }
  }, []);

  const refreshCart = useCallback(async () => {
    setCartLoading(true);
    try {
      const data = await apiFetch<{ cart: CartState }>('/api/cart');
      syncCartState(data.cart, Boolean(user));
    } catch (err) {
      console.error('Failed to refresh cart:', err);
    } finally {
      setCartLoading(false);
    }
  }, [syncCartState, user]);

  // Bootstrap authentication: checks existing email session OR Firebase Auth state
  useEffect(() => {
    let active = true;

    async function hydrateEmailSession() {
      const existingSession = getSessionToken();
      if (!existingSession) return false;
      try {
        const res = await apiFetch<{ user: UserProfile }>('/api/auth/me', {}, existingSession);
        if (active) {
          setUser(res.user);
        }
        return true;
      } catch {
        setSessionToken(null);
        return false;
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Avoid firing a duplicate /api/auth/google merge while loginWithGoogle() is actively syncing
        if (googleSignInPendingRef.current) {
          return;
        }
        try {
          const idToken = await fbUser.getIdToken();
          setFirebaseIdToken(idToken);
          const res = await apiFetch<{ user: UserProfile; cart: CartState }>(
            '/api/auth/google',
            {
              method: 'POST',
              body: JSON.stringify({
                guestToken: getOrCreateGuestToken(),
                guestItems: loadGuestItemsBackup(),
              }),
            },
            idToken
          );
          if (active) {
            setUser(res.user);
            syncCartState(res.cart, true);
            setCartLoading(false);
            setAuthReady(true);
          }
          return;
        } catch (err) {
          console.error('Firebase session sync failed:', err);
          setFirebaseIdToken(null);
        }
      }

      const restoredEmail = await hydrateEmailSession();
      if (active) {
        try {
          const cartData = await apiFetch<{ cart: CartState }>('/api/cart');
          syncCartState(cartData.cart, restoredEmail);
        } catch {
          // ignore
        } finally {
          setCartLoading(false);
          setAuthReady(true);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [syncCartState]);

  const addToCart = useCallback(
    async (productId: number, quantity = 1, productName?: string): Promise<boolean> => {
      try {
        const data = await apiFetch<{ cart: CartState }>('/api/cart/items', {
          method: 'POST',
          body: JSON.stringify({ productId, quantity }),
        });
        syncCartState(data.cart, Boolean(user));
        const label = productName
          ? `${productName} added to cart successfully.`
          : 'Added to cart successfully.';
        showToast(label, 'success', {
          label: 'View Cart',
          onClick: () => setCartOpen(true),
        });
        return true;
      } catch (err: any) {
        showToast(err.message || 'Could not add item to cart.', 'error');
        return false;
      }
    },
    [showToast, syncCartState, user]
  );

  const updateCartQuantity = useCallback(
    async (productId: number, quantity: number) => {
      try {
        const data = await apiFetch<{ cart: CartState }>(`/api/cart/items/${productId}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity }),
        });
        syncCartState(data.cart, Boolean(user));
      } catch (err: any) {
        showToast(err.message || 'Could not update item quantity.', 'error');
      }
    },
    [showToast, syncCartState, user]
  );

  const removeFromCart = useCallback(
    async (productId: number) => {
      try {
        const data = await apiFetch<{ cart: CartState }>(`/api/cart/items/${productId}`, {
          method: 'DELETE',
        });
        syncCartState(data.cart, Boolean(user));
      } catch (err: any) {
        showToast(err.message || 'Could not remove item.', 'error');
      }
    },
    [showToast, syncCartState, user]
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<UserProfile> => {
      const res = await apiFetch<{ token: string; user: UserProfile; cart: CartState }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            guestToken: getOrCreateGuestToken(),
            guestItems: loadGuestItemsBackup(),
          }),
        }
      );
      setFirebaseIdToken(null);
      setSessionToken(res.token);
      setUser(res.user);
      syncCartState(res.cart, true);
      return res.user;
    },
    [syncCartState]
  );

  const signupWithEmail = useCallback(
    async (name: string, email: string, password: string): Promise<UserProfile> => {
      const res = await apiFetch<{ token: string; user: UserProfile; cart: CartState }>(
        '/api/auth/signup',
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            password,
            guestToken: getOrCreateGuestToken(),
            guestItems: loadGuestItemsBackup(),
          }),
        }
      );
      setFirebaseIdToken(null);
      setSessionToken(res.token);
      setUser(res.user);
      syncCartState(res.cart, true);
      return res.user;
    },
    [syncCartState]
  );

  const loginWithGoogle = useCallback(async (): Promise<UserProfile> => {
    googleSignInPendingRef.current = true;
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await credential.user.getIdToken();
      setSessionToken(null);
      setFirebaseIdToken(idToken);

      const res = await apiFetch<{ user: UserProfile; cart: CartState }>(
        '/api/auth/google',
        {
          method: 'POST',
          body: JSON.stringify({
            guestToken: getOrCreateGuestToken(),
            guestItems: loadGuestItemsBackup(),
          }),
        },
        idToken
      );
      setUser(res.user);
      syncCartState(res.cart, true);
      setCartLoading(false);
      setAuthReady(true);
      return res.user;
    } finally {
      googleSignInPendingRef.current = false;
    }
  }, [syncCartState]);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setFirebaseIdToken(null);
    setSessionToken(null);
    setUser(null);
    const cartData = await apiFetch<{ cart: CartState }>('/api/cart', {}, null).catch(
      () => ({ cart: EMPTY_CART })
    );
    syncCartState(cartData.cart, false);
    showToast('Signed out of KOVA.');
    navigate('/');
  }, [navigate, showToast, syncCartState]);

  const bumpCatalogVersion = useCallback(() => {
    setCatalogVersion((v) => v + 1);
  }, []);

  return (
    <StoreContext.Provider
      value={{
        path,
        navigate,
        theme,
        toggleTheme,
        setTheme,
        user,
        authReady,
        cart,
        cartLoading,
        cartOpen,
        setCartOpen,
        toast,
        showToast,
        dismissToast,
        refreshCart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        logout,
        catalogVersion,
        bumpCatalogVersion,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return ctx;
}
