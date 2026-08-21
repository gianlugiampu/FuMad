const WINDOW_MINUTES = 15;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Counts hits for `key` in the last WINDOW_MINUTES; throws 429 if maxAttempts
// is reached, otherwise records this attempt. Uses the same Postgres
// connection as the rest of the request so it shares the transaction-free
// client from withClient.
async function checkRateLimit(client, key, maxAttempts) {
  await client.query(`DELETE FROM rate_limit_hits WHERE created_at < now() - interval '${WINDOW_MINUTES} minutes'`);
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS count FROM rate_limit_hits WHERE key = $1 AND created_at >= now() - interval '${WINDOW_MINUTES} minutes'`,
    [key]
  );
  if (rows[0].count >= maxAttempts) {
    const err = new Error('Troppi tentativi. Riprova tra qualche minuto.');
    err.statusCode = 429;
    throw err;
  }
  await client.query('INSERT INTO rate_limit_hits (key) VALUES ($1)', [key]);
}

module.exports = { getClientIp, checkRateLimit };
