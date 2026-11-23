import crypto from 'node:crypto';
import express from 'express';
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, isDatabaseConfigured } from '../db/index.ts';
import {
  categories,
  newsletterSubscribers,
  orderItems,
  orders,
  paymentAttempts,
  products,
  users,
} from '../db/schema.ts';
import { ensureSeeded, getAdminEmailAllowlist, getUserByEmail } from '../db/seed.ts';
import { isValidFulfilmentStatus, isValidPaymentStatus, slugify } from '../lib/commerce.ts';
import {
  createSessionForUser,
  optionalAuth,
  requireAdmin,
  requireAuth,
  revokeSessionToken,
  upsertGoogleUser,
  type AuthRequest,
} from '../middleware/auth.ts';
import { verifyFirebaseIdToken } from '../lib/firebase-admin.ts';
import {
  hashPassword,
  verifyPassword,
  verifyRazorpayWebhookSignature,
} from './paymentCrypto.ts';
import {
  loadHydratedCart,
  mergeGuestCartIntoUserCart,
  removeCartItem,
  upsertCartItem,
} from './cartService.ts';
import {
  createCodOrderFromCart,
  createPaymentAttemptFromCart,
  finalizeConfirmedOrderForAttempt,
  recheckPendingPaymentAttempt,
  recordNonSuccessPaymentOutcome,
  verifyAndProcessPayment,
} from './paymentService.ts';
import { getPublicPaymentConfig, issueSandboxSignedCallback } from './razorpay.ts';
import { applyPublicCatalogCache, applyPublicConfigCache } from './cacheHeaders.ts';

export const apiRouter = express.Router();

apiRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    databaseConfigured: isDatabaseConfigured,
  });
});

// Fail fast with an actionable message if PostgreSQL env vars are not set in production
apiRouter.use(async (_req, res, next) => {
  if (!isDatabaseConfigured) {
    res.status(503).json({
      error:
        'Database is not configured. Add DATABASE_URL (PostgreSQL) in your Vercel Environment Variables and redeploy.',
    });
    return;
  }
  try {
    await ensureSeeded();
  } catch (err) {
    console.error('Lazy seed warning:', err);
  }
  next();
});

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name (at least 2 characters).').max(120),
  email: z.string().trim().email('Please enter a valid email address.').max(180),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(120),
  guestToken: z.string().optional(),
  guestItems: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive().max(99),
      })
    )
    .optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  guestToken: z.string().optional(),
  guestItems: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive().max(99),
      })
    )
    .optional(),
});

const shippingSchema = z.object({
  fullName: z.string().trim().min(2, 'Recipient name is required.').max(120),
  email: z.string().trim().email('Valid email is required.').max(180),
  phone: z.string().trim().min(7, 'Phone number is required.').max(30),
  address: z.string().trim().min(5, 'Street address is required.').max(250),
  city: z.string().trim().min(2, 'City is required.').max(100),
  postalCode: z.string().trim().min(3, 'Postal code is required.').max(20),
  country: z.string().trim().min(2).max(80).default('India'),
});

