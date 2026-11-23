var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server/app.ts
import express2 from "express";

// src/server/routes.ts
import crypto5 from "node:crypto";
import express from "express";
import { and as and3, asc, count as count2, desc, eq as eq5, gte, ilike, lte, or, sql as sql2 } from "drizzle-orm";
import { z } from "zod";

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  cartItems: () => cartItems,
  cartItemsRelations: () => cartItemsRelations,
  carts: () => carts,
  cartsRelations: () => cartsRelations,
  categories: () => categories,
  categoriesRelations: () => categoriesRelations,
  newsletterSubscribers: () => newsletterSubscribers,
  orderItems: () => orderItems,
  orderItemsRelations: () => orderItemsRelations,
  orders: () => orders,
  ordersRelations: () => ordersRelations,
  paymentAttempts: () => paymentAttempts,
  paymentAttemptsRelations: () => paymentAttemptsRelations,
  products: () => products,
  productsRelations: () => productsRelations,
  userSessions: () => userSessions,
  users: () => users,
  usersRelations: () => usersRelations
});
import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("customer"),
  // 'customer' | 'admin'
  authProvider: text("auth_provider").notNull().default("email"),
  // 'email' | 'google'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var products = pgTable("products", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null"
  }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sku: text("sku").notNull().unique(),
  summary: text("summary").notNull(),
  description: text("description").notNull(),
  priceMinor: integer("price_minor").notNull(),
  // Price in minor units (paise for INR)
  currency: text("currency").notNull().default("INR"),
  stock: integer("stock").notNull().default(0),
  images: jsonb("images").$type().notNull().default([]),
  materials: text("materials").notNull().default(""),
  dimensions: text("dimensions").notNull().default(""),
  isVisible: boolean("is_visible").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var carts = pgTable("carts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).unique(),
  guestToken: text("guest_token").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    cartId: integer("cart_id").references(() => carts.id, { onDelete: "cascade" }).notNull(),
    productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => [uniqueIndex("cart_items_cart_product_idx").on(table.cartId, table.productId)]
);
var orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  userId: integer("user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  paymentMethod: text("payment_method").notNull().default("online"),
  // 'online' | 'cod'
  paymentStatus: text("payment_status").notNull().default("paid"),
  // 'paid' | 'cod_pending' | 'refunded'
  fulfilmentStatus: text("fulfilment_status").notNull().default("confirmed"),
  // 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  subtotalMinor: integer("subtotal_minor").notNull(),
  shippingMinor: integer("shipping_minor").notNull(),
  taxMinor: integer("tax_minor").notNull(),
  totalMinor: integer("total_minor").notNull(),
  currency: text("currency").notNull().default("INR"),
  shippingName: text("shipping_name").notNull(),
  shippingEmail: text("shipping_email").notNull(),
  shippingPhone: text("shipping_phone").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  shippingCity: text("shipping_city").notNull(),
  shippingPostalCode: text("shipping_postal_code").notNull(),
  shippingCountry: text("shipping_country").notNull().default("India"),
  trackingNote: text("tracking_note").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null"
  }),
  productName: text("product_name").notNull(),
  productSku: text("product_sku").notNull(),
  productImage: text("product_image").notNull().default(""),
  unitPriceMinor: integer("unit_price_minor").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotalMinor: integer("line_total_minor").notNull()
});
var paymentAttempts = pgTable("payment_attempts", {
  id: serial("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  userId: integer("user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }).unique(),
  provider: text("provider").notNull(),
  // 'razorpay_test' | 'razorpay_sandbox'
  providerOrderId: text("provider_order_id").notNull().unique(),
  providerPaymentId: text("provider_payment_id").unique(),
  status: text("status").notNull().default("created"),
  // 'created' | 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'uncertain'
  amountMinor: integer("amount_minor").notNull(),
  subtotalMinor: integer("subtotal_minor").notNull(),
  shippingMinor: integer("shipping_minor").notNull(),
  taxMinor: integer("tax_minor").notNull(),
  currency: text("currency").notNull().default("INR"),
  cartSnapshot: jsonb("cart_snapshot").$type().notNull(),
  shippingDetails: jsonb("shipping_details").$type().notNull(),
  failureReason: text("failure_reason"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("footer"),
  subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(userSessions),
  cart: one(carts, { fields: [users.id], references: [carts.userId] }),
  orders: many(orders),
  paymentAttempts: many(paymentAttempts)
}));
var categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products)
}));
var productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  }),
  cartItems: many(cartItems),
  orderItems: many(orderItems)
}));
var cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems)
}));
var cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] })
}));
var ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  paymentAttempt: one(paymentAttempts, {
    fields: [orders.id],
    references: [paymentAttempts.orderId]
  })
}));
var orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] })
}));
var paymentAttemptsRelations = relations(paymentAttempts, ({ one }) => ({
  user: one(users, { fields: [paymentAttempts.userId], references: [users.id] }),
  order: one(orders, { fields: [paymentAttempts.orderId], references: [orders.id] })
}));

// src/db/poolResilience.ts
var TRANSIENT_PG_CODES = /* @__PURE__ */ new Set([
  "57P01",
  // admin_shutdown (e.g., scale-to-zero or maintenance)
  "57P02",
  // crash_shutdown
  "57P03",
  // cannot_connect_now
  "08000",
  // connection_exception
  "08003",
  // connection_does_not_exist
  "08006"
  // connection_failure
]);
var TRANSIENT_NET_CODES = /* @__PURE__ */ new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ECONNREFUSED",
  "ENOTFOUND"
]);
var TRANSIENT_MESSAGE_PATTERNS = [
  /connection terminated unexpectedly/i,
  /connection terminated/i,
  /server closed the connection unexpectedly/i,
  /client has encountered a connection error/i,
  /socket hang up/i
];
function isTransientIdlePoolError(err) {
  if (!err || typeof err !== "object") {
    return false;
  }
  const record = err;
  const code = typeof record.code === "string" ? record.code : "";
  if (TRANSIENT_PG_CODES.has(code) || TRANSIENT_NET_CODES.has(code)) {
    return true;
  }
  const message = typeof record.message === "string" ? record.message : "";
  if (TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }
  if (record.cause && record.cause !== err) {
    return isTransientIdlePoolError(record.cause);
  }
  return false;
}

