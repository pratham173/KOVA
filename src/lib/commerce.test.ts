import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartTotals,
  COD_MAX_ORDER_MINOR,
  formatCurrency,
  isCodEligible,
  isValidPaymentStatus,
  mergeGuestAndUserCartItems,
  slugify,
  validateStockForCheckout,
} from './commerce';

test('calculateCartTotals computes shipping below threshold and free shipping at/above threshold', () => {
  const under = calculateCartTotals([
    { productId: 1, unitPriceMinor: 240000, quantity: 1 },
  ]);
  assert.equal(under.subtotalMinor, 240000);
  assert.equal(under.shippingMinor, 25000);
  assert.equal(under.taxMinor, 28800);
  assert.equal(under.totalMinor, 293800);
  assert.equal(under.remainingForFreeShippingMinor, 260000);

  const free = calculateCartTotals([
    { productId: 2, unitPriceMinor: 680000, quantity: 1 },
  ]);
  assert.equal(free.subtotalMinor, 680000);
  assert.equal(free.shippingMinor, 0);
  assert.equal(free.taxMinor, 81600);
  assert.equal(free.totalMinor, 761600);
  assert.equal(free.remainingForFreeShippingMinor, 0);
});

test('calculateCartTotals returns zeroes for empty cart', () => {
  const empty = calculateCartTotals([]);
  assert.equal(empty.totalMinor, 0);
  assert.equal(empty.shippingMinor, 0);
  assert.equal(empty.taxMinor, 0);
});

test('mergeGuestAndUserCartItems sums quantities, clamps to stock, and drops hidden or sold-out items', () => {
  const merged = mergeGuestAndUserCartItems(
    [
      { productId: 1, quantity: 2 },
      { productId: 3, quantity: 1 },
    ],
    [
      { productId: 1, quantity: 4 },
      { productId: 2, quantity: 2 },
      { productId: 4, quantity: 1 },
    ],
    {
      1: { stock: 5, isVisible: true },
      2: { stock: 0, isVisible: true },
      3: { stock: 10, isVisible: false },
      4: { stock: 3, isVisible: true },
    }
  );

  assert.deepEqual(merged, [
    { productId: 1, quantity: 5 },
    { productId: 4, quantity: 1 },
  ]);
});

test('validateStockForCheckout catches hidden, out-of-stock, and insufficient-stock items', () => {
  const bad = validateStockForCheckout([
    { productId: 1, name: 'Arc Lamp', quantity: 3, availableStock: 2, isVisible: true },
    { productId: 2, name: 'Carafe', quantity: 1, availableStock: 0, isVisible: true },
    { productId: 3, name: 'Draft Item', quantity: 1, availableStock: 5, isVisible: false },
  ]);
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.equal(bad.issues.length, 3);
    assert.equal(bad.issues[0].reason, 'insufficient_stock');
    assert.equal(bad.issues[1].reason, 'out_of_stock');
    assert.equal(bad.issues[2].reason, 'unavailable');
  }

  const ok = validateStockForCheckout([
    { productId: 1, name: 'Arc Lamp', quantity: 2, availableStock: 5, isVisible: true },
  ]);
  assert.equal(ok.ok, true);
});

test('slugify and formatCurrency produce clean deterministic output', () => {
  assert.equal(slugify('  Fluted Stoneware Carafe (v2)!  '), 'fluted-stoneware-carafe-v2');
  assert.match(formatCurrency(680000, 'INR'), /6,800/);
});

test('isCodEligible and isValidPaymentStatus enforce Cash on Delivery rules', () => {
  assert.equal(isCodEligible(0).ok, false);
  assert.equal(isCodEligible(680000).ok, true);
  assert.equal(isCodEligible(COD_MAX_ORDER_MINOR).ok, true);
  assert.equal(isCodEligible(COD_MAX_ORDER_MINOR + 100).ok, false);

  assert.equal(isValidPaymentStatus('paid'), true);
  assert.equal(isValidPaymentStatus('cod_pending'), true);
  assert.equal(isValidPaymentStatus('refunded'), true);
  assert.equal(isValidPaymentStatus('free_money'), false);
});
