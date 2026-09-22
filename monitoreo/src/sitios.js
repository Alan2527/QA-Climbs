/**
 * Que se vigila.
 *
 * `contiene` exige que la pagina traiga el formulario de ingreso: un 200 con una
 * pagina de error de IIS o un "sitio en mantenimiento" no cuenta como arriba.
 * Los marcadores se verificaron en QA el 2026-09-21 (las tres pantallas de login
 * traen el campo `txtPassword`).
 *
 * `activo: false` deja el sitio declarado pero sin vigilar.
 */
export const SITIOS = [
  {
    id: 'portal',
    nombre: 'Portal online',
    // No /online/: en produccion redirige a /home/, una aplicacion Next.js que arma el
    // login en el navegador, y el HTML no trae el formulario. El 2026-09-21 eso dio
    // una falsa alarma de caida. /login.aspx es la pantalla de ingreso que usan los
    // tests y trae txtPassword en QA y en produccion.
    url: 'https://amv.travel/login.aspx',
    contiene: 'txtPassword',
    activo: true,
  },
  {
    id: 'webadmin',
    nombre: 'WebAdmin',
    // En QA la pantalla de ingreso del admin tardo 15 s: el timeout es holgado.
    url: 'https://amv.travel/administration/',
    contiene: 'txtPassword',
    activo: true,
  },
  {
    id: 'backoffice',
    nombre: 'BackOffice',
    url: 'https://bo.amv.travel/',
    contiene: 'txtPassword',
    activo: true,
  },
  {
    id: 'api',
    nombre: 'API',
    // Falta la consulta liviana: la raiz responde 403 y las rutas del codigo dan 404
    // en QA. Se activa cuando el dev confirme que endpoint usar.
    // La API del proyecto (Whole.Api), la que usa el portal para el tarifario y las
    // reservas. getlanguages es de solo lectura, sin login, y lee de la base: si
    // responde con la lista de idiomas, la aplicacion y su base estan arriba.
    // Verificado el 2026-09-21: 200 con 4 idiomas en QA y en produccion.
    url: 'https://api.amv.travel/location/getlanguages',
    contiene: '<WholesalerLanguage>',
    activo: true,
  },
];

/** Fallas seguidas antes de avisar: una sola puede ser un corte de red del lado de Cloudflare. */
export const FALLAS_PARA_AVISAR = 2;

/** Cada cuanto se repite el aviso mientras un sitio siga caido. */
export const REPETIR_AVISO_MIN = 30;

/** Tiempo maximo de respuesta. Pasado esto, el sitio cuenta como caido. */
export const TIMEOUT_MS = 30_000;
