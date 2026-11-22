const GUEST_TOKEN_KEY = 'kova_guest_cart_token';
const GUEST_ITEMS_BACKUP_KEY = 'kova_guest_cart_backup';
const SESSION_TOKEN_KEY = 'kova_session_token';

// Firebase ID tokens are stored ONLY in memory (never in localStorage)
let inMemoryFirebaseToken: string | null = null;

export function setFirebaseIdToken(token: string | null): void {
  inMemoryFirebaseToken = token;
}

export function getSessionToken(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null): void {
  try {
    if (token) {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage restriction errors
  }
}

export function getActiveAuthToken(): string | null {
  return inMemoryFirebaseToken || getSessionToken();
}

export function getOrCreateGuestToken(): string {
  try {
    const existing = window.localStorage.getItem(GUEST_TOKEN_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) {
      return existing;
    }
    const generated = `guest_${crypto.randomUUID().replace(/-/g, '')}`;
    window.localStorage.setItem(GUEST_TOKEN_KEY, generated);
    return generated;
  } catch {
    return 'guest_ephemeral_session';
  }
}

export function saveGuestItemsBackup(
  items: Array<{ productId: number; quantity: number }>
): void {
  try {
    window.localStorage.setItem(GUEST_ITEMS_BACKUP_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

export function loadGuestItemsBackup(): Array<{ productId: number; quantity: number }> {
  try {
    const raw = window.localStorage.getItem(GUEST_ITEMS_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i) =>
        i &&
        typeof i.productId === 'number' &&
        typeof i.quantity === 'number' &&
        i.quantity > 0
    );
  } catch {
    return [];
  }
}

export function clearGuestItemsBackup(): void {
  try {
    window.localStorage.removeItem(GUEST_ITEMS_BACKUP_KEY);
  } catch {
    // Ignore storage errors
  }
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  explicitBearer?: string | null
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const token = explicitBearer !== undefined ? explicitBearer : getActiveAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('x-guest-cart-token', getOrCreateGuestToken());

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error || `Request failed (${response.status})`,
      response.status,
      data
    );
  }

  return data as T;
}
