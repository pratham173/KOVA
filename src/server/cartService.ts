import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { cartItems, carts, categories, products } from '../db/schema.ts';
import {
  calculateCartTotals,
  mergeGuestAndUserCartItems,
  type CartTotals,
} from '../lib/commerce.ts';

export interface HydratedCartItem {
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

export interface HydratedCart {
  items: HydratedCartItem[];
  itemCount: number;
  totals: CartTotals;
  currency: string;
  adjustments: string[];
}

export async function getOrCreateCartId(params: {
  userId?: number;
  guestToken?: string;
}): Promise<number | null> {
  try {
    if (params.userId) {
      const existing = await db
        .select({ id: carts.id })
        .from(carts)
        .where(eq(carts.userId, params.userId))
        .limit(1);

      if (existing[0]) {
        return existing[0].id;
      }

      const [created] = await db
        .insert(carts)
        .values({ userId: params.userId })
        .onConflictDoNothing()
        .returning({ id: carts.id });

      if (created) {
        return created.id;
      }

      const fallback = await db
        .select({ id: carts.id })
        .from(carts)
        .where(eq(carts.userId, params.userId))
        .limit(1);
      return fallback[0]?.id ?? null;
    }

    if (params.guestToken) {
      const existing = await db
        .select({ id: carts.id })
        .from(carts)
        .where(eq(carts.guestToken, params.guestToken))
        .limit(1);

      if (existing[0]) {
        return existing[0].id;
      }

      const [created] = await db
        .insert(carts)
        .values({ guestToken: params.guestToken })
        .onConflictDoNothing()
        .returning({ id: carts.id });

      if (created) {
        return created.id;
      }

      const fallback = await db
        .select({ id: carts.id })
        .from(carts)
        .where(eq(carts.guestToken, params.guestToken))
        .limit(1);
      return fallback[0]?.id ?? null;
    }

    return null;
  } catch (error) {
    console.error('Failed to resolve cart:', error);
    throw new Error('Unable to access shopping cart right now.', { cause: error });
  }
}

export async function loadHydratedCart(params: {
  userId?: number;
  guestToken?: string;
}): Promise<HydratedCart> {
  try {
    const empty: HydratedCart = {
      items: [],
      itemCount: 0,
      totals: calculateCartTotals([]),
      currency: 'INR',
      adjustments: [],
    };

    const cartRow = params.userId
      ? await db
          .select({ id: carts.id })
          .from(carts)
          .where(eq(carts.userId, params.userId))
          .limit(1)
      : params.guestToken
        ? await db
            .select({ id: carts.id })
            .from(carts)
            .where(eq(carts.guestToken, params.guestToken))
            .limit(1)
        : [];

    if (!cartRow[0]) {
      return empty;
    }

    const rows = await db
      .select({
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
        quantity: cartItems.quantity,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(cartItems.cartId, cartRow[0].id));

    const adjustments: string[] = [];
    const hydrated: HydratedCartItem[] = [];

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
        await db
          .update(cartItems)
          .set({ quantity: effectiveQty, updatedAt: new Date() })
          .where(eq(cartItems.id, row.cartItemId));
      }

      hydrated.push({
        productId: row.productId,
        slug: row.slug,
        name: row.name,
        sku: row.sku,
        categoryName: row.categoryName || 'Objects',
        image: row.images[0] || '',
        unitPriceMinor: row.priceMinor,
        currency: row.currency,
        stock: row.stock,
        isVisible: row.isVisible,
        quantity: effectiveQty,
        lineTotalMinor: row.priceMinor * effectiveQty,
      });
    }

    hydrated.sort((a, b) => a.productId - b.productId);

    const totals = calculateCartTotals(
      hydrated.map((item) => ({
        productId: item.productId,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity,
      }))
    );

    const itemCount = hydrated.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items: hydrated,
      itemCount,
      totals,
      currency: hydrated[0]?.currency || 'INR',
      adjustments,
    };
  } catch (error) {
    console.error('Failed to load cart:', error);
    throw new Error('Unable to load shopping cart.', { cause: error });
  }
}

