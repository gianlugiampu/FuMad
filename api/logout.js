const { clearAuthCookie } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  clearAuthCookie(res);
  res.status(200).json({ ok: true });
};
