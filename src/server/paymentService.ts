import crypto from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  cartItems,
  carts,
  orderItems,
  orders,
  paymentAttempts,
  products,
  type PaymentCartSnapshotItem,
  type ShippingDetails,
} from '../db/schema.ts';
import {
  calculateCartTotals,
  isCodEligible,
  validateStockForCheckout,
} from '../lib/commerce.ts';
import {
  evaluatePaymentTransition,
  type PaymentAttemptStatus,
} from './paymentCrypto.ts';
import {
  createGatewayOrder,
  inspectGatewayPaymentStatus,
  verifyGatewaySignature,
  type PaymentGatewayMode,
} from './razorpay.ts';

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomInt(100000, 999999);
  return `KOVA-${year}-${suffix}`;
}

export async function createPaymentAttemptFromCart(params: {
  userId: number;
  shippingDetails: ShippingDetails;
  idempotencyKey?: string;
}) {
  // 1. Check idempotency key if supplied so double-clicks don't spawn duplicate payment attempts
  const key = params.idempotencyKey?.trim() || `att_${crypto.randomUUID()}`;
  const existing = await db
    .select()
    .from(paymentAttempts)
    .where(eq(paymentAttempts.idempotencyKey, key))
    .limit(1);

  if (existing[0] && existing[0].userId === params.userId && existing[0].status === 'created') {
    return existing[0];
  }

  // 2. Load user's authoritative PostgreSQL cart joined with trusted product prices & stock
  const userCart = await db
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.userId, params.userId))
    .limit(1);

  if (!userCart[0]) {
    throw new Error('Your shopping bag is empty.');
  }

  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      sku: products.sku,
      images: products.images,
      priceMinor: products.priceMinor,
      currency: products.currency,
      stock: products.stock,
      isVisible: products.isVisible,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, userCart[0].id));

  if (rows.length === 0) {
    throw new Error('Your shopping bag is empty.');
  }

  // 3. Validate stock and product visibility before creating any payment attempt
  const stockCheck = validateStockForCheckout(
    rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      quantity: r.quantity,
      availableStock: r.stock,
      isVisible: r.isVisible,
    }))
  );

  if (!stockCheck.ok) {
    const first = stockCheck.issues[0];
    const message =
      first.reason === 'unavailable'
        ? `${first.name} is no longer available for purchase.`
        : first.reason === 'out_of_stock'
          ? `${first.name} is currently out of stock.`
          : `Only ${first.available} unit(s) of ${first.name} remain in stock.`;
    throw new Error(message);
  }

  // 4. Calculate authoritative totals strictly from PostgreSQL product prices
  const snapshot: PaymentCartSnapshotItem[] = rows.map((r) => ({
    productId: r.productId,
    productName: r.name,
    productSku: r.sku,
    productImage: r.images[0] || '',
    unitPriceMinor: r.priceMinor,
    quantity: r.quantity,
    lineTotalMinor: r.priceMinor * r.quantity,
  }));

  const totals = calculateCartTotals(
    snapshot.map((item) => ({
      productId: item.productId,
      unitPriceMinor: item.unitPriceMinor,
      quantity: item.quantity,
    }))
  );

  // 5. Create Razorpay Test Mode order (or local sandbox order when keys aren't configured)
  const gatewayOrder = await createGatewayOrder({
    amountMinor: totals.totalMinor,
    currency: 'INR',
    receipt: key,
  });

  // 6. Store payment_attempt SEPARATELY from confirmed orders
  try {
    const [attempt] = await db
      .insert(paymentAttempts)
      .values({
        idempotencyKey: key,
        userId: params.userId,
        provider: gatewayOrder.provider,
        providerOrderId: gatewayOrder.providerOrderId,
        status: 'created',
        amountMinor: totals.totalMinor,
        subtotalMinor: totals.subtotalMinor,
        shippingMinor: totals.shippingMinor,
        taxMinor: totals.taxMinor,
        currency: 'INR',
        cartSnapshot: snapshot,
        shippingDetails: params.shippingDetails,
      })
      .returning();

    return attempt;
  } catch (error) {
    console.error('Failed to persist payment attempt:', error);
    throw new Error('Could not initialize checkout payment attempt.', { cause: error });
  }
}

