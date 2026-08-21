async function getHeatAlert(client) {
  const { rows } = await client.query('SELECT heat_alert FROM app_state WHERE id = 1');
  return rows[0] ? rows[0].heat_alert : null;
}

// Toggles the office-wide heat alert on/off. Any logged-in user can flip it
// either way, same as a physical alarm switch.
async function toggleHeatAlert(client, username) {
  await client.query('BEGIN');
  try {
    const { rows } = await client.query('SELECT heat_alert FROM app_state WHERE id = 1 FOR UPDATE');
    const current = rows[0] ? rows[0].heat_alert : null;
    const next = current ? null : { active: true, by: username, since: new Date().toISOString() };
    await client.query('UPDATE app_state SET heat_alert = $1 WHERE id = 1', [JSON.stringify(next)]);
    await client.query('COMMIT');
    return next;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

module.exports = { getHeatAlert, toggleHeatAlert };
