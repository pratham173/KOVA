import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Mail,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import { FULFILMENT_STATUSES, PAYMENT_STATUSES, formatCurrency } from '../lib/commerce';
import type {
  AdminStats,
  Category,
  NewsletterSubscriber,
  OrderRecord,
  Product,
} from '../types/store';
import { ProductImage } from './ProductImage';

type AdminTab = 'products' | 'categories' | 'orders' | 'subscribers';

const STUDIO_IMAGE_PRESETS = [
  { label: 'Arc Desk Lamp', url: '/src/assets/images/product_arc_lamp_1795282162126.jpg' },
  { label: 'Stoneware Carafe', url: '/src/assets/images/product_stoneware_carafe_1795282144095.jpg' },
  { label: 'Espresso Duo', url: '/src/assets/images/product_espresso_duo_1795282144243.jpg' },
  { label: 'Monolith Tray', url: '/src/assets/images/product_monolith_tray_1795282143935.jpg' },
  { label: 'Orb Table Lamp', url: '/src/assets/images/product_orb_lamp_1795282144335.jpg' },
  { label: 'Canvas Tote', url: '/src/assets/images/product_canvas_tote_1795282144104.jpg' },
  { label: 'Brass Pen', url: '/src/assets/images/product_brass_pen_1795282144045.jpg' },
  { label: 'Woven Throw', url: '/src/assets/images/product_woven_throw_1795282143744.jpg' },
];

const FIELD_CLASS =
  'w-full h-11 px-3.5 rounded-[3px] bg-white/85 dark:bg-[#1B1B1F] border border-[#171716]/15 dark:border-white/15 text-sm text-[#171716] dark:text-[#F3F1EC] placeholder:text-[#7B766C] dark:placeholder:text-[#8E8A81] focus:outline-none focus:border-[#3B66F5] transition-colors';

const TEXTAREA_CLASS =
  'w-full p-3.5 rounded-[3px] bg-white/85 dark:bg-[#1B1B1F] border border-[#171716]/15 dark:border-white/15 text-sm text-[#171716] dark:text-[#F3F1EC] placeholder:text-[#7B766C] dark:placeholder:text-[#8E8A81] focus:outline-none focus:border-[#3B66F5] transition-colors';

interface ProductFormState {
  id?: number;
  name: string;
  sku: string;
  categoryId: string;
  priceRupees: string;
  stock: string;
  summary: string;
  description: string;
  imagesText: string;
  materials: string;
  dimensions: string;
  isVisible: boolean;
  isFeatured: boolean;
}

const BLANK_PRODUCT_FORM: ProductFormState = {
  name: '',
  sku: '',
  categoryId: '',
  priceRupees: '',
  stock: '10',
  summary: '',
  description: '',
  imagesText: STUDIO_IMAGE_PRESETS[0].url,
  materials: '',
  dimensions: '',
  isVisible: true,
  isFeatured: false,
};

