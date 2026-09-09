# Bitácora PlazaCamacho — instalación desde cero

Web de solo lectura conectada a Gmail. Lee los mensajes que coinciden con una búsqueda de Gmail y los convierte en una bitácora con fecha/hora, turno Día/Noche, empresa, asunto, detalle de la solicitud, estado, local, fecha mencionada y adjuntos. Incluye filtros por texto, fecha, turno y empresa, paginación de 10 registros y vista de detalle.

## 1. Requisitos
- Una cuenta de Google/Gmail con acceso al buzón que se desea leer.
- Cuenta de Google Cloud.
- Cuenta de Vercel.
- Opcional: API key de Anthropic. Sin ella funciona con reglas; con ella la extracción de empresa y detalle suele ser mejor.

## 2. Crear el proyecto en Google Cloud
1. Entra a Google Cloud Console y crea un proyecto (por ejemplo `Bitacora PlazaCamacho`).
2. Ve a **APIs & Services > Library** y habilita **Gmail API**.
3. Ve a **Google Auth Platform / OAuth consent screen** y configura la pantalla de consentimiento.
4. Si la aplicación está en modo Testing, agrega como **Test users** las cuentas Gmail que usarán la web.
5. Ve a **Credentials > Create credentials > OAuth client ID**.
6. Tipo: **Web application**.
7. En **Authorized redirect URIs** agrega, después de crear tu proyecto Vercel:
   `https://TU-DOMINIO.vercel.app/api/oauth-callback`
8. Copia el **Client ID** y **Client Secret**.

El permiso solicitado por la web es únicamente `gmail.readonly`.

## 3. Subir a Vercel
1. Descomprime este ZIP.
2. Sube la carpeta a un repositorio GitHub o impórtala directamente en Vercel.
3. Crea el proyecto en Vercel. No necesita framework especial; los archivos dentro de `/api` funcionan como Serverless Functions.
4. Obtén el dominio asignado por Vercel, por ejemplo `https://bitacora-plazacamacho.vercel.app`.
5. Regresa a Google Cloud y agrega exactamente `https://bitacora-plazacamacho.vercel.app/api/oauth-callback` como Authorized redirect URI.

## 4. Variables de entorno en Vercel
En **Project > Settings > Environment Variables** crea:
- `GOOGLE_CLIENT_ID`: Client ID de Google.
- `GOOGLE_CLIENT_SECRET`: Client Secret de Google.
- `GOOGLE_REDIRECT_URI`: `https://TU-DOMINIO.vercel.app/api/oauth-callback`
- `DEFAULT_GMAIL_QUERY`: por ejemplo `from:plazacamacho newer_than:1y`
- `MAX_EMAILS`: `300` (puedes subir hasta 1000; más correos hacen más lenta la actualización).
- `DAY_SHIFT_START`: `7`
- `DAY_SHIFT_END`: `19`
- `ANTHROPIC_API_KEY`: opcional.
- `ANTHROPIC_MODEL`: opcional, por defecto `claude-sonnet-4-6`.

Después de guardar variables, haz **Redeploy**.

## 5. Configurar qué correos debe leer
La búsqueda usa la misma sintaxis del buscador de Gmail. Ejemplos:
- `from:plazacamacho newer_than:1y`
- `from:correo@dominio.com newer_than:1y`
- `from:(correo1@dominio.com OR correo2@dominio.com) newer_than:1y`
- `newer_than:1y` para leer cualquier remitente dentro del último año.

También puedes cambiar la búsqueda desde la sección **Búsqueda de Gmail** de la propia web. El navegador recuerda esa búsqueda.

## 6. Cómo se calcula Día / Noche
Por defecto:
- Día: 07:00 a 18:59.
- Noche: 19:00 a 06:59.

Se cambia con `DAY_SHIFT_START` y `DAY_SHIFT_END`.

## 7. Extracción del detalle y empresa
Sin `ANTHROPIC_API_KEY`, el sistema intenta detectar empresa, detalle, local, fecha y estado con reglas de texto. Con la API de Anthropic configurada, envía el asunto/remitente y una parte del cuerpo del correo para devolver esos campos de forma estructurada. Esto implica que contenido de los correos procesados se envía a ese proveedor; si no deseas eso, deja la variable vacía.

## 8. Primera prueba
1. Abre la URL de Vercel.
2. Pulsa **Conectar con Gmail**.
3. Inicia sesión con la cuenta correcta y acepta el permiso de solo lectura.
4. La web cargará los mensajes y mostrará los filtros.
5. Pulsa **Ver detalle** para ver qué solicita el correo y el contenido procesado.

## 9. Si Google muestra “Access blocked” o redirect_uri_mismatch
- Comprueba que `GOOGLE_REDIRECT_URI` y el Authorized redirect URI de Google Cloud sean idénticos, incluido `https://`.
- Si OAuth está en Testing, confirma que tu Gmail esté agregado como Test user.
- Confirma que Gmail API esté habilitada.
- Tras cambiar variables en Vercel, vuelve a desplegar.

## 10. Seguridad y límites actuales
- Gmail se solicita en modo solo lectura.
- El token OAuth se guarda en una cookie HttpOnly/Secure del navegador.
- La aplicación no incluye base de datos: al actualizar vuelve a consultar Gmail.
- El turno se determina por la hora de recepción del correo, no por una fecha/hora escrita dentro del mensaje.
- La clasificación automática puede equivocarse; el botón **Abrir correo en Gmail** permite verificar el original.
- Para un entorno corporativo con varios usuarios conviene añadir autenticación propia, almacenamiento central y controles de acceso antes de producción.
