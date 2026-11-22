export interface PricedLineItem {
  productId: number;
  unitPriceMinor: number;
  quantity: number;
}

export interface CartTotals {
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  freeShippingThresholdMinor: number;
  remainingForFreeShippingMinor: number;
}

export interface MergeableCartItem {
  productId: number;
  quantity: number;
}

export interface StockCheckItem {
  productId: number;
  name: string;
  quantity: number;
  availableStock: number;
  isVisible: boolean;
}

export interface StockIssue {
  productId: number;
  name: string;
  requested: number;
  available: number;
  reason: 'unavailable' | 'out_of_stock' | 'insufficient_stock';
}

export const FREE_SHIPPING_THRESHOLD_MINOR = 500000; // ₹5,000.00
export const STANDARD_SHIPPING_MINOR = 25000; // ₹250.00
export const TAX_RATE_BPS = 1200; // 12% GST
export const COD_MAX_ORDER_MINOR = 5000000; // ₹50,000.00 max order value for Cash on Delivery

export const PAYMENT_METHODS = ['online', 'cod'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['paid', 'cod_pending', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FULFILMENT_STATUSES = [
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

export function formatCurrency(amountMinor: number, currency = 'INR'): string {
  const major = amountMinor / 100;
  const hasFraction = amountMinor % 100 !== 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(hasFraction ? 2 : 0)}`;
  }
}

export function calculateCartTotals(items: PricedLineItem[]): CartTotals {
  const subtotalMinor = items.reduce((sum, item) => {
    const qty = Math.max(0, Math.floor(item.quantity));
    const unit = Math.max(0, Math.floor(item.unitPriceMinor));
    return sum + unit * qty;
  }, 0);

  if (subtotalMinor === 0) {
    return {
      subtotalMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      totalMinor: 0,
      freeShippingThresholdMinor: FREE_SHIPPING_THRESHOLD_MINOR,
      remainingForFreeShippingMinor: FREE_SHIPPING_THRESHOLD_MINOR,
    };
  }

  const shippingMinor =
    subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR ? 0 : STANDARD_SHIPPING_MINOR;
  const taxMinor = Math.round((subtotalMinor * TAX_RATE_BPS) / 10000);
  const totalMinor = subtotalMinor + shippingMinor + taxMinor;
  const remainingForFreeShippingMinor = Math.max(
    0,
    FREE_SHIPPING_THRESHOLD_MINOR - subtotalMinor
  );

  return {
    subtotalMinor,
    shippingMinor,
    taxMinor,
    totalMinor,
    freeShippingThresholdMinor: FREE_SHIPPING_THRESHOLD_MINOR,
    remainingForFreeShippingMinor,
  };
}

export function mergeGuestAndUserCartItems(
  userItems: MergeableCartItem[],
  guestItems: MergeableCartItem[],
  stockByProductId: Record<number, { stock: number; isVisible: boolean }>
): MergeableCartItem[] {
  const combined = new Map<number, number>();

  for (const item of userItems) {
    if (item.quantity > 0) {
      combined.set(item.productId, (combined.get(item.productId) ?? 0) + Math.floor(item.quantity));
    }
  }

  for (const item of guestItems) {
    if (item.quantity > 0) {
      combined.set(item.productId, (combined.get(item.productId) ?? 0) + Math.floor(item.quantity));
    }
  }

  const merged: MergeableCartItem[] = [];
  for (const [productId, rawQty] of combined.entries()) {
    const meta = stockByProductId[productId];
    if (!meta || !meta.isVisible || meta.stock <= 0) {
      continue;
    }
    const clampedQty = Math.min(rawQty, meta.stock);
    if (clampedQty > 0) {
      merged.push({ productId, quantity: clampedQty });
    }
  }

  return merged.sort((a, b) => a.productId - b.productId);
}

export function validateStockForCheckout(
  items: StockCheckItem[]
): { ok: true } | { ok: false; issues: StockIssue[] } {
  const issues: StockIssue[] = [];

  for (const item of items) {
    if (!item.isVisible) {
      issues.push({
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: 0,
        reason: 'unavailable',
      });
    } else if (item.availableStock <= 0) {
      issues.push({
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: 0,
        reason: 'out_of_stock',
      });
    } else if (item.quantity > item.availableStock) {
      issues.push({
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: item.availableStock,
        reason: 'insufficient_stock',
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function isValidFulfilmentStatus(value: string): value is FulfilmentStatus {
  return (FULFILMENT_STATUSES as readonly string[]).includes(value);
}

export function isValidPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function isCodEligible(totalMinor: number): { ok: true } | { ok: false; reason: string } {
  if (totalMinor <= 0) {
    return { ok: false, reason: 'Your cart is empty.' };
  }
  if (totalMinor > COD_MAX_ORDER_MINOR) {
    return {
      ok: false,
      reason: `Cash on Delivery is available for orders up to ${formatCurrency(COD_MAX_ORDER_MINOR, 'INR')}.`,
    };
  }
  return { ok: true };
}
