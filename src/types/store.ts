export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: 'customer' | 'admin' | string;
  authProvider: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  productCount: number;
}

export interface Product {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  categorySlug?: string | null;
  name: string;
  slug: string;
  sku: string;
  summary: string;
  description: string;
  priceMinor: number;
  currency: string;
  stock: number;
  images: string[];
  materials: string;
  dimensions: string;
  isVisible: boolean;
  isFeatured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  productId: number;
  slug: string;
  name: string;
  sku: string;
  categoryName: string;
  image: string;
  unitPriceMinor: number;
  currency: string;
  stock: number;
  isVisible: boolean;
  quantity: number;
  lineTotalMinor: number;
}

export interface CartTotals {
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  freeShippingThresholdMinor: number;
  remainingForFreeShippingMinor: number;
}

export interface CartState {
  items: CartItem[];
  itemCount: number;
  totals: CartTotals;
  currency: string;
  adjustments: string[];
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number | null;
  productName: string;
  productSku: string;
  productImage: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
}

export interface OrderRecord {
  id: number;
  orderNumber: string;
  userId: number;
  customerName?: string;
  customerEmail?: string;
  paymentMethod?: 'online' | 'cod' | string;
  paymentStatus: string;
  fulfilmentStatus: string;
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
  shippingName: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingCountry: string;
  trackingNote: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  paymentAttempt?: {
    id: number;
    provider: string;
    providerOrderId: string;
    providerPaymentId: string | null;
    status: string;
    verifiedAt: string | null;
  } | null;
}

export interface PaymentAttemptSummary {
  id: number;
  provider: string;
  providerOrderId: string;
  status: string;
  amountMinor: number;
  currency: string;
  failureReason: string | null;
  orderId: number | null;
  createdAt: string;
}

export interface NewsletterSubscriber {
  id: number;
  email: string;
  source: string;
  subscribedAt: string;
}

export interface AdminStats {
  confirmedRevenueMinor: number;
  totalOrders: number;
  pendingFulfilmentCount: number;
  totalProducts: number;
  visibleProducts: number;
  lowStockCount: number;
  totalCategories: number;
  totalCustomers: number;
  totalSubscribers?: number;
}
