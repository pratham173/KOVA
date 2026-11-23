const TRANSIENT_PG_CODES = new Set([
  '57P01', // admin_shutdown (e.g., scale-to-zero or maintenance)
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
]);

const TRANSIENT_NET_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ECONNREFUSED',
  'ENOTFOUND',
]);

const TRANSIENT_MESSAGE_PATTERNS = [
  /connection terminated unexpectedly/i,
  /connection terminated/i,
  /server closed the connection unexpectedly/i,
  /client has encountered a connection error/i,
  /socket hang up/i,
];

/**
 * Identifies recoverable idle-client disconnect errors emitted by `pg.Pool`
 * when a managed or scale-to-zero PostgreSQL backend (Cloud SQL, Neon,
 * Supabase pooler) closes an idle TCP connection. `pg.Pool` automatically
 * evicts the dead client and creates a fresh connection on the next query.
 */
export function isTransientIdlePoolError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }

  const record = err as { code?: unknown; message?: unknown; cause?: unknown };
  const code = typeof record.code === 'string' ? record.code : '';
  if (TRANSIENT_PG_CODES.has(code) || TRANSIENT_NET_CODES.has(code)) {
    return true;
  }

  const message = typeof record.message === 'string' ? record.message : '';
  if (TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }

  if (record.cause && record.cause !== err) {
    return isTransientIdlePoolError(record.cause);
  }

  return false;
}
