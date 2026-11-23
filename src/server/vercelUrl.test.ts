import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVercelApiUrl } from './vercelUrl.ts';

test('normalizeVercelApiUrl preserves direct /api/* paths and query params', () => {
  assert.equal(normalizeVercelApiUrl('/api/products?sort=featured&inStock=true'), '/api/products?sort=featured&inStock=true');
  assert.equal(normalizeVercelApiUrl('/api/health'), '/api/health');
});

test('normalizeVercelApiUrl reconstructs path from Vercel __route rewrite param', () => {
  assert.equal(normalizeVercelApiUrl('/api?__route=products&sort=price_asc'), '/api/products?sort=price_asc');
  assert.equal(normalizeVercelApiUrl('/api?__route=products/arc-desk-lamp'), '/api/products/arc-desk-lamp');
  assert.equal(normalizeVercelApiUrl('/api?__route=/categories'), '/api/categories');
});

test('normalizeVercelApiUrl restores missing /api prefix', () => {
  assert.equal(normalizeVercelApiUrl('/products?category=lighting'), '/api/products?category=lighting');
  assert.equal(normalizeVercelApiUrl(undefined), '/api');
});
