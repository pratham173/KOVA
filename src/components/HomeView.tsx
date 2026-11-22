import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CornerDownLeft,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatCurrency } from '../lib/commerce';
import type { Category, Product } from '../types/store';
import { ProductImage } from './ProductImage';

const HERO_IMAGE = '/src/assets/images/hero_kova_collection_1795282144091.jpg';
const ARC_LAMP_IMAGE = '/src/assets/images/product_arc_lamp_1795282162126.jpg';
const CARAFE_IMAGE = '/src/assets/images/product_stoneware_carafe_1795282144095.jpg';
const TRAY_IMAGE = '/src/assets/images/product_monolith_tray_1795282143935.jpg';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const CRAFT_LEDGER = [
  {
    index: '01',
    title: 'Spun 2mm Aluminum',
    detail: 'Formed on manual steel mandrels in Bengaluru with powder-coated matte finishes.',
  },
  {
    index: '02',
    title: '1,240°C Kiln Stoneware',
    detail: 'High-fired speckled clay bodies glazed by hand in small Jaipur production runs.',
  },
  {
    index: '03',
    title: 'Cash on Delivery & Online Pay',
    detail: 'Pay by card, UPI, or settle in cash at your doorstep with instant receipt tracking.',
  },
  {
    index: '04',
    title: '48-Hour Plastic-Free Dispatch',
    detail: 'Packed in custom molded fiber pulp with complimentary courier delivery over ₹5,000.',
  },
];

function SplitActionButton({
  label,
  onClick,
  variant = 'frosted',
  type = 'button',
  disabled = false,
}: {
  label: string;
  onClick?: () => void;
  variant?: 'frosted' | 'dark' | 'light';
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  const styles =
    variant === 'dark'
      ? 'bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141416] hover:bg-[#3B66F5] dark:hover:bg-[#6389FF] dark:hover:text-white border-transparent'
      : variant === 'light'
        ? 'bg-[#EAE5DC] text-[#171716] hover:bg-white border-[#EAE5DC]'
        : 'glass-overlay text-white hover:bg-[#171716]/80';

  const dividerColor =
    variant === 'light'
      ? 'border-[#171716]/18'
      : variant === 'dark'
        ? 'border-white/15 dark:border-[#141416]/15'
        : 'border-white/22';

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className={`inline-flex items-center justify-between shrink-0 h-11 rounded-[3px] border text-xs sm:text-sm font-medium transition-colors overflow-hidden cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${styles}`}
    >
      <span className="flex-1 px-4 sm:px-5 whitespace-nowrap text-center">{label}</span>
      <span
        className={`w-10 h-full border-l flex items-center justify-center shrink-0 ${dividerColor}`}
        aria-hidden="true"
      >
        <CornerDownLeft className="w-3.5 h-3.5" />
      </span>
    </motion.button>
  );
}

