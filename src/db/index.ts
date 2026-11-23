import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';
import { isTransientIdlePoolError } from './poolResilience.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function getConnectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    undefined
  );
}

export const isDatabaseConfigured = Boolean(getConnectionString() || process.env.SQL_HOST);

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = getConnectionString();
    const isServerless = Boolean(process.env.VERCEL);

    const commonPoolOptions = {
      max: isServerless ? 5 : 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
      statement_timeout: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      allowExitOnIdle: isServerless,
    };

    if (connectionString) {
      const isLocal =
        connectionString.includes('localhost') ||
        connectionString.includes('127.0.0.1') ||
        connectionString.includes('sslmode=disable');

      global._postgresPool = new Pool({
        connectionString,
        ssl: isLocal ? undefined : { rejectUnauthorized: false },
        ...commonPoolOptions,
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        ...commonPoolOptions,
      });
    }

    global._postgresPool.on('error', (err) => {
      // Scale-to-zero databases (Cloud SQL, Neon, Supabase poolers) routinely
      // close idle backend sockets; pg.Pool automatically evicts the client
      // and establishes a fresh connection on the next query.
      if (isTransientIdlePoolError(err)) {
        return;
      }
      console.error('SQL pool client error:', err instanceof Error ? err.message : String(err));
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