const productWriteSchema = z.object({
  name: z.string().trim().min(2, 'Product name is required.').max(160),
  slug: z.string().trim().max(160).optional(),
  sku: z.string().trim().min(2, 'SKU is required.').max(60),
  categoryId: z.number().int().positive().nullable().optional(),
  summary: z.string().trim().min(4, 'Short summary is required.').max(300),
  description: z.string().trim().min(8, 'Full description is required.').max(4000),
  priceMinor: z.number().int().min(100, 'Price must be at least ₹1.00.'),
  stock: z.number().int().min(0, 'Stock cannot be negative.').max(100000),
  images: z.array(z.string().trim().min(1)).max(10).default([]),
  materials: z.string().trim().max(300).default(''),
  dimensions: z.string().trim().max(200).default(''),
  isVisible: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

const categoryWriteSchema = z.object({
  name: z.string().trim().min(2, 'Category name is required.').max(80),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().max(300).default(''),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

// ==================== PUBLIC CATALOGUE ====================

apiRouter.get('/categories', async (_req, res) => {
  try {
    const catRows = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    const counts = await db
      .select({
        categoryId: products.categoryId,
        productCount: count(),
      })
      .from(products)
      .where(eq(products.isVisible, true))
      .groupBy(products.categoryId);

    const countMap = new Map(counts.map((c) => [c.categoryId, Number(c.productCount)]));

    applyPublicCatalogCache(res);
    res.json({
      categories: catRows.map((c) => ({
        ...c,
        productCount: countMap.get(c.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error('GET /api/categories failed:', error);
    res.status(500).json({ error: 'Unable to load categories.' });
  }
});

apiRouter.get('/products', async (req, res) => {
  try {
    const categorySlug = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const inStockOnly = req.query.inStock === 'true';
    const featuredOnly = req.query.featured === 'true';
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'featured';

    const conditions = [eq(products.isVisible, true)];

    if (categorySlug && categorySlug !== 'all') {
      const [cat] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, categorySlug))
        .limit(1);
      if (!cat) {
        res.json({ products: [] });
        return;
      }
      conditions.push(eq(products.categoryId, cat.id));
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
        )!
      );
    }

    if (inStockOnly) {
      conditions.push(gte(products.stock, 1));
    }

    if (featuredOnly) {
      conditions.push(eq(products.isFeatured, true));
    }

    if (minPrice !== null && !Number.isNaN(minPrice) && minPrice >= 0) {
      conditions.push(gte(products.priceMinor, Math.round(minPrice * 100)));
    }

    if (maxPrice !== null && !Number.isNaN(maxPrice) && maxPrice > 0) {
      conditions.push(lte(products.priceMinor, Math.round(maxPrice * 100)));
    }

    const orderByClause =
      sort === 'price_asc'
        ? [asc(products.priceMinor), asc(products.name)]
        : sort === 'price_desc'
          ? [desc(products.priceMinor), asc(products.name)]
          : sort === 'newest'
            ? [desc(products.createdAt), asc(products.name)]
            : [desc(products.isFeatured), asc(products.id)];

    const rows = await db
      .select({
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
        createdAt: products.createdAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(...orderByClause);

    applyPublicCatalogCache(res);
    res.json({ products: rows });
  } catch (error) {
    console.error('GET /api/products failed:', error);
    res.status(500).json({ error: 'Unable to load product catalogue.' });
  }
});

apiRouter.get('/products/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.trim();
    const rows = await db
      .select({
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
        createdAt: products.createdAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.slug, slug), eq(products.isVisible, true)))
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const product = rows[0];
    const related = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        summary: products.summary,
        priceMinor: products.priceMinor,
        currency: products.currency,
        stock: products.stock,
        images: products.images,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.isVisible, true), sql`${products.id} != ${product.id}`))
      .orderBy(desc(products.isFeatured), asc(products.id))
      .limit(3);

    applyPublicCatalogCache(res);
    res.json({ product, related });
  } catch (error) {
    console.error('GET /api/products/:slug failed:', error);
    res.status(500).json({ error: 'Unable to load product details.' });
  }
});

// ==================== NEWSLETTER DISPATCH SIGNUP ====================

const newsletterSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').max(180),
  source: z.string().trim().max(40).default('footer'),
});

apiRouter.post('/newsletter/subscribe', async (req, res) => {
  const parsed = newsletterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Please enter a valid email address.',
    });
    return;
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  try {
    const [existing] = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, normalizedEmail))
      .limit(1);

    if (existing) {
      res.status(200).json({
        subscribed: true,
        alreadySubscribed: true,
        subscriber: {
          id: existing.id,
          email: existing.email,
          source: existing.source,
          subscribedAt: existing.subscribedAt,
        },
        message: 'This email is already on the KOVA collection dispatch list.',
      });
      return;
    }

    const [created] = await db
      .insert(newsletterSubscribers)
      .values({
        email: normalizedEmail,
        source: parsed.data.source || 'footer',
      })
      .returning();

    res.status(201).json({
      subscribed: true,
      alreadySubscribed: false,
      subscriber: {
        id: created.id,
        email: created.email,
        source: created.source,
        subscribedAt: created.subscribedAt,
      },
      message: 'Subscribed — we will notify you when new KOVA collections release.',
    });
  } catch (error: any) {
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === '23505') {
      res.status(200).json({
        subscribed: true,
        alreadySubscribed: true,
        message: 'This email is already on the KOVA collection dispatch list.',
      });
      return;
    }
    console.error('POST /api/newsletter/subscribe failed:', error);
    res.status(500).json({ error: 'Unable to save your subscription right now. Please try again.' });
  }
});

