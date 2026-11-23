import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

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

    if (connectionString) {
      const isLocal =
        connectionString.includes('localhost') ||
        connectionString.includes('127.0.0.1') ||
        connectionString.includes('sslmode=disable');

      global._postgresPool = new Pool({
        connectionString,
        ssl: isLocal ? undefined : { rejectUnauthorized: false },
        max: isServerless ? 5 : 10,
        idleTimeoutMillis: isServerless ? 10000 : 30000,
        connectionTimeoutMillis: 15000,
        statement_timeout: 15000,
        allowExitOnIdle: isServerless,
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: isServerless ? 5 : 10,
        idleTimeoutMillis: isServerless ? 10000 : 30000,
        connectionTimeoutMillis: 15000,
        statement_timeout: 15000,
        allowExitOnIdle: isServerless,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
