export const CACHE_HEADERS = {
  /** Public catalogue endpoints cached on Vercel Edge CDN with background revalidation */
  PUBLIC_CATALOG: 'public, max-age=30, s-maxage=120, stale-while-revalidate=600',
  /** Public non-sensitive runtime config (e.g. payment methods & gateway mode) */
  PUBLIC_CONFIG: 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
  /** Private, authenticated, cart, order, admin, and mutating responses */
  PRIVATE_NO_STORE: 'private, no-store, no-cache, must-revalidate',
} as const;

export interface HeaderSetter {
  setHeader(name: string, value: string): unknown;
}

export function applyPublicCatalogCache(res: HeaderSetter): void {
  res.setHeader('Cache-Control', CACHE_HEADERS.PUBLIC_CATALOG);
  res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
}

export function applyPublicConfigCache(res: HeaderSetter): void {
  res.setHeader('Cache-Control', CACHE_HEADERS.PUBLIC_CONFIG);
  res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
}

export function applyPrivateNoStore(res: HeaderSetter): void {
  res.setHeader('Cache-Control', CACHE_HEADERS.PRIVATE_NO_STORE);
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
}

export function isCacheableCatalogRequest(method: string, hasAuthHeader: boolean): boolean {
  return method.toUpperCase() === 'GET' && !hasAuthHeader;
}
