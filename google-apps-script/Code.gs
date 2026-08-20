/**
 * API privada de Finanzas para Google Sheets.
 *
 * 1. Crea un proyecto de Apps Script desde tu hoja: Extensiones > Apps Script.
 * 2. Pega este archivo y cambia SPREADSHEET_ID y SHEET_NAME.
 * 3. Implementar > Nueva implementación > Aplicación web.
 *    Ejecutar como: yo. Acceso: Cualquier persona.
 * 4. Copia la URL terminada en /exec a SHEETS_API_URL de index.html.
 *
 * La hoja puede seguir siendo privada: la URL es solo la puerta de la app.
 * No compartas la URL /exec en sitios públicos.
 */
const SPREADSHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET';
const SHEET_NAME = 'movimientos';
const HEADERS = ['id', 'date', 'note', 'amount', 'type', 'wallet', 'categoryLabel'];

function sheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function records_() {
  const sheet = sheet_();
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const indexes = {};
  values[0].forEach((header, index) => indexes[String(header).trim().toLowerCase()] = index);
  const cell = (row, names, fallback) => {
    const index = names.map(name => indexes[name]).find(index => index !== undefined);
    return index === undefined ? fallback : row[index];
  };
  return values.slice(1).filter(row => row.some(value => value !== '')).map((row, index) => ({
    // También acepta las columnas antiguas en español: Fecha, Nota, Monto,
    // Tipo, Cuenta y Categoría. No tienes que migrar el historial primero.
    id: cell(row, ['id'], `hist-${index + 2}`),
    date: cell(row, ['date', 'fecha'], ''),
    note: cell(row, ['note', 'nota', 'descripción', 'descripcion'], ''),
    amount: Number(String(cell(row, ['amount', 'monto', 'valor'], 0)).replace(/[^0-9.-]/g, '')) || 0,
    type: cell(row, ['type', 'tipo'], 'gasto'),
    wallet: cell(row, ['wallet', 'cuenta', 'billetera'], 'Nequi'),
    categoryLabel: cell(row, ['categorylabel', 'categoría', 'categoria'], 'Otros'),
  }));
}

function appendRecord_(tx) {
  const sheet = sheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
    .map(header => String(header).trim().toLowerCase());
  const fields = {
    id: tx.id, date: tx.date, fecha: tx.date,
    note: tx.note || '', nota: tx.note || '', descripción: tx.note || '', descripcion: tx.note || '',
    amount: Number(tx.amount), monto: Number(tx.amount), valor: Number(tx.amount),
    type: tx.type, tipo: tx.type,
    wallet: tx.wallet, cuenta: tx.wallet, billetera: tx.wallet,
    categorylabel: tx.categoryLabel, categoría: tx.categoryLabel, categoria: tx.categoryLabel,
  };
  // Mantiene el formato de una pestaña histórica en español, o el formato
  // canónico creado automáticamente para una pestaña nueva.
  sheet.appendRow(headers.map(header => fields[header] === undefined ? '' : fields[header]));
}

function deleteRecord_(id) {
  const sheet = sheet_();
  const values = sheet.getDataRange().getDisplayValues();
  const indexes = {};
  values[0].forEach((header, index) => indexes[String(header).trim().toLowerCase()] = index);
  const idColumn = indexes.id;
  for (let row = 1; row < values.length; row++) {
    const currentId = idColumn === undefined ? `hist-${row + 1}` : values[row][idColumn];
    if (String(currentId) === String(id)) {
      sheet.deleteRow(row + 1);
      return true;
    }
  }
  return false;
}

function json_(data, callback) {
  const text = JSON.stringify(data);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(`${callback}(${text});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return json_(records_(), e && e.parameter && e.parameter.callback);
}

function doPost(e) {
  try {
    const tx = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (tx.action === 'delete') {
      return json_({ ok: deleteRecord_(tx.id) });
    }
    if (!tx.id || !tx.date || !tx.type || !tx.wallet || !tx.categoryLabel || !Number(tx.amount)) {
      throw new Error('Movimiento incompleto');
    }
    const sheet = sheet_();
    const existingIds = records_().map(record => record.id);
    // Evita duplicados si el navegador reintenta el envío.
    if (existingIds.indexOf(String(tx.id)) === -1) {
      appendRecord_(tx);
    }
    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}
