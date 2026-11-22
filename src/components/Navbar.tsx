import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Menu, Moon, Shield, ShoppingBag, Sun, User, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function KovaStepMark({ className = 'w-6 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 26"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <polygon points="1,7 16,1 22,1 22,11 37,5 43,5 43,19 28,25 22,25 22,15 7,21 1,21" />
    </svg>
  );
}

const MENU_CATEGORIES = [
  { label: 'Full Collection', to: '/' },
  { label: 'Lighting', to: '/?category=lighting' },
  { label: 'Tableware', to: '/?category=tableware' },
  { label: 'Desk Objects', to: '/?category=desk-objects' },
  { label: 'Carry & Soft', to: '/?category=carry-soft' },
];

const NAV_LINKS = [
  { label: 'Collection', to: '/' },
  { label: 'Lighting', to: '/?category=lighting' },
  { label: 'Tableware', to: '/?category=tableware' },
  { label: 'Desk', to: '/?category=desk-objects' },
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function Navbar() {
  const { path, navigate, user, cart, theme, toggleTheme } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const pathname = path.split('?')[0];

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleNav = (to: string, scrollToCatalogue = false) => {
    setMenuOpen(false);
    navigate(to);
    if (scrollToCatalogue) {
      window.setTimeout(() => {
        document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    }
  };

  return (
    <header className="fixed top-2.5 inset-x-0 z-40 px-2.5 sm:px-4 pointer-events-none">
      <div
        ref={menuContainerRef}
        className="pointer-events-auto max-w-[1440px] mx-auto relative"
      >
        <div className="glass-bar h-13 rounded-sm px-2.5 sm:px-4 flex items-center justify-between gap-4">
          {/* Left Zone: Brand Wordmark (desktop) / Menu toggle (mobile) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="studio-nav-menu"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden h-9 w-9 rounded-[3px] border border-[#171716]/15 dark:border-white/15 text-[#171716] dark:text-[#F3F1EC] inline-flex items-center justify-center hover:bg-[#171716]/8 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                handleNav('/');
              }}
              aria-label="KOVA Studio Home"
              className="inline-flex items-center gap-1 font-display text-lg sm:text-xl font-extrabold tracking-[-0.045em] text-[#171716] dark:text-[#F3F1EC] whitespace-nowrap shrink-0 hover:opacity-80 transition-opacity"
            >
              <span>KO</span>
              <KovaStepMark className="w-5 h-3.5 sm:w-6 sm:h-4 text-[#171716] dark:text-[#F3F1EC] -mx-0.5" />
              <span>VA</span>
            </a>
          </div>

          {/* Center Zone: Clean Single-Line Typographic Navigation Links */}
          <nav
            aria-label="Primary categories"
            className="hidden md:flex items-center gap-7 text-xs sm:text-sm font-medium"
          >
            {NAV_LINKS.map((item) => {
              const isActive =
                item.to === '/'
                  ? pathname === '/' && !path.includes('category=')
                  : path.includes(item.to.split('?')[1] || '');
              return (
                <a
                  key={item.label}
                  href={item.to}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNav(item.to, true);
                  }}
                  className={`relative py-1 whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'text-[#171716] dark:text-white'
                      : 'text-[#5C5851] dark:text-[#A4A097] hover:text-[#171716] dark:hover:text-white'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-underline"
                      transition={{ duration: 0.22, ease: EASE }}
                      className="absolute left-0 right-0 -bottom-0.5 h-[1.5px] bg-[#171716] dark:bg-[#F3F1EC]"
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Right Zone: Theme Switcher + Account + Cart */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              data-testid="theme-toggle"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
              className="h-9 w-9 rounded-[3px] border border-[#171716]/15 dark:border-white/15 text-[#171716] dark:text-[#F3F1EC] hover:bg-[#171716]/8 dark:hover:bg-white/10 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0 overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ y: 8, opacity: 0, rotate: -20 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: -8, opacity: 0, rotate: 20 }}
                  transition={{ duration: 0.18, ease: EASE }}
                  className="inline-flex items-center justify-center"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Moon className="w-4 h-4" aria-hidden="true" />
                  )}
                </motion.span>
              </AnimatePresence>
            </button>

            <a
              href={user ? '/account' : '/login'}
              onClick={(e) => {
                e.preventDefault();
                handleNav(user ? '/account' : '/login');
              }}
              className={`h-9 px-2.5 sm:px-3.5 rounded-[3px] border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                pathname.startsWith('/account') || pathname === '/login' || pathname === '/signup'
                  ? 'bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141416] border-transparent'
                  : 'border-[#171716]/15 dark:border-white/15 text-[#171716] dark:text-[#F3F1EC] hover:bg-[#171716]/8 dark:hover:bg-white/10'
              }`}
            >
              <User className="w-3.5 h-3.5 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{user ? 'Account' : 'Sign In'}</span>
              <span className="sm:hidden sr-only">{user ? 'Account' : 'Sign In'}</span>
            </a>

            <motion.a
              href="/cart"
              whileTap={{ scale: 0.96 }}
              onClick={(e) => {
                e.preventDefault();
                handleNav('/cart');
              }}
              data-testid="cart-trigger"
              aria-current={pathname === '/cart' ? 'page' : undefined}
              aria-label={`Open shopping cart with ${cart.itemCount} items`}
              className={`h-9 px-3 rounded-[3px] text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                pathname === '/cart'
                  ? 'bg-[#3B66F5] text-white'
                  : 'bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141416] hover:bg-[#3B66F5] dark:hover:bg-[#6389FF] dark:hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-mono tabular-nums">({cart.itemCount})</span>
            </motion.a>
          </div>
        </div>

        {/* Mobile Glass Navigation Menu Popover */}
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              id="studio-nav-menu"
              aria-label="Studio navigation menu"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="glass-bar mt-2 w-full sm:w-80 rounded-sm p-2.5 space-y-2.5"
            >
              <div className="px-2.5 pt-1 flex items-center justify-between text-xs text-[#5C5851] dark:text-[#A4A097]">
                <span className="font-medium">Browse Collection</span>
                <span className="font-mono text-[11px]">Home & Desk</span>
              </div>

              <div className="space-y-1">
                {MENU_CATEGORIES.map((item) => {
                  const isActive =
                    item.to === '/'
                      ? pathname === '/' && !path.includes('category=')
                      : path.includes(item.to.split('?')[1] || '');
                  return (
                    <a
                      key={item.label}
                      href={item.to}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNav(item.to, true);
                      }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-[3px] text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141416]'
                          : 'text-[#171716] dark:text-[#E5E2DC] hover:bg-[#171716]/8 dark:hover:bg-white/10'
                      }`}
                    >
                      <span>{item.label}</span>
                      <ArrowUpRight className="w-4 h-4 opacity-60" aria-hidden="true" />
                    </a>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-[#171716]/10 dark:border-white/10 space-y-1">
                <a
                  href={user ? '/account' : '/login'}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNav(user ? '/account' : '/login');
                  }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-[3px] text-sm font-medium text-[#171716] dark:text-[#E5E2DC] hover:bg-[#171716]/8 dark:hover:bg-white/10 transition-colors"
                >
                  <span>{user ? `Account (${user.name})` : 'Sign In / Create Account'}</span>
                  <ArrowUpRight className="w-4 h-4 opacity-60" aria-hidden="true" />
                </a>

                {user?.role === 'admin' && (
                  <a
                    href="/admin"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('/admin');
                    }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-[3px] text-sm font-semibold bg-[#3B66F5] text-white hover:bg-[#2F56DA] transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Shield className="w-4 h-4" aria-hidden="true" />
                      <span>Admin Console</span>
                    </span>
                    <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                  </a>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