// ==================== AUTHENTICATION & ACCOUNT ====================

apiRouter.post('/auth/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid signup details.' });
    return;
  }

  const { name, email, password, guestToken, guestItems } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
      return;
    }

    const adminAllowlist = getAdminEmailAllowlist();
    const role = adminAllowlist.has(normalizedEmail) ? 'admin' : 'customer';

    const [created] = await db
      .insert(users)
      .values({
        uid: `local_${crypto.randomUUID()}`,
        email: normalizedEmail,
        name,
        passwordHash: hashPassword(password),
        role,
        authProvider: 'email',
      })
      .returning();

    const token = await createSessionForUser(created.id);
    const cart = await mergeGuestCartIntoUserCart({
      userId: created.id,
      guestToken,
      fallbackItems: guestItems,
    });

    res.status(201).json({
      token,
      user: {
        id: created.id,
        uid: created.uid,
        email: created.email,
        name: created.name,
        role: created.role,
        authProvider: created.authProvider,
      },
      cart,
    });
  } catch (error) {
    console.error('POST /api/auth/signup failed:', error);
    res.status(500).json({ error: 'Unable to create account right now.' });
  }
});

apiRouter.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid login credentials.' });
    return;
  }

  const { email, password, guestToken, guestItems } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const user = await getUserByEmail(normalizedEmail);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }

    const token = await createSessionForUser(user.id);
    const cart = await mergeGuestCartIntoUserCart({
      userId: user.id,
      guestToken,
      fallbackItems: guestItems,
    });

    res.json({
      token,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: user.role,
        authProvider: user.authProvider,
      },
      cart,
    });
  } catch (error) {
    console.error('POST /api/auth/login failed:', error);
    res.status(500).json({ error: 'Unable to sign in right now.' });
  }
});

apiRouter.post('/auth/google', async (req, res) => {
  const authHeader = req.headers.authorization;
  const idToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';

  if (!idToken) {
    res.status(401).json({ error: 'Missing Firebase ID token.' });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    const email = decoded.email || `${decoded.uid}@google.local`;
    const name = decoded.name || email.split('@')[0] || 'Customer';
    const user = await upsertGoogleUser(decoded.uid, email, name);

    const guestToken =
      typeof req.body?.guestToken === 'string' ? req.body.guestToken : undefined;
    const guestItems = Array.isArray(req.body?.guestItems) ? req.body.guestItems : undefined;

    const cart = await mergeGuestCartIntoUserCart({
      userId: user.id,
      guestToken,
      fallbackItems: guestItems,
    });

    res.json({ user, cart });
  } catch (error) {
    console.error('POST /api/auth/google failed:', error);
    res.status(401).json({ error: 'Unable to verify Google Sign-In token.' });
  }
});

apiRouter.post('/auth/logout', optionalAuth, async (req: AuthRequest, res) => {
  if (req.authToken) {
    await revokeSessionToken(req.authToken);
  }
  res.json({ ok: true });
});

apiRouter.get('/auth/me', requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: req.dbUser });
});

// ==================== PERSISTENT CART ====================

apiRouter.get('/cart', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const cart = await loadHydratedCart({
      userId: req.dbUser?.id,
      guestToken: req.guestCartToken,
    });
    res.json({ cart });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load cart.' });
  }
});

apiRouter.post('/cart/items', optionalAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(50).default(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid productId and quantity are required.' });
    return;
  }

  if (!req.dbUser && !req.guestCartToken) {
    res.status(400).json({ error: 'Missing guest cart token header.' });
    return;
  }

  try {
    const cart = await upsertCartItem({
      userId: req.dbUser?.id,
      guestToken: req.guestCartToken,
      productId: parsed.data.productId,
      quantityDelta: parsed.data.quantity,
    });
    res.json({ cart });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to add item to cart.' });
  }
});

