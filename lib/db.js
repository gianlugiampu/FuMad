const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL non impostata. Configurala nelle Environment Variables di Vercel.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let schemaReady = false;

async function ensureSchema(client) {
  if (schemaReady) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      username_lower TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS board_state (
      id INT PRIMARY KEY,
      seats JSONB NOT NULL DEFAULT '[null,null,null,null]'::jsonb,
      seat_since JSONB NOT NULL DEFAULT '[null,null,null,null]'::jsonb,
      reservation JSONB,
      queue JSONB NOT NULL DEFAULT '[]'::jsonb,
      history JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `);
  await client.query(`
    ALTER TABLE board_state ADD COLUMN IF NOT EXISTS seat_since JSONB NOT NULL DEFAULT '[null,null,null,null]'::jsonb;
  `);
  await client.query(`
    ALTER TABLE board_state ADD COLUMN IF NOT EXISTS reservation JSONB;
  `);
  await client.query(`
    ALTER TABLE board_state DROP CONSTRAINT IF EXISTS single_row;
  `);
  await client.query(`
    INSERT INTO board_state (id, seats, seat_since) VALUES (1, '[null,null,null,null]'::jsonb, '[null,null,null,null]'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `);
  await client.query(`
    INSERT INTO board_state (id, seats, seat_since) VALUES (2, '[null,null]'::jsonb, '[null,null]'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS rate_limit_hits (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS rate_limit_hits_key_created_idx ON rate_limit_hits (key, created_at);
  `);
  schemaReady = true;
}

async function withClient(fn) {
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    return await fn(client);
  } finally {
    client.release();
  }
}

module.exports = { pool, withClient };
