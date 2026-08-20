# Integración anterior de Apps Script

Este método ya no se usa. La aplicación actual se conecta mediante una función privada de Vercel; sigue las instrucciones de `VERCEL_GOOGLE_SHEETS.md`.

## Configuración (una sola vez)

1. Abre tu Google Sheet y copia su ID: es la parte de la URL entre `/d/` y `/edit`.
2. Ve a **Extensiones > Apps Script**. Reemplaza el código inicial por el contenido de `google-apps-script/Code.gs`.
3. Cambia `SPREADSHEET_ID` por el ID copiado. El nombre de la pestaña debe ser `movimientos` o debes ajustar `SHEET_NAME`.
4. Pulsa **Implementar > Nueva implementación > Aplicación web**. Elige **Ejecutar como: yo** y **Quién tiene acceso: Cualquier persona**. Autoriza el proyecto y copia la URL que termina en `/exec`.
5. Abre `index.html` y pega esa URL en `const SHEETS_API_URL = ''`. Guarda, sube el cambio a GitHub y Vercel publicará la nueva versión.

Al abrir la página desde cualquier dispositivo, descargará los movimientos existentes de la pestaña `movimientos`; al registrar o eliminar uno, aplicará el cambio allí. La app conserva una copia local para cargar rápido o cuando no haya conexión, pero Sheets es lo que comparte los datos.

## Historial que ya tienes

Puedes usar la pestaña existente si se llama `movimientos`. El conector entiende tanto las columnas nuevas (`id`, `date`, `note`, `amount`, `type`, `wallet`, `categoryLabel`) como los encabezados habituales en español: **Fecha, Nota, Monto, Tipo, Cuenta y Categoría**. Los movimientos nuevos se guardarán en el formato nuevo; no borres ni reordenes los encabezados una vez creada la pestaña.

## Seguridad

El Sheet permanece privado. La URL de Apps Script permite escribir registros, así que trátala como una clave: no la publiques ni la envíes a terceros. Para una aplicación con varias personas o requisitos de seguridad más fuertes, conviene sustituir Apps Script por un backend con autenticación (por ejemplo Supabase o Firebase).
