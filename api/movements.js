const { google } = require('googleapis');

const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
const sheetName = process.env.GOOGLE_SHEET_NAME || 'movimientos';
const hasHeaders = process.env.GOOGLE_SHEET_HAS_HEADERS === 'true';

function sheetsClient() {
  if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Faltan las variables de Google Sheets en Vercel.');
  }
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function asDate(value) {
  const raw = String(value || '').trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : raw;
}

function asAmount(value) {
  return Number(String(value || '').replace(/[^0-9-]/g, '')) || 0;
}

function transaction(row, rowNumber) {
  return {
    id: `row-${rowNumber}`,
    date: asDate(row[0]),
    note: String(row[1] || ''),
    amount: asAmount(row[2]),
    type: String(row[3] || 'gasto'),
    wallet: String(row[4] || 'Nequi'),
    categoryLabel: String(row[5] || 'Otros'),
  };
}

async function list(sheets) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetName}'!A:F` });
  const start = hasHeaders ? 2 : 1;
  return (response.data.values || [])
    .slice(hasHeaders ? 1 : 0)
    .map((row, index) => transaction(row, start + index))
    .filter(tx => tx.date && tx.amount);
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const sheets = sheetsClient();
    if (req.method === 'GET') return res.status(200).json(await list(sheets));

    if (req.method === 'POST') {
      const tx = req.body || {};
      if (!tx.date || !tx.amount || !tx.type || !tx.wallet || !tx.categoryLabel) {
        return res.status(400).json({ error: 'Movimiento incompleto.' });
      }
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: `'${sheetName}'!A:F`, valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[tx.date, tx.note || '', Number(tx.amount), tx.type, tx.wallet, tx.categoryLabel]] },
      });
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const target = req.body || {};
      const rows = await list(sheets);
      const match = rows.find(tx => tx.date === target.date && tx.note === String(target.note || '') &&
        tx.amount === Number(target.amount) && tx.type === target.type && tx.wallet === target.wallet &&
        tx.categoryLabel === target.categoryLabel);
      if (!match) return res.status(404).json({ error: 'Movimiento no encontrado.' });
      const row = match.id.replace('row-', '');
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${sheetName}'!A${row}:F${row}` });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Método no permitido.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'No se pudo conectar con Google Sheets.' });
  }
};
