const { withClient } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { withBoard, freeSeat, clearReservation, parseBalconyId } = require('../lib/board');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  const username = requireAuth(req, res);
  if (!username) return;
  const balcony = parseBalconyId(req.body && req.body.balcony);

  try {
    const { board } = await withClient((client) => withBoard(client, balcony, (b) => {
      if (b.reservation) {
        if (b.reservation.owner !== username) {
          const err = new Error('Solo chi ha avviato la prenotazione puo terminarla.');
          err.statusCode = 409;
          throw err;
        }
        clearReservation(b);
        return;
      }
      const idx = b.seats.indexOf(username);
      if (idx === -1) {
        const err = new Error('Non hai un posto occupato.');
        err.statusCode = 409;
        throw err;
      }
      freeSeat(b, idx);
    }));
    res.status(200).json({ ...board, balcony });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
