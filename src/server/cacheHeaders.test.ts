import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_HEADERS,
  applyPrivateNoStore,
  applyPublicCatalogCache,
  applyPublicConfigCache,
  isCacheableCatalogRequest,
} from './cacheHeaders.ts';

function createMockRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
  };
}

test('applyPublicCatalogCache sets s-maxage and stale-while-revalidate for Vercel CDN', () => {
  const res = createMockRes();
  applyPublicCatalogCache(res);
  assert.equal(res.headers['Cache-Control'], CACHE_HEADERS.PUBLIC_CATALOG);
  assert.match(res.headers['Vercel-CDN-Cache-Control'], /s-maxage=120/);
  assert.match(res.headers['Vercel-CDN-Cache-Control'], /stale-while-revalidate=600/);
});

test('applyPublicConfigCache sets longer edge TTL for public payment configuration', () => {
  const res = createMockRes();
  applyPublicConfigCache(res);
  assert.equal(res.headers['Cache-Control'], CACHE_HEADERS.PUBLIC_CONFIG);
  assert.match(res.headers['Vercel-CDN-Cache-Control'], /s-maxage=300/);
});

test('applyPrivateNoStore explicitly blocks shared CDN caching', () => {
  const res = createMockRes();
  applyPrivateNoStore(res);
  assert.match(res.headers['Cache-Control'], /private/);
  assert.match(res.headers['Cache-Control'], /no-store/);
  assert.equal(res.headers['Vercel-CDN-Cache-Control'], 'no-store');
});

test('isCacheableCatalogRequest only allows unauthenticated GET requests', () => {
  assert.equal(isCacheableCatalogRequest('GET', false), true);
  assert.equal(isCacheableCatalogRequest('get', false), true);
  assert.equal(isCacheableCatalogRequest('GET', true), false);
  assert.equal(isCacheableCatalogRequest('POST', false), false);
});