export async function finalizeConfirmedOrderForAttempt(params: {
  attemptId: number;
  providerPaymentId: string;
}) {
  return db.transaction(async (tx) => {
    // Lock attempt row for update to guarantee single order creation under concurrent retries/webhooks
    const [attempt] = await tx
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.id, params.attemptId))
      .for('update');

    if (!attempt) {
      throw new Error('Payment attempt not found.');
    }

    // Duplicate prevention: if already confirmed, return existing order idempotently
    if (attempt.status === 'succeeded' && attempt.orderId) {
      const [existingOrder] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, attempt.orderId))
        .limit(1);
      if (existingOrder) {
        return { order: existingOrder, duplicate: true };
      }
    }

    // Check if another attempt already claimed this providerPaymentId
    const duplicatePay = await tx
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.providerPaymentId, params.providerPaymentId))
      .limit(1);

    if (duplicatePay[0] && duplicatePay[0].id !== attempt.id && duplicatePay[0].orderId) {
      const [existingOrder] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, duplicatePay[0].orderId))
        .limit(1);
      if (existingOrder) {
        return { order: existingOrder, duplicate: true };
      }
    }

    // Lock product rows and verify stock right before decrementing
    const productIds = attempt.cartSnapshot.map((i) => i.productId);
    const lockedProducts = await tx
      .select()
      .from(products)
      .where(inArray(products.id, productIds))
      .for('update');

    const byId = new Map(lockedProducts.map((p) => [p.id, p]));
    for (const item of attempt.cartSnapshot) {
      const prod = byId.get(item.productId);
      if (!prod || prod.stock < item.quantity) {
        await tx
          .update(paymentAttempts)
          .set({
            status: 'uncertain',
            providerPaymentId: params.providerPaymentId,
            failureReason: `Stock changed during payment for ${item.productName}. Please contact support for automatic refund.`,
            updatedAt: new Date(),
          })
          .where(eq(paymentAttempts.id, attempt.id));

        throw new Error(
          `Stock changed before payment settled for ${item.productName}. Order was not created so you will not be over-allocated.`
        );
      }
    }

    // Decrement stock safely
    for (const item of attempt.cartSnapshot) {
      const prod = byId.get(item.productId)!;
      await tx
        .update(products)
        .set({
          stock: prod.stock - item.quantity,
          updatedAt: new Date(),
        })
        .where(eq(products.id, prod.id));
    }

    // Create confirmed order with immutable shipping & pricing snapshot
    const [createdOrder] = await tx
      .insert(orders)
      .values({
        orderNumber: generateOrderNumber(),
        userId: attempt.userId,
        paymentStatus: 'paid',
        fulfilmentStatus: 'confirmed',
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
        shippingCountry: attempt.shippingDetails.country || 'India',
      })
      .returning();

    // Create immutable order_items snapshot so future catalogue edits never alter order history
    await tx.insert(orderItems).values(
      attempt.cartSnapshot.map((item) => ({
        orderId: createdOrder.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        productImage: item.productImage,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity,
        lineTotalMinor: item.lineTotalMinor,
      }))
    );

    // Mark payment attempt verified & linked to confirmed order
    await tx
      .update(paymentAttempts)
      .set({
        status: 'succeeded',
        orderId: createdOrder.id,
        providerPaymentId: params.providerPaymentId,
        failureReason: null,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentAttempts.id, attempt.id));

    // Clear the user's cart ONLY after order confirmation succeeds
    const [userCart] = await tx
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.userId, attempt.userId))
      .limit(1);

    if (userCart) {
      await tx.delete(cartItems).where(eq(cartItems.cartId, userCart.id));
    }

    return { order: createdOrder, duplicate: false };
  });
}

