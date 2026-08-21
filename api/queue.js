const { withClient } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { withBoard, assignFromQueue, parseBalconyId, assertNotOnOtherBalcony } = require('../lib/board');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  const username = requireAuth(req, res);
  if (!username) return;
  const balcony = parseBalconyId(req.body && req.body.balcony);

  try {
    const { board } = await withClient(async (client) => {
      await assertNotOnOtherBalcony(client, [username], balcony);
      return withBoard(client, balcony, (b) => {
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
        b.queue.push(username);
        assignFromQueue(b);
      });
    });
    res.status(200).json({ ...board, balcony });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
