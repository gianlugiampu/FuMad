const { withClient } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { toggleHeatAlert } = require('../lib/globalState');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  const username = requireAuth(req, res);
  if (!username) return;

  try {
    const heatAlert = await withClient((client) => toggleHeatAlert(client, username));
    res.status(200).json({ heatAlert });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