apiRouter.patch('/cart/items/:productId', optionalAuth, async (req: AuthRequest, res) => {
  const productId = Number(req.params.productId);
  const schema = z.object({ quantity: z.number().int().min(0).max(99) });
  const parsed = schema.safeParse(req.body);
  if (!Number.isInteger(productId) || productId <= 0 || !parsed.success) {
    res.status(400).json({ error: 'Valid productId and quantity are required.' });
    return;
  }

  if (!req.dbUser && !req.guestCartToken) {
    res.status(400).json({ error: 'Missing guest cart token header.' });
    return;
  }

  try {
    const cart = await upsertCartItem({
      userId: req.dbUser?.id,
      guestToken: req.guestCartToken,
      productId,
      absoluteQuantity: parsed.data.quantity,
    });
    res.json({ cart });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to update cart quantity.' });
  }
});

apiRouter.delete('/cart/items/:productId', optionalAuth, async (req: AuthRequest, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    res.status(400).json({ error: 'Valid productId is required.' });
    return;
  }

  try {
    const cart = await removeCartItem({
      userId: req.dbUser?.id,
      guestToken: req.guestCartToken,
      productId,
    });
    res.json({ cart });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unable to remove cart item.' });
  }
});

apiRouter.post('/cart/merge', requireAuth, async (req: AuthRequest, res) => {
  const guestToken =
    typeof req.body?.guestToken === 'string' ? req.body.guestToken : undefined;
  const fallbackItems = Array.isArray(req.body?.guestItems) ? req.body.guestItems : undefined;

  try {
    const cart = await mergeGuestCartIntoUserCart({
      userId: req.dbUser!.id,
      guestToken,
      fallbackItems,
    });
    res.json({ cart });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unable to merge cart.' });
  }
});

// ==================== CHECKOUT & VERIFIED PAYMENTS ====================

apiRouter.get('/payments/config', (_req, res) => {
  applyPublicConfigCache(res);
  res.json(getPublicPaymentConfig());
});

apiRouter.post('/checkout/create-attempt', requireAuth, async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      shipping: shippingSchema,
      idempotencyKey: z.string().trim().max(120).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Please complete all shipping fields.',
    });
    return;
  }

  try {
    const attempt = await createPaymentAttemptFromCart({
      userId: req.dbUser!.id,
      shippingDetails: parsed.data.shipping,
      idempotencyKey: parsed.data.idempotencyKey,
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
        status: attempt.status,
      },
      gateway: {
        mode: config.mode,
        keyId: config.keyId,
        livePaymentsBlocked: true,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to start checkout.' });
  }
});

apiRouter.post('/checkout/cod', requireAuth, async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      shipping: shippingSchema,
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Please complete all shipping fields.',
    });
    return;
  }

  try {
    const order = await createCodOrderFromCart({
      userId: req.dbUser!.id,
      shippingDetails: parsed.data.shipping,
    });
    res.status(201).json({ order });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to place Cash on Delivery order.' });
  }
});

// Local sandbox helper: generates a signed callback payload strictly when mode === 'razorpay_sandbox'
// Actual verification and order creation STILL occur exclusively in POST /api/payments/verify.
apiRouter.post('/payments/:attemptId/sandbox-authorize', requireAuth, async (req: AuthRequest, res) => {
  const config = getPublicPaymentConfig();
  if (config.mode !== 'razorpay_sandbox') {
    res.status(403).json({
      error: 'Sandbox simulator endpoint is disabled when Razorpay Test Mode keys are active.',
    });
    return;
  }

  const attemptId = Number(req.params.attemptId);
  const outcomeSchema = z.object({
    outcome: z.enum(['captured', 'pending', 'tampered']),
  });
  const parsed = outcomeSchema.safeParse(req.body);
  if (!Number.isInteger(attemptId) || !parsed.success) {
    res.status(400).json({ error: 'Invalid sandbox simulation parameters.' });
    return;
  }

  const [attempt] = await db
    .select()
    .from(paymentAttempts)
    .where(and(eq(paymentAttempts.id, attemptId), eq(paymentAttempts.userId, req.dbUser!.id)))
    .limit(1);

  if (!attempt || attempt.provider !== 'razorpay_sandbox') {
    res.status(404).json({ error: 'Sandbox payment attempt not found.' });
    return;
  }

  const signed = issueSandboxSignedCallback(attempt.providerOrderId, parsed.data.outcome);
  res.json({
    providerOrderId: attempt.providerOrderId,
    providerPaymentId: signed.providerPaymentId,
    signature: signed.signature,
  });
});

