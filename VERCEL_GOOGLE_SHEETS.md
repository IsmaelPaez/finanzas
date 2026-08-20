# Configuración única: Vercel + Google Sheets

La app ya no usa Apps Script ni una URL configurable desde el navegador. Vercel se conecta a Google Sheets de forma privada y la web usa `/api/movements`.

## 1. Crear una cuenta de servicio de Google

1. Ve a [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto y activa **Google Sheets API**.
2. En **IAM y administración > Cuentas de servicio**, crea una cuenta de servicio.
3. Abre esa cuenta, pestaña **Claves**, crea una clave JSON y descárgala. No subas ese archivo a GitHub.
4. En tu Google Sheet, pulsa **Compartir** y da permiso de **Editor** al correo de la cuenta de servicio (termina en `iam.gserviceaccount.com`).

## 2. Variables en Vercel

En tu proyecto de Vercel: **Settings > Environment Variables**, añade para Production, Preview y Development:

| Nombre | Valor |
| --- | --- |
| `GOOGLE_SHEETS_ID` | El ID entre `/d/` y `/edit` de la URL de tu Sheet. |
| `GOOGLE_SHEET_NAME` | El nombre exacto de la pestaña con movimientos. Por ejemplo: `movimientos`. |
| `GOOGLE_SHEET_HAS_HEADERS` | `false` si, como en tu captura, la primera fila ya es un movimiento. `true` si hay títulos en la fila 1. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | El campo `client_email` del JSON descargado. |
| `GOOGLE_PRIVATE_KEY` | El campo `private_key` completo del JSON, incluidas las líneas BEGIN/END. |

Después, haz un redeploy de Vercel. La clave queda solamente en Vercel; ni GitHub ni el navegador la reciben.

## Datos admitidos

No necesitas cambiar tus columnas ni añadir encabezados. Se leen siempre en este orden: fecha, descripción, monto, tipo, cuenta y categoría. Tus valores `Ingreso`, `Egreso`, `Efectivo`, `Nequi` y `Nu Bank` son compatibles.
