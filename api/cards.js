const { google } = require('googleapis');
const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
const sheetName = process.env.GOOGLE_CARDS_SHEET_NAME || 'tarjetas_credito';

function client() {
  if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) throw new Error('Faltan las variables de Google Sheets en Vercel.');
  const auth = new google.auth.JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}
async function ensure(sheets) {
  const book = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  if (!book.data.sheets.some(s => s.properties.title === sheetName)) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${sheetName}'!A1:F1`, valueInputOption: 'RAW', requestBody: { values: [['id', 'name', 'creditLimit', 'cutoffDay', 'paymentDay', 'active']] } });
}
async function list(sheets) {
  await ensure(sheets);
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetName}'!A2:F` });
  return (response.data.values || []).filter(row => row[0] && row[1]).map((row, index) => ({ row: index + 2, id: String(row[0]), name: String(row[1]), creditLimit: Number(row[2]) || 0, cutoffDay: Number(row[3]) || 0, paymentDay: Number(row[4]) || 0, active: String(row[5] || 'true') !== 'false' }));
}
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const sheets = client();
    if (req.method === 'GET') return res.status(200).json(await list(sheets));
    if (req.method === 'POST') {
      const { name, creditLimit, cutoffDay, paymentDay } = req.body || {};
      if (!String(name || '').trim() || !Number(creditLimit) || !Number(cutoffDay) || !Number(paymentDay)) return res.status(400).json({ error: 'Completa nombre, cupo, corte y pago.' });
      const id = `card_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await ensure(sheets);
      await sheets.spreadsheets.values.append({ spreadsheetId, range: `'${sheetName}'!A:F`, valueInputOption: 'RAW', requestBody: { values: [[id, String(name).trim(), Number(creditLimit), Number(cutoffDay), Number(paymentDay), true]] } });
      return res.status(201).json({ id });
    }
    res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Método no permitido.' });
  } catch (error) { console.error(error); return res.status(500).json({ error: error.message || 'No se pudieron gestionar las tarjetas.' }); }
};
