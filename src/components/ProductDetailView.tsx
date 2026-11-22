import { useEffect, useState } from 'react';
import { ArrowLeft, Banknote, Check, Minus, Plus, ShieldCheck, Truck } from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { formatCurrency } from '../lib/commerce';
import type { Product } from '../types/store';
import { ProductImage } from './ProductImage';
import { ZoomableProductImage } from './ZoomableProductImage';

interface ProductDetailViewProps {
  slug: string;
}

export function ProductDetailView({ slug }: ProductDetailViewProps) {
  const { navigate, addToCart } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSelectedImageIdx(0);
    setQuantity(1);

    apiFetch<{ product: Product; related: Product[] }>(`/api/products/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (active) {
          setProduct(res.product);
          setRelated(res.related);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Object not found.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [slug]);

  const handleAdd = async () => {
    if (!product) return;
    setSubmitting(true);
    const ok = await addToCart(product.id, quantity, product.name);
    setSubmitting(false);
    if (ok) {
      setAddedFeedback(true);
      window.setTimeout(() => setAddedFeedback(false), 1800);
    }
  };

  if (loading) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse">
          <div className="lg:col-span-7 aspect-[4/3] bg-[#D6D0C5] dark:bg-[#1E1E22] rounded-sm" />
          <div className="lg:col-span-5 glass-surface rounded-sm p-8 space-y-4">
            <div className="h-4 w-28 bg-[#E4DFD6] dark:bg-white/10 rounded" />
            <div className="h-10 w-3/4 bg-[#E4DFD6] dark:bg-white/10 rounded" />
            <div className="h-6 w-32 bg-[#E4DFD6] dark:bg-white/10 rounded" />
            <div className="h-24 w-full bg-[#ECE8DF] dark:bg-white/5 rounded-[3px]" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 text-center">
        <div className="max-w-md mx-auto glass-surface rounded-sm p-10">
          <h1 className="font-display text-3xl font-bold text-[#171716] dark:text-[#F3F1EC]">
            Object not found
          </h1>
          <p className="text-sm text-[#5C5851] dark:text-[#A4A097] mt-2 mb-6">
            {error || 'This product may have been archived or hidden.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors cursor-pointer"
          >
            Return to Catalogue
          </button>
        </div>
      </main>
    );
  }

  const gallery = product.images.length > 0 ? product.images : [''];
  const activeImage = gallery[selectedImageIdx] || gallery[0];
  const outOfStock = product.stock <= 0;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-22 sm:pt-24 pb-24">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[3px] glass-surface text-xs sm:text-sm font-medium text-[#171716] dark:text-[#F3F1EC] hover:border-[#171716]/25 dark:hover:border-white/25 transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to Catalogue</span>
      </button>

      {/* Contiguous Purchase Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Sticky Left Gallery with Precision Detail Magnification */}
        <div className="lg:col-span-7 lg:sticky lg:top-24 space-y-3">
          <ZoomableProductImage
            src={activeImage}
            alt={product.name}
            gallery={gallery}
            activeIndex={selectedImageIdx}
            onSelectIndex={setSelectedImageIdx}
          />

          {gallery.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {gallery.map((imgUrl, idx) => (
                <button
                  key={`${imgUrl}-${idx}`}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  aria-label={`View image ${idx + 1} of ${product.name}`}
                  aria-current={selectedImageIdx === idx ? 'true' : undefined}
                  className={`aspect-[4/3] rounded-sm overflow-hidden bg-[#DFD9CE] dark:bg-[#1C1C20] border-2 transition-colors cursor-pointer ${
                    selectedImageIdx === idx
                      ? 'border-[#3B66F5]'
                      : 'border-transparent hover:border-[#171716]/30 dark:hover:border-white/30'
                  }`}
                >
                  <ProductImage
                    src={imgUrl}
                    alt={`${product.name} view ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sticky Right Glass Purchase Panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 glass-surface rounded-sm p-6 sm:p-8 lg:p-10 space-y-6"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B665D] dark:text-[#9A968E]">
              <span>{product.categoryName || 'Studio Object'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{product.sku}</span>
              {product.isFeatured && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#3B66F5] dark:text-[#7BA1FF]">Signature</span>
                </>
              )}
            </div>

            <h1 className="mt-2.5 font-display text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#171716] dark:text-[#F3F1EC]">
              {product.name}
            </h1>

            <div className="mt-4 flex items-baseline justify-between gap-4">
              <p className="font-mono text-2xl font-semibold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
                {formatCurrency(product.priceMinor, product.currency)}
              </p>
              <p
                className={`text-xs sm:text-sm font-medium ${
                  outOfStock
                    ? 'text-[#B91C1C] dark:text-[#F87171]'
                    : product.stock <= 5
                      ? 'text-[#B45309] dark:text-[#FBBF24]'
                      : 'text-[#166534] dark:text-[#4ADE80]'
                }`}
              >
                {outOfStock
                  ? 'Currently out of stock'
                  : `${product.stock} in studio stock`}
              </p>
            </div>
          </div>

          <p className="text-sm sm:text-base text-[#4C4841] dark:text-[#B8B4AC] leading-relaxed">
            {product.description}
          </p>

          {/* Quantity + Primary CTA */}
          <div className="pt-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center border border-[#171716]/15 dark:border-white/15 rounded-[3px] bg-white/70 dark:bg-white/[0.04] h-12">
                <button
                  type="button"
                  disabled={outOfStock || quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-11 h-full flex items-center justify-center text-[#171716] dark:text-[#F3F1EC] hover:bg-[#171716]/5 dark:hover:bg-white/10 disabled:opacity-35 rounded-l-[3px] cursor-pointer transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-mono text-sm font-medium text-[#171716] dark:text-[#F3F1EC] tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  disabled={outOfStock || quantity >= product.stock}
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  aria-label="Increase quantity"
                  className="w-11 h-full flex items-center justify-center text-[#171716] dark:text-[#F3F1EC] hover:bg-[#171716]/5 dark:hover:bg-white/10 disabled:opacity-35 rounded-r-[3px] cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <motion.button
                whileTap={{ scale: 0.99 }}
                type="button"
                disabled={outOfStock || submitting}
                onClick={handleAdd}
                className={`flex-1 h-12 px-6 rounded-[3px] text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                  addedFeedback
                    ? 'bg-[#166534] text-white'
                    : 'bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141413] hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white disabled:bg-[#E2DDD4] dark:disabled:bg-white/10 disabled:text-[#7B766C] dark:disabled:text-[#6E6B64]'
                }`}
              >
                {addedFeedback ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>Added to Cart</span>
                  </>
                ) : outOfStock ? (
                  <span>Out of Stock</span>
                ) : submitting ? (
                  <span>Adding…</span>
                ) : (
                  <span>
                    Add to Cart · {formatCurrency(product.priceMinor * quantity, product.currency)}
                  </span>
                )}
              </motion.button>
            </div>
          </div>

          {/* Specifications */}
          <dl className="pt-6 border-t border-[#171716]/10 dark:border-white/10 space-y-4 text-sm">
            {product.materials && (
              <div>
                <dt className="text-xs font-medium text-[#6B665D] dark:text-[#9A968E] mb-1">
                  Materials
                </dt>
                <dd className="text-[#171716] dark:text-[#F3F1EC]">{product.materials}</dd>
              </div>
            )}
            {product.dimensions && (
              <div>
                <dt className="text-xs font-medium text-[#6B665D] dark:text-[#9A968E] mb-1">
                  Dimensions &amp; Weight
                </dt>
                <dd className="text-[#171716] dark:text-[#F3F1EC]">{product.dimensions}</dd>
              </div>
            )}
            <div className="pt-2 space-y-2.5 text-xs text-[#5C5851] dark:text-[#A4A097]">
              <div className="flex items-start gap-2.5">
                <Truck
                  className="w-4 h-4 text-[#171716] dark:text-[#F3F1EC] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>Complimentary courier delivery over ₹5,000. Dispatched within 48h.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Banknote
                  className="w-4 h-4 text-[#171716] dark:text-[#F3F1EC] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>Cash on Delivery available at checkout on eligible orders up to ₹50,000.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck
                  className="w-4 h-4 text-[#171716] dark:text-[#F3F1EC] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>Server-verified pricing &amp; Razorpay checkout protection.</span>
              </div>
            </div>
          </dl>
        </motion.div>
      </div>

      {/* Related Studio Objects */}
      {related.length > 0 && (
        <section className="mt-16 pt-12 border-t border-[#171716]/12 dark:border-white/10">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-[#171716] dark:text-[#F3F1EC] mb-6">
            Pair with other objects
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {related.map((item) => (
              <motion.a
                key={item.id}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                href={`/product/${item.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/product/${item.slug}`);
                }}
                className="group block glass-surface rounded-sm overflow-hidden"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[#DFD9CE] dark:bg-[#1C1C20]">
                  <ProductImage
                    src={item.images[0]}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
                  />
                </div>
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-base text-[#171716] dark:text-[#F3F1EC] truncate group-hover:text-[#3B66F5] transition-colors">
                      {item.name}
                    </p>
                    <p className="text-xs text-[#6B665D] dark:text-[#9A968E]">
                      {item.categoryName || 'Object'}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-[#171716] dark:text-[#F3F1EC] tabular-nums shrink-0">
                    {formatCurrency(item.priceMinor, item.currency)}
                  </span>
                </div>
              </motion.a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