export async function verifyAndProcessPayment(params: {
  userId: number;
  attemptId: number;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}) {
  const [attempt] = await db
    .select()
    .from(paymentAttempts)
    .where(eq(paymentAttempts.id, params.attemptId))
    .limit(1);

  if (!attempt || attempt.userId !== params.userId) {
    throw new Error('Payment attempt not found.');
  }

  if (attempt.providerOrderId !== params.providerOrderId) {
    throw new Error('Payment order reference mismatch.');
  }

  // Idempotent replay check
  if (attempt.status === 'succeeded' && attempt.orderId) {
    const [existingOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, attempt.orderId))
      .limit(1);
    return {
      status: 'succeeded' as const,
      duplicate: true,
      order: existingOrder,
    };
  }

  // 1. Verify HMAC-SHA256 signature on the backend
  const sigValid = verifyGatewaySignature({
    provider: attempt.provider as PaymentGatewayMode,
    providerOrderId: params.providerOrderId,
    providerPaymentId: params.providerPaymentId,
    signature: params.signature,
  });

  if (!sigValid) {
    const transition = evaluatePaymentTransition(
      attempt.status as PaymentAttemptStatus,
      Boolean(attempt.orderId),
      { type: 'signature_invalid' }
    );
    if (transition.action === 'mark_uncertain') {
      await db
        .update(paymentAttempts)
        .set({
          status: 'uncertain',
          failureReason: transition.reason,
          updatedAt: new Date(),
        })
        .where(eq(paymentAttempts.id, attempt.id));
    }
    return {
      status: 'uncertain' as const,
      error:
        'Payment signature could not be verified on the server. Your cart has been preserved — do not treat this payment as confirmed.',
    };
  }

  // 2. Inspect actual payment status with gateway
  const inspection = await inspectGatewayPaymentStatus({
    provider: attempt.provider as PaymentGatewayMode,
    providerPaymentId: params.providerPaymentId,
    expectedAmountMinor: attempt.amountMinor,
    expectedCurrency: attempt.currency,
  });

  if (inspection.verifiedStatus === 'pending') {
    await db
      .update(paymentAttempts)
      .set({
        status: 'pending',
        providerPaymentId: params.providerPaymentId,
        failureReason: inspection.failureReason || 'Awaiting final bank settlement.',
        updatedAt: new Date(),
      })
      .where(eq(paymentAttempts.id, attempt.id));

    return {
      status: 'pending' as const,
      attemptId: attempt.id,
      message:
        inspection.failureReason ||
        'Payment is currently pending confirmation from your bank. No order has been finalized yet.',
    };
  }

  if (inspection.verifiedStatus === 'failed') {
    await db
      .update(paymentAttempts)
      .set({
        status: 'failed',
        providerPaymentId: params.providerPaymentId,
        failureReason: inspection.failureReason || 'Payment failed at gateway.',
        updatedAt: new Date(),
      })
      .where(eq(paymentAttempts.id, attempt.id));

    return {
      status: 'failed' as const,
      error: inspection.failureReason || 'Payment failed. Your cart has been preserved.',
    };
  }

  // 3. Verified & captured -> finalize confirmed order atomically
  const result = await finalizeConfirmedOrderForAttempt({
    attemptId: attempt.id,
    providerPaymentId: params.providerPaymentId,
  });

  return {
    status: 'succeeded' as const,
    duplicate: result.duplicate,
    order: result.order,
  };
}

export async function recordNonSuccessPaymentOutcome(params: {
  userId: number;
  attemptId: number;
  outcome: 'failed' | 'cancelled';
  reason?: string;
}) {
  const [attempt] = await db
    .select()
    .from(paymentAttempts)
    .where(eq(paymentAttempts.id, params.attemptId))
    .limit(1);

  if (!attempt || attempt.userId !== params.userId) {
    throw new Error('Payment attempt not found.');
  }

  // Never downgrade an already verified succeeded payment
  if (attempt.status === 'succeeded' && attempt.orderId) {
    return { status: 'succeeded' as const, orderId: attempt.orderId };
  }

  const transition = evaluatePaymentTransition(
    attempt.status as PaymentAttemptStatus,
    Boolean(attempt.orderId),
    params.outcome === 'cancelled'
      ? { type: 'customer_cancelled' }
      : { type: 'gateway_failed', reason: params.reason || 'Payment was declined.' }
  );

  if (transition.action === 'mark_failed' || transition.action === 'mark_cancelled') {
    await db
      .update(paymentAttempts)
      .set({
        status: transition.nextStatus,
        failureReason: transition.reason,
        updatedAt: new Date(),
      })
      .where(eq(paymentAttempts.id, attempt.id));

    return { status: transition.nextStatus, reason: transition.reason };
  }

  return { status: attempt.status };
}

export async function recheckPendingPaymentAttempt(params: {
  userId: number;
  attemptId: number;
}) {
  const [attempt] = await db
    .select()
    .from(paymentAttempts)
    .where(eq(paymentAttempts.id, params.attemptId))
    .limit(1);

  if (!attempt || attempt.userId !== params.userId) {
    throw new Error('Payment attempt not found.');
  }

  if (attempt.status === 'succeeded' && attempt.orderId) {
    const [existingOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, attempt.orderId))
      .limit(1);
    return { status: 'succeeded' as const, order: existingOrder, duplicate: true };
  }

  if (!attempt.providerPaymentId) {
    return {
      status: attempt.status,
      message: 'No payment transaction reference has been received yet.',
    };
  }

  const inspection = await inspectGatewayPaymentStatus({
    provider: attempt.provider as PaymentGatewayMode,
    providerPaymentId: attempt.providerPaymentId,
    expectedAmountMinor: attempt.amountMinor,
    expectedCurrency: attempt.currency,
    recheckAfterDelay: true,
  });

  if (inspection.verifiedStatus === 'captured') {
    const result = await finalizeConfirmedOrderForAttempt({
      attemptId: attempt.id,
      providerPaymentId: attempt.providerPaymentId,
    });
    return { status: 'succeeded' as const, order: result.order, duplicate: result.duplicate };
  }

  if (inspection.verifiedStatus === 'failed') {
    await db
      .update(paymentAttempts)
      .set({
        status: 'failed',
        failureReason: inspection.failureReason || 'Delayed payment failed.',
        updatedAt: new Date(),
      })
      .where(eq(paymentAttempts.id, attempt.id));
    return {
      status: 'failed' as const,
      error: inspection.failureReason || 'Delayed payment failed. Your cart is still saved.',
    };
  }

  return {
    status: 'pending' as const,
    message: inspection.failureReason || 'Payment is still awaiting bank confirmation.',
  };
}

