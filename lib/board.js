const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

function assignFromQueue(board) {
  for (let i = 0; i < board.seats.length; i++) {
    if (!board.seats[i] && board.queue.length > 0) {
      const next = board.queue.shift();
      board.seats[i] = next;
      board.history.unshift({ name: next, time: new Date().toISOString() });
    }
  }
  board.history = board.history.slice(0, 50);
}

// Locks the single board row, applies lazy cleanup if 15+ minutes elapsed,
// then lets the caller mutate it, then persists. Runs inside a transaction
// to avoid race conditions between concurrent requests.
async function withBoard(client, mutateFn) {
  await client.query('BEGIN');
  try {
    const { rows } = await client.query('SELECT seats, queue, history, last_cleanup_at FROM board_state WHERE id = 1 FOR UPDATE');
    const row = rows[0];
    const board = {
      seats: row.seats,
      queue: row.queue,
      history: row.history
    };

    const lastCleanup = new Date(row.last_cleanup_at).getTime();
    let lastCleanupAt = row.last_cleanup_at;
    if (Date.now() - lastCleanup >= CLEANUP_INTERVAL_MS) {
      board.seats = [null, null, null, null];
      assignFromQueue(board);
      lastCleanupAt = new Date().toISOString();
    }

    const result = mutateFn ? mutateFn(board) : undefined;

    await client.query(
      'UPDATE board_state SET seats = $1, queue = $2, history = $3, last_cleanup_at = $4 WHERE id = 1',
      [JSON.stringify(board.seats), JSON.stringify(board.queue), JSON.stringify(board.history), lastCleanupAt]
    );
    await client.query('COMMIT');
    return { board, result };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

module.exports = { assignFromQueue, withBoard };
