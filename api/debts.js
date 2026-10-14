const { google } = require('googleapis');
const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
const sheetName = process.env.GOOGLE_DEBTS_SHEET_NAME || 'deudas';

function client() {
  if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) throw new Error('Faltan las variables de Google Sheets en Vercel.');
  const auth = new google.auth.JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}
async function ensure(sheets) {
  const book = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  if (!book.data.sheets.some(s => s.properties.title === sheetName)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${sheetName}'!A1:J1`, valueInputOption: 'RAW', requestBody: { values: [['id', 'name', 'originalAmount', 'initialPaid', 'active', 'kind', 'dueDate', 'cutoffDay', 'paymentDay', 'createdAt']] } });
  }
  // Asegura nuevas columnas también si la pestaña fue creada por una versión anterior.
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${sheetName}'!A1:J1`, valueInputOption: 'RAW', requestBody: { values: [['id', 'name', 'originalAmount', 'initialPaid', 'active', 'kind', 'dueDate', 'cutoffDay', 'paymentDay', 'createdAt']] } });
}
async function list(sheets) {
  await ensure(sheets);
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetName}'!A2:J` });
  return (response.data.values || []).filter(row => row[0] && row[1]).map((row, index) => ({ row: index + 2, id: String(row[0]), name: String(row[1]), originalAmount: Number(row[2]) || 0, initialPaid: Number(row[3]) || 0, active: String(row[4] || 'true') !== 'false', kind: String(row[5] || 'debt'), dueDate: String(row[6] || ''), cutoffDay: Number(row[7]) || 0, paymentDay: Number(row[8]) || 0 }));
}
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const sheets = client();
    if (req.method === 'GET') return res.status(200).json(await list(sheets));
    if (req.method === 'POST') {
      const { name, originalAmount, initialPaid = 0, kind = 'debt', dueDate = '', cutoffDay = 0, paymentDay = 0 } = req.body || {};
      if (!String(name || '').trim() || !Number(originalAmount) || Number(initialPaid) < 0) return res.status(400).json({ error: 'Datos de deuda inválidos.' });
      const id = `debt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await ensure(sheets);
      await sheets.spreadsheets.values.append({ spreadsheetId, range: `'${sheetName}'!A:J`, valueInputOption: 'RAW', requestBody: { values: [[id, String(name).trim(), Number(originalAmount), Number(initialPaid), true, kind, dueDate, Number(cutoffDay) || '', Number(paymentDay) || '', new Date().toISOString()]] } });
      return res.status(201).json({ id });
    }
    if (req.method === 'PATCH') {
      const { row, active } = req.body || {};
      if (!Number(row)) return res.status(400).json({ error: 'Deuda inválida.' });
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${sheetName}'!E${Number(row)}`, valueInputOption: 'RAW', requestBody: { values: [[Boolean(active)]] } });
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, PATCH'); return res.status(405).json({ error: 'Método no permitido.' });
  } catch (error) { console.error(error); return res.status(500).json({ error: error.message || 'No se pudieron gestionar las deudas.' }); }
};