export async function upsertCartItem(params: {
  userId?: number;
  guestToken?: string;
  productId: number;
  quantityDelta?: number;
  absoluteQuantity?: number;
}): Promise<HydratedCart> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, params.productId))
    .limit(1);

  if (!product || !product.isVisible) {
    throw new Error('This product is no longer available.');
  }

  const cartId = await getOrCreateCartId({
    userId: params.userId,
    guestToken: params.guestToken,
  });

  if (!cartId) {
    throw new Error('Missing cart session token.');
  }

  try {
    await db.transaction(async (tx) => {
      // Serialize concurrent mutations on the same cart
      await tx.select({ id: carts.id }).from(carts).where(eq(carts.id, cartId)).for('update');

      const existing = await tx
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, params.productId)))
        .limit(1);

      const nextQty =
        params.absoluteQuantity !== undefined
          ? Math.floor(params.absoluteQuantity)
          : (existing[0]?.quantity ?? 0) + Math.floor(params.quantityDelta ?? 1);

      if (nextQty <= 0) {
        if (existing[0]) {
          await tx.delete(cartItems).where(eq(cartItems.id, existing[0].id));
        }
        return;
      }

      if (product.stock <= 0) {
        throw new Error(`${product.name} is currently out of stock.`);
      }
      if (nextQty > product.stock) {
        throw new Error(`Only ${product.stock} unit(s) of ${product.name} remain in stock.`);
      }

      const now = new Date();
      await tx
        .insert(cartItems)
        .values({
          cartId,
          productId: params.productId,
          quantity: nextQty,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [cartItems.cartId, cartItems.productId],
          set: { quantity: nextQty, updatedAt: now },
        });
    });

    return loadHydratedCart({ userId: params.userId, guestToken: params.guestToken });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('stock') || error.message.includes('available'))) {
      throw error;
    }
    console.error('Failed to update cart item:', error);
    throw new Error('Unable to update cart item.', { cause: error });
  }
}

export async function removeCartItem(params: {
  userId?: number;
  guestToken?: string;
  productId: number;
}): Promise<HydratedCart> {
  const cartId = await getOrCreateCartId({
    userId: params.userId,
    guestToken: params.guestToken,
  });
  if (cartId) {
    try {
      await db
        .delete(cartItems)
        .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, params.productId)));
    } catch (error) {
      console.error('Failed to remove cart item:', error);
      throw new Error('Unable to remove item from cart.', { cause: error });
    }
  }
  return loadHydratedCart({ userId: params.userId, guestToken: params.guestToken });
}

export async function mergeGuestCartIntoUserCart(params: {
  userId: number;
  guestToken?: string;
  fallbackItems?: Array<{ productId: number; quantity: number }>;
}): Promise<HydratedCart> {
  try {
    const userCartId = await getOrCreateCartId({ userId: params.userId });
    if (!userCartId) {
      return loadHydratedCart({ userId: params.userId });
    }

    await db.transaction(async (tx) => {
      // Lock the user's cart row so concurrent login/sync calls serialize cleanly
      await tx.select({ id: carts.id }).from(carts).where(eq(carts.id, userCartId)).for('update');

      const userRows = await tx
        .select({ productId: cartItems.productId, quantity: cartItems.quantity })
        .from(cartItems)
        .where(eq(cartItems.cartId, userCartId));

      let guestCartId: number | null = null;
      let guestRows: Array<{ productId: number; quantity: number }> = [];

      if (params.guestToken) {
        const guestCart = await tx
          .select({ id: carts.id })
          .from(carts)
          .where(eq(carts.guestToken, params.guestToken))
          .for('update');

        if (guestCart[0]) {
          guestCartId = guestCart[0].id;
          guestRows = await tx
            .select({ productId: cartItems.productId, quantity: cartItems.quantity })
            .from(cartItems)
            .where(eq(cartItems.cartId, guestCartId));
        }
      }

      // Only use client fallbackItems if there was no guest cart row in Postgres AND user cart has no matching items yet
      if (
        !guestCartId &&
        guestRows.length === 0 &&
        params.fallbackItems &&
        params.fallbackItems.length > 0 &&
        userRows.length === 0
      ) {
        guestRows = params.fallbackItems;
      }

      if (guestRows.length === 0) {
        if (guestCartId) {
          await tx.delete(carts).where(eq(carts.id, guestCartId));
        }
        return;
      }

      const allProductIds = Array.from(
        new Set([...userRows.map((i) => i.productId), ...guestRows.map((i) => i.productId)])
      );

      const prodRows =
        allProductIds.length > 0
          ? await tx
              .select({ id: products.id, stock: products.stock, isVisible: products.isVisible })
              .from(products)
              .where(inArray(products.id, allProductIds))
          : [];

      const stockMap: Record<number, { stock: number; isVisible: boolean }> = {};
      for (const p of prodRows) {
        stockMap[p.id] = { stock: p.stock, isVisible: p.isVisible };
      }

      const merged = mergeGuestAndUserCartItems(userRows, guestRows, stockMap);

      await tx.delete(cartItems).where(eq(cartItems.cartId, userCartId));
      const now = new Date();
      for (const item of merged) {
        await tx
          .insert(cartItems)
          .values({
            cartId: userCartId,
            productId: item.productId,
            quantity: item.quantity,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [cartItems.cartId, cartItems.productId],
            set: { quantity: item.quantity, updatedAt: now },
          });
      }

      if (guestCartId) {
        await tx.delete(carts).where(eq(carts.id, guestCartId));
      }
    });

    return loadHydratedCart({ userId: params.userId });
  } catch (error) {
    console.error('Failed to merge guest cart:', error);
    throw new Error('Unable to merge guest cart after login.', { cause: error });
  }
}
