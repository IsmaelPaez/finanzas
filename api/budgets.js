const { google } = require('googleapis');

const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
const sheetName = process.env.GOOGLE_BUDGETS_SHEET_NAME || 'presupuestos';

function client() {
  if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Faltan las variables de Google Sheets en Vercel.');
  }
  const auth = new google.auth.JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

async function ensureSheet(sheets) {
  const book = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  if (!book.data.sheets.some(sheet => sheet.properties.title === sheetName)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${sheetName}'!A1:B1`, valueInputOption: 'RAW', requestBody: { values: [['category', 'limit']] } });
  }
}

async function budgets(sheets) {
  await ensureSheet(sheets);
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetName}'!A2:B` });
  return (response.data.values || []).filter(row => row[0] && row[1] !== undefined).map((row, index) => ({ row: index + 2, category: String(row[0]), limit: Number(row[1]) || 0 }));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const sheets = client();
    if (req.method === 'GET') return res.status(200).json(await budgets(sheets));
    if (req.method === 'POST') {
      const { category, limit } = req.body || {};
      if (!category || !Number(limit) || Number(limit) < 0) return res.status(400).json({ error: 'Presupuesto inválido.' });
      const current = await budgets(sheets);
      const match = current.find(item => item.category === category);
      const range = match ? `'${sheetName}'!A${match.row}:B${match.row}` : `'${sheetName}'!A:B`;
      const method = match ? 'update' : 'append';
      await sheets.spreadsheets.values[method]({ spreadsheetId, range, valueInputOption: 'USER_ENTERED', requestBody: { values: [[category, Number(limit)]] } });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const row = Number((req.body || {}).row);
      if (!row || row < 2) return res.status(400).json({ error: 'Presupuesto inválido.' });
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${sheetName}'!A${row}:B${row}` });
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Método no permitido.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'No se pudieron gestionar los presupuestos.' });
  }
};