export async function createCodOrderFromCart(params: {
  userId: number;
  shippingDetails: ShippingDetails;
}) {
  return db.transaction(async (tx) => {
    const [userCart] = await tx
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.userId, params.userId))
      .limit(1);

    if (!userCart) {
      throw new Error('Your shopping cart is empty.');
    }

    const rows = await tx
      .select({
        productId: products.id,
        name: products.name,
        sku: products.sku,
        images: products.images,
        priceMinor: products.priceMinor,
        currency: products.currency,
        stock: products.stock,
        isVisible: products.isVisible,
        quantity: cartItems.quantity,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, userCart.id));

    if (rows.length === 0) {
      throw new Error('Your shopping cart is empty.');
    }

    // Lock product rows before validating and decrementing stock
    const productIds = rows.map((r) => r.productId);
    const lockedProducts = await tx
      .select()
      .from(products)
      .where(inArray(products.id, productIds))
      .for('update');

    const byId = new Map(lockedProducts.map((p) => [p.id, p]));

    const stockCheck = validateStockForCheckout(
      rows.map((r) => {
        const live = byId.get(r.productId);
        return {
          productId: r.productId,
          name: r.name,
          quantity: r.quantity,
          availableStock: live?.stock ?? 0,
          isVisible: live?.isVisible ?? false,
        };
      })
    );

    if (!stockCheck.ok) {
      const first = stockCheck.issues[0];
      const message =
        first.reason === 'unavailable'
          ? `${first.name} is no longer available for purchase.`
          : first.reason === 'out_of_stock'
            ? `${first.name} is currently out of stock.`
            : `Only ${first.available} unit(s) of ${first.name} remain in stock.`;
      throw new Error(message);
    }

    // Authoritative server-calculated totals from live PostgreSQL prices
    const snapshot: PaymentCartSnapshotItem[] = rows.map((r) => {
      const live = byId.get(r.productId)!;
      return {
        productId: live.id,
        productName: live.name,
        productSku: live.sku,
        productImage: (live.images || [])[0] || '',
        unitPriceMinor: live.priceMinor,
        quantity: r.quantity,
        lineTotalMinor: live.priceMinor * r.quantity,
      };
    });

    const totals = calculateCartTotals(
      snapshot.map((item) => ({
        productId: item.productId,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity,
      }))
    );

    const eligibility = isCodEligible(totals.totalMinor);
    if (!eligibility.ok) {
      throw new Error(eligibility.reason);
    }

    // Decrement stock atomically
    for (const item of snapshot) {
      const live = byId.get(item.productId)!;
      await tx
        .update(products)
        .set({
          stock: live.stock - item.quantity,
          updatedAt: new Date(),
        })
        .where(eq(products.id, live.id));
    }

    // Create confirmed Cash on Delivery order (payment collected at delivery)
    const [createdOrder] = await tx
      .insert(orders)
      .values({
        orderNumber: generateOrderNumber(),
        userId: params.userId,
        paymentMethod: 'cod',
        paymentStatus: 'cod_pending',
        fulfilmentStatus: 'confirmed',
        subtotalMinor: totals.subtotalMinor,
        shippingMinor: totals.shippingMinor,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
        currency: 'INR',
        shippingName: params.shippingDetails.fullName,
        shippingEmail: params.shippingDetails.email,
        shippingPhone: params.shippingDetails.phone,
        shippingAddress: params.shippingDetails.address,
        shippingCity: params.shippingDetails.city,
        shippingPostalCode: params.shippingDetails.postalCode,
        shippingCountry: params.shippingDetails.country || 'India',
      })
      .returning();

    const createdItems = await tx
      .insert(orderItems)
      .values(
        snapshot.map((item) => ({
          orderId: createdOrder.id,
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          productImage: item.productImage,
          unitPriceMinor: item.unitPriceMinor,
          quantity: item.quantity,
          lineTotalMinor: item.lineTotalMinor,
        }))
      )
      .returning();

    // Clear the user's cart after confirmed COD order creation
    await tx.delete(cartItems).where(eq(cartItems.cartId, userCart.id));

    return {
      ...createdOrder,
      items: createdItems,
    };
  });
}