apiRouter.post('/payments/verify', requireAuth, async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      attemptId: z.number().int().positive(),
      providerOrderId: z.string().trim().min(3),
      providerPaymentId: z.string().trim().min(3),
      signature: z.string().trim().min(8),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Incomplete payment verification payload.' });
    return;
  }

  try {
    const result = await verifyAndProcessPayment({
      userId: req.dbUser!.id,
      attemptId: parsed.data.attemptId,
      providerOrderId: parsed.data.providerOrderId,
      providerPaymentId: parsed.data.providerPaymentId,
      signature: parsed.data.signature,
    });

    if (result.status === 'uncertain' || result.status === 'failed') {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (error: any) {
    console.error('POST /api/payments/verify failed:', error);
    res.status(400).json({
      status: 'uncertain',
      error: error.message || 'Payment verification failed.',
    });
  }
});

apiRouter.post('/payments/:attemptId/mark-outcome', requireAuth, async (req: AuthRequest, res) => {
  const attemptId = Number(req.params.attemptId);
  const parsed = z
    .object({
      outcome: z.enum(['failed', 'cancelled']),
      reason: z.string().trim().max(250).optional(),
    })
    .safeParse(req.body);

  if (!Number.isInteger(attemptId) || !parsed.success) {
    res.status(400).json({ error: 'Invalid payment outcome parameters.' });
    return;
  }

  try {
    const result = await recordNonSuccessPaymentOutcome({
      userId: req.dbUser!.id,
      attemptId,
      outcome: parsed.data.outcome,
      reason: parsed.data.reason,
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to record payment status.' });
  }
});

apiRouter.post('/payments/:attemptId/recheck', requireAuth, async (req: AuthRequest, res) => {
  const attemptId = Number(req.params.attemptId);
  if (!Number.isInteger(attemptId) || attemptId <= 0) {
    res.status(400).json({ error: 'Invalid payment attempt ID.' });
    return;
  }

  try {
    const result = await recheckPendingPaymentAttempt({
      userId: req.dbUser!.id,
      attemptId,
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to re-check payment status.' });
  }
});

// Razorpay server-to-server webhook for asynchronous delayed captures & failures
apiRouter.post('/payments/razorpay/webhook', async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody;

  if (!webhookSecret || typeof signature !== 'string' || !rawBody) {
    res.status(400).json({ error: 'Webhook verification configuration or signature missing.' });
    return;
  }

  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    res.status(401).json({ error: 'Invalid webhook signature.' });
    return;
  }

  try {
    const event = req.body as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            error_description?: string;
          };
        };
      };
    };

    const entity = event.payload?.payment?.entity;
    if (!entity?.order_id || !entity?.id) {
      res.json({ received: true });
      return;
    }

    const [attempt] = await db
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.providerOrderId, entity.order_id))
      .limit(1);

    if (!attempt) {
      res.json({ received: true });
      return;
    }

    if (event.event === 'payment.captured') {
      await finalizeConfirmedOrderForAttempt({
        attemptId: attempt.id,
        providerPaymentId: entity.id,
      });
    } else if (event.event === 'payment.failed' && attempt.status !== 'succeeded') {
      await db
        .update(paymentAttempts)
        .set({
          status: 'failed',
          providerPaymentId: entity.id,
          failureReason: entity.error_description || 'Payment failed via Razorpay webhook.',
          updatedAt: new Date(),
        })
        .where(eq(paymentAttempts.id, attempt.id));
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

// ==================== CUSTOMER ORDERS ====================

apiRouter.get('/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const customerOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.dbUser!.id))
      .orderBy(desc(orders.createdAt));

    const orderIds = customerOrders.map((o) => o.id);
    const items =
      orderIds.length > 0
        ? await db
            .select()
            .from(orderItems)
            .where(sql`${orderItems.orderId} IN (${sql.join(orderIds, sql`, `)})`)
        : [];

    const itemsByOrderId = new Map<number, typeof items>();
    for (const item of items) {
      const list = itemsByOrderId.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrderId.set(item.orderId, list);
    }

    const recentAttempts = await db
      .select({
        id: paymentAttempts.id,
        provider: paymentAttempts.provider,
        providerOrderId: paymentAttempts.providerOrderId,
        status: paymentAttempts.status,
        amountMinor: paymentAttempts.amountMinor,
        currency: paymentAttempts.currency,
        failureReason: paymentAttempts.failureReason,
        orderId: paymentAttempts.orderId,
        createdAt: paymentAttempts.createdAt,
      })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.userId, req.dbUser!.id))
      .orderBy(desc(paymentAttempts.createdAt))
      .limit(10);

    res.json({
      orders: customerOrders.map((o) => ({
        ...o,
        items: itemsByOrderId.get(o.id) ?? [],
      })),
      paymentAttempts: recentAttempts.filter((a) => a.status !== 'succeeded'),
    });
  } catch (error) {
    console.error('GET /api/orders failed:', error);
    res.status(500).json({ error: 'Unable to load order history.' });
  }
});

