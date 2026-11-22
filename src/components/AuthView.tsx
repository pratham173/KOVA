import React, { useMemo, useState } from 'react';
import { ArrowRight, Chrome } from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';

interface AuthViewProps {
  mode: 'login' | 'signup';
}

const INPUT_CLASS =
  'w-full h-11 px-3.5 rounded-[3px] bg-white/85 dark:bg-white/[0.05] border border-[#171716]/15 dark:border-white/15 text-sm text-[#171716] dark:text-[#F3F1EC] placeholder:text-[#7B766C] dark:placeholder:text-[#8E8A81] focus:outline-none focus:border-[#3B66F5] transition-colors';

export function AuthView({ mode }: AuthViewProps) {
  const { path, navigate, cart, loginWithEmail, signupWithEmail, loginWithGoogle, showToast } =
    useStore();

  const nextUrl = useMemo(() => {
    const query = path.includes('?') ? path.split('?')[1] : '';
    const raw = new URLSearchParams(query).get('next');
    if (raw && raw.startsWith('/')) return raw;
    return '/account';
  }, [path]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup' && name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const signedIn =
        mode === 'signup'
          ? await signupWithEmail(name.trim(), email.trim(), password)
          : await loginWithEmail(email.trim(), password);

      showToast(
        signedIn.role !== 'admin' && cart.itemCount > 0
          ? `Welcome, ${signedIn.name}. Your bag items are ready.`
          : `Welcome back, ${signedIn.name}.`
      );
      navigate(signedIn.role === 'admin' && nextUrl === '/account' ? '/admin' : nextUrl);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const signedIn = await loginWithGoogle();
      showToast(`Signed in with Google as ${signedIn.name}.`);
      navigate(signedIn.role === 'admin' && nextUrl === '/account' ? '/admin' : nextUrl);
    } catch (err: any) {
      setError(err.message || 'Google Sign-In did not complete. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-26 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-lg mx-auto glass-surface rounded-sm p-8 sm:p-10"
      >
        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-wider text-[#6B665D] dark:text-[#9A968E] mb-2">
            KOVA Account
          </p>
          <h1 className="font-display text-3xl font-bold tracking-[-0.025em] text-[#171716] dark:text-[#F3F1EC]">
            {mode === 'signup' ? 'Create your account' : 'Sign in to KOVA'}
          </h1>
          <p className="text-sm text-[#5C5851] dark:text-[#A4A097] mt-2">
            {mode === 'signup'
              ? 'Save your cart across devices, complete checkout, and track studio orders.'
              : 'Access your saved cart, order receipts, and shipment updates.'}
          </p>
        </div>

        {cart.itemCount > 0 && (
          <div className="mb-6 rounded-sm bg-[#171716]/[0.05] dark:bg-white/[0.06] border border-[#171716]/10 dark:border-white/10 px-4 py-3 text-xs text-[#171716] dark:text-[#F3F1EC]">
            You currently have{' '}
            <span className="font-semibold">
              {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
            </span>{' '}
            in your guest cart. They will merge automatically into your account once signed in.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-[3px] bg-[#FEF2F2] dark:bg-[#B91C1C]/15 border border-[#B91C1C]/25 px-4 py-3 text-sm text-[#991B1B] dark:text-[#FCA5A5]"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || submitting}
          className="w-full h-12 px-4 rounded-[3px] bg-white/75 dark:bg-white/[0.05] border border-[#171716]/12 dark:border-white/15 text-sm font-medium text-[#171716] dark:text-[#F3F1EC] hover:bg-white dark:hover:bg-white/10 transition-colors inline-flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
        >
          <Chrome className="w-4 h-4" aria-hidden="true" />
          <span>{googleLoading ? 'Connecting to Google…' : 'Continue with Google'}</span>
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-[#6B675E] dark:text-[#9A968E]">
          <div className="flex-1 h-px bg-[#171716]/10 dark:bg-white/10" />
          <span>or continue with email</span>
          <div className="flex-1 h-px bg-[#171716]/10 dark:bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
              >
                Full Name
              </label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aarav Mehta"
                className={INPUT_CLASS}
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
            >
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
              className={INPUT_CLASS}
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={submitting || googleLoading}
            className="w-full h-12 px-5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>
              {submitting
                ? mode === 'signup'
                  ? 'Creating Account…'
                  : 'Signing In…'
                : mode === 'signup'
                  ? 'Create Account'
                  : 'Sign In'}
            </span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </motion.button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#171716]/10 dark:border-white/10 text-sm text-[#5C5851] dark:text-[#A4A097] flex items-center justify-between gap-4">
          <span>{mode === 'signup' ? 'Already have an account?' : 'New to KOVA?'}</span>
          <button
            type="button"
            onClick={() =>
              navigate(
                mode === 'signup'
                  ? `/login${nextUrl !== '/account' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`
                  : `/signup${nextUrl !== '/account' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`
              )
            }
            className="font-semibold text-[#171716] dark:text-[#F3F1EC] hover:text-[#3B66F5] dark:hover:text-[#7BA1FF] underline underline-offset-4 cursor-pointer"
          >
            {mode === 'signup' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </motion.div>
    </main>
  );
}
