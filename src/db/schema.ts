import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export interface ShippingDetails {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface PaymentCartSnapshotItem {
  productId: number;
  productName: string;
  productSku: string;
  productImage: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('customer'), // 'customer' | 'admin'
  authProvider: text('auth_provider').notNull().default('email'), // 'email' | 'google'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userSessions = pgTable('user_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  sku: text('sku').notNull().unique(),
  summary: text('summary').notNull(),
  description: text('description').notNull(),
  priceMinor: integer('price_minor').notNull(), // Price in minor units (paise for INR)
  currency: text('currency').notNull().default('INR'),
  stock: integer('stock').notNull().default(0),
  images: jsonb('images').$type<string[]>().notNull().default([]),
  materials: text('materials').notNull().default(''),
  dimensions: text('dimensions').notNull().default(''),
  isVisible: boolean('is_visible').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  guestToken: text('guest_token').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cartItems = pgTable(
  'cart_items',
  {
    id: serial('id').primaryKey(),
    cartId: integer('cart_id')
      .references(() => carts.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    quantity: integer('quantity').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('cart_items_cart_product_idx').on(table.cartId, table.productId)]
);

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'restrict' })
    .notNull(),
  paymentMethod: text('payment_method').notNull().default('online'), // 'online' | 'cod'
  paymentStatus: text('payment_status').notNull().default('paid'), // 'paid' | 'cod_pending' | 'refunded'
  fulfilmentStatus: text('fulfilment_status').notNull().default('confirmed'), // 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  subtotalMinor: integer('subtotal_minor').notNull(),
  shippingMinor: integer('shipping_minor').notNull(),
  taxMinor: integer('tax_minor').notNull(),
  totalMinor: integer('total_minor').notNull(),
  currency: text('currency').notNull().default('INR'),
  shippingName: text('shipping_name').notNull(),
  shippingEmail: text('shipping_email').notNull(),
  shippingPhone: text('shipping_phone').notNull(),
  shippingAddress: text('shipping_address').notNull(),
  shippingCity: text('shipping_city').notNull(),
  shippingPostalCode: text('shipping_postal_code').notNull(),
  shippingCountry: text('shipping_country').notNull().default('India'),
  trackingNote: text('tracking_note').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id').references(() => products.id, {
    onDelete: 'set null',
  }),
  productName: text('product_name').notNull(),
  productSku: text('product_sku').notNull(),
  productImage: text('product_image').notNull().default(''),
  unitPriceMinor: integer('unit_price_minor').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotalMinor: integer('line_total_minor').notNull(),
});

export const paymentAttempts = pgTable('payment_attempts', {
  id: serial('id').primaryKey(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'restrict' })
    .notNull(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'set null' })
    .unique(),
  provider: text('provider').notNull(), // 'razorpay_test' | 'razorpay_sandbox'
  providerOrderId: text('provider_order_id').notNull().unique(),
  providerPaymentId: text('provider_payment_id').unique(),
  status: text('status').notNull().default('created'), // 'created' | 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'uncertain'
  amountMinor: integer('amount_minor').notNull(),
  subtotalMinor: integer('subtotal_minor').notNull(),
  shippingMinor: integer('shipping_minor').notNull(),
  taxMinor: integer('tax_minor').notNull(),
  currency: text('currency').notNull().default('INR'),
  cartSnapshot: jsonb('cart_snapshot').$type<PaymentCartSnapshotItem[]>().notNull(),
  shippingDetails: jsonb('shipping_details').$type<ShippingDetails>().notNull(),
  failureReason: text('failure_reason'),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  source: text('source').notNull().default('footer'),
  subscribedAt: timestamp('subscribed_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Drizzle Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(userSessions),
  cart: one(carts, { fields: [users.id], references: [carts.userId] }),
  orders: many(orders),
  paymentAttempts: many(paymentAttempts),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  paymentAttempt: one(paymentAttempts, {
    fields: [orders.id],
    references: [paymentAttempts.orderId],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const paymentAttemptsRelations = relations(paymentAttempts, ({ one }) => ({
  user: one(users, { fields: [paymentAttempts.userId], references: [users.id] }),
  order: one(orders, { fields: [paymentAttempts.orderId], references: [orders.id] }),
}));
