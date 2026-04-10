import { Pool } from "pg";

// Reuse connection pool across hot-reloads in dev
const globalForPg = globalThis;

if (!globalForPg._pgPool) {
  globalForPg._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export const pool = globalForPg._pgPool;

/**
 * Run a single query
 * @param {string} text
 * @param {any[]} params
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.NODE_ENV !== "production") {
      const duration = Date.now() - start;
      console.log("[db]", { text: text.slice(0, 60), duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    console.error("[db error]", err.message, { text: text.slice(0, 80) });
    throw err;
  }
}

/**
 * Run queries inside a transaction
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
