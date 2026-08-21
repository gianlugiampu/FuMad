const SEAT_TTL_MS = 15 * 60 * 1000;
const RESERVATION_TTL_MS = {
  privacy: 2 * 60 * 1000,
  gossip: 5 * 60 * 1000
};
const BALCONY_SEAT_COUNTS = { 1: 4, 2: 2 };

// Sentinel used for the seats of a Privacy/Gossip reservation that are not
// assigned to a specific member: blocks booking (seats.indexOf(null) skips
// it) without colliding with any real username, since usernames are always
// strings.
const LOCKED = true;

function parseBalconyId(value) {
  const id = parseInt(value, 10);
  return BALCONY_SEAT_COUNTS[id] ? id : 1;
}

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

function clearReservation(board) {
  const n = board.seats.length;
  board.seats = new Array(n).fill(null);
  board.seatSince = new Array(n).fill(null);
  board.reservation = null;
}

// Reserves all seats for `members` (owner first). Extra seats beyond
// members.length are locked. Throws 409/400 if the balcony isn't fully
// free, a reservation is already active, or there are too many members
// for this balcony's capacity.
function startReservation(board, type, members) {
  if (board.reservation) {
    const err = new Error('Il balcone e gia riservato.');
    err.statusCode = 409;
    throw err;
  }
  if (board.seats.some((s) => s)) {
    const err = new Error('Il balcone deve essere libero per attivare questa modalita.');
    err.statusCode = 409;
    throw err;
  }
  const n = board.seats.length;
  if (members.length > n) {
    const err = new Error('Questo balcone ha solo ' + n + ' posti.');
    err.statusCode = 400;
    throw err;
  }
  const now = new Date().toISOString();
  const seats = new Array(n).fill(LOCKED);
  members.forEach((name, i) => { seats[i] = name; });
  board.seats = seats;
  board.seatSince = new Array(n).fill(now);
  board.reservation = { type, owner: members[0], members, since: now };
  const label = type === 'privacy' ? 'Privacy: ' + members[0] : 'Gossip: ' + members.join(', ');
  board.history.unshift({ name: label, time: now });
  board.history = board.history.slice(0, 50);
}

// Frees only the seats whose individual 15-minute timer has run out,
// leaving seats occupied more recently untouched. While a Privacy/Gossip
// reservation is active, seats are governed by the reservation's own TTL
// instead, and the whole balcony frees together when it expires.
function cleanupExpiredSeats(board) {
  if (board.reservation) {
    const ttl = RESERVATION_TTL_MS[board.reservation.type] || SEAT_TTL_MS;
    const since = new Date(board.reservation.since).getTime();
    if (!Number.isFinite(since) || Date.now() - since >= ttl) {
      clearReservation(board);
    }
    return;
  }
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
  if (board.reservation) return;
  for (let i = 0; i < board.seats.length; i++) {
    if (!board.seats[i] && board.queue.length > 0) {
      occupySeat(board, i, board.queue.shift());
    }
  }
}

// Locks the given balcony's row, frees any seat past its individual TTL (or
// the whole balcony past its reservation TTL), then lets the caller mutate
// it, then persists. Runs inside a transaction to avoid race conditions
// between concurrent requests.
async function withBoard(client, balconyId, mutateFn) {
  await client.query('BEGIN');
  try {
    const { rows } = await client.query('SELECT seats, seat_since, reservation, queue, history FROM board_state WHERE id = $1 FOR UPDATE', [balconyId]);
    const row = rows[0];
    const board = {
      seats: row.seats,
      seatSince: row.seat_since,
      reservation: row.reservation,
      queue: row.queue,
      history: row.history
    };

    cleanupExpiredSeats(board);
    assignFromQueue(board);

    const result = mutateFn ? mutateFn(board) : undefined;

    await client.query(
      'UPDATE board_state SET seats = $2, seat_since = $3, reservation = $4, queue = $5, history = $6 WHERE id = $1',
      [balconyId, JSON.stringify(board.seats), JSON.stringify(board.seatSince), JSON.stringify(board.reservation), JSON.stringify(board.queue), JSON.stringify(board.history)]
    );
    await client.query('COMMIT');
    return { board, result };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

module.exports = { assignFromQueue, occupySeat, freeSeat, clearReservation, startReservation, withBoard, parseBalconyId, BALCONY_SEAT_COUNTS };