apiRouter.get('/orders/:orderNumber', requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderNumber = req.params.orderNumber.trim();
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    // Enforce ownership (customer can only view own orders; admins can inspect all)
    if (order.userId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
      res.status(403).json({ error: 'You do not have permission to view this order.' });
      return;
    }

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    const [attempt] = await db
      .select({
        id: paymentAttempts.id,
        provider: paymentAttempts.provider,
        providerOrderId: paymentAttempts.providerOrderId,
        providerPaymentId: paymentAttempts.providerPaymentId,
        status: paymentAttempts.status,
        verifiedAt: paymentAttempts.verifiedAt,
      })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.orderId, order.id))
      .limit(1);

    res.json({
      order: {
        ...order,
        items,
        paymentAttempt: attempt ?? null,
      },
    });
  } catch (error) {
    console.error('GET /api/orders/:orderNumber failed:', error);
    res.status(500).json({ error: 'Unable to load order details.' });
  }
});

// ==================== ADMIN PORTAL (BACKEND-ENFORCED) ====================

apiRouter.get('/admin/overview', requireAdmin, async (_req, res) => {
  try {
    const [allOrders, allProducts, allUsers, allCategories, allSubscribers] = await Promise.all([
      db.select().from(orders),
      db.select().from(products),
      db.select({ id: users.id, role: users.role }).from(users),
      db.select({ id: categories.id }).from(categories),
      db.select({ id: newsletterSubscribers.id }).from(newsletterSubscribers),
    ]);

    const confirmedRevenueMinor = allOrders
      .filter((o) => o.fulfilmentStatus !== 'cancelled')
      .reduce((sum, o) => sum + o.totalMinor, 0);

    const pendingFulfilmentCount = allOrders.filter(
      (o) => o.fulfilmentStatus === 'confirmed' || o.fulfilmentStatus === 'processing'
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
        totalCustomers: allUsers.filter((u) => u.role === 'customer').length,
        totalSubscribers: allSubscribers.length,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/overview failed:', error);
    res.status(500).json({ error: 'Unable to load admin overview.' });
  }
});

apiRouter.get('/admin/products', requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
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
        updatedAt: products.updatedAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(desc(products.updatedAt), asc(products.id));

    res.json({ products: rows });
  } catch (error) {
    console.error('GET /api/admin/products failed:', error);
    res.status(500).json({ error: 'Unable to load admin products.' });
  }
});

