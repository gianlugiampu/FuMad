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
      id INT PRIMARY KEY DEFAULT 1,
      seats JSONB NOT NULL DEFAULT '[null,null,null,null]'::jsonb,
      queue JSONB NOT NULL DEFAULT '[]'::jsonb,
      history JSONB NOT NULL DEFAULT '[]'::jsonb,
      last_cleanup_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT single_row CHECK (id = 1)
    );
  `);
  await client.query(`
    INSERT INTO board_state (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING;
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
