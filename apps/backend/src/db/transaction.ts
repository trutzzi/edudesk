import type { PoolClient } from 'pg';
import { pool } from './pool.js';

// Runs `work` in a transaction on one pooled connection: COMMIT when it resolves,
// ROLLBACK when it throws (then rethrows), and the connection always goes back to the pool.
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