function formatPaymentStatusOption(status: string): string {
  if (status === 'cod_pending') return 'COD Pending';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function AdminView() {
  const { user, authReady, navigate, showToast, bumpCatalogVersion } = useStore();
  const [tab, setTab] = useState<AdminTab>('products');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [deletingSubscriberId, setDeletingSubscriberId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Product modal state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState<ProductFormState>(BLANK_PRODUCT_FORM);
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<number | null>(null);

  // Category form state
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catSortOrder, setCatSortOrder] = useState('0');
  const [savingCategory, setSavingCategory] = useState(false);

  // Order fulfilment & payment status draft edits
  const [orderStatusDraft, setOrderStatusDraft] = useState<Record<number, string>>({});
  const [orderPaymentStatusDraft, setOrderPaymentStatusDraft] = useState<Record<number, string>>({});
  const [orderNoteDraft, setOrderNoteDraft] = useState<Record<number, string>>({});
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);

  const loadAllAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, prodRes, catRes, ordRes, subRes] = await Promise.all([
        apiFetch<{ stats: AdminStats }>('/api/admin/overview'),
        apiFetch<{ products: Product[] }>('/api/admin/products'),
        apiFetch<{ categories: Category[] }>('/api/admin/categories'),
        apiFetch<{ orders: OrderRecord[] }>('/api/admin/orders'),
        apiFetch<{ subscribers: NewsletterSubscriber[] }>('/api/admin/newsletter'),
      ]);
      setStats(ov.stats);
      setProducts(prodRes.products);
      setCategories(catRes.categories);
      setOrders(ordRes.orders);
      setSubscribers(subRes.subscribers);

      const statusMap: Record<number, string> = {};
      const paymentStatusMap: Record<number, string> = {};
      const noteMap: Record<number, string> = {};
      for (const o of ordRes.orders) {
        statusMap[o.id] = o.fulfilmentStatus;
        paymentStatusMap[o.id] = o.paymentStatus;
        noteMap[o.id] = o.trackingNote || '';
      }
      setOrderStatusDraft(statusMap);
      setOrderPaymentStatusDraft(paymentStatusMap);
      setOrderNoteDraft(noteMap);
    } catch (err: any) {
      setError(err.message || 'Unable to load admin console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady || !user || user.role !== 'admin') return;
    loadAllAdminData();
  }, [authReady, user]);

  if (!authReady) {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 text-center text-sm text-[#5C5851] dark:text-[#A4A097]">
        Loading…
      </main>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        <div className="max-w-md mx-auto glass-surface rounded-sm p-10 text-center">
          <p className="font-mono text-xs text-[#6B665D] dark:text-[#9A968E] mb-2">404</p>
          <h1 className="font-display text-2xl font-bold text-[#171716] dark:text-[#F3F1EC]">
            Page not found
          </h1>
          <p className="text-sm text-[#5C5851] dark:text-[#A4A097] mt-2 mb-6">
            The page you are looking for does not exist or is unavailable.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors cursor-pointer"
          >
            Return to Store
          </button>
        </div>
      </main>
    );
  }

  const openNewProductModal = () => {
    setProductForm({
      ...BLANK_PRODUCT_FORM,
      categoryId: categories[0] ? String(categories[0].id) : '',
    });
    setProductFormError(null);
    setProductModalOpen(true);
  };

  const openEditProductModal = (prod: Product) => {
    setProductForm({
      id: prod.id,
      name: prod.name,
      sku: prod.sku,
      categoryId: prod.categoryId ? String(prod.categoryId) : '',
      priceRupees: String(prod.priceMinor / 100),
      stock: String(prod.stock),
      summary: prod.summary,
      description: prod.description,
      imagesText: (prod.images || []).join('\n'),
      materials: prod.materials || '',
      dimensions: prod.dimensions || '',
      isVisible: prod.isVisible,
      isFeatured: prod.isFeatured,
    });
    setProductFormError(null);
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductFormError(null);

    const priceNum = Number(productForm.priceRupees);
    const stockNum = Number(productForm.stock);

    if (productForm.name.trim().length < 2) {
      setProductFormError('Product name must be at least 2 characters.');
      return;
    }
    if (productForm.sku.trim().length < 2) {
      setProductFormError('SKU is required.');
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 1) {
      setProductFormError('Please enter a valid price in ₹ (minimum ₹1).');
      return;
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      setProductFormError('Stock must be a whole number of 0 or more.');
      return;
    }

    const images = productForm.imagesText
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      name: productForm.name.trim(),
      sku: productForm.sku.trim(),
      categoryId: productForm.categoryId ? Number(productForm.categoryId) : null,
      priceMinor: Math.round(priceNum * 100),
      stock: stockNum,
      summary: productForm.summary.trim(),
      description: productForm.description.trim(),
      images,
      materials: productForm.materials.trim(),
      dimensions: productForm.dimensions.trim(),
      isVisible: productForm.isVisible,
      isFeatured: productForm.isFeatured,
    };

    setSavingProduct(true);
    try {
      if (productForm.id) {
        await apiFetch(`/api/admin/products/${productForm.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast(`Updated ${payload.name}.`);
      } else {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`Created ${payload.name}.`);
      }
      setProductModalOpen(false);
      bumpCatalogVersion();
      await loadAllAdminData();
    } catch (err: any) {
      setProductFormError(err.message || 'Unable to save product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleToggleProductVisibility = async (prod: Product) => {
    try {
      await apiFetch(`/api/admin/products/${prod.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isVisible: !prod.isVisible }),
      });
      showToast(`${prod.name} is now ${!prod.isVisible ? 'visible' : 'hidden'} in storefront.`);
      bumpCatalogVersion();
      await loadAllAdminData();
    } catch (err: any) {
      showToast(err.message || 'Unable to update visibility.', 'error');
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      await apiFetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
      setConfirmDeleteProductId(null);
      showToast('Product deleted from catalogue.');
      bumpCatalogVersion();
      await loadAllAdminData();
    } catch (err: any) {
      showToast(err.message || 'Unable to delete product.', 'error');
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (catName.trim().length < 2) {
      showToast('Category name must be at least 2 characters.', 'error');
      return;
    }
    setSavingCategory(true);
    try {
      const payload = {
        name: catName.trim(),
        description: catDescription.trim(),
        sortOrder: Number(catSortOrder) || 0,
      };
      if (editingCategoryId) {
        await apiFetch(`/api/admin/categories/${editingCategoryId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast(`Updated category "${payload.name}".`);
      } else {
        await apiFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`Created category "${payload.name}".`);
      }
      setEditingCategoryId(null);
      setCatName('');
      setCatDescription('');
      setCatSortOrder('0');
      bumpCatalogVersion();
      await loadAllAdminData();
    } catch (err: any) {
      showToast(err.message || 'Unable to save category.', 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      await apiFetch(`/api/admin/categories/${categoryId}`, { method: 'DELETE' });
      showToast('Category deleted.');
      bumpCatalogVersion();
      await loadAllAdminData();
    } catch (err: any) {
      showToast(err.message || 'Unable to delete category.', 'error');
    }
  };

  const handleUpdateOrderFulfilment = async (order: OrderRecord) => {
    setSavingOrderId(order.id);
    try {
      const draftPayStatus = orderPaymentStatusDraft[order.id];
      const payload: Record<string, string> = {
        fulfilmentStatus: orderStatusDraft[order.id] ?? order.fulfilmentStatus,
        trackingNote: orderNoteDraft[order.id] ?? '',
      };
      if (draftPayStatus && draftPayStatus !== order.paymentStatus) {
        payload.paymentStatus = draftPayStatus;
      }
      await apiFetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      showToast('Order updated.');
      await loadAllAdminData();
    } catch (err: any) {
      showToast(err.message || 'Unable to update order.', 'error');
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleDeleteSubscriber = async (subscriberId: number) => {
    setDeletingSubscriberId(subscriberId);
    try {
      await apiFetch(`/api/admin/newsletter/${subscriberId}`, { method: 'DELETE' });
      showToast('Subscriber removed from mailing list.');
      await loadAllAdminData();
    } catch (err: any) {
      showToast(err.message || 'Unable to remove subscriber.', 'error');
    } finally {
      setDeletingSubscriberId(null);
    }
  };

  const handleCopyAllEmails = async () => {
    if (subscribers.length === 0) return;
    const list = subscribers.map((s) => s.email).join(', ');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(list);
      }
      showToast(`Copied ${subscribers.length} subscriber email${subscribers.length === 1 ? '' : 's'}.`);
    } catch {
      showToast('Unable to copy emails automatically.', 'error');
    }
  };

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#6B675E] dark:text-[#9A968E]">
            KOVA Admin · Catalogue &amp; Fulfilment
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-[-0.025em] text-[#171716] dark:text-[#F3F1EC]">
            Studio Management
          </h1>
        </div>
        <button
          type="button"
          onClick={openNewProductModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add Product</span>
        </button>
      </div>

      {/* KPI Strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="glass-surface rounded-sm p-5">
            <p className="text-xs text-[#6B675E] dark:text-[#9A968E]">Confirmed Revenue</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
              {formatCurrency(stats.confirmedRevenueMinor, 'INR')}
            </p>
          </div>
          <div className="glass-surface rounded-sm p-5">
            <p className="text-xs text-[#6B675E] dark:text-[#9A968E]">Confirmed Orders</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
              {stats.totalOrders}
              <span className="ml-2 text-xs font-sans font-normal text-[#6B675E] dark:text-[#9A968E]">
                ({stats.pendingFulfilmentCount} to fulfil)
              </span>
            </p>
          </div>
          <div className="glass-surface rounded-sm p-5">
            <p className="text-xs text-[#6B675E] dark:text-[#9A968E]">Catalogue Objects</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
              {stats.totalProducts}
              <span className="ml-2 text-xs font-sans font-normal text-[#6B675E] dark:text-[#9A968E]">
                ({stats.visibleProducts} visible)
              </span>
            </p>
          </div>
          <div className="glass-surface rounded-sm p-5">
            <p className="text-xs text-[#6B675E] dark:text-[#9A968E]">Low Stock Alerts</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
              {stats.lowStockCount}
              <span className="ml-2 text-xs font-sans font-normal text-[#6B675E] dark:text-[#9A968E]">
                (≤ 5 units)
              </span>
            </p>
          </div>
          <div className="glass-surface rounded-sm p-5 col-span-2 md:col-span-1">
            <p className="text-xs text-[#6B675E] dark:text-[#9A968E]">Newsletter List</p>
            <p className="mt-2 font-mono text-2xl font-bold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
              {stats.totalSubscribers ?? subscribers.length}
              <span className="ml-2 text-xs font-sans font-normal text-[#6B675E] dark:text-[#9A968E]">
                saved
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Admin Section Tabs */}
      <div
        role="tablist"
        aria-label="Admin sections"
        className="inline-flex flex-wrap items-center gap-1 p-1 glass-surface rounded-sm"
      >
        {(
          [
            { id: 'products', label: `Products (${products.length})` },
            { id: 'categories', label: `Categories (${categories.length})` },
            { id: 'orders', label: `Orders (${orders.length})` },
            { id: 'subscribers', label: `Subscribers (${subscribers.length})` },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 rounded-[2px] text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              tab === item.id
                ? 'bg-[#171716] dark:bg-[#F3F1EC] text-white dark:text-[#141413]'
                : 'text-[#5C5851] dark:text-[#A4A097] hover:text-[#171716] dark:hover:text-[#F3F1EC]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-sm bg-[#FEF2F2] dark:bg-[#B91C1C]/15 border border-[#B91C1C]/25 p-5 text-sm text-[#991B1B] dark:text-[#FCA5A5]"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 glass-surface rounded-sm" />
            ))}
          </div>
          <div className="h-64 glass-surface rounded-sm" />
        </div>
      ) : tab === 'products' ? (
        /* PRODUCTS MANAGEMENT */
        <section className="glass-surface rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#171716]/10 dark:border-white/10 text-xs text-[#6B675E] dark:text-[#9A968E]">
                  <th className="py-4 px-5 font-medium">Object</th>
                  <th className="py-4 px-4 font-medium">Category</th>
                  <th className="py-4 px-4 font-medium">Price</th>
                  <th className="py-4 px-4 font-medium">Stock</th>
                  <th className="py-4 px-4 font-medium">Visibility</th>
                  <th className="py-4 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#171716]/8 dark:divide-white/8 text-sm">
                {products.map((prod) => (
                  <tr
                    key={prod.id}
                    className="hover:bg-[#171716]/[0.025] dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-[3px] overflow-hidden bg-[#E4DFD6] dark:bg-[#232328] shrink-0">
                          <ProductImage
                            src={prod.images[0]}
                            alt={prod.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[#171716] dark:text-[#F3F1EC] truncate">
                            {prod.name}
                          </p>
                          <p className="text-xs font-mono text-[#6B675E] dark:text-[#9A968E]">
                            {prod.sku}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-[#5C5851] dark:text-[#A4A097] whitespace-nowrap">
                      {prod.categoryName || 'Uncategorized'}
                    </td>
                    <td className="py-4 px-4 font-mono tabular-nums text-[#171716] dark:text-[#F3F1EC] whitespace-nowrap">
                      {formatCurrency(prod.priceMinor, prod.currency)}
                    </td>
                    <td className="py-4 px-4 font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          prod.stock <= 5
                            ? 'text-[#B45309] dark:text-[#FBBF24] font-semibold'
                            : 'text-[#171716] dark:text-[#F3F1EC]'
                        }
                      >
                        {prod.stock}
                      </span>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleProductVisibility(prod)}
                        aria-label={`Toggle visibility for ${prod.name}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#171716] dark:text-[#F3F1EC] hover:text-[#3B66F5] cursor-pointer"
                      >
                        {prod.isVisible ? (
                          <>
                            <Eye
                              className="w-3.5 h-3.5 text-[#166534] dark:text-[#4ADE80]"
                              aria-hidden="true"
                            />
                            <span>Visible</span>
                          </>
                        ) : (
                          <>
                            <EyeOff
                              className="w-3.5 h-3.5 text-[#6B675E] dark:text-[#9A968E]"
                              aria-hidden="true"
                            />
                            <span className="text-[#6B675E] dark:text-[#9A968E]">Hidden</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditProductModal(prod)}
                          aria-label={`Edit ${prod.name}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[3px] border border-[#171716]/15 dark:border-white/15 bg-white/75 dark:bg-white/[0.05] text-xs font-medium text-[#171716] dark:text-[#F3F1EC] hover:bg-white dark:hover:bg-white/10 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Edit</span>
                        </button>

                        {confirmDeleteProductId === prod.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="px-2.5 py-1.5 rounded-[3px] bg-[#B91C1C] text-white text-xs font-medium cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProductId(null)}
                              className="px-2 py-1.5 rounded-[3px] bg-[#E4DFD6] dark:bg-white/10 text-[#171716] dark:text-[#F3F1EC] text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProductId(prod.id)}
                            aria-label={`Delete ${prod.name}`}
                            className="p-2 rounded-[3px] text-[#6B675E] dark:text-[#9A968E] hover:text-[#B91C1C] dark:hover:text-[#F87171] hover:bg-[#FEF2F2] dark:hover:bg-[#B91C1C]/15 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : tab === 'categories' ? (
        /* CATEGORIES MANAGEMENT */
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form onSubmit={handleSaveCategory} className="lg:col-span-5 glass-surface rounded-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[#171716] dark:text-[#F3F1EC]">
                {editingCategoryId ? 'Edit Category' : 'Create Category'}
              </h2>
              {editingCategoryId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategoryId(null);
                    setCatName('');
                    setCatDescription('');
                    setCatSortOrder('0');
                  }}
                  className="text-xs text-[#5C5851] dark:text-[#A4A097] hover:text-[#171716] dark:hover:text-[#F3F1EC] cursor-pointer"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <div>
              <label
                htmlFor="cat-name"
                className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
              >
                Category Name
              </label>
              <input
                id="cat-name"
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Textiles & Rugs"
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="cat-desc"
                className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
              >
                Description
              </label>
              <textarea
                id="cat-desc"
                rows={3}
                value={catDescription}
                onChange={(e) => setCatDescription(e.target.value)}
                placeholder="Hand-loomed textiles and natural fiber weaves."
                className={TEXTAREA_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="cat-sort"
                className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1.5"
              >
                Display Order
              </label>
              <input
                id="cat-sort"
                type="number"
                min={0}
                value={catSortOrder}
                onChange={(e) => setCatSortOrder(e.target.value)}
                className={`${FIELD_CLASS} font-mono`}
              />
            </div>

            <button
              type="submit"
              disabled={savingCategory}
              className="w-full h-11 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingCategory
                ? 'Saving…'
                : editingCategoryId
                  ? 'Save Category Changes'
                  : 'Create Category'}
            </button>
          </form>

          <div className="lg:col-span-7 glass-surface rounded-sm divide-y divide-[#171716]/10 dark:divide-white/10">
            {categories.map((cat) => (
              <div key={cat.id} className="p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold text-base text-[#171716] dark:text-[#F3F1EC]">
                      {cat.name}
                    </h3>
                    <span className="text-xs font-mono text-[#6B675E] dark:text-[#9A968E]">
                      /{cat.slug}
                    </span>
                  </div>
                  <p className="text-xs text-[#5C5851] dark:text-[#A4A097] mt-0.5">
                    {cat.description || 'No description'} · {cat.productCount} linked products
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategoryId(cat.id);
                      setCatName(cat.name);
                      setCatDescription(cat.description);
                      setCatSortOrder(String(cat.sortOrder));
                    }}
                    aria-label={`Edit category ${cat.name}`}
                    className="px-3 py-1.5 rounded-[3px] border border-[#171716]/15 dark:border-white/15 bg-white/75 dark:bg-white/[0.05] text-xs font-medium text-[#171716] dark:text-[#F3F1EC] hover:bg-white dark:hover:bg-white/10 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id)}
                    aria-label={`Delete category ${cat.name}`}
                    className="p-2 rounded-[3px] text-[#6B675E] dark:text-[#9A968E] hover:text-[#B91C1C] dark:hover:text-[#F87171] hover:bg-[#FEF2F2] dark:hover:bg-[#B91C1C]/15 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : tab === 'orders' ? (
        /* ORDERS FULFILMENT & COD MANAGEMENT */
        <section className="space-y-4">
          {orders.length === 0 ? (
            <div className="glass-surface rounded-sm p-12 text-center text-sm text-[#5C5851] dark:text-[#A4A097]">
              No confirmed customer orders yet.
            </div>
          ) : (
            orders.map((order) => {
              const isCod = order.paymentMethod === 'cod';
              const isCodPending = order.paymentStatus === 'cod_pending';
              return (
                <article key={order.id} className="glass-surface rounded-sm p-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#171716]/10 dark:border-white/10">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B675E] dark:text-[#9A968E]">
                        <span className="font-mono font-semibold text-[#171716] dark:text-[#F3F1EC]">
                          {order.orderNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {order.customerName} ({order.customerEmail})
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-[#171716] dark:text-[#F3F1EC]">
                          {isCod ? 'Cash on Delivery' : 'Online'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-medium ${
                            isCodPending
                              ? 'text-[#B45309] dark:text-[#FBBF24]'
                              : 'text-[#166534] dark:text-[#4ADE80]'
                          }`}
                        >
                          Payment: {formatPaymentStatusOption(order.paymentStatus)}
                        </span>
                      </div>
                      <p className="text-xs text-[#5C5851] dark:text-[#A4A097] mt-1">
                        Ship to: {order.shippingName}, {order.shippingAddress}, {order.shippingCity}{' '}
                        {order.shippingPostalCode}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-mono text-lg font-bold text-[#171716] dark:text-[#F3F1EC] tabular-nums">
                        {formatCurrency(order.totalMinor, order.currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/account/orders/${order.orderNumber}`)}
                        className="px-3 py-1.5 rounded-[3px] border border-[#171716]/15 dark:border-white/15 bg-white/75 dark:bg-white/[0.05] text-xs font-medium text-[#171716] dark:text-[#F3F1EC] hover:bg-white dark:hover:bg-white/10 cursor-pointer"
                      >
                        Receipt
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-[#44423D] dark:text-[#C4C0B7] space-y-1">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between gap-4">
                        <span>
                          {item.productName} ({item.productSku}) × {item.quantity}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(item.lineTotalMinor, order.currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-[#171716]/10 dark:border-white/10 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-3">
                      <label
                        htmlFor={`status-${order.id}`}
                        className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                      >
                        Fulfilment Status
                      </label>
                      <select
                        id={`status-${order.id}`}
                        value={orderStatusDraft[order.id] ?? order.fulfilmentStatus}
                        onChange={(e) =>
                          setOrderStatusDraft((prev) => ({ ...prev, [order.id]: e.target.value }))
                        }
                        className="w-full h-10 px-3 rounded-[3px] bg-white/85 dark:bg-[#1B1B1F] border border-[#171716]/15 dark:border-white/15 text-sm text-[#171716] dark:text-[#F3F1EC]"
                      >
                        {FULFILMENT_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st.charAt(0).toUpperCase() + st.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor={`paystatus-${order.id}`}
                        className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                      >
                        Payment Status
                      </label>
                      <select
                        id={`paystatus-${order.id}`}
                        value={orderPaymentStatusDraft[order.id] ?? order.paymentStatus}
                        onChange={(e) =>
                          setOrderPaymentStatusDraft((prev) => ({
                            ...prev,
                            [order.id]: e.target.value,
                          }))
                        }
                        className="w-full h-10 px-3 rounded-[3px] bg-white/85 dark:bg-[#1B1B1F] border border-[#171716]/15 dark:border-white/15 text-sm text-[#171716] dark:text-[#F3F1EC]"
                      >
                        {PAYMENT_STATUSES.map((ps) => (
                          <option key={ps} value={ps}>
                            {formatPaymentStatusOption(ps)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-5">
                      <label
                        htmlFor={`note-${order.id}`}
                        className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                      >
                        Courier / Tracking Note
                      </label>
                      <input
                        id={`note-${order.id}`}
                        type="text"
                        value={orderNoteDraft[order.id] ?? ''}
                        onChange={(e) =>
                          setOrderNoteDraft((prev) => ({ ...prev, [order.id]: e.target.value }))
                        }
                        placeholder="BlueDart AWB #948201294 — dispatched from Bengaluru studio"
                        className="w-full h-10 px-3 rounded-[3px] bg-white/85 dark:bg-[#1B1B1F] border border-[#171716]/15 dark:border-white/15 text-sm text-[#171716] dark:text-[#F3F1EC]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        disabled={savingOrderId === order.id}
                        onClick={() => handleUpdateOrderFulfilment(order)}
                        className="w-full h-10 px-4 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-xs font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{savingOrderId === order.id ? 'Saving…' : 'Update'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      ) : (
        /* NEWSLETTER SUBSCRIBERS MANAGEMENT */
        <section
          data-testid="admin-subscribers-section"
          className="glass-surface rounded-sm overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[#171716]/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#171716] dark:text-[#F3F1EC]">
                Collection Dispatch Subscribers
              </h2>
              <p className="text-xs text-[#5C5851] dark:text-[#A4A097] mt-0.5">
                Emails saved from the storefront footer for upcoming releases and restock announcements.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyAllEmails}
              disabled={subscribers.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[3px] border border-[#171716]/15 dark:border-white/15 bg-white/75 dark:bg-white/[0.05] text-xs font-medium text-[#171716] dark:text-[#F3F1EC] hover:bg-white dark:hover:bg-white/10 disabled:opacity-40 cursor-pointer whitespace-nowrap self-start sm:self-auto"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy All Emails</span>
            </button>
          </div>

          {subscribers.length === 0 ? (
            <div className="p-12 text-center">
              <Mail
                className="w-6 h-6 text-[#6B675E] dark:text-[#9A968E] mx-auto mb-2.5"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-[#171716] dark:text-[#F3F1EC]">
                No subscribers yet
              </p>
              <p className="text-xs text-[#6B675E] dark:text-[#9A968E] mt-1">
                Customer emails submitted in the storefront footer will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#171716]/10 dark:border-white/10 text-xs text-[#6B675E] dark:text-[#9A968E]">
                    <th className="py-3.5 px-5 font-medium">Email Address</th>
                    <th className="py-3.5 px-4 font-medium">Source</th>
                    <th className="py-3.5 px-4 font-medium">Subscribed</th>
                    <th className="py-3.5 px-5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171716]/8 dark:divide-white/8 text-sm">
                  {subscribers.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-[#171716]/[0.025] dark:hover:bg-white/[0.03]"
                    >
                      <td className="py-3.5 px-5 font-mono text-xs sm:text-sm text-[#171716] dark:text-[#F3F1EC]">
                        {sub.email}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#5C5851] dark:text-[#A4A097] capitalize">
                        {sub.source}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-[#6B675E] dark:text-[#9A968E] whitespace-nowrap">
                        {new Date(sub.subscribedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          disabled={deletingSubscriberId === sub.id}
                          onClick={() => handleDeleteSubscriber(sub.id)}
                          aria-label={`Remove ${sub.email}`}
                          className="p-2 rounded-[3px] text-[#6B675E] dark:text-[#9A968E] hover:text-[#B91C1C] dark:hover:text-[#F87171] hover:bg-[#FEF2F2] dark:hover:bg-[#B91C1C]/15 cursor-pointer disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Product Add / Edit Modal */}
      <AnimatePresence>
        {productModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label={productForm.id ? 'Edit product' : 'Add product'}
          >
            <div
              className="fixed inset-0 bg-[#0E0E10]/65 backdrop-blur-md"
              onClick={() => setProductModalOpen(false)}
            />
            <motion.form
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleSaveProduct}
              className="relative z-10 w-full max-w-2xl bg-[#FAF9F6]/95 dark:bg-[#17171A]/95 backdrop-blur-2xl rounded-sm border border-[#171716]/15 dark:border-white/15 shadow-2xl p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#171716]/10 dark:border-white/10">
                <h2 className="font-display text-2xl font-bold text-[#171716] dark:text-[#F3F1EC]">
                  {productForm.id ? 'Edit Product' : 'Add New Product'}
                </h2>
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  aria-label="Close product modal"
                  className="w-9 h-9 rounded-[3px] flex items-center justify-center text-[#5C5851] dark:text-[#A4A097] hover:bg-[#171716]/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {productFormError && (
                <div
                  role="alert"
                  className="rounded-[3px] bg-[#FEF2F2] dark:bg-[#B91C1C]/15 border border-[#B91C1C]/25 px-4 py-3 text-sm text-[#991B1B] dark:text-[#FCA5A5]"
                >
                  {productFormError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="prod-name"
                    className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                  >
                    Product Name
                  </label>
                  <input
                    id="prod-name"
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </div>

                <div>
                  <label
                    htmlFor="prod-sku"
                    className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                  >
                    SKU
                  </label>
                  <input
                    id="prod-sku"
                    type="text"
                    required
                    value={productForm.sku}
                    onChange={(e) => setProductForm((p) => ({ ...p, sku: e.target.value }))}
                    placeholder="KV-OBJ-09"
                    className={`${FIELD_CLASS} font-mono`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="prod-cat"
                    className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="prod-cat"
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm((p) => ({ ...p, categoryId: e.target.value }))}
                    className={FIELD_CLASS}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="prod-price"
                      className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                    >
                      Price (₹)
                    </label>
                    <input
                      id="prod-price"
                      type="number"
                      min={1}
                      step="1"
                      required
                      value={productForm.priceRupees}
                      onChange={(e) =>
                        setProductForm((p) => ({ ...p, priceRupees: e.target.value }))
                      }
                      className={`${FIELD_CLASS} font-mono`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="prod-stock"
                      className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                    >
                      Stock
                    </label>
                    <input
                      id="prod-stock"
                      type="number"
                      min={0}
                      step="1"
                      required
                      value={productForm.stock}
                      onChange={(e) => setProductForm((p) => ({ ...p, stock: e.target.value }))}
                      className={`${FIELD_CLASS} font-mono`}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="prod-summary"
                    className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                  >
                    Short Summary
                  </label>
                  <input
                    id="prod-summary"
                    type="text"
                    required
                    value={productForm.summary}
                    onChange={(e) => setProductForm((p) => ({ ...p, summary: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="prod-desc"
                    className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                  >
                    Full Description
                  </label>
                  <textarea
                    id="prod-desc"
                    rows={3}
                    required
                    value={productForm.description}
                    onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))}
                    className={TEXTAREA_CLASS}
                  />
                </div>

                <div>
                  <label
                    htmlFor="prod-materials"
                    className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                  >
                    Materials
                  </label>
                  <input
                    id="prod-materials"
                    type="text"
                    value={productForm.materials}
                    onChange={(e) => setProductForm((p) => ({ ...p, materials: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </div>

                <div>
                  <label
                    htmlFor="prod-dimensions"
                    className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                  >
                    Dimensions
                  </label>
                  <input
                    id="prod-dimensions"
                    type="text"
                    value={productForm.dimensions}
                    onChange={(e) => setProductForm((p) => ({ ...p, dimensions: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="prod-images"
                    className="block text-xs font-medium text-[#5C5851] dark:text-[#A4A097] mb-1"
                  >
                    Image URLs (one per line)
                  </label>
                  <textarea
                    id="prod-images"
                    rows={2}
                    value={productForm.imagesText}
                    onChange={(e) => setProductForm((p) => ({ ...p, imagesText: e.target.value }))}
                    className={`${TEXTAREA_CLASS} text-xs font-mono`}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {STUDIO_IMAGE_PRESETS.slice(0, 4).map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() =>
                          setProductForm((p) => ({
                            ...p,
                            imagesText: p.imagesText.includes(preset.url)
                              ? p.imagesText
                              : [preset.url, p.imagesText].filter(Boolean).join('\n'),
                          }))
                        }
                        className="px-2.5 py-1 rounded-[2px] bg-[#E4DFD6] dark:bg-white/10 text-[11px] font-medium text-[#5C5851] dark:text-[#D1CDC4] hover:text-[#171716] dark:hover:text-white cursor-pointer"
                      >
                        + {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center gap-6 pt-1">
                  <label className="inline-flex items-center gap-2 text-sm text-[#171716] dark:text-[#F3F1EC] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.isVisible}
                      onChange={(e) =>
                        setProductForm((p) => ({ ...p, isVisible: e.target.checked }))
                      }
                      className="w-4 h-4 accent-[#3B66F5]"
                    />
                    <span>Visible in storefront</span>
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm text-[#171716] dark:text-[#F3F1EC] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.isFeatured}
                      onChange={(e) =>
                        setProductForm((p) => ({ ...p, isFeatured: e.target.checked }))
                      }
                      className="w-4 h-4 accent-[#3B66F5]"
                    />
                    <span>Featured on homepage</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-[#171716]/10 dark:border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-[3px] border border-[#171716]/15 dark:border-white/15 bg-white/80 dark:bg-white/[0.05] text-sm font-medium text-[#171716] dark:text-[#F3F1EC] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-6 py-2.5 rounded-[3px] bg-[#171716] dark:bg-[#F3F1EC] text-[#FAF9F6] dark:text-[#141413] text-sm font-medium hover:bg-[#3B66F5] dark:hover:bg-[#3B66F5] dark:hover:text-white cursor-pointer disabled:opacity-50"
                >
                  {savingProduct ? 'Saving…' : productForm.id ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