apiRouter.post('/admin/products', requireAdmin, async (req, res) => {
  const parsed = productWriteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product fields.' });
    return;
  }

  const data = parsed.data;
  const slug = slugify(data.slug || data.name);
  if (!slug) {
    res.status(400).json({ error: 'Product slug could not be generated from name.' });
    return;
  }

  try {
    const [created] = await db
      .insert(products)
      .values({
        categoryId: data.categoryId ?? null,
        name: data.name,
        slug,
        sku: data.sku.toUpperCase(),
        summary: data.summary,
        description: data.description,
        priceMinor: data.priceMinor,
        currency: 'INR',
        stock: data.stock,
        images: data.images,
        materials: data.materials,
        dimensions: data.dimensions,
        isVisible: data.isVisible,
        isFeatured: data.isFeatured,
      })
      .returning();

    res.status(201).json({ product: created });
  } catch (error: any) {
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === '23505') {
      res.status(409).json({ error: 'A product with that slug or SKU already exists.' });
      return;
    }
    console.error('POST /api/admin/products failed:', error);
    res.status(500).json({ error: 'Unable to create product.' });
  }
});

apiRouter.patch('/admin/products/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid product ID.' });
    return;
  }

  const parsed = productWriteSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product update.' });
    return;
  }

  const patch: Record<string, unknown> = {
    ...parsed.data,
    updatedAt: new Date(),
  };

  if (parsed.data.slug !== undefined) {
    patch.slug = slugify(parsed.data.slug || parsed.data.name || '');
  }
  if (parsed.data.sku !== undefined) {
    patch.sku = parsed.data.sku.toUpperCase();
  }

  try {
    const [updated] = await db
      .update(products)
      .set(patch)
      .where(eq(products.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    res.json({ product: updated });
  } catch (error: any) {
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === '23505') {
      res.status(409).json({ error: 'Another product already uses that slug or SKU.' });
      return;
    }
    console.error('PATCH /api/admin/products/:id failed:', error);
    res.status(500).json({ error: 'Unable to update product.' });
  }
});

apiRouter.delete('/admin/products/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid product ID.' });
    return;
  }

  try {
    const [deleted] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });

    if (!deleted) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    res.json({ deletedId: deleted.id });
  } catch (error) {
    console.error('DELETE /api/admin/products/:id failed:', error);
    res.status(500).json({ error: 'Unable to delete product.' });
  }
});

apiRouter.get('/admin/categories', requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    const counts = await db
      .select({ categoryId: products.categoryId, productCount: count() })
      .from(products)
      .groupBy(products.categoryId);

    const map = new Map(counts.map((c) => [c.categoryId, Number(c.productCount)]));
    res.json({
      categories: rows.map((c) => ({
        ...c,
        productCount: map.get(c.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error('GET /api/admin/categories failed:', error);
    res.status(500).json({ error: 'Unable to load categories.' });
  }
});

apiRouter.post('/admin/categories', requireAdmin, async (req, res) => {
  const parsed = categoryWriteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid category details.' });
    return;
  }

  const slug = slugify(parsed.data.slug || parsed.data.name);
  if (!slug) {
    res.status(400).json({ error: 'Category slug could not be generated.' });
    return;
  }

  try {
    const [created] = await db
      .insert(categories)
      .values({
        name: parsed.data.name,
        slug,
        description: parsed.data.description,
        sortOrder: parsed.data.sortOrder,
      })
      .returning();

    res.status(201).json({ category: created });
  } catch (error: any) {
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === '23505') {
      res.status(409).json({ error: 'A category with that slug already exists.' });
      return;
    }
    console.error('POST /api/admin/categories failed:', error);
    res.status(500).json({ error: 'Unable to create category.' });
  }
});

apiRouter.patch('/admin/categories/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid category ID.' });
    return;
  }

  const parsed = categoryWriteSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid category update.' });
    return;
  }

  const patch: Record<string, unknown> = {
    ...parsed.data,
    updatedAt: new Date(),
  };
  if (parsed.data.slug !== undefined) {
    patch.slug = slugify(parsed.data.slug || parsed.data.name || '');
  }

  try {
    const [updated] = await db
      .update(categories)
      .set(patch)
      .where(eq(categories.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    res.json({ category: updated });
  } catch (error: any) {
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === '23505') {
      res.status(409).json({ error: 'Another category already uses that slug.' });
      return;
    }
    console.error('PATCH /api/admin/categories/:id failed:', error);
    res.status(500).json({ error: 'Unable to update category.' });
  }
});

