const { google } = require('googleapis');
const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
const sheetName = process.env.GOOGLE_OPENING_BALANCES_SHEET_NAME || 'saldos_iniciales';

function client() {
  if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) throw new Error('Faltan las variables de Google Sheets en Vercel.');
  const auth = new google.auth.JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}
async function ensure(sheets) {
  const book = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  if (!book.data.sheets.some(s => s.properties.title === sheetName)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${sheetName}'!A1:B1`, valueInputOption: 'RAW', requestBody: { values: [['wallet', 'amount']] } });
  }
}
async function list(sheets) {
  await ensure(sheets);
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetName}'!A2:B` });
  return (response.data.values || []).filter(r => r[0]).map((r, i) => ({ row: i + 2, wallet: String(r[0]), amount: Number(r[1]) || 0 }));
}
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const sheets = client();
    if (req.method === 'GET') return res.status(200).json(await list(sheets));
    if (req.method === 'POST') {
      const { wallet, amount } = req.body || {};
      if (!wallet || amount === undefined || Number(amount) < 0) return res.status(400).json({ error: 'Saldo inicial inválido.' });
      const current = await list(sheets);
      const match = current.find(item => item.wallet === wallet);
      const request = { spreadsheetId, range: match ? `'${sheetName}'!A${match.row}:B${match.row}` : `'${sheetName}'!A:B`, valueInputOption: 'USER_ENTERED', requestBody: { values: [[wallet, Number(amount) || 0]] } };
      if (match) await sheets.spreadsheets.values.update(request); else await sheets.spreadsheets.values.append(request);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Método no permitido.' });
  } catch (error) { console.error(error); return res.status(500).json({ error: error.message || 'No se pudieron guardar los saldos iniciales.' }); }
};