export function HomeView() {
  const { path, navigate, addToCart, catalogVersion, showToast } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [justAddedId, setJustAddedId] = useState<number | null>(null);

  // Database-backed footer newsletter state
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterFeedback, setNewsletterFeedback] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  const initialCategory = useMemo(() => {
    const query = path.includes('?') ? path.split('?')[1] : '';
    const params = new URLSearchParams(query);
    return params.get('category') || 'all';
  }, [path]);

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState('featured');

  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    let active = true;
    apiFetch<{ categories: Category[] }>('/api/categories')
      .then((res) => {
        if (active) setCategories(res.categories);
      })
      .catch(() => {
        // Handled with main catalogue error
      });
    return () => {
      active = false;
    };
  }, [catalogVersion]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (selectedCategory && selectedCategory !== 'all') {
      params.set('category', selectedCategory);
    }
    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    }
    if (inStockOnly) {
      params.set('inStock', 'true');
    }
    if (maxPrice) {
      params.set('maxPrice', maxPrice);
    }
    if (sortBy) {
      params.set('sort', sortBy);
    }

    const timer = window.setTimeout(() => {
      apiFetch<{ products: Product[] }>(`/api/products?${params.toString()}`)
        .then((res) => {
          if (active) {
            setProducts(res.products);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (active) {
            setError(err.message || 'Unable to load products right now.');
            setLoading(false);
          }
        });
    }, 90);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [selectedCategory, searchQuery, inStockOnly, maxPrice, sortBy, catalogVersion]);

  const handleQuickAdd = async (product: Product) => {
    setAddingId(product.id);
    const ok = await addToCart(product.id, 1, product.name);
    setAddingId(null);
    if (ok) {
      setJustAddedId(product.id);
      window.setTimeout(() => {
        setJustAddedId((curr) => (curr === product.id ? null : curr));
      }, 1800);
    }
  };

  const resetFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
    setInStockOnly(false);
    setMaxPrice('');
    setSortBy('featured');
    navigate('/', { replace: true });
  };

  const jumpToCategory = (slug: string) => {
    setSelectedCategory(slug);
    navigate(`/?category=${slug}`, { replace: true });
    window.setTimeout(() => {
      document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewsletterFeedback(null);
    const trimmed = newsletterEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setNewsletterFeedback({
        kind: 'error',
        message: 'Please enter a valid email address.',
      });
      return;
    }

    setNewsletterSubmitting(true);
    try {
      const res = await apiFetch<{
        subscribed: boolean;
        alreadySubscribed: boolean;
        message: string;
      }>('/api/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: trimmed, source: 'footer' }),
      });

      setNewsletterEmail('');
      setNewsletterFeedback({
        kind: 'success',
        message: res.message,
      });
      showToast(res.message, 'success');
    } catch (err: any) {
      const msg = err.message || 'Could not save your subscription right now.';
      setNewsletterFeedback({ kind: 'error', message: msg });
      showToast(msg, 'error');
    } finally {
      setNewsletterSubmitting(false);
    }
  };

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    searchQuery.trim() !== '' ||
    inStockOnly ||
    maxPrice !== '' ||
    sortBy !== 'featured';

  return (
    <div className="min-h-screen flex flex-col">
      {/* SECTION 1: Architectural Studio Hero with Optical Glassmorphism */}
      <section className="px-2.5 sm:px-4 pt-18 sm:pt-19 pb-4">
        <div className="max-w-[1440px] mx-auto relative rounded-sm overflow-hidden bg-[#161615] min-h-[540px] sm:min-h-[620px] lg:min-h-[82vh] flex flex-col justify-end shadow-xl">
          <motion.div
            initial={{ scale: 1.05, opacity: 0.85 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="absolute inset-0"
          >
            <ProductImage
              src={HERO_IMAGE}
              alt="KOVA studio collection of spun aluminum lamps, fluted stoneware carafe, and milled tray"
              className="w-full h-full object-cover"
            />
          </motion.div>

          {/* Measured contrast scrim for WCAG AA legibility across media luminance */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111110]/90 via-[#111110]/35 to-[#111110]/15" />

          <div className="relative z-10 p-6 sm:p-10 lg:p-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            {/* Bottom-Left Editorial Headline + Frosted Glass CTA */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1, ease: EASE }}
              className="max-w-2xl space-y-5"
            >
              <p className="text-xs sm:text-sm font-medium text-white/80 tracking-normal">
                Bengaluru & Jaipur · Small-Batch Home & Desk Objects
              </p>

              <h1 className="font-display text-[clamp(2.15rem,3.8vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white">
                Spun aluminum lamps, high-fired stoneware, and milled desk goods.
              </h1>

              <div className="pt-1 flex flex-wrap items-center gap-4">
                <SplitActionButton
                  label="Explore Collection"
                  variant="frosted"
                  onClick={() => {
                    document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                />
                <span className="text-xs text-white/75">
                  Complimentary courier over ₹5,000 · Cash on Delivery available
                </span>
              </div>
            </motion.div>

            {/* Bottom-Right Frosted Glass Featured Piece Card */}
            <motion.a
              href="/product/arc-desk-lamp"
              onClick={(e) => {
                e.preventDefault();
                navigate('/product/arc-desk-lamp');
              }}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.22, ease: EASE }}
              whileHover={{ y: -3 }}
              className="group glass-overlay-light self-start lg:self-end rounded-sm p-2.5 pr-4 flex items-center gap-3.5 w-full sm:w-auto sm:min-w-[310px] transition-shadow"
            >
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-[2px] overflow-hidden bg-[#EAE5DC] dark:bg-[#232327] shrink-0">
                <ProductImage
                  src={ARC_LAMP_IMAGE}
                  alt="Arc Desk Lamp"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-[#5C5851] dark:text-[#A4A097]">
                    Lighting · Signature
                  </p>
                  <ArrowUpRight
                    className="w-3.5 h-3.5 text-[#5C5851] dark:text-[#A4A097] group-hover:text-[#3B66F5] dark:group-hover:text-[#6389FF] transition-colors shrink-0"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-0.5 font-display font-semibold text-sm sm:text-base text-[#171716] dark:text-[#F3F1EC] leading-tight">
                  Arc Desk Lamp
                </p>
                <p className="mt-1 font-mono text-xs sm:text-sm font-medium text-[#171716] dark:text-[#E5E2DC] tabular-nums">
                  ₹6,800
                </p>
              </div>
            </motion.a>
          </div>
        </div>
      </section>

      {/* SECTION 2: Current Collection — Glass Filter Bar & Uniform 4:3 Product Grid */}
      <section
        id="catalogue"
        className="max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-16 sm:pb-22"
      >
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-7"
        >
          <div>
            <p className="text-xs font-medium text-[#5C5851] dark:text-[#A4A097]">
              Studio Catalogue
            </p>
            <h2 className="mt-1 font-display text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[#171716] dark:text-[#F3F1EC]">
              Current Collection
            </h2>
          </div>

          <p className="text-xs font-mono text-[#5C5851] dark:text-[#A4A097] tabular-nums">
            {loading
              ? 'Loading collection…'
              : `${products.length} ${products.length === 1 ? 'piece' : 'pieces'} available`}
          </p>
        </motion.div>

        {/* Glassmorphic Filter, Search & Sort Bar */}
        <div className="glass-surface rounded-sm p-3.5 sm:p-4 mb-8 space-y-3.5">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="tablist"
            aria-label="Product categories"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'all'}
              onClick={() => {
                setSelectedCategory('all');
                navigate('/', { replace: true });
              }}
              className={`px-3.5 py-2 rounded-[3px] text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141416]'
                  : 'bg-[#171716]/6 dark:bg-white/6 text-[#4C4841] dark:text-[#B5B0A6] hover:text-[#171716] dark:hover:text-white hover:bg-[#171716]/12 dark:hover:bg-white/12'
              }`}
            >
              All Pieces
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selectedCategory === cat.slug}
                onClick={() => {
                  setSelectedCategory(cat.slug);
                  navigate(`/?category=${cat.slug}`, { replace: true });
                }}
                className={`px-3.5 py-2 rounded-[3px] text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat.slug
                    ? 'bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141416]'
                    : 'bg-[#171716]/6 dark:bg-white/6 text-[#4C4841] dark:text-[#B5B0A6] hover:text-[#171716] dark:hover:text-white hover:bg-[#171716]/12 dark:hover:bg-white/12'
                }`}
              >
                {cat.name}
                <span className="ml-1.5 text-xs opacity-65 tabular-nums">({cat.productCount})</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-3 border-t border-[#171716]/8 dark:border-white/10">
            <div className="md:col-span-5 relative">
              <label htmlFor="catalogue-search" className="sr-only">
                Search products
              </label>
              <Search
                className="w-4 h-4 text-[#6B665D] dark:text-[#9A958C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="catalogue-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by lamp, vessel, material, or SKU…"
                className="w-full h-10 pl-10 pr-4 rounded-[3px] bg-white/75 dark:bg-[#111113]/80 border border-[#171716]/12 dark:border-white/12 text-sm text-[#171716] dark:text-[#F3F1EC] placeholder:text-[#7B766C] dark:placeholder:text-[#7E7A72] focus:bg-white dark:focus:bg-[#161619] focus:border-[#3B66F5] transition-colors"
              />
            </div>

            <div className="md:col-span-3 relative">
              <label htmlFor="catalogue-price" className="sr-only">
                Maximum price filter
              </label>
              <select
                id="catalogue-price"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full h-10 pl-3.5 pr-9 rounded-[3px] bg-white/75 dark:bg-[#111113]/80 border border-[#171716]/12 dark:border-white/12 text-sm text-[#171716] dark:text-[#F3F1EC] appearance-none cursor-pointer"
              >
                <option value="">Any price</option>
                <option value="2500">Under ₹2,500</option>
                <option value="4000">Under ₹4,000</option>
                <option value="6000">Under ₹6,000</option>
              </select>
              <ChevronDown
                className="w-4 h-4 text-[#6B665D] dark:text-[#9A958C] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
            </div>

            <div className="md:col-span-2 relative">
              <label htmlFor="catalogue-sort" className="sr-only">
                Sort products
              </label>
              <select
                id="catalogue-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-10 pl-3.5 pr-9 rounded-[3px] bg-white/75 dark:bg-[#111113]/80 border border-[#171716]/12 dark:border-white/12 text-sm text-[#171716] dark:text-[#F3F1EC] appearance-none cursor-pointer"
              >
                <option value="featured">Featured</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="newest">Newest</option>
              </select>
              <ChevronDown
                className="w-4 h-4 text-[#6B665D] dark:text-[#9A958C] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-3 px-1">
              <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#171716] dark:text-[#E5E2DC] cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="w-4 h-4 rounded-[2px] accent-[#3B66F5]"
                />
                <span>In stock</span>
              </label>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  aria-label="Reset all filters"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#3B66F5] dark:text-[#6389FF] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div
            role="alert"
            className="glass-surface rounded-sm border-[#B91C1C]/30 p-8 text-center"
          >
            <p className="font-display text-lg font-semibold text-[#171716] dark:text-[#F3F1EC] mb-1">
              Could not load the catalogue
            </p>
            <p className="text-sm text-[#5C5851] dark:text-[#A4A097] mb-5">{error}</p>
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-2 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141416] text-sm font-medium hover:bg-[#3B66F5] cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {!error && loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="glass-surface rounded-sm overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-[#D4CEC3] dark:bg-[#232327]" />
                <div className="p-4 space-y-2.5">
                  <div className="h-3 w-24 bg-[#DDD8CE] dark:bg-[#2A2A30]" />
                  <div className="h-4 w-36 bg-[#DDD8CE] dark:bg-[#2A2A30]" />
                  <div className="h-8 w-full bg-[#E5E0D6] dark:bg-[#232327] mt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!error && !loading && products.length === 0 && (
          <div className="glass-surface rounded-sm p-12 text-center">
            <SlidersHorizontal
              className="w-7 h-7 mx-auto text-[#6B665D] dark:text-[#9A958C] mb-3"
              aria-hidden="true"
            />
            <h3 className="font-display text-xl font-semibold text-[#171716] dark:text-[#F3F1EC]">
              No pieces match your filters
            </h3>
            <p className="text-sm text-[#5C5851] dark:text-[#A4A097] mt-1.5 mb-6">
              Try broadening your search terms, price limit, or category selection.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="px-5 py-2.5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141416] text-sm font-medium hover:bg-[#3B66F5] cursor-pointer"
            >
              Show Full Collection
            </button>
          </div>
        )}

        {/* Refined Product Grid — Uniform 4:3 Photography & Clean Unboxed Metadata */}
        {!error && !loading && products.length > 0 && (
          <div
            data-testid="product-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {products.map((product, index) => {
              const outOfStock = product.stock <= 0;
              const isJustAdded = justAddedId === product.id;

              const statusNote = outOfStock
                ? 'Sold Out'
                : product.stock <= 5
                  ? `Only ${product.stock} left`
                  : product.isFeatured
                    ? 'Signature'
                    : null;

              return (
                <motion.article
                  key={product.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.36,
                    delay: Math.min(index * 0.04, 0.24),
                    ease: EASE,
                  }}
                  whileHover={{ y: -3 }}
                  className="group glass-surface rounded-sm overflow-hidden flex flex-col transition-shadow duration-200"
                >
                  <a
                    href={`/product/${product.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/product/${product.slug}`);
                    }}
                    className="block aspect-[4/3] overflow-hidden bg-[#EAE5DC] dark:bg-[#1E1E22] relative"
                  >
                    <ProductImage
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    />
                  </a>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-[#5C5851] dark:text-[#A4A097]">
                        <span>{product.categoryName || 'Home & Desk'}</span>
                        {statusNote && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                outOfStock
                                  ? 'text-[#B91C1C] dark:text-[#F87171] font-medium'
                                  : product.stock <= 5
                                    ? 'text-[#B45309] dark:text-[#FBBF24] font-medium'
                                    : 'text-[#3B66F5] dark:text-[#7BA1FF] font-medium'
                              }
                            >
                              {statusNote}
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="mt-1 font-display text-base font-semibold text-[#171716] dark:text-[#F3F1EC] leading-snug">
                        <a
                          href={`/product/${product.slug}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/product/${product.slug}`);
                          }}
                          className="hover:text-[#3B66F5] dark:hover:text-[#7BA1FF] transition-colors"
                        >
                          {product.name}
                        </a>
                      </h3>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#171716]/8 dark:border-white/8">
                      <span className="font-mono text-[15px] font-semibold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
                        {formatCurrency(product.priceMinor, product.currency)}
                      </span>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        disabled={outOfStock || addingId === product.id}
                        onClick={() => handleQuickAdd(product)}
                        aria-label={`Add ${product.name} to cart`}
                        className={`px-3 py-1.5 rounded-[3px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed ${
                          isJustAdded
                            ? 'bg-[#166534] text-white'
                            : 'bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141416] hover:bg-[#3B66F5] dark:hover:bg-[#6389FF] dark:hover:text-white disabled:bg-[#D4CEC3] dark:disabled:bg-[#2B2B30] disabled:text-[#6B665D]'
                        }`}
                      >
                        {isJustAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Added</span>
                          </>
                        ) : outOfStock ? (
                          <span>Sold Out</span>
                        ) : addingId === product.id ? (
                          <span>Adding…</span>
                        ) : (
                          <span>Add to Cart</span>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 3: Workshops & Material Ledger (Replaces repetitive filler sections) */}
      <section className="max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 pb-20 sm:pb-26 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"
        >
          <div>
            <p className="text-xs font-medium text-[#5C5851] dark:text-[#A4A097]">
              Atelier & Provenance
            </p>
            <h2 className="mt-1 font-display text-2xl sm:text-4xl font-semibold tracking-[-0.03em] text-[#171716] dark:text-[#F3F1EC]">
              Built in Bengaluru and Jaipur.
            </h2>
          </div>
          <p className="text-sm text-[#5C5851] dark:text-[#A4A097] max-w-md">
            Two partner workshops dedicated to spun aluminum lighting, milled hardware, and
            high-fired stoneware vessels.
          </p>
        </motion.div>

        {/* Two Clean Architectural Workshop Panels with Frosted Glass Captions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <motion.button
            type="button"
            onClick={() => jumpToCategory('lighting')}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5, ease: EASE }}
            whileHover={{ y: -2 }}
            className="lg:col-span-7 group relative rounded-sm overflow-hidden min-h-[380px] sm:min-h-[450px] text-left cursor-pointer bg-[#1B1B19]"
          >
            <ProductImage
              src={ARC_LAMP_IMAGE}
              alt="Bengaluru Metalwork Foundry lighting collection"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#121211]/85 via-[#121211]/20 to-transparent" />

            <div className="relative z-10 h-full p-5 sm:p-7 flex flex-col justify-end">
              <div className="glass-overlay rounded-sm p-5 max-w-md flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-white/75">01. Bengaluru Metalwork Foundry</p>
                  <h3 className="mt-1 font-display text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-white">
                    Lighting & Milled Alloy
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-white/80">
                    Spun 2mm aluminum shades paired with weighted steel columns and CNC-milled desk
                    hardware.
                  </p>
                </div>
                <ArrowRight
                  className="w-5 h-5 text-white shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </div>
            </div>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => jumpToCategory('tableware')}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5, delay: 0.08, ease: EASE }}
            whileHover={{ y: -2 }}
            className="lg:col-span-5 group relative rounded-sm overflow-hidden min-h-[380px] sm:min-h-[450px] text-left cursor-pointer bg-[#1B1B19]"
          >
            <ProductImage
              src={CARAFE_IMAGE}
              alt="Jaipur Stoneware Kiln ceramics collection"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#121211]/85 via-[#121211]/20 to-transparent" />

            <div className="relative z-10 h-full p-5 sm:p-7 flex flex-col justify-end">
              <div className="glass-overlay rounded-sm p-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-white/75">02. Jaipur Stoneware Kiln</p>
                  <h3 className="mt-1 font-display text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-white">
                    High-Fired Ceramics
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-white/80">
                    Fluted carafes and raw speckled stoneware fired at 1,240°C for daily table use.
                  </p>
                </div>
                <ArrowRight
                  className="w-5 h-5 text-white shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </div>
            </div>
          </motion.button>
        </div>

        {/* Refined 4-Column Glassmorphic Material & Service Ledger */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CRAFT_LEDGER.map((item, idx) => (
            <motion.div
              key={item.index}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.4, delay: idx * 0.05, ease: EASE }}
              className="glass-surface rounded-sm p-5 sm:p-6 flex flex-col justify-between gap-4"
            >
              <span className="font-mono text-xs text-[#5C5851] dark:text-[#8E8A82]">
                {item.index}
              </span>
              <div>
                <h3 className="font-display text-base font-semibold text-[#171716] dark:text-[#F3F1EC]">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-[#5C5851] dark:text-[#A4A097] leading-relaxed">
                  {item.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Desk Objects Feature Banner — Subtle Glass Strip */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="glass-surface rounded-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch"
        >
          <div className="lg:col-span-5 aspect-[16/10] lg:aspect-auto bg-[#EAE5DC] dark:bg-[#1E1E22] overflow-hidden">
            <ProductImage
              src={TRAY_IMAGE}
              alt="Monolith milled aluminum valet tray"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center gap-4">
            <p className="text-xs font-medium text-[#5C5851] dark:text-[#A4A097]">
              Desk Architecture · Milled 6061 Aluminum & Solid Brass
            </p>
            <h3 className="font-display text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-[#171716] dark:text-[#F3F1EC]">
              Objects with quiet weight for everyday desks and tables.
            </h3>
            <p className="text-sm text-[#5C5851] dark:text-[#A4A097] max-w-xl leading-relaxed">
              Every piece is finished without chrome plating or synthetic lacquer so natural brass,
              raw stoneware, and bead-blasted aluminum wear gracefully over years of daily use.
            </p>
            <div className="pt-2">
              <SplitActionButton
                label="Shop Desk Objects"
                variant="dark"
                onClick={() => jumpToCategory('desk-objects')}
              />
            </div>
          </div>
        </motion.div>
      </section>

      {/* SECTION 4: Monumental Architectural Footer + Database-Backed Glass Newsletter */}
      <footer className="bg-[#151517] text-[#F3F1EC] pt-18 sm:pt-22 overflow-hidden border-t border-white/8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <p className="font-display text-2xl sm:text-4xl font-medium leading-[1.24] tracking-[-0.025em] text-[#F3F1EC]">
              Small-batch lighting, stoneware, and milled hardware crafted with lasting weight for
              contemporary interiors.
            </p>
          </div>

          {/* Dedicated Database-Backed Frosted Glass Newsletter Signup */}
          <motion.section
            aria-labelledby="footer-newsletter-heading"
            data-testid="footer-newsletter"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="glass-dark-panel mt-12 sm:mt-14 max-w-3xl mx-auto rounded-sm p-6 sm:p-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-6 space-y-1.5 text-left">
                <p className="text-xs font-medium text-[#A4A097]">New Collection Dispatch</p>
                <h2
                  id="footer-newsletter-heading"
                  className="font-display text-xl sm:text-2xl font-semibold text-white tracking-[-0.02em]"
                >
                  Hear first when new editions leave the workshop.
                </h2>
                <p className="text-xs sm:text-sm text-[#B8B3AA] leading-relaxed">
                  Join our studio list for upcoming lighting releases, stoneware kiln runs, and
                  restock notices.
                </p>
              </div>

              <div className="md:col-span-6">
                <form onSubmit={handleNewsletterSubmit} noValidate className="space-y-2.5">
                  <label htmlFor="footer-newsletter-email" className="sr-only">
                    Email address for new collection updates
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      id="footer-newsletter-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full sm:flex-1 sm:min-w-0 h-11 px-3.5 rounded-[3px] bg-black/35 border border-white/18 text-sm text-white placeholder:text-[#8E8980] focus:border-[#6389FF] focus:outline-none transition-colors"
                    />
                    <SplitActionButton
                      label={newsletterSubmitting ? 'Saving…' : 'Subscribe'}
                      variant="light"
                      type="submit"
                      disabled={newsletterSubmitting}
                    />
                  </div>

                  {newsletterFeedback && (
                    <p
                      role={newsletterFeedback.kind === 'error' ? 'alert' : 'status'}
                      data-testid="newsletter-feedback"
                      className={`text-xs leading-snug ${
                        newsletterFeedback.kind === 'error'
                          ? 'text-[#FCA5A5]'
                          : 'text-[#86EFAC]'
                      }`}
                    >
                      {newsletterFeedback.message}
                    </p>
                  )}
                </form>
              </div>
            </div>
          </motion.section>

          {/* Quiet Footer Links (Admin intentionally omitted for public visitors) */}
          <div className="mt-12 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#A4A097]">
            <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
              <a
                href="/#catalogue"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/');
                  window.setTimeout(() => {
                    document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
                  }, 60);
                }}
                className="hover:text-white transition-colors"
              >
                Collection
              </a>
              <a
                href="/?category=lighting#catalogue"
                onClick={(e) => {
                  e.preventDefault();
                  jumpToCategory('lighting');
                }}
                className="hover:text-white transition-colors"
              >
                Lighting
              </a>
              <a
                href="/?category=tableware#catalogue"
                onClick={(e) => {
                  e.preventDefault();
                  jumpToCategory('tableware');
                }}
                className="hover:text-white transition-colors"
              >
                Tableware
              </a>
              <a
                href="/account"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/account');
                }}
                className="hover:text-white transition-colors"
              >
                Account & Orders
              </a>
            </div>

            <div className="flex items-center gap-x-6 text-[#8E8980]">
              <span>Bengaluru · Jaipur</span>
              <span>© {new Date().getFullYear()} KOVA Studio</span>
            </div>
          </div>
        </div>

        {/* Monumental Edge-to-Edge Architectural Wordmark */}
        <div className="mt-10 sm:mt-14 px-2 sm:px-4 pb-2 select-none" aria-hidden="true">
          <div className="max-w-[1440px] mx-auto text-[#DDD5C7]/90">
            <svg
              viewBox="0 0 1085 215"
              className="w-full h-auto block fill-current"
              role="presentation"
            >
              <text
                x="6"
                y="186"
                fontFamily="'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif"
                fontWeight="800"
                fontSize="222"
                letterSpacing="-14"
              >
                KO
              </text>
              <g transform="translate(314, 24) scale(7.35, 6.8)">
                <polygon points="1,7 16,1 22,1 22,11 37,5 43,5 43,19 28,25 22,25 22,15 7,21 1,21" />
              </g>
              <text
                x="656"
                y="186"
                fontFamily="'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif"
                fontWeight="800"
                fontSize="222"
                letterSpacing="-14"
              >
                VA
              </text>
              <g transform="translate(972, 28)">
                <rect
                  x="4"
                  y="4"
                  width="88"
                  height="88"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="9"
                />
                <text
                  x="48"
                  y="68"
                  textAnchor="middle"
                  fontFamily="'Plus Jakarta Sans', ui-sans-serif, sans-serif"
                  fontWeight="700"
                  fontSize="56"
                >
                  C
                </text>
              </g>
            </svg>
          </div>
        </div>
      </footer>
    </div>
  );
}
