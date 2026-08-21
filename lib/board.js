const SEAT_TTL_MS = 15 * 60 * 1000;

function occupySeat(board, index, username) {
  const now = new Date().toISOString();
  board.seats[index] = username;
  board.seatSince[index] = now;
  board.history.unshift({ name: username, time: now });
  board.history = board.history.slice(0, 50);
}

function freeSeat(board, index) {
  board.seats[index] = null;
  board.seatSince[index] = null;
}

// Frees only the seats whose individual 15-minute timer has run out,
// leaving seats occupied more recently untouched.
function cleanupExpiredSeats(board) {
  const now = Date.now();
  board.seats.forEach((occupant, i) => {
    if (!occupant) return;
    const since = board.seatSince[i] ? new Date(board.seatSince[i]).getTime() : NaN;
    if (!Number.isFinite(since) || now - since >= SEAT_TTL_MS) {
      freeSeat(board, i);
    }
  });
}

function assignFromQueue(board) {
  for (let i = 0; i < board.seats.length; i++) {
    if (!board.seats[i] && board.queue.length > 0) {
      occupySeat(board, i, board.queue.shift());
    }
  }
}

// Locks the single board row, frees any seat past its individual TTL,
// then lets the caller mutate it, then persists. Runs inside a transaction
// to avoid race conditions between concurrent requests.
async function withBoard(client, mutateFn) {
  await client.query('BEGIN');
  try {
    const { rows } = await client.query('SELECT seats, seat_since, queue, history FROM board_state WHERE id = 1 FOR UPDATE');
    const row = rows[0];
    const board = {
      seats: row.seats,
      seatSince: row.seat_since,
      queue: row.queue,
      history: row.history
    };

    cleanupExpiredSeats(board);
    assignFromQueue(board);

    const result = mutateFn ? mutateFn(board) : undefined;

    await client.query(
      'UPDATE board_state SET seats = $1, seat_since = $2, queue = $3, history = $4 WHERE id = 1',
      [JSON.stringify(board.seats), JSON.stringify(board.seatSince), JSON.stringify(board.queue), JSON.stringify(board.history)]
    );
    await client.query('COMMIT');
    return { board, result };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

module.exports = { assignFromQueue, occupySeat, freeSeat, withBoard };
