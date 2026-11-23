/**
 * Normalizes incoming request URLs for Vercel serverless rewrites so Express
 * routes mounted at `/api` always receive `/api/<subpath>?<query>`.
 *
 * Supports:
 * - Direct paths: `/api/products?sort=featured`
 * - Query-based rewrites: `/api?__route=products&sort=featured`
 * - Stripped-prefix paths: `/products?sort=featured`
 */
export function normalizeVercelApiUrl(rawUrl: string | undefined): string {
  const input = rawUrl || '/api';
  const parsed = new URL(input, 'http://localhost');
  const routeParam = parsed.searchParams.get('__route');

  if (routeParam !== null) {
    parsed.searchParams.delete('__route');
    const cleanRoute = routeParam.replace(/^\/+/, '');
    const pathname = cleanRoute ? `/api/${cleanRoute}` : '/api';
    const qs = parsed.searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  let pathname = parsed.pathname || '/api';
  if (pathname !== '/api' && !pathname.startsWith('/api/')) {
    pathname = pathname.startsWith('/') ? `/api${pathname}` : `/api/${pathname}`;
  }

  const qs = parsed.searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