apiRouter.delete('/admin/categories/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid category ID.' });
    return;
  }

  try {
    const [deleted] = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });

    if (!deleted) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    res.json({ deletedId: deleted.id });
  } catch (error) {
    console.error('DELETE /api/admin/categories/:id failed:', error);
    res.status(500).json({ error: 'Unable to delete category.' });
  }
});

apiRouter.get('/admin/orders', requireAdmin, async (_req, res) => {
  try {
    const allOrders = await db
      .select({
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
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.createdAt));

    const orderIds = allOrders.map((o) => o.id);
    const items =
      orderIds.length > 0
        ? await db
            .select()
            .from(orderItems)
            .where(sql`${orderItems.orderId} IN (${sql.join(orderIds, sql`, `)})`)
        : [];

    const itemsByOrderId = new Map<number, typeof items>();
    for (const item of items) {
      const list = itemsByOrderId.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrderId.set(item.orderId, list);
    }

    res.json({
      orders: allOrders.map((o) => ({
        ...o,
        items: itemsByOrderId.get(o.id) ?? [],
      })),
    });
  } catch (error) {
    console.error('GET /api/admin/orders failed:', error);
    res.status(500).json({ error: 'Unable to load admin orders.' });
  }
});

apiRouter.patch('/admin/orders/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid order ID.' });
    return;
  }

  const parsed = z
    .object({
      fulfilmentStatus: z.string(),
      paymentStatus: z.string().optional(),
      trackingNote: z.string().trim().max(240).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success || !isValidFulfilmentStatus(parsed.data.fulfilmentStatus)) {
    res.status(400).json({ error: 'Invalid fulfilment status.' });
    return;
  }

  if (parsed.data.paymentStatus !== undefined && !isValidPaymentStatus(parsed.data.paymentStatus)) {
    res.status(400).json({ error: 'Invalid payment status.' });
    return;
  }

  try {
    const [existingOrder] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!existingOrder) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    // Automatically mark COD orders as paid once delivered unless explicitly overridden
    const nextPaymentStatus =
      parsed.data.paymentStatus !== undefined
        ? parsed.data.paymentStatus
        : existingOrder.paymentMethod === 'cod' &&
            existingOrder.paymentStatus === 'cod_pending' &&
            parsed.data.fulfilmentStatus === 'delivered'
          ? 'paid'
          : existingOrder.paymentStatus;

    const [updated] = await db
      .update(orders)
      .set({
        fulfilmentStatus: parsed.data.fulfilmentStatus,
        paymentStatus: nextPaymentStatus,
        ...(parsed.data.trackingNote !== undefined
          ? { trackingNote: parsed.data.trackingNote }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();

    res.json({ order: updated });
  } catch (error) {
    console.error('PATCH /api/admin/orders/:id failed:', error);
    res.status(500).json({ error: 'Unable to update order fulfilment status.' });
  }
});

apiRouter.get('/admin/newsletter', requireAdmin, async (_req, res) => {
  try {
    const subscribers = await db
      .select({
        id: newsletterSubscribers.id,
        email: newsletterSubscribers.email,
        source: newsletterSubscribers.source,
        subscribedAt: newsletterSubscribers.subscribedAt,
      })
      .from(newsletterSubscribers)
      .orderBy(desc(newsletterSubscribers.subscribedAt));

    res.json({ subscribers });
  } catch (error) {
    console.error('GET /api/admin/newsletter failed:', error);
    res.status(500).json({ error: 'Unable to load newsletter subscribers.' });
  }
});

apiRouter.delete('/admin/newsletter/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid subscriber ID.' });
    return;
  }

  try {
    const [deleted] = await db
      .delete(newsletterSubscribers)
      .where(eq(newsletterSubscribers.id, id))
      .returning({ id: newsletterSubscribers.id });

    if (!deleted) {
      res.status(404).json({ error: 'Subscriber not found.' });
      return;
    }

    res.json({ deletedId: deleted.id });
  } catch (error) {
    console.error('DELETE /api/admin/newsletter/:id failed:', error);
    res.status(500).json({ error: 'Unable to remove subscriber.' });
  }
});
