const { withClient } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { withBoard, occupySeat } = require('../lib/board');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  const username = requireAuth(req, res);
  if (!username) return;

  try {
    const { board } = await withClient((client) => withBoard(client, (b) => {
      if (b.seats.includes(username)) {
        const err = new Error('Sei gia seduto in un posto.');
        err.statusCode = 409;
        throw err;
      }
      if (b.queue.includes(username)) {
        const err = new Error('Sei gia in coda.');
        err.statusCode = 409;
        throw err;
      }
      const freeIndex = b.seats.indexOf(null);
      if (freeIndex === -1) {
        const err = new Error('Nessun posto libero. Mettiti in coda.');
        err.statusCode = 409;
        throw err;
      }
      occupySeat(b, freeIndex, username);
    }));
    res.status(200).json(board);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