// src/db/index.ts
function getConnectionString() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";
  const cleaned = raw.trim().replace(/^["']|["']$/g, "");
  return cleaned || void 0;
}
var isDatabaseConfigured = Boolean(getConnectionString() || process.env.SQL_HOST);
var createPool = () => {
  if (!global._postgresPool) {
    const connectionString = getConnectionString();
    const isServerless = Boolean(process.env.VERCEL);
    const commonPoolOptions = {
      max: isServerless ? 5 : 10,
      idleTimeoutMillis: 1e4,
      connectionTimeoutMillis: 15e3,
      statement_timeout: 15e3,
      keepAlive: true,
      keepAliveInitialDelayMillis: 1e4,
      allowExitOnIdle: isServerless
    };
    if (connectionString) {
      const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("sslmode=disable");
      global._postgresPool = new Pool({
        connectionString,
        ssl: isLocal ? void 0 : { rejectUnauthorized: false },
        ...commonPoolOptions
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : void 0,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        ...commonPoolOptions
      });
    }
    global._postgresPool.on("error", (err) => {
      if (isTransientIdlePoolError(err)) {
        return;
      }
      console.error("SQL pool client error:", err instanceof Error ? err.message : String(err));
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = drizzle(pool, { schema: schema_exports });

// src/db/seed.ts
import { count, eq, sql } from "drizzle-orm";

// src/server/paymentCrypto.ts
import crypto from "node:crypto";
function assertTestModeRazorpayKey(keyId) {
  const trimmed = keyId.trim();
  if (!trimmed) {
    return { valid: false, reason: "RAZORPAY_KEY_ID is empty" };
  }
  if (trimmed.startsWith("rzp_live_")) {
    return {
      valid: false,
      reason: "Live Razorpay keys (rzp_live_*) are strictly disabled. Use a Test Mode key (rzp_test_*)."
    };
  }
  if (!trimmed.startsWith("rzp_test_")) {
    return {
      valid: false,
      reason: "Invalid Razorpay Test Mode key prefix. Expected rzp_test_*."
    };
  }
  return { valid: true };
}
function signRazorpayPayload(razorpayOrderId, razorpayPaymentId, secret) {
  return crypto.createHmac("sha256", secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
}
function verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, providedSignature, secret) {
  if (!razorpayOrderId || !razorpayPaymentId || !providedSignature || !secret) {
    return false;
  }
  const expected = signRazorpayPayload(razorpayOrderId, razorpayPaymentId, secret);
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(providedSignature.trim(), "utf8");
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
function verifyRazorpayWebhookSignature(rawBody, providedSignature, webhookSecret) {
  if (!providedSignature || !webhookSecret) {
    return false;
  }
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(providedSignature.trim(), "utf8");
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) {
    return false;
  }
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) {
    return false;
  }
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expected);
}
function hashSessionToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
function evaluatePaymentTransition(currentStatus, hasOrder, event) {
  if (currentStatus === "succeeded" || hasOrder) {
    return { action: "duplicate_already_confirmed" };
  }
  switch (event.type) {
    case "signature_invalid":
      return {
        action: "mark_uncertain",
        nextStatus: "uncertain",
        reason: "Payment signature verification failed on the server."
      };
    case "gateway_captured":
      return {
        action: "confirm_order",
        nextStatus: "succeeded"
      };
    case "gateway_pending":
      return {
        action: "mark_pending",
        nextStatus: "pending"
      };
    case "gateway_failed":
      return {
        action: "mark_failed",
        nextStatus: "failed",
        reason: event.reason || "Payment was declined by the payment provider."
      };
    case "customer_cancelled":
      return {
        action: "mark_cancelled",
        nextStatus: "cancelled",
        reason: "Payment was cancelled before completion."
      };
  }
}

// src/db/seed.ts
var HERO_IMAGE = "/src/assets/images/hero_kova_collection_1795282144091.jpg";
var SEED_CATEGORIES = [
  {
    name: "Lighting",
    slug: "lighting",
    description: "Sculptural spun-metal and opal-glass desk and ambient lamps.",
    sortOrder: 1
  },
  {
    name: "Tableware",
    slug: "tableware",
    description: "Hand-cast speckled stoneware carafes, cups, and daily vessels.",
    sortOrder: 2
  },
  {
    name: "Desk Objects",
    slug: "desk-objects",
    description: "Milled aluminum catchalls, solid brass instruments, and weighted tools.",
    sortOrder: 3
  },
  {
    name: "Carry & Soft",
    slug: "carry-soft",
    description: "Heavyweight unbleached canvas totes and loom-woven wool-cotton textiles.",
    sortOrder: 4
  }
];
var SEED_PRODUCTS = [
  {
    categorySlug: "lighting",
    name: "Arc Desk Lamp",
    slug: "arc-desk-lamp",
    sku: "KV-LGT-01",
    summary: "Spun-aluminum matte dome shade on a powder-coated charcoal steel column.",
    description: "Designed around a generous hemispherical reflector that casts soft, glare-free pools across a work surface. Spun from 2mm aluminum in a tactile chalk-stone finish and anchored by a weighted matte charcoal steel base with braided textile cord and inline dimmer.",
    priceMinor: 68e4,
    stock: 14,
    images: [
      "/src/assets/images/product_arc_lamp_1795282162126.jpg",
      HERO_IMAGE
    ],
    materials: "Spun aluminum, powder-coated steel, braided linen cord",
    dimensions: "\xD8 28 cm \xD7 H 41 cm \xB7 2.4 kg",
    isVisible: true,
    isFeatured: true
  },
  {
    categorySlug: "tableware",
    name: "Fluted Stoneware Carafe",
    slug: "fluted-stoneware-carafe",
    sku: "KV-TBL-01",
    summary: "Architectural ribbed porcelain water vessel finished in satin oatmeal glaze.",
    description: "Slip-cast in small studio runs with crisp vertical fluting for an effortless grip even when chilled. Fired to vitrification at 1240\xB0C with an iron-flecked matte exterior and food-safe clear satin interior glaze. Holds 1.1 liters.",
    priceMinor: 295e3,
    stock: 22,
    images: [
      "/src/assets/images/product_stoneware_carafe_1795282144095.jpg",
      HERO_IMAGE
    ],
    materials: "High-fired speckled stoneware clay, lead-free mineral glaze",
    dimensions: "\xD8 11.5 cm \xD7 H 25 cm \xB7 1.1 L capacity",
    isVisible: true,
    isFeatured: true
  },
  {
    categorySlug: "desk-objects",
    name: "Monolith Valet Tray",
    slug: "monolith-valet-tray",
    sku: "KV-DSK-01",
    summary: "CNC-milled solid 6061 aluminum organizer in bead-blasted matte charcoal.",
    description: "Carved from a single billet of aerospace aluminum with four sculpted pockets sized for watches, keys, fountain pens, and daily clips. Subtle concentric toolpaths catch ambient light while a recessed cork foot protects timber and stone desktops.",
    priceMinor: 24e4,
    stock: 18,
    images: [
      "/src/assets/images/product_monolith_tray_1795282143935.jpg",
      HERO_IMAGE
    ],
    materials: "Bead-blasted 6061-T6 anodized aluminum, natural Portuguese cork base",
    dimensions: "24 cm \xD7 16 cm \xD7 2.2 cm \xB7 680 g",
    isVisible: true,
    isFeatured: true
  },
  {
    categorySlug: "tableware",
    name: "Stacking Espresso Duo",
    slug: "stacking-espresso-duo",
    sku: "KV-TBL-02",
    summary: "Pair of thick-walled speckled stoneware espresso cups with raw basalt foot.",
    description: "Engineered to retain heat and nest cleanly on an espresso machine warmer tray. Each cup pairs our warm speckled glaze above an unglazed raw charcoal stoneware base for tactile contrast in the hand.",
    priceMinor: 185e3,
    stock: 30,
    images: [
      "/src/assets/images/product_espresso_duo_1795282144243.jpg",
      "/src/assets/images/product_stoneware_carafe_1795282144095.jpg"
    ],
    materials: "Dual-clay speckled stoneware, dishwasher and microwave safe",
    dimensions: "\xD8 6.8 cm \xD7 H 6.2 cm \xB7 110 ml each (set of 2)",
    isVisible: true,
    isFeatured: false
  },
  {
    categorySlug: "lighting",
    name: "Orb Ambient Table Lamp",
    slug: "orb-ambient-table-lamp",
    sku: "KV-LGT-02",
    summary: "Mouth-blown frosted opal glass globe seated on raw cleft basalt stone.",
    description: "Balances luminous lightness against geological weight. A triple-layer acid-etched glass diffuser rests flush inside a hand-turned dark basalt cylinder, radiating warm 2700K ambient light for bedside tables, bookshelves, and quiet corners.",
    priceMinor: 54e4,
    stock: 9,
    images: [
      "/src/assets/images/product_orb_lamp_1795282144335.jpg",
      "/src/assets/images/product_arc_lamp_1795282162126.jpg"
    ],
    materials: "Mouth-blown opal glass, natural carved basalt stone, 2700K LED bulb included",
    dimensions: "\xD8 18 cm \xD7 H 24 cm \xB7 3.1 kg",
    isVisible: true,
    isFeatured: true
  },
  {
    categorySlug: "carry-soft",
    name: "Studio Heavy Canvas Tote",
    slug: "studio-heavy-canvas-tote",
    sku: "KV-CRY-01",
    summary: "Structured 18oz unbleached cotton duck carryall with dual-drop charcoal webbing.",
    description: "Built to stand upright on its own while loading laptops, sketchbooks, or studio samples. Sewn from raw Japanese-weight 18oz cotton canvas with reinforced boxed bottom, interior suspended 16-inch sleeve, and continuous charcoal cotton straps.",
    priceMinor: 32e4,
    stock: 16,
    images: [
      "/src/assets/images/product_canvas_tote_1795282144104.jpg",
      "/src/assets/images/product_woven_throw_1795282143744.jpg"
    ],
    materials: "18oz unbleached cotton duck, 38mm heavy cotton webbing, brass rivets",
    dimensions: "42 cm \xD7 34 cm \xD7 16 cm \xB7 22 L volume",
    isVisible: true,
    isFeatured: false
  },
  {
    categorySlug: "desk-objects",
    name: "Weighted Brass Pen & Rest",
    slug: "weighted-brass-pen-rest",
    sku: "KV-DSK-02",
    summary: "Precision-turned uncoated solid brass rollerball with angled charcoal stone plinth.",
    description: "Machined from solid C36000 brass rod that deepens into a personal patina over years of daily writing. Balanced forward for effortless strokes and docked at 45 degrees inside a chamfered dark stone block. Accepts standard Schmidt P8126 refills.",
    priceMinor: 365e3,
    stock: 11,
    images: [
      "/src/assets/images/product_brass_pen_1795282144045.jpg",
      "/src/assets/images/product_monolith_tray_1795282143935.jpg"
    ],
    materials: "Uncoated solid C36000 brass, honed dark limestone stand",
    dimensions: "Pen 13.8 cm (58 g) \xB7 Stand 7.5 cm \xD7 5 cm \xD7 5.2 cm",
    isVisible: true,
    isFeatured: false
  },
  {
    categorySlug: "carry-soft",
    name: "Woven Ribbed Throw",
    slug: "woven-ribbed-throw",
    sku: "KV-CRY-02",
    summary: "Heavyweight cotton-merino ribbed blanket with architectural charcoal grid lines.",
    description: "Loom-knitted in a lofty fisherman rib that drapes with reassuring weight without overheating. Yarn-dyed in raw stone oat and deep obsidian stripes for an understated graphic accent across sofas and reading chairs.",
    priceMinor: 49e4,
    stock: 7,
    images: [
      "/src/assets/images/product_woven_throw_1795282143744.jpg",
      "/src/assets/images/product_canvas_tote_1795282144104.jpg"
    ],
    materials: "70% combed organic cotton, 30% extrafine merino wool",
    dimensions: "140 cm \xD7 190 cm \xB7 1.35 kg",
    isVisible: true,
    isFeatured: false
  }
];
var seedPromise = null;
async function ensureSchemaTables() {
  try {
    const check = await db.execute(sql`
      SELECT
        to_regclass('public.users') AS users_tbl,
        to_regclass('public.products') AS products_tbl,
        to_regclass('public.orders') AS orders_tbl,
        to_regclass('public.newsletter_subscribers') AS newsletter_tbl
    `);
    const row = check.rows?.[0];
    if (row?.users_tbl && row?.products_tbl && row?.orders_tbl && row?.newsletter_tbl) {
      return;
    }
  } catch {
  }
  try {
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" serial PRIMARY KEY NOT NULL,
      "uid" text NOT NULL UNIQUE,
      "email" text NOT NULL UNIQUE,
      "name" text NOT NULL,
      "password_hash" text,
      "role" text DEFAULT 'customer' NOT NULL,
      "auth_provider" text DEFAULT 'email' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "token_hash" text NOT NULL UNIQUE,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );
  `);
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "categories" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "slug" text NOT NULL UNIQUE,
      "description" text DEFAULT '' NOT NULL,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "products" (
      "id" serial PRIMARY KEY NOT NULL,
      "category_id" integer REFERENCES "categories"("id") ON DELETE set null,
      "name" text NOT NULL,
      "slug" text NOT NULL UNIQUE,
      "sku" text NOT NULL UNIQUE,
      "summary" text NOT NULL,
      "description" text NOT NULL,
      "price_minor" integer NOT NULL,
      "currency" text DEFAULT 'INR' NOT NULL,
      "stock" integer DEFAULT 0 NOT NULL,
      "images" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "materials" text DEFAULT '' NOT NULL,
      "dimensions" text DEFAULT '' NOT NULL,
      "is_visible" boolean DEFAULT true NOT NULL,
      "is_featured" boolean DEFAULT false NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "carts" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer UNIQUE REFERENCES "users"("id") ON DELETE cascade,
      "guest_token" text UNIQUE,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "cart_items" (
      "id" serial PRIMARY KEY NOT NULL,
      "cart_id" integer NOT NULL REFERENCES "carts"("id") ON DELETE cascade,
      "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE cascade,
      "quantity" integer DEFAULT 1 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
    await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_product_idx"
      ON "cart_items" USING btree ("cart_id", "product_id");
  `);
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "orders" (
      "id" serial PRIMARY KEY NOT NULL,
      "order_number" text NOT NULL UNIQUE,
      "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE restrict,
      "payment_method" text DEFAULT 'online' NOT NULL,
      "payment_status" text DEFAULT 'paid' NOT NULL,
      "fulfilment_status" text DEFAULT 'confirmed' NOT NULL,
      "subtotal_minor" integer NOT NULL,
      "shipping_minor" integer NOT NULL,
      "tax_minor" integer NOT NULL,
      "total_minor" integer NOT NULL,
      "currency" text DEFAULT 'INR' NOT NULL,
      "shipping_name" text NOT NULL,
      "shipping_email" text NOT NULL,
      "shipping_phone" text NOT NULL,
      "shipping_address" text NOT NULL,
      "shipping_city" text NOT NULL,
      "shipping_postal_code" text NOT NULL,
      "shipping_country" text DEFAULT 'India' NOT NULL,
      "tracking_note" text DEFAULT '' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
    await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" text DEFAULT 'online' NOT NULL;
  `);
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "order_items" (
      "id" serial PRIMARY KEY NOT NULL,
      "order_id" integer NOT NULL REFERENCES "orders"("id") ON DELETE cascade,
      "product_id" integer REFERENCES "products"("id") ON DELETE set null,
      "product_name" text NOT NULL,
      "product_sku" text NOT NULL,
      "product_image" text DEFAULT '' NOT NULL,
      "unit_price_minor" integer NOT NULL,
      "quantity" integer NOT NULL,
      "line_total_minor" integer NOT NULL
    );
  `);
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payment_attempts" (
      "id" serial PRIMARY KEY NOT NULL,
      "idempotency_key" text NOT NULL UNIQUE,
      "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE restrict,
      "order_id" integer UNIQUE REFERENCES "orders"("id") ON DELETE set null,
      "provider" text NOT NULL,
      "provider_order_id" text NOT NULL UNIQUE,
      "provider_payment_id" text UNIQUE,
      "status" text DEFAULT 'created' NOT NULL,
      "amount_minor" integer NOT NULL,
      "subtotal_minor" integer NOT NULL,
      "shipping_minor" integer NOT NULL,
      "tax_minor" integer NOT NULL,
      "currency" text DEFAULT 'INR' NOT NULL,
      "cart_snapshot" jsonb NOT NULL,
      "shipping_details" jsonb NOT NULL,
      "failure_reason" text,
      "verified_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
      "id" serial PRIMARY KEY NOT NULL,
      "email" text NOT NULL UNIQUE,
      "source" text DEFAULT 'footer' NOT NULL,
      "subscribed_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);
  } catch (err) {
    const code = err?.cause?.code ?? err?.code;
    if (code !== "42501") {
      throw err;
    }
  }
}
async function runSeedInternal() {
  await ensureSchemaTables();
  const adminEmail = "admin@kovagoods.com";
  const customerEmail = "maya@example.com";
  await db.insert(users).values([
    {
      uid: "local_seed_admin_kova",
      email: adminEmail,
      name: "KOVA Studio Admin",
      passwordHash: hashPassword("AdminDemo123!"),
      role: "admin",
      authProvider: "email"
    },
    {
      uid: "local_seed_customer_maya",
      email: customerEmail,
      name: "Maya Deshmukh",
      passwordHash: hashPassword("CustomerDemo123!"),
      role: "customer",
      authProvider: "email"
    }
  ]).onConflictDoNothing();
  const [{ value: catCount }] = await db.select({ value: count() }).from(categories);
  if (Number(catCount) === 0) {
    for (const cat of SEED_CATEGORIES) {
      await db.insert(categories).values(cat).onConflictDoNothing();
    }
  }
  const [{ value: prodCount }] = await db.select({ value: count() }).from(products);
  if (Number(prodCount) === 0) {
    const allCats = await db.select().from(categories);
    const catBySlug = new Map(allCats.map((c) => [c.slug, c.id]));
    for (const item of SEED_PRODUCTS) {
      await db.insert(products).values({
        categoryId: catBySlug.get(item.categorySlug) ?? null,
        name: item.name,
        slug: item.slug,
        sku: item.sku,
        summary: item.summary,
        description: item.description,
        priceMinor: item.priceMinor,
        currency: "INR",
        stock: item.stock,
        images: item.images,
        materials: item.materials,
        dimensions: item.dimensions,
        isVisible: item.isVisible,
        isFeatured: item.isFeatured
      }).onConflictDoNothing();
    }
  }
}
async function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = runSeedInternal().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}
function getAdminEmailAllowlist() {
  const configured = (process.env.ADMIN_EMAILS || "pratham28may2007@gmail.com,admin@kovagoods.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return new Set(configured);
}
async function getUserByEmail(email) {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return rows[0] ?? null;
}

// src/lib/commerce.ts
var FREE_SHIPPING_THRESHOLD_MINOR = 5e5;
var STANDARD_SHIPPING_MINOR = 25e3;
var TAX_RATE_BPS = 1200;
var COD_MAX_ORDER_MINOR = 5e6;
var PAYMENT_STATUSES = ["paid", "cod_pending", "refunded"];
var FULFILMENT_STATUSES = [
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled"
];
function formatCurrency(amountMinor, currency = "INR") {
  const major = amountMinor / 100;
  const hasFraction = amountMinor % 100 !== 0;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(hasFraction ? 2 : 0)}`;
  }
}
function calculateCartTotals(items) {
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
      remainingForFreeShippingMinor: FREE_SHIPPING_THRESHOLD_MINOR
    };
  }
  const shippingMinor = subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR ? 0 : STANDARD_SHIPPING_MINOR;
  const taxMinor = Math.round(subtotalMinor * TAX_RATE_BPS / 1e4);
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
    remainingForFreeShippingMinor
  };
}
function mergeGuestAndUserCartItems(userItems, guestItems, stockByProductId) {
  const combined = /* @__PURE__ */ new Map();
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
  const merged = [];
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
function validateStockForCheckout(items) {
  const issues = [];
  for (const item of items) {
    if (!item.isVisible) {
      issues.push({
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: 0,
        reason: "unavailable"
      });
    } else if (item.availableStock <= 0) {
      issues.push({
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: 0,
        reason: "out_of_stock"
      });
    } else if (item.quantity > item.availableStock) {
      issues.push({
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: item.availableStock,
        reason: "insufficient_stock"
      });
    }
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true };
}
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function isValidFulfilmentStatus(value) {
  return FULFILMENT_STATUSES.includes(value);
}
function isValidPaymentStatus(value) {
  return PAYMENT_STATUSES.includes(value);
}
function isCodEligible(totalMinor) {
  if (totalMinor <= 0) {
    return { ok: false, reason: "Your cart is empty." };
  }
  if (totalMinor > COD_MAX_ORDER_MINOR) {
    return {
      ok: false,
      reason: `Cash on Delivery is available for orders up to ${formatCurrency(COD_MAX_ORDER_MINOR, "INR")}.`
    };
  }
  return { ok: true };
}

// src/middleware/auth.ts
import crypto2 from "node:crypto";
import { and, eq as eq2, gt } from "drizzle-orm";

// src/lib/firebase-admin.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var cachedAuth = null;
function resolveFirebaseProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  let dir = process.cwd();
  try {
    dir = path.dirname(fileURLToPath(import.meta.url));
  } catch {
  }
  const candidates = [
    path.resolve(dir, "../../firebase-applet-config.json"),
    path.resolve(dir, "../firebase-applet-config.json"),
    path.resolve(process.cwd(), "firebase-applet-config.json")
  ];
  for (const configPath of candidates) {
    try {
      if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
        if (parsed.projectId) {
          return parsed.projectId;
        }
      }
    } catch {
    }
  }
  return void 0;
}
async function getAdminAuth() {
  if (cachedAuth) {
    return cachedAuth;
  }
  const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/auth")
  ]);
  if (!getApps().length) {
    const projectId = resolveFirebaseProjectId();
    initializeApp(projectId ? { projectId } : void 0);
  }
  cachedAuth = getAuth();
  return cachedAuth;
}
async function verifyFirebaseIdToken(idToken) {
  const auth = await getAdminAuth();
  return auth.verifyIdToken(idToken);
}

// src/middleware/auth.ts
async function createSessionForUser(userId) {
  const rawToken = `ksess_${crypto2.randomBytes(32).toString("hex")}`;
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + 1e3 * 60 * 60 * 24 * 14);
  try {
    await db.insert(userSessions).values({
      userId,
      tokenHash,
      expiresAt
    });
    return rawToken;
  } catch (error) {
    console.error("Failed to create user session:", error);
    throw new Error("Unable to create authentication session.", { cause: error });
  }
}
async function revokeSessionToken(rawToken) {
  if (!rawToken.startsWith("ksess_")) {
    return;
  }
  const tokenHash = hashSessionToken(rawToken);
  try {
    await db.delete(userSessions).where(eq2(userSessions.tokenHash, tokenHash));
  } catch (error) {
    console.error("Failed to revoke session token:", error);
  }
}
async function upsertGoogleUser(uid, email, name) {
  const normalizedEmail = email.trim().toLowerCase();
  const displayName = name.trim() || normalizedEmail.split("@")[0] || "Customer";
  const adminAllowlist = getAdminEmailAllowlist();
  const shouldBeAdmin = adminAllowlist.has(normalizedEmail);
  try {
    const existingByEmail = await db.select().from(users).where(eq2(users.email, normalizedEmail)).limit(1);
    if (existingByEmail[0]) {
      const targetRole = shouldBeAdmin ? "admin" : existingByEmail[0].role;
      const [updated] = await db.update(users).set({
        uid,
        name: displayName,
        role: targetRole,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(users.id, existingByEmail[0].id)).returning();
      return {
        id: updated.id,
        uid: updated.uid,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        authProvider: updated.authProvider
      };
    }
    const [inserted] = await db.insert(users).values({
      uid,
      email: normalizedEmail,
      name: displayName,
      role: shouldBeAdmin ? "admin" : "customer",
      authProvider: "google"
    }).onConflictDoUpdate({
      target: users.uid,
      set: {
        email: normalizedEmail,
        name: displayName,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return {
      id: inserted.id,
      uid: inserted.uid,
      email: inserted.email,
      name: inserted.name,
      role: inserted.role,
      authProvider: inserted.authProvider
    };
  } catch (error) {
    console.error("Failed to upsert Google user:", error);
    throw new Error("Unable to synchronize user profile.", { cause: error });
  }
}
async function resolveUserFromToken(token) {
  if (token.startsWith("ksess_")) {
    const tokenHash = hashSessionToken(token);
    const now = /* @__PURE__ */ new Date();
    const rows = await db.select({
      id: users.id,
      uid: users.uid,
      email: users.email,
      name: users.name,
      role: users.role,
      authProvider: users.authProvider
    }).from(userSessions).innerJoin(users, eq2(userSessions.userId, users.id)).where(and(eq2(userSessions.tokenHash, tokenHash), gt(userSessions.expiresAt, now))).limit(1);
    return rows[0] ?? null;
  }
  try {
    const decoded = await verifyFirebaseIdToken(token);
    const email = decoded.email || `${decoded.uid}@google.local`;
    const name = decoded.name || email.split("@")[0] || "Customer";
    return await upsertGoogleUser(decoded.uid, email, name);
  } catch {
    return null;
  }
}
async function optionalAuth(req, _res, next) {
  const guestHeader = req.headers["x-guest-cart-token"];
  if (typeof guestHeader === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(guestHeader)) {
    req.guestCartToken = guestHeader;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) {
      req.authToken = token;
      try {
        const user = await resolveUserFromToken(token);
        if (user) {
          req.dbUser = user;
        }
      } catch (error) {
        console.error("Optional auth verification failed:", error);
      }
    }
  }
  next();
}
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required. Please sign in." });
    return;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Authentication required. Missing token." });
    return;
  }
  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: "Session expired or invalid. Please sign in again." });
      return;
    }
    req.dbUser = user;
    req.authToken = token;
    next();
  } catch (error) {
    console.error("Error verifying auth token:", error);
    res.status(401).json({ error: "Authentication verification failed." });
  }
}
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (!req.dbUser || req.dbUser.role !== "admin") {
      res.status(403).json({ error: "Administrator privileges are required for this action." });
      return;
    }
    next();
  });
}

// src/server/cartService.ts
import { and as and2, eq as eq3, inArray } from "drizzle-orm";
async function getOrCreateCartId(params) {
  try {
    if (params.userId) {
      const existing = await db.select({ id: carts.id }).from(carts).where(eq3(carts.userId, params.userId)).limit(1);
      if (existing[0]) {
        return existing[0].id;
      }
      const [created] = await db.insert(carts).values({ userId: params.userId }).onConflictDoNothing().returning({ id: carts.id });
      if (created) {
        return created.id;
      }
      const fallback = await db.select({ id: carts.id }).from(carts).where(eq3(carts.userId, params.userId)).limit(1);
      return fallback[0]?.id ?? null;
    }
    if (params.guestToken) {
      const existing = await db.select({ id: carts.id }).from(carts).where(eq3(carts.guestToken, params.guestToken)).limit(1);
      if (existing[0]) {
        return existing[0].id;
      }
      const [created] = await db.insert(carts).values({ guestToken: params.guestToken }).onConflictDoNothing().returning({ id: carts.id });
      if (created) {
        return created.id;
      }
      const fallback = await db.select({ id: carts.id }).from(carts).where(eq3(carts.guestToken, params.guestToken)).limit(1);
      return fallback[0]?.id ?? null;
    }
    return null;
  } catch (error) {
    console.error("Failed to resolve cart:", error);
    throw new Error("Unable to access shopping cart right now.", { cause: error });
  }
}
async function loadHydratedCart(params) {
  try {
    const empty = {
      items: [],
      itemCount: 0,
      totals: calculateCartTotals([]),
      currency: "INR",
      adjustments: []
    };
    const cartRow = params.userId ? await db.select({ id: carts.id }).from(carts).where(eq3(carts.userId, params.userId)).limit(1) : params.guestToken ? await db.select({ id: carts.id }).from(carts).where(eq3(carts.guestToken, params.guestToken)).limit(1) : [];
    if (!cartRow[0]) {
      return empty;
    }
    const rows = await db.select({
      cartItemId: cartItems.id,
      productId: products.id,
      slug: products.slug,
      name: products.name,
      sku: products.sku,
      categoryName: categories.name,
      images: products.images,
      priceMinor: products.priceMinor,
      currency: products.currency,
      stock: products.stock,
      isVisible: products.isVisible,
      quantity: cartItems.quantity
    }).from(cartItems).innerJoin(products, eq3(cartItems.productId, products.id)).leftJoin(categories, eq3(products.categoryId, categories.id)).where(eq3(cartItems.cartId, cartRow[0].id));
    const adjustments = [];
    const hydrated = [];
    for (const row of rows) {
      if (!row.isVisible || row.stock <= 0) {
        adjustments.push(`${row.name} is currently unavailable and was flagged in your bag.`);
        continue;
      }
      const effectiveQty = Math.min(row.quantity, row.stock);
      if (effectiveQty !== row.quantity) {
        adjustments.push(
          `${row.name} quantity was adjusted to ${effectiveQty} based on available studio stock.`
        );
        await db.update(cartItems).set({ quantity: effectiveQty, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(cartItems.id, row.cartItemId));
      }
      hydrated.push({
        productId: row.productId,
        slug: row.slug,
        name: row.name,
        sku: row.sku,
        categoryName: row.categoryName || "Objects",
        image: row.images[0] || "",
        unitPriceMinor: row.priceMinor,
        currency: row.currency,
        stock: row.stock,
        isVisible: row.isVisible,
        quantity: effectiveQty,
        lineTotalMinor: row.priceMinor * effectiveQty
      });
    }
    hydrated.sort((a, b) => a.productId - b.productId);
    const totals = calculateCartTotals(
      hydrated.map((item) => ({
        productId: item.productId,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity
      }))
    );
    const itemCount = hydrated.reduce((sum, item) => sum + item.quantity, 0);
    return {
      items: hydrated,
      itemCount,
      totals,
      currency: hydrated[0]?.currency || "INR",
      adjustments
    };
  } catch (error) {
    console.error("Failed to load cart:", error);
    throw new Error("Unable to load shopping cart.", { cause: error });
  }
}
async function upsertCartItem(params) {
  const [product] = await db.select().from(products).where(eq3(products.id, params.productId)).limit(1);
  if (!product || !product.isVisible) {
    throw new Error("This product is no longer available.");
  }
  const cartId = await getOrCreateCartId({
    userId: params.userId,
    guestToken: params.guestToken
  });
  if (!cartId) {
    throw new Error("Missing cart session token.");
  }
  try {
    await db.transaction(async (tx) => {
      await tx.select({ id: carts.id }).from(carts).where(eq3(carts.id, cartId)).for("update");
      const existing = await tx.select().from(cartItems).where(and2(eq3(cartItems.cartId, cartId), eq3(cartItems.productId, params.productId))).limit(1);
      const nextQty = params.absoluteQuantity !== void 0 ? Math.floor(params.absoluteQuantity) : (existing[0]?.quantity ?? 0) + Math.floor(params.quantityDelta ?? 1);
      if (nextQty <= 0) {
        if (existing[0]) {
          await tx.delete(cartItems).where(eq3(cartItems.id, existing[0].id));
        }
        return;
      }
      if (product.stock <= 0) {
        throw new Error(`${product.name} is currently out of stock.`);
      }
      if (nextQty > product.stock) {
        throw new Error(`Only ${product.stock} unit(s) of ${product.name} remain in stock.`);
      }
      const now = /* @__PURE__ */ new Date();
      await tx.insert(cartItems).values({
        cartId,
        productId: params.productId,
        quantity: nextQty,
        updatedAt: now
      }).onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.productId],
        set: { quantity: nextQty, updatedAt: now }
      });
    });
    return loadHydratedCart({ userId: params.userId, guestToken: params.guestToken });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("stock") || error.message.includes("available"))) {
      throw error;
    }
    console.error("Failed to update cart item:", error);
    throw new Error("Unable to update cart item.", { cause: error });
  }
}
async function removeCartItem(params) {
  const cartId = await getOrCreateCartId({
    userId: params.userId,
    guestToken: params.guestToken
  });
  if (cartId) {
    try {
      await db.delete(cartItems).where(and2(eq3(cartItems.cartId, cartId), eq3(cartItems.productId, params.productId)));
    } catch (error) {
      console.error("Failed to remove cart item:", error);
      throw new Error("Unable to remove item from cart.", { cause: error });
    }
  }
  return loadHydratedCart({ userId: params.userId, guestToken: params.guestToken });
}
async function mergeGuestCartIntoUserCart(params) {
  try {
    const userCartId = await getOrCreateCartId({ userId: params.userId });
    if (!userCartId) {
      return loadHydratedCart({ userId: params.userId });
    }
    await db.transaction(async (tx) => {
      await tx.select({ id: carts.id }).from(carts).where(eq3(carts.id, userCartId)).for("update");
      const userRows = await tx.select({ productId: cartItems.productId, quantity: cartItems.quantity }).from(cartItems).where(eq3(cartItems.cartId, userCartId));
      let guestCartId = null;
      let guestRows = [];
      if (params.guestToken) {
        const guestCart = await tx.select({ id: carts.id }).from(carts).where(eq3(carts.guestToken, params.guestToken)).for("update");
        if (guestCart[0]) {
          guestCartId = guestCart[0].id;
          guestRows = await tx.select({ productId: cartItems.productId, quantity: cartItems.quantity }).from(cartItems).where(eq3(cartItems.cartId, guestCartId));
        }
      }
      if (!guestCartId && guestRows.length === 0 && params.fallbackItems && params.fallbackItems.length > 0 && userRows.length === 0) {
        guestRows = params.fallbackItems;
      }
      if (guestRows.length === 0) {
        if (guestCartId) {
          await tx.delete(carts).where(eq3(carts.id, guestCartId));
        }
        return;
      }
      const allProductIds = Array.from(
        /* @__PURE__ */ new Set([...userRows.map((i) => i.productId), ...guestRows.map((i) => i.productId)])
      );
      const prodRows = allProductIds.length > 0 ? await tx.select({ id: products.id, stock: products.stock, isVisible: products.isVisible }).from(products).where(inArray(products.id, allProductIds)) : [];
      const stockMap = {};
      for (const p of prodRows) {
        stockMap[p.id] = { stock: p.stock, isVisible: p.isVisible };
      }
      const merged = mergeGuestAndUserCartItems(userRows, guestRows, stockMap);
      await tx.delete(cartItems).where(eq3(cartItems.cartId, userCartId));
      const now = /* @__PURE__ */ new Date();
      for (const item of merged) {
        await tx.insert(cartItems).values({
          cartId: userCartId,
          productId: item.productId,
          quantity: item.quantity,
          updatedAt: now
        }).onConflictDoUpdate({
          target: [cartItems.cartId, cartItems.productId],
          set: { quantity: item.quantity, updatedAt: now }
        });
      }
      if (guestCartId) {
        await tx.delete(carts).where(eq3(carts.id, guestCartId));
      }
    });
    return loadHydratedCart({ userId: params.userId });
  } catch (error) {
    console.error("Failed to merge guest cart:", error);
    throw new Error("Unable to merge guest cart after login.", { cause: error });
  }
}

// src/server/paymentService.ts
import crypto4 from "node:crypto";
import { eq as eq4, inArray as inArray2 } from "drizzle-orm";

// src/server/razorpay.ts
import crypto3 from "node:crypto";
function getSandboxSecret() {
  return process.env.SESSION_SECRET || `kova_local_razorpay_sandbox_secret_${process.env.SQL_DB_NAME || "dev"}`;
}
function getPublicPaymentConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
  if (keyId && keySecret) {
    const check = assertTestModeRazorpayKey(keyId);
    if (!check.valid) {
      return {
        mode: "razorpay_sandbox",
        keyId: null,
        currency: "INR",
        livePaymentsBlocked: true,
        configError: check.reason || "Invalid Razorpay key configuration."
      };
    }
    return {
      mode: "razorpay_test",
      keyId,
      currency: "INR",
      livePaymentsBlocked: true,
      configError: null
    };
  }
  return {
    mode: "razorpay_sandbox",
    keyId: null,
    currency: "INR",
    livePaymentsBlocked: true,
    configError: null
  };
}
async function createGatewayOrder(params) {
  const config = getPublicPaymentConfig();
  if (config.configError) {
    throw new Error(config.configError);
  }
  if (config.mode === "razorpay_test" && config.keyId) {
    const secret = process.env.RAZORPAY_KEY_SECRET.trim();
    const basic = Buffer.from(`${config.keyId}:${secret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: params.amountMinor,
        currency: params.currency,
        receipt: params.receipt.slice(0, 40),
        payment_capture: 1
      })
    });
    const data = await response.json();
    if (!response.ok || !data.id) {
      throw new Error(
        data.error?.description || "Failed to create Razorpay Test Mode order."
      );
    }
    return {
      provider: "razorpay_test",
      providerOrderId: data.id,
      keyId: config.keyId,
      amountMinor: params.amountMinor,
      currency: params.currency
    };
  }
  const sandboxOrderId = `order_sandbox_${crypto3.randomBytes(8).toString("hex")}`;
  return {
    provider: "razorpay_sandbox",
    providerOrderId: sandboxOrderId,
    keyId: null,
    amountMinor: params.amountMinor,
    currency: params.currency
  };
}
function issueSandboxSignedCallback(providerOrderId, outcome) {
  const suffix = outcome === "pending" ? "pending" : "pay";
  const providerPaymentId = `pay_sandbox_${suffix}_${crypto3.randomBytes(6).toString("hex")}`;
  const validSig = signRazorpayPayload(
    providerOrderId,
    providerPaymentId,
    getSandboxSecret()
  );
  if (outcome === "tampered") {
    const flipped = validSig.startsWith("0") ? "1" + validSig.slice(1) : "0" + validSig.slice(1);
    return { providerPaymentId, signature: flipped };
  }
  return { providerPaymentId, signature: validSig };
}
function verifyGatewaySignature(params) {
  const secret = params.provider === "razorpay_test" ? process.env.RAZORPAY_KEY_SECRET?.trim() || "" : getSandboxSecret();
  return verifyRazorpaySignature(
    params.providerOrderId,
    params.providerPaymentId,
    params.signature,
    secret
  );
}
async function inspectGatewayPaymentStatus(params) {
  if (params.provider === "razorpay_test") {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
    const check = assertTestModeRazorpayKey(keyId);
    if (!check.valid || !keySecret) {
      return {
        verifiedStatus: "failed",
        failureReason: "Razorpay Test Mode credentials are not valid."
      };
    }
    const basic = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(params.providerPaymentId)}`,
      {
        headers: {
          Authorization: `Basic ${basic}`
        }
      }
    );
    if (!response.ok) {
      return {
        verifiedStatus: "pending",
        failureReason: "Unable to confirm payment capture status with Razorpay yet."
      };
    }
    const payment = await response.json();
    if (payment.amount !== params.expectedAmountMinor || (payment.currency || "").toUpperCase() !== params.expectedCurrency.toUpperCase()) {
      return {
        verifiedStatus: "failed",
        failureReason: "Payment amount or currency did not match the server order total."
      };
    }
    if (payment.status === "captured") {
      return { verifiedStatus: "captured" };
    }
    if (payment.status === "authorized" || payment.status === "created") {
      return {
        verifiedStatus: "pending",
        failureReason: "Payment is authorized and awaiting final bank capture."
      };
    }
    return {
      verifiedStatus: "failed",
      failureReason: payment.error_description || `Gateway reported status: ${payment.status}`
    };
  }
  if (params.providerPaymentId.includes("_pending_") && !params.recheckAfterDelay) {
    return {
      verifiedStatus: "pending",
      failureReason: "Bank confirmation is delayed. Please re-check payment status shortly."
    };
  }
  return { verifiedStatus: "captured" };
}

// src/server/paymentService.ts
function generateOrderNumber() {
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const suffix = crypto4.randomInt(1e5, 999999);
  return `KOVA-${year}-${suffix}`;
}
async function createPaymentAttemptFromCart(params) {
  const key = params.idempotencyKey?.trim() || `att_${crypto4.randomUUID()}`;
  const existing = await db.select().from(paymentAttempts).where(eq4(paymentAttempts.idempotencyKey, key)).limit(1);
  if (existing[0] && existing[0].userId === params.userId && existing[0].status === "created") {
    return existing[0];
  }
  const userCart = await db.select({ id: carts.id }).from(carts).where(eq4(carts.userId, params.userId)).limit(1);
  if (!userCart[0]) {
    throw new Error("Your shopping bag is empty.");
  }
  const rows = await db.select({
    productId: products.id,
    name: products.name,
    sku: products.sku,
    images: products.images,
    priceMinor: products.priceMinor,
    currency: products.currency,
    stock: products.stock,
    isVisible: products.isVisible,
    quantity: cartItems.quantity
  }).from(cartItems).innerJoin(products, eq4(cartItems.productId, products.id)).where(eq4(cartItems.cartId, userCart[0].id));
  if (rows.length === 0) {
    throw new Error("Your shopping bag is empty.");
  }
  const stockCheck = validateStockForCheckout(
    rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      quantity: r.quantity,
      availableStock: r.stock,
      isVisible: r.isVisible
    }))
  );
  if (!stockCheck.ok) {
    const first = stockCheck.issues[0];
    const message = first.reason === "unavailable" ? `${first.name} is no longer available for purchase.` : first.reason === "out_of_stock" ? `${first.name} is currently out of stock.` : `Only ${first.available} unit(s) of ${first.name} remain in stock.`;
    throw new Error(message);
  }
  const snapshot = rows.map((r) => ({
    productId: r.productId,
    productName: r.name,
    productSku: r.sku,
    productImage: r.images[0] || "",
    unitPriceMinor: r.priceMinor,
    quantity: r.quantity,
    lineTotalMinor: r.priceMinor * r.quantity
  }));
  const totals = calculateCartTotals(
    snapshot.map((item) => ({
      productId: item.productId,
      unitPriceMinor: item.unitPriceMinor,
      quantity: item.quantity
    }))
  );
  const gatewayOrder = await createGatewayOrder({
    amountMinor: totals.totalMinor,
    currency: "INR",
    receipt: key
  });
  try {
    const [attempt] = await db.insert(paymentAttempts).values({
      idempotencyKey: key,
      userId: params.userId,
      provider: gatewayOrder.provider,
      providerOrderId: gatewayOrder.providerOrderId,
      status: "created",
      amountMinor: totals.totalMinor,
      subtotalMinor: totals.subtotalMinor,
      shippingMinor: totals.shippingMinor,
      taxMinor: totals.taxMinor,
      currency: "INR",
      cartSnapshot: snapshot,
      shippingDetails: params.shippingDetails
    }).returning();
    return attempt;
  } catch (error) {
    console.error("Failed to persist payment attempt:", error);
    throw new Error("Could not initialize checkout payment attempt.", { cause: error });
  }
}
async function finalizeConfirmedOrderForAttempt(params) {
  return db.transaction(async (tx) => {
    const [attempt] = await tx.select().from(paymentAttempts).where(eq4(paymentAttempts.id, params.attemptId)).for("update");
    if (!attempt) {
      throw new Error("Payment attempt not found.");
    }
    if (attempt.status === "succeeded" && attempt.orderId) {
      const [existingOrder] = await tx.select().from(orders).where(eq4(orders.id, attempt.orderId)).limit(1);
      if (existingOrder) {
        return { order: existingOrder, duplicate: true };
      }
    }
    const duplicatePay = await tx.select().from(paymentAttempts).where(eq4(paymentAttempts.providerPaymentId, params.providerPaymentId)).limit(1);
    if (duplicatePay[0] && duplicatePay[0].id !== attempt.id && duplicatePay[0].orderId) {
      const [existingOrder] = await tx.select().from(orders).where(eq4(orders.id, duplicatePay[0].orderId)).limit(1);
      if (existingOrder) {
        return { order: existingOrder, duplicate: true };
      }
    }
    const productIds = attempt.cartSnapshot.map((i) => i.productId);
    const lockedProducts = await tx.select().from(products).where(inArray2(products.id, productIds)).for("update");
    const byId = new Map(lockedProducts.map((p) => [p.id, p]));
    for (const item of attempt.cartSnapshot) {
      const prod = byId.get(item.productId);
      if (!prod || prod.stock < item.quantity) {
        await tx.update(paymentAttempts).set({
          status: "uncertain",
          providerPaymentId: params.providerPaymentId,
          failureReason: `Stock changed during payment for ${item.productName}. Please contact support for automatic refund.`,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq4(paymentAttempts.id, attempt.id));
        throw new Error(
          `Stock changed before payment settled for ${item.productName}. Order was not created so you will not be over-allocated.`
        );
      }
    }
    for (const item of attempt.cartSnapshot) {
      const prod = byId.get(item.productId);
      await tx.update(products).set({
        stock: prod.stock - item.quantity,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(products.id, prod.id));
    }
    const [createdOrder] = await tx.insert(orders).values({
      orderNumber: generateOrderNumber(),
      userId: attempt.userId,
      paymentStatus: "paid",
      fulfilmentStatus: "confirmed",
      subtotalMinor: attempt.subtotalMinor,
      shippingMinor: attempt.shippingMinor,
      taxMinor: attempt.taxMinor,
      totalMinor: attempt.amountMinor,
      currency: attempt.currency,
      shippingName: attempt.shippingDetails.fullName,
      shippingEmail: attempt.shippingDetails.email,
      shippingPhone: attempt.shippingDetails.phone,
      shippingAddress: attempt.shippingDetails.address,
      shippingCity: attempt.shippingDetails.city,
      shippingPostalCode: attempt.shippingDetails.postalCode,
      shippingCountry: attempt.shippingDetails.country || "India"
    }).returning();
    await tx.insert(orderItems).values(
      attempt.cartSnapshot.map((item) => ({
        orderId: createdOrder.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        productImage: item.productImage,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity,
        lineTotalMinor: item.lineTotalMinor
      }))
    );
    await tx.update(paymentAttempts).set({
      status: "succeeded",
      orderId: createdOrder.id,
      providerPaymentId: params.providerPaymentId,
      failureReason: null,
      verifiedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(paymentAttempts.id, attempt.id));
    const [userCart] = await tx.select({ id: carts.id }).from(carts).where(eq4(carts.userId, attempt.userId)).limit(1);
    if (userCart) {
      await tx.delete(cartItems).where(eq4(cartItems.cartId, userCart.id));
    }
    return { order: createdOrder, duplicate: false };
  });
}
async function verifyAndProcessPayment(params) {
  const [attempt] = await db.select().from(paymentAttempts).where(eq4(paymentAttempts.id, params.attemptId)).limit(1);
  if (!attempt || attempt.userId !== params.userId) {
    throw new Error("Payment attempt not found.");
  }
  if (attempt.providerOrderId !== params.providerOrderId) {
    throw new Error("Payment order reference mismatch.");
  }
  if (attempt.status === "succeeded" && attempt.orderId) {
    const [existingOrder] = await db.select().from(orders).where(eq4(orders.id, attempt.orderId)).limit(1);
    return {
      status: "succeeded",
      duplicate: true,
      order: existingOrder
    };
  }
  const sigValid = verifyGatewaySignature({
    provider: attempt.provider,
    providerOrderId: params.providerOrderId,
    providerPaymentId: params.providerPaymentId,
    signature: params.signature
  });
  if (!sigValid) {
    const transition = evaluatePaymentTransition(
      attempt.status,
      Boolean(attempt.orderId),
      { type: "signature_invalid" }
    );
    if (transition.action === "mark_uncertain") {
      await db.update(paymentAttempts).set({
        status: "uncertain",
        failureReason: transition.reason,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(paymentAttempts.id, attempt.id));
    }
    return {
      status: "uncertain",
      error: "Payment signature could not be verified on the server. Your cart has been preserved \u2014 do not treat this payment as confirmed."
    };
  }
  const inspection = await inspectGatewayPaymentStatus({
    provider: attempt.provider,
    providerPaymentId: params.providerPaymentId,
    expectedAmountMinor: attempt.amountMinor,
    expectedCurrency: attempt.currency
  });
  if (inspection.verifiedStatus === "pending") {
    await db.update(paymentAttempts).set({
      status: "pending",
      providerPaymentId: params.providerPaymentId,
      failureReason: inspection.failureReason || "Awaiting final bank settlement.",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(paymentAttempts.id, attempt.id));
    return {
      status: "pending",
      attemptId: attempt.id,
      message: inspection.failureReason || "Payment is currently pending confirmation from your bank. No order has been finalized yet."
    };
  }
  if (inspection.verifiedStatus === "failed") {
    await db.update(paymentAttempts).set({
      status: "failed",
      providerPaymentId: params.providerPaymentId,
      failureReason: inspection.failureReason || "Payment failed at gateway.",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(paymentAttempts.id, attempt.id));
    return {
      status: "failed",
      error: inspection.failureReason || "Payment failed. Your cart has been preserved."
    };
  }
  const result = await finalizeConfirmedOrderForAttempt({
    attemptId: attempt.id,
    providerPaymentId: params.providerPaymentId
  });
  return {
    status: "succeeded",
    duplicate: result.duplicate,
    order: result.order
  };
}
async function recordNonSuccessPaymentOutcome(params) {
  const [attempt] = await db.select().from(paymentAttempts).where(eq4(paymentAttempts.id, params.attemptId)).limit(1);
  if (!attempt || attempt.userId !== params.userId) {
    throw new Error("Payment attempt not found.");
  }
  if (attempt.status === "succeeded" && attempt.orderId) {
    return { status: "succeeded", orderId: attempt.orderId };
  }
  const transition = evaluatePaymentTransition(
    attempt.status,
    Boolean(attempt.orderId),
    params.outcome === "cancelled" ? { type: "customer_cancelled" } : { type: "gateway_failed", reason: params.reason || "Payment was declined." }
  );
  if (transition.action === "mark_failed" || transition.action === "mark_cancelled") {
    await db.update(paymentAttempts).set({
      status: transition.nextStatus,
      failureReason: transition.reason,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(paymentAttempts.id, attempt.id));
    return { status: transition.nextStatus, reason: transition.reason };
  }
  return { status: attempt.status };
}
async function recheckPendingPaymentAttempt(params) {
  const [attempt] = await db.select().from(paymentAttempts).where(eq4(paymentAttempts.id, params.attemptId)).limit(1);
  if (!attempt || attempt.userId !== params.userId) {
    throw new Error("Payment attempt not found.");
  }
  if (attempt.status === "succeeded" && attempt.orderId) {
    const [existingOrder] = await db.select().from(orders).where(eq4(orders.id, attempt.orderId)).limit(1);
    return { status: "succeeded", order: existingOrder, duplicate: true };
  }
  if (!attempt.providerPaymentId) {
    return {
      status: attempt.status,
      message: "No payment transaction reference has been received yet."
    };
  }
  const inspection = await inspectGatewayPaymentStatus({
    provider: attempt.provider,
    providerPaymentId: attempt.providerPaymentId,
    expectedAmountMinor: attempt.amountMinor,
    expectedCurrency: attempt.currency,
    recheckAfterDelay: true
  });
  if (inspection.verifiedStatus === "captured") {
    const result = await finalizeConfirmedOrderForAttempt({
      attemptId: attempt.id,
      providerPaymentId: attempt.providerPaymentId
    });
    return { status: "succeeded", order: result.order, duplicate: result.duplicate };
  }
  if (inspection.verifiedStatus === "failed") {
    await db.update(paymentAttempts).set({
      status: "failed",
      failureReason: inspection.failureReason || "Delayed payment failed.",
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq4(paymentAttempts.id, attempt.id));
    return {
      status: "failed",
      error: inspection.failureReason || "Delayed payment failed. Your cart is still saved."
    };
  }
  return {
    status: "pending",
    message: inspection.failureReason || "Payment is still awaiting bank confirmation."
  };
}
async function createCodOrderFromCart(params) {
  return db.transaction(async (tx) => {
    const [userCart] = await tx.select({ id: carts.id }).from(carts).where(eq4(carts.userId, params.userId)).limit(1);
    if (!userCart) {
      throw new Error("Your shopping cart is empty.");
    }
    const rows = await tx.select({
      productId: products.id,
      name: products.name,
      sku: products.sku,
      images: products.images,
      priceMinor: products.priceMinor,
      currency: products.currency,
      stock: products.stock,
      isVisible: products.isVisible,
      quantity: cartItems.quantity
    }).from(cartItems).innerJoin(products, eq4(cartItems.productId, products.id)).where(eq4(cartItems.cartId, userCart.id));
    if (rows.length === 0) {
      throw new Error("Your shopping cart is empty.");
    }
    const productIds = rows.map((r) => r.productId);
    const lockedProducts = await tx.select().from(products).where(inArray2(products.id, productIds)).for("update");
    const byId = new Map(lockedProducts.map((p) => [p.id, p]));
    const stockCheck = validateStockForCheckout(
      rows.map((r) => {
        const live = byId.get(r.productId);
        return {
          productId: r.productId,
          name: r.name,
          quantity: r.quantity,
          availableStock: live?.stock ?? 0,
          isVisible: live?.isVisible ?? false
        };
      })
    );
    if (!stockCheck.ok) {
      const first = stockCheck.issues[0];
      const message = first.reason === "unavailable" ? `${first.name} is no longer available for purchase.` : first.reason === "out_of_stock" ? `${first.name} is currently out of stock.` : `Only ${first.available} unit(s) of ${first.name} remain in stock.`;
      throw new Error(message);
    }
    const snapshot = rows.map((r) => {
      const live = byId.get(r.productId);
      return {
        productId: live.id,
        productName: live.name,
        productSku: live.sku,
        productImage: (live.images || [])[0] || "",
        unitPriceMinor: live.priceMinor,
        quantity: r.quantity,
        lineTotalMinor: live.priceMinor * r.quantity
      };
    });
    const totals = calculateCartTotals(
      snapshot.map((item) => ({
        productId: item.productId,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity
      }))
    );
    const eligibility = isCodEligible(totals.totalMinor);
    if (!eligibility.ok) {
      throw new Error(eligibility.reason);
    }
    for (const item of snapshot) {
      const live = byId.get(item.productId);
      await tx.update(products).set({
        stock: live.stock - item.quantity,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(products.id, live.id));
    }
    const [createdOrder] = await tx.insert(orders).values({
      orderNumber: generateOrderNumber(),
      userId: params.userId,
      paymentMethod: "cod",
      paymentStatus: "cod_pending",
      fulfilmentStatus: "confirmed",
      subtotalMinor: totals.subtotalMinor,
      shippingMinor: totals.shippingMinor,
      taxMinor: totals.taxMinor,
      totalMinor: totals.totalMinor,
      currency: "INR",
      shippingName: params.shippingDetails.fullName,
      shippingEmail: params.shippingDetails.email,
      shippingPhone: params.shippingDetails.phone,
      shippingAddress: params.shippingDetails.address,
      shippingCity: params.shippingDetails.city,
      shippingPostalCode: params.shippingDetails.postalCode,
      shippingCountry: params.shippingDetails.country || "India"
    }).returning();
    const createdItems = await tx.insert(orderItems).values(
      snapshot.map((item) => ({
        orderId: createdOrder.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        productImage: item.productImage,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity,
        lineTotalMinor: item.lineTotalMinor
      }))
    ).returning();
    await tx.delete(cartItems).where(eq4(cartItems.cartId, userCart.id));
    return {
      ...createdOrder,
      items: createdItems
    };
  });
}

// src/server/cacheHeaders.ts
var CACHE_HEADERS = {
  /** Public catalogue endpoints cached on Vercel Edge CDN with background revalidation */
  PUBLIC_CATALOG: "public, max-age=30, s-maxage=120, stale-while-revalidate=600",
  /** Public non-sensitive runtime config (e.g. payment methods & gateway mode) */
  PUBLIC_CONFIG: "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  /** Private, authenticated, cart, order, admin, and mutating responses */
  PRIVATE_NO_STORE: "private, no-store, no-cache, must-revalidate"
};
function applyPublicCatalogCache(res) {
  res.setHeader("Cache-Control", CACHE_HEADERS.PUBLIC_CATALOG);
  res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
}
function applyPublicConfigCache(res) {
  res.setHeader("Cache-Control", CACHE_HEADERS.PUBLIC_CONFIG);
  res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
}
function applyPrivateNoStore(res) {
  res.setHeader("Cache-Control", CACHE_HEADERS.PRIVATE_NO_STORE);
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}

// src/server/routes.ts
var apiRouter = express.Router();
apiRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    databaseConfigured: isDatabaseConfigured
  });
});
apiRouter.use(async (_req, res, next) => {
  if (!isDatabaseConfigured) {
    res.status(503).json({
      error: "Database is not configured. Add DATABASE_URL (PostgreSQL) in your Vercel Environment Variables and redeploy."
    });
    return;
  }
  try {
    await ensureSeeded();
  } catch (err) {
    console.error("Lazy seed warning:", err);
  }
  next();
});
var signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name (at least 2 characters).").max(120),
  email: z.string().trim().email("Please enter a valid email address.").max(180),
  password: z.string().min(8, "Password must be at least 8 characters.").max(120),
  guestToken: z.string().optional(),
  guestItems: z.array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().positive().max(99)
    })
  ).optional()
});
var loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  guestToken: z.string().optional(),
  guestItems: z.array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().positive().max(99)
    })
  ).optional()
});
var shippingSchema = z.object({
  fullName: z.string().trim().min(2, "Recipient name is required.").max(120),
  email: z.string().trim().email("Valid email is required.").max(180),
  phone: z.string().trim().min(7, "Phone number is required.").max(30),
  address: z.string().trim().min(5, "Street address is required.").max(250),
  city: z.string().trim().min(2, "City is required.").max(100),
  postalCode: z.string().trim().min(3, "Postal code is required.").max(20),
  country: z.string().trim().min(2).max(80).default("India")
});
var productWriteSchema = z.object({
  name: z.string().trim().min(2, "Product name is required.").max(160),
  slug: z.string().trim().max(160).optional(),
  sku: z.string().trim().min(2, "SKU is required.").max(60),
  categoryId: z.number().int().positive().nullable().optional(),
  summary: z.string().trim().min(4, "Short summary is required.").max(300),
  description: z.string().trim().min(8, "Full description is required.").max(4e3),
  priceMinor: z.number().int().min(100, "Price must be at least \u20B91.00."),
  stock: z.number().int().min(0, "Stock cannot be negative.").max(1e5),
  images: z.array(z.string().trim().min(1)).max(10).default([]),
  materials: z.string().trim().max(300).default(""),
  dimensions: z.string().trim().max(200).default(""),
  isVisible: z.boolean().default(true),
  isFeatured: z.boolean().default(false)
});
var categoryWriteSchema = z.object({
  name: z.string().trim().min(2, "Category name is required.").max(80),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().max(300).default(""),
  sortOrder: z.number().int().min(0).max(999).default(0)
});
apiRouter.get("/categories", async (_req, res) => {
  try {
    const catRows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
    const counts = await db.select({
      categoryId: products.categoryId,
      productCount: count2()
    }).from(products).where(eq5(products.isVisible, true)).groupBy(products.categoryId);
    const countMap = new Map(counts.map((c) => [c.categoryId, Number(c.productCount)]));
    applyPublicCatalogCache(res);
    res.json({
      categories: catRows.map((c) => ({
        ...c,
        productCount: countMap.get(c.id) ?? 0
      }))
    });
  } catch (error) {
    console.error("GET /api/categories failed:", error);
    res.status(500).json({ error: "Unable to load categories." });
  }
});
apiRouter.get("/products", async (req, res) => {
  try {
    const categorySlug = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const inStockOnly = req.query.inStock === "true";
    const featuredOnly = req.query.featured === "true";
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
    const sort = typeof req.query.sort === "string" ? req.query.sort : "featured";
    const conditions = [eq5(products.isVisible, true)];
    if (categorySlug && categorySlug !== "all") {
      const [cat] = await db.select({ id: categories.id }).from(categories).where(eq5(categories.slug, categorySlug)).limit(1);
      if (!cat) {
        res.json({ products: [] });
        return;
      }
      conditions.push(eq5(products.categoryId, cat.id));
    }
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(products.name, pattern),
          ilike(products.summary, pattern),
          ilike(products.description, pattern),
          ilike(products.materials, pattern),
          ilike(products.sku, pattern)
        )
      );
    }
    if (inStockOnly) {
      conditions.push(gte(products.stock, 1));
    }
    if (featuredOnly) {
      conditions.push(eq5(products.isFeatured, true));
    }
    if (minPrice !== null && !Number.isNaN(minPrice) && minPrice >= 0) {
      conditions.push(gte(products.priceMinor, Math.round(minPrice * 100)));
    }
    if (maxPrice !== null && !Number.isNaN(maxPrice) && maxPrice > 0) {
      conditions.push(lte(products.priceMinor, Math.round(maxPrice * 100)));
    }
    const orderByClause = sort === "price_asc" ? [asc(products.priceMinor), asc(products.name)] : sort === "price_desc" ? [desc(products.priceMinor), asc(products.name)] : sort === "newest" ? [desc(products.createdAt), asc(products.name)] : [desc(products.isFeatured), asc(products.id)];
    const rows = await db.select({
      id: products.id,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      name: products.name,
      slug: products.slug,
      sku: products.sku,
      summary: products.summary,
      description: products.description,
      priceMinor: products.priceMinor,
      currency: products.currency,
      stock: products.stock,
      images: products.images,
      materials: products.materials,
      dimensions: products.dimensions,
      isVisible: products.isVisible,
      isFeatured: products.isFeatured,
      createdAt: products.createdAt
    }).from(products).leftJoin(categories, eq5(products.categoryId, categories.id)).where(and3(...conditions)).orderBy(...orderByClause);
    applyPublicCatalogCache(res);
    res.json({ products: rows });
  } catch (error) {
    console.error("GET /api/products failed:", error);
    res.status(500).json({ error: "Unable to load product catalogue." });
  }
});
apiRouter.get("/products/:slug", async (req, res) => {
  try {
    const slug = req.params.slug.trim();
    const rows = await db.select({
      id: products.id,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      name: products.name,
      slug: products.slug,
      sku: products.sku,
      summary: products.summary,
      description: products.description,
      priceMinor: products.priceMinor,
      currency: products.currency,
      stock: products.stock,
      images: products.images,
      materials: products.materials,
      dimensions: products.dimensions,
      isVisible: products.isVisible,
      isFeatured: products.isFeatured,
      createdAt: products.createdAt
    }).from(products).leftJoin(categories, eq5(products.categoryId, categories.id)).where(and3(eq5(products.slug, slug), eq5(products.isVisible, true))).limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    const product = rows[0];
    const related = await db.select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      summary: products.summary,
      priceMinor: products.priceMinor,
      currency: products.currency,
      stock: products.stock,
      images: products.images,
      categoryName: categories.name
    }).from(products).leftJoin(categories, eq5(products.categoryId, categories.id)).where(and3(eq5(products.isVisible, true), sql2`${products.id} != ${product.id}`)).orderBy(desc(products.isFeatured), asc(products.id)).limit(3);
    applyPublicCatalogCache(res);
    res.json({ product, related });
  } catch (error) {
    console.error("GET /api/products/:slug failed:", error);
    res.status(500).json({ error: "Unable to load product details." });
  }
});
var newsletterSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").max(180),
  source: z.string().trim().max(40).default("footer")
});
apiRouter.post("/newsletter/subscribe", async (req, res) => {
  const parsed = newsletterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || "Please enter a valid email address."
    });
    return;
  }
  const normalizedEmail = parsed.data.email.toLowerCase();
  try {
    const [existing] = await db.select().from(newsletterSubscribers).where(eq5(newsletterSubscribers.email, normalizedEmail)).limit(1);
    if (existing) {
      res.status(200).json({
        subscribed: true,
        alreadySubscribed: true,
        subscriber: {
          id: existing.id,
          email: existing.email,
          source: existing.source,
          subscribedAt: existing.subscribedAt
        },
        message: "This email is already on the KOVA collection dispatch list."
      });
      return;
    }
    const [created] = await db.insert(newsletterSubscribers).values({
      email: normalizedEmail,
      source: parsed.data.source || "footer"
    }).returning();
    res.status(201).json({
      subscribed: true,
      alreadySubscribed: false,
      subscriber: {
        id: created.id,
        email: created.email,
        source: created.source,
        subscribedAt: created.subscribedAt
      },
      message: "Subscribed \u2014 we will notify you when new KOVA collections release."
    });
  } catch (error) {
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === "23505") {
      res.status(200).json({
        subscribed: true,
        alreadySubscribed: true,
        message: "This email is already on the KOVA collection dispatch list."
      });
      return;
    }
    console.error("POST /api/newsletter/subscribe failed:", error);
    res.status(500).json({ error: "Unable to save your subscription right now. Please try again." });
  }
});
apiRouter.post("/auth/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid signup details." });
    return;
  }
  const { name, email, password, guestToken, guestItems } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  try {
    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists. Please sign in." });
      return;
    }
    const adminAllowlist = getAdminEmailAllowlist();
    const role = adminAllowlist.has(normalizedEmail) ? "admin" : "customer";
    const [created] = await db.insert(users).values({
      uid: `local_${crypto5.randomUUID()}`,
      email: normalizedEmail,
      name,
      passwordHash: hashPassword(password),
      role,
      authProvider: "email"
    }).returning();
    const token = await createSessionForUser(created.id);
    const cart = await mergeGuestCartIntoUserCart({
      userId: created.id,
      guestToken,
      fallbackItems: guestItems
    });
    res.status(201).json({
      token,
      user: {
        id: created.id,
        uid: created.uid,
        email: created.email,
        name: created.name,
        role: created.role,
        authProvider: created.authProvider
      },
      cart
    });
  } catch (error) {
    console.error("POST /api/auth/signup failed:", error);
    res.status(500).json({ error: "Unable to create account right now." });
  }
});
apiRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid login credentials." });
    return;
  }
  const { email, password, guestToken, guestItems } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  try {
    const user = await getUserByEmail(normalizedEmail);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Incorrect email or password." });
      return;
    }
    const token = await createSessionForUser(user.id);
    const cart = await mergeGuestCartIntoUserCart({
      userId: user.id,
      guestToken,
      fallbackItems: guestItems
    });
    res.json({
      token,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: user.role,
        authProvider: user.authProvider
      },
      cart
    });
  } catch (error) {
    console.error("POST /api/auth/login failed:", error);
    res.status(500).json({ error: "Unable to sign in right now." });
  }
});
apiRouter.post("/auth/google", async (req, res) => {
  const authHeader = req.headers.authorization;
  const idToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!idToken) {
    res.status(401).json({ error: "Missing Firebase ID token." });
    return;
  }
  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    const email = decoded.email || `${decoded.uid}@google.local`;
    const name = decoded.name || email.split("@")[0] || "Customer";
    const user = await upsertGoogleUser(decoded.uid, email, name);
    const guestToken = typeof req.body?.guestToken === "string" ? req.body.guestToken : void 0;
    const guestItems = Array.isArray(req.body?.guestItems) ? req.body.guestItems : void 0;
    const cart = await mergeGuestCartIntoUserCart({
      userId: user.id,
      guestToken,
      fallbackItems: guestItems
    });
    res.json({ user, cart });
  } catch (error) {
    console.error("POST /api/auth/google failed:", error);
    res.status(401).json({ error: "Unable to verify Google Sign-In token." });
  }
});
apiRouter.post("/auth/logout", optionalAuth, async (req, res) => {
  if (req.authToken) {
    await revokeSessionToken(req.authToken);
  }
  res.json({ ok: true });
});
apiRouter.get("/auth/me", requireAuth, async (req, res) => {
  res.json({ user: req.dbUser });
});
apiRouter.get("/cart", optionalAuth, async (req, res) => {
  try {
    const cart = await loadHydratedCart({
      userId: req.dbUser?.id,
      guestToken: req.guestCartToken
    });
    res.json({ cart });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load cart." });
  }
});
apiRouter.post("/cart/items", optionalAuth, async (req, res) => {
  const schema = z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(50).default(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valid productId and quantity are required." });
    return;
  }
  if (!req.dbUser && !req.guestCartToken) {
    res.status(400).json({ error: "Missing guest cart token header." });
    return;
  }
  try {
    const cart = await upsertCartItem({
      userId: req.dbUser?.id,
      guestToken: req.guestCartToken,
      productId: parsed.data.productId,
      quantityDelta: parsed.data.quantity
    });
    res.json({ cart });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to add item to cart." });
  }
});
apiRouter.patch("/cart/items/:productId", optionalAuth, async (req, res) => {
  const productId = Number(req.params.productId);
  const schema = z.object({ quantity: z.number().int().min(0).max(99) });
  const parsed = schema.safeParse(req.body);
  if (!Number.isInteger(productId) || productId <= 0 || !parsed.success) {
    res.status(400).json({ error: "Valid productId and quantity are required." });
    return;
  }
  if (!req.dbUser && !req.guestCartToken) {
    res.status(400).json({ error: "Missing guest cart token header." });
    return;
  }
  try {
    const cart = await upsertCartItem({
      userId: req.dbUser?.id,
      guestToken: req.guestCartToken,
      productId,
      absoluteQuantity: parsed.data.quantity
    });
    res.json({ cart });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to update cart quantity." });
  }
});
apiRouter.delete("/cart/items/:productId", optionalAuth, async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    res.status(400).json({ error: "Valid productId is required." });
    return;
  }
  try {
    const cart = await removeCartItem({
      userId: req.dbUser?.id,
      guestToken: req.guestCartToken,
      productId
    });
    res.json({ cart });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to remove cart item." });
  }
});
apiRouter.post("/cart/merge", requireAuth, async (req, res) => {
  const guestToken = typeof req.body?.guestToken === "string" ? req.body.guestToken : void 0;
  const fallbackItems = Array.isArray(req.body?.guestItems) ? req.body.guestItems : void 0;
  try {
    const cart = await mergeGuestCartIntoUserCart({
      userId: req.dbUser.id,
      guestToken,
      fallbackItems
    });
    res.json({ cart });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to merge cart." });
  }
});
apiRouter.get("/payments/config", (_req, res) => {
  applyPublicConfigCache(res);
  res.json(getPublicPaymentConfig());
});
apiRouter.post("/checkout/create-attempt", requireAuth, async (req, res) => {
  const parsed = z.object({
    shipping: shippingSchema,
    idempotencyKey: z.string().trim().max(120).optional()
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || "Please complete all shipping fields."
    });
    return;
  }
  try {
    const attempt = await createPaymentAttemptFromCart({
      userId: req.dbUser.id,
      shippingDetails: parsed.data.shipping,
      idempotencyKey: parsed.data.idempotencyKey
    });
    const config = getPublicPaymentConfig();
    res.status(201).json({
      attempt: {
        id: attempt.id,
        provider: attempt.provider,
        providerOrderId: attempt.providerOrderId,
        amountMinor: attempt.amountMinor,
        subtotalMinor: attempt.subtotalMinor,
        shippingMinor: attempt.shippingMinor,
        taxMinor: attempt.taxMinor,
        currency: attempt.currency,
        status: attempt.status
      },
      gateway: {
        mode: config.mode,
        keyId: config.keyId,
        livePaymentsBlocked: true
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to start checkout." });
  }
});
apiRouter.post("/checkout/cod", requireAuth, async (req, res) => {
  const parsed = z.object({
    shipping: shippingSchema
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || "Please complete all shipping fields."
    });
    return;
  }
  try {
    const order = await createCodOrderFromCart({
      userId: req.dbUser.id,
      shippingDetails: parsed.data.shipping
    });
    res.status(201).json({ order });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to place Cash on Delivery order." });
  }
});
apiRouter.post("/payments/:attemptId/sandbox-authorize", requireAuth, async (req, res) => {
  const config = getPublicPaymentConfig();
  if (config.mode !== "razorpay_sandbox") {
    res.status(403).json({
      error: "Sandbox simulator endpoint is disabled when Razorpay Test Mode keys are active."
    });
    return;
  }
  const attemptId = Number(req.params.attemptId);
  const outcomeSchema = z.object({
    outcome: z.enum(["captured", "pending", "tampered"])
  });
  const parsed = outcomeSchema.safeParse(req.body);
  if (!Number.isInteger(attemptId) || !parsed.success) {
    res.status(400).json({ error: "Invalid sandbox simulation parameters." });
    return;
  }
  const [attempt] = await db.select().from(paymentAttempts).where(and3(eq5(paymentAttempts.id, attemptId), eq5(paymentAttempts.userId, req.dbUser.id))).limit(1);
  if (!attempt || attempt.provider !== "razorpay_sandbox") {
    res.status(404).json({ error: "Sandbox payment attempt not found." });
    return;
  }
  const signed = issueSandboxSignedCallback(attempt.providerOrderId, parsed.data.outcome);
  res.json({
    providerOrderId: attempt.providerOrderId,
    providerPaymentId: signed.providerPaymentId,
    signature: signed.signature
  });
});
apiRouter.post("/payments/verify", requireAuth, async (req, res) => {
  const parsed = z.object({
    attemptId: z.number().int().positive(),
    providerOrderId: z.string().trim().min(3),
    providerPaymentId: z.string().trim().min(3),
    signature: z.string().trim().min(8)
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Incomplete payment verification payload." });
    return;
  }
  try {
    const result = await verifyAndProcessPayment({
      userId: req.dbUser.id,
      attemptId: parsed.data.attemptId,
      providerOrderId: parsed.data.providerOrderId,
      providerPaymentId: parsed.data.providerPaymentId,
      signature: parsed.data.signature
    });
    if (result.status === "uncertain" || result.status === "failed") {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (error) {
    console.error("POST /api/payments/verify failed:", error);
    res.status(400).json({
      status: "uncertain",
      error: error.message || "Payment verification failed."
    });
  }
});
apiRouter.post("/payments/:attemptId/mark-outcome", requireAuth, async (req, res) => {
  const attemptId = Number(req.params.attemptId);
  const parsed = z.object({
    outcome: z.enum(["failed", "cancelled"]),
    reason: z.string().trim().max(250).optional()
  }).safeParse(req.body);
  if (!Number.isInteger(attemptId) || !parsed.success) {
    res.status(400).json({ error: "Invalid payment outcome parameters." });
    return;
  }
  try {
    const result = await recordNonSuccessPaymentOutcome({
      userId: req.dbUser.id,
      attemptId,
      outcome: parsed.data.outcome,
      reason: parsed.data.reason
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to record payment status." });
  }
});
apiRouter.post("/payments/:attemptId/recheck", requireAuth, async (req, res) => {
  const attemptId = Number(req.params.attemptId);
  if (!Number.isInteger(attemptId) || attemptId <= 0) {
    res.status(400).json({ error: "Invalid payment attempt ID." });
    return;
  }
  try {
    const result = await recheckPendingPaymentAttempt({
      userId: req.dbUser.id,
      attemptId
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to re-check payment status." });
  }
});
apiRouter.post("/payments/razorpay/webhook", async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = req.rawBody;
  if (!webhookSecret || typeof signature !== "string" || !rawBody) {
    res.status(400).json({ error: "Webhook verification configuration or signature missing." });
    return;
  }
  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    res.status(401).json({ error: "Invalid webhook signature." });
    return;
  }
  try {
    const event = req.body;
    const entity = event.payload?.payment?.entity;
    if (!entity?.order_id || !entity?.id) {
      res.json({ received: true });
      return;
    }
    const [attempt] = await db.select().from(paymentAttempts).where(eq5(paymentAttempts.providerOrderId, entity.order_id)).limit(1);
    if (!attempt) {
      res.json({ received: true });
      return;
    }
    if (event.event === "payment.captured") {
      await finalizeConfirmedOrderForAttempt({
        attemptId: attempt.id,
        providerPaymentId: entity.id
      });
    } else if (event.event === "payment.failed" && attempt.status !== "succeeded") {
      await db.update(paymentAttempts).set({
        status: "failed",
        providerPaymentId: entity.id,
        failureReason: entity.error_description || "Payment failed via Razorpay webhook.",
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq5(paymentAttempts.id, attempt.id));
    }
    res.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Webhook processing failed." });
  }
});
apiRouter.get("/orders", requireAuth, async (req, res) => {
  try {
    const customerOrders = await db.select().from(orders).where(eq5(orders.userId, req.dbUser.id)).orderBy(desc(orders.createdAt));
    const orderIds = customerOrders.map((o) => o.id);
    const items = orderIds.length > 0 ? await db.select().from(orderItems).where(sql2`${orderItems.orderId} IN (${sql2.join(orderIds, sql2`, `)})`) : [];
    const itemsByOrderId = /* @__PURE__ */ new Map();
    for (const item of items) {
      const list = itemsByOrderId.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrderId.set(item.orderId, list);
    }
    const recentAttempts = await db.select({
      id: paymentAttempts.id,
      provider: paymentAttempts.provider,
      providerOrderId: paymentAttempts.providerOrderId,
      status: paymentAttempts.status,
      amountMinor: paymentAttempts.amountMinor,
      currency: paymentAttempts.currency,
      failureReason: paymentAttempts.failureReason,
      orderId: paymentAttempts.orderId,
      createdAt: paymentAttempts.createdAt
    }).from(paymentAttempts).where(eq5(paymentAttempts.userId, req.dbUser.id)).orderBy(desc(paymentAttempts.createdAt)).limit(10);
    res.json({
      orders: customerOrders.map((o) => ({
        ...o,
        items: itemsByOrderId.get(o.id) ?? []
      })),
      paymentAttempts: recentAttempts.filter((a) => a.status !== "succeeded")
    });
  } catch (error) {
    console.error("GET /api/orders failed:", error);
    res.status(500).json({ error: "Unable to load order history." });
  }
});
apiRouter.get("/orders/:orderNumber", requireAuth, async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber.trim();
    const [order] = await db.select().from(orders).where(eq5(orders.orderNumber, orderNumber)).limit(1);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    if (order.userId !== req.dbUser.id && req.dbUser.role !== "admin") {
      res.status(403).json({ error: "You do not have permission to view this order." });
      return;
    }
    const items = await db.select().from(orderItems).where(eq5(orderItems.orderId, order.id));
    const [attempt] = await db.select({
      id: paymentAttempts.id,
      provider: paymentAttempts.provider,
      providerOrderId: paymentAttempts.providerOrderId,
      providerPaymentId: paymentAttempts.providerPaymentId,
      status: paymentAttempts.status,
      verifiedAt: paymentAttempts.verifiedAt
    }).from(paymentAttempts).where(eq5(paymentAttempts.orderId, order.id)).limit(1);
    res.json({
      order: {
        ...order,
        items,
        paymentAttempt: attempt ?? null
      }
    });
  } catch (error) {
    console.error("GET /api/orders/:orderNumber failed:", error);
    res.status(500).json({ error: "Unable to load order details." });
  }
});
apiRouter.get("/admin/overview", requireAdmin, async (_req, res) => {
  try {
    const [allOrders, allProducts, allUsers, allCategories, allSubscribers] = await Promise.all([
      db.select().from(orders),
      db.select().from(products),
      db.select({ id: users.id, role: users.role }).from(users),
      db.select({ id: categories.id }).from(categories),
      db.select({ id: newsletterSubscribers.id }).from(newsletterSubscribers)
    ]);
    const confirmedRevenueMinor = allOrders.filter((o) => o.fulfilmentStatus !== "cancelled").reduce((sum, o) => sum + o.totalMinor, 0);
    const pendingFulfilmentCount = allOrders.filter(
      (o) => o.fulfilmentStatus === "confirmed" || o.fulfilmentStatus === "processing"
    ).length;
    const lowStockCount = allProducts.filter((p) => p.stock <= 5).length;
    res.json({
      stats: {
        confirmedRevenueMinor,
        totalOrders: allOrders.length,
        pendingFulfilmentCount,
        totalProducts: allProducts.length,
        visibleProducts: allProducts.filter((p) => p.isVisible).length,
        lowStockCount,
        totalCategories: allCategories.length,
        totalCustomers: allUsers.filter((u) => u.role === "customer").length,
        totalSubscribers: allSubscribers.length
      }
    });
  } catch (error) {
    console.error("GET /api/admin/overview failed:", error);
    res.status(500).json({ error: "Unable to load admin overview." });
  }
});
apiRouter.get("/admin/products", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select({
      id: products.id,
      categoryId: products.categoryId,
      categoryName: categories.name,
      name: products.name,
      slug: products.slug,
      sku: products.sku,
      summary: products.summary,
      description: products.description,
      priceMinor: products.priceMinor,
      currency: products.currency,
      stock: products.stock,
      images: products.images,
      materials: products.materials,
      dimensions: products.dimensions,
      isVisible: products.isVisible,
      isFeatured: products.isFeatured,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt
    }).from(products).leftJoin(categories, eq5(products.categoryId, categories.id)).orderBy(desc(products.updatedAt), asc(products.id));
    res.json({ products: rows });
  } catch (error) {
    console.error("GET /api/admin/products failed:", error);
    res.status(500).json({ error: "Unable to load admin products." });
  }
});
apiRouter.post("/admin/products", requireAdmin, async (req, res) => {
  const parsed = productWriteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid product fields." });
    return;
  }
  const data = parsed.data;
  const slug = slugify(data.slug || data.name);
  if (!slug) {
    res.status(400).json({ error: "Product slug could not be generated from name." });
    return;
  }
  try {
    const [created] = await db.insert(products).values({
      categoryId: data.categoryId ?? null,
      name: data.name,
      slug,
      sku: data.sku.toUpperCase(),
      summary: data.summary,
      description: data.description,
      priceMinor: data.priceMinor,
      currency: "INR",
      stock: data.stock,
      images: data.images,
      materials: data.materials,
      dimensions: data.dimensions,
      isVisible: data.isVisible,
      isFeatured: data.isFeatured
    }).returning();
    res.status(201).json({ product: created });
  } catch (error) {
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === "23505") {
      res.status(409).json({ error: "A product with that slug or SKU already exists." });
      return;
    }
    console.error("POST /api/admin/products failed:", error);
    res.status(500).json({ error: "Unable to create product." });
  }
});
apiRouter.patch("/admin/products/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid product ID." });
    return;
  }
  const parsed = productWriteSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid product update." });
    return;
  }
  const patch = {
    ...parsed.data,
    updatedAt: /* @__PURE__ */ new Date()
  };
  if (parsed.data.slug !== void 0) {
    patch.slug = slugify(parsed.data.slug || parsed.data.name || "");
  }
  if (parsed.data.sku !== void 0) {
    patch.sku = parsed.data.sku.toUpperCase();
  }
  try {
    const [updated] = await db.update(products).set(patch).where(eq5(products.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    res.json({ product: updated });
  } catch (error) {
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === "23505") {
      res.status(409).json({ error: "Another product already uses that slug or SKU." });
      return;
    }
    console.error("PATCH /api/admin/products/:id failed:", error);
    res.status(500).json({ error: "Unable to update product." });
  }
});
apiRouter.delete("/admin/products/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid product ID." });
    return;
  }
  try {
    const [deleted] = await db.delete(products).where(eq5(products.id, id)).returning({ id: products.id });
    if (!deleted) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    res.json({ deletedId: deleted.id });
  } catch (error) {
    console.error("DELETE /api/admin/products/:id failed:", error);
    res.status(500).json({ error: "Unable to delete product." });
  }
});
apiRouter.get("/admin/categories", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
    const counts = await db.select({ categoryId: products.categoryId, productCount: count2() }).from(products).groupBy(products.categoryId);
    const map = new Map(counts.map((c) => [c.categoryId, Number(c.productCount)]));
    res.json({
      categories: rows.map((c) => ({
        ...c,
        productCount: map.get(c.id) ?? 0
      }))
    });
  } catch (error) {
    console.error("GET /api/admin/categories failed:", error);
    res.status(500).json({ error: "Unable to load categories." });
  }
});
apiRouter.post("/admin/categories", requireAdmin, async (req, res) => {
  const parsed = categoryWriteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid category details." });
    return;
  }
  const slug = slugify(parsed.data.slug || parsed.data.name);
  if (!slug) {
    res.status(400).json({ error: "Category slug could not be generated." });
    return;
  }
  try {
    const [created] = await db.insert(categories).values({
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
      sortOrder: parsed.data.sortOrder
    }).returning();
    res.status(201).json({ category: created });
  } catch (error) {
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === "23505") {
      res.status(409).json({ error: "A category with that slug already exists." });
      return;
    }
    console.error("POST /api/admin/categories failed:", error);
    res.status(500).json({ error: "Unable to create category." });
  }
});
apiRouter.patch("/admin/categories/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid category ID." });
    return;
  }
  const parsed = categoryWriteSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid category update." });
    return;
  }
  const patch = {
    ...parsed.data,
    updatedAt: /* @__PURE__ */ new Date()
  };
  if (parsed.data.slug !== void 0) {
    patch.slug = slugify(parsed.data.slug || parsed.data.name || "");
  }
  try {
    const [updated] = await db.update(categories).set(patch).where(eq5(categories.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Category not found." });
      return;
    }
    res.json({ category: updated });
  } catch (error) {
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === "23505") {
      res.status(409).json({ error: "Another category already uses that slug." });
      return;
    }
    console.error("PATCH /api/admin/categories/:id failed:", error);
    res.status(500).json({ error: "Unable to update category." });
  }
});
apiRouter.delete("/admin/categories/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid category ID." });
    return;
  }
  try {
    const [deleted] = await db.delete(categories).where(eq5(categories.id, id)).returning({ id: categories.id });
    if (!deleted) {
      res.status(404).json({ error: "Category not found." });
      return;
    }
    res.json({ deletedId: deleted.id });
  } catch (error) {
    console.error("DELETE /api/admin/categories/:id failed:", error);
    res.status(500).json({ error: "Unable to delete category." });
  }
});
apiRouter.get("/admin/orders", requireAdmin, async (_req, res) => {
  try {
    const allOrders = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      userId: orders.userId,
      customerName: users.name,
      customerEmail: users.email,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      fulfilmentStatus: orders.fulfilmentStatus,
      subtotalMinor: orders.subtotalMinor,
      shippingMinor: orders.shippingMinor,
      taxMinor: orders.taxMinor,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      shippingName: orders.shippingName,
      shippingEmail: orders.shippingEmail,
      shippingPhone: orders.shippingPhone,
      shippingAddress: orders.shippingAddress,
      shippingCity: orders.shippingCity,
      shippingPostalCode: orders.shippingPostalCode,
      shippingCountry: orders.shippingCountry,
      trackingNote: orders.trackingNote,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt
    }).from(orders).innerJoin(users, eq5(orders.userId, users.id)).orderBy(desc(orders.createdAt));
    const orderIds = allOrders.map((o) => o.id);
    const items = orderIds.length > 0 ? await db.select().from(orderItems).where(sql2`${orderItems.orderId} IN (${sql2.join(orderIds, sql2`, `)})`) : [];
    const itemsByOrderId = /* @__PURE__ */ new Map();
    for (const item of items) {
      const list = itemsByOrderId.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrderId.set(item.orderId, list);
    }
    res.json({
      orders: allOrders.map((o) => ({
        ...o,
        items: itemsByOrderId.get(o.id) ?? []
      }))
    });
  } catch (error) {
    console.error("GET /api/admin/orders failed:", error);
    res.status(500).json({ error: "Unable to load admin orders." });
  }
});
apiRouter.patch("/admin/orders/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid order ID." });
    return;
  }
  const parsed = z.object({
    fulfilmentStatus: z.string(),
    paymentStatus: z.string().optional(),
    trackingNote: z.string().trim().max(240).optional()
  }).safeParse(req.body);
  if (!parsed.success || !isValidFulfilmentStatus(parsed.data.fulfilmentStatus)) {
    res.status(400).json({ error: "Invalid fulfilment status." });
    return;
  }
  if (parsed.data.paymentStatus !== void 0 && !isValidPaymentStatus(parsed.data.paymentStatus)) {
    res.status(400).json({ error: "Invalid payment status." });
    return;
  }
  try {
    const [existingOrder] = await db.select().from(orders).where(eq5(orders.id, id)).limit(1);
    if (!existingOrder) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    const nextPaymentStatus = parsed.data.paymentStatus !== void 0 ? parsed.data.paymentStatus : existingOrder.paymentMethod === "cod" && existingOrder.paymentStatus === "cod_pending" && parsed.data.fulfilmentStatus === "delivered" ? "paid" : existingOrder.paymentStatus;
    const [updated] = await db.update(orders).set({
      fulfilmentStatus: parsed.data.fulfilmentStatus,
      paymentStatus: nextPaymentStatus,
      ...parsed.data.trackingNote !== void 0 ? { trackingNote: parsed.data.trackingNote } : {},
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq5(orders.id, id)).returning();
    res.json({ order: updated });
  } catch (error) {
    console.error("PATCH /api/admin/orders/:id failed:", error);
    res.status(500).json({ error: "Unable to update order fulfilment status." });
  }
});
apiRouter.get("/admin/newsletter", requireAdmin, async (_req, res) => {
  try {
    const subscribers = await db.select({
      id: newsletterSubscribers.id,
      email: newsletterSubscribers.email,
      source: newsletterSubscribers.source,
      subscribedAt: newsletterSubscribers.subscribedAt
    }).from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.subscribedAt));
    res.json({ subscribers });
  } catch (error) {
    console.error("GET /api/admin/newsletter failed:", error);
    res.status(500).json({ error: "Unable to load newsletter subscribers." });
  }
});
apiRouter.delete("/admin/newsletter/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid subscriber ID." });
    return;
  }
  try {
    const [deleted] = await db.delete(newsletterSubscribers).where(eq5(newsletterSubscribers.id, id)).returning({ id: newsletterSubscribers.id });
    if (!deleted) {
      res.status(404).json({ error: "Subscriber not found." });
      return;
    }
    res.json({ deletedId: deleted.id });
  } catch (error) {
    console.error("DELETE /api/admin/newsletter/:id failed:", error);
    res.status(500).json({ error: "Unable to remove subscriber." });
  }
});

// src/server/app.ts
function createApiApp() {
  const app = express2();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.set("etag", "strong");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.use("/api", (_req, res, next) => {
    applyPrivateNoStore(res);
    next();
  });
  app.use(
    express2.json({
      limit: "2mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app.use("/api", apiRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });
  app.use(
    (err, req, res, next) => {
      if (req.path.startsWith("/api")) {
        console.error("Unhandled API error:", err);
        res.status(500).json({ error: "Internal server error." });
        return;
      }
      next(err);
    }
  );
  return app;
}

// src/server/vercelUrl.ts
function normalizeVercelApiUrl(rawUrl) {
  const input = rawUrl || "/api";
  const parsed = new URL(input, "http://localhost");
  const routeParam = parsed.searchParams.get("__route");
  if (routeParam !== null) {
    parsed.searchParams.delete("__route");
    const cleanRoute = routeParam.replace(/^\/+/, "");
    const pathname2 = cleanRoute ? `/api/${cleanRoute}` : "/api";
    const qs2 = parsed.searchParams.toString();
    return qs2 ? `${pathname2}?${qs2}` : pathname2;
  }
  let pathname = parsed.pathname || "/api";
  if (pathname !== "/api" && !pathname.startsWith("/api/")) {
    pathname = pathname.startsWith("/") ? `/api${pathname}` : `/api/${pathname}`;
  }
  const qs = parsed.searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

// src/server/vercelHandler.ts
var cachedApp = null;
var initError = null;
function getApp() {
  if (!cachedApp) {
    cachedApp = createApiApp();
  }
  return cachedApp;
}
function handler(req, res) {
  try {
    if (initError) {
      throw initError;
    }
    const app = getApp();
    req.url = normalizeVercelApiUrl(req.url);
    return app(req, res);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (!cachedApp) {
      initError = error;
    }
    console.error("Vercel API handler error:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: `API initialization error: ${error.message}`
        })
      );
    }
  }
}
export {
  handler as default
};
