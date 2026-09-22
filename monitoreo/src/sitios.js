/**
 * Que se vigila, por cliente.
 *
 * Sumar un cliente nuevo es agregar una entrada a CLIENTES con sus direcciones:
 * cada una arma sola su chequeo, con el criterio de su tipo (TIPOS, mas abajo). Lo
 * pidio Nico el 2026-09-22: que cada sitio que se levante entre al monitoreo sin
 * tocar la logica.
 *
 * Todas las direcciones y marcadores se verificaron contra produccion el
 * 2026-09-22, con la misma consulta liviana que hace el monitor.
 *
 * `activo: false` deja un cliente o un sitio declarado pero sin vigilar.
 */

/**
 * Como se chequea cada tipo de sitio. `contiene` es lo que tiene que traer la
 * respuesta para contar como arriba: un 200 con una pagina de error de IIS o un
 * "sitio en mantenimiento" no alcanza.
 */
const TIPOS = {
  // La pantalla de ingreso del portal (WEB). No la portada: en AMV redirige a una
  // app Next.js que arma el login en el navegador (dio una falsa alarma el 21/09),
  // y en GPS la portada pesa 167 KB y tarda 6 s.
  portal: { nombre: 'Portal', ruta: '/login.aspx', contiene: 'txtPassword' },
  // El WebAdmin vive en el mismo dominio que el portal.
  webadmin: { nombre: 'WebAdmin', ruta: '/administration/', contiene: 'txtPassword' },
  // El BackOffice (Sherpa): la raiz redirige a su login.
  sherpa: { nombre: 'BackOffice', ruta: '/', contiene: 'txtPassword' },
  // La API del sistema (Whole.Api), la que usa el portal para tarifario, carrito y
  // reservas. getlanguages es de solo lectura, sin login, y lee de la base: si
  // responde con la lista de idiomas, la aplicacion y su base estan arriba.
  api: { nombre: 'API', ruta: '/location/getlanguages', contiene: '<WholesalerLanguage>' },
  // La API de procesos de IA (API.NET): /health es el ping sin autenticacion que
  // el propio proyecto expone para monitoreo (Program.cs). Confirma que la
  // aplicacion levanta, no que los procesos de IA funcionen.
  apiIa: { nombre: 'API de IA', ruta: '/health', contiene: 'ok' },
};

export const CLIENTES = [
  {
    id: 'amv',
    nombre: 'AMV',
    portal: 'https://amv.travel',
    webadmin: 'https://amv.travel',
    sherpa: 'https://bo.amv.travel',
    api: 'https://api.amv.travel',
    apiIa: 'https://api.net.amv.travel',
  },
  {
    id: 'tsl',
    nombre: 'Travel Solutions',
    portal: 'https://portal.travelsolutionsdmc.com',
    sherpa: 'https://sherpa.travelsolutionsdmc.com',
    api: 'https://api.tsl.climbs.dev',
  },
  {
    id: 'kinich',
    nombre: 'Kinich',
    portal: 'https://portal.kinich.com',
    sherpa: 'https://sherpa.kinich.com',
    api: 'https://api.kin.climbs.dev',
  },
  {
    id: 'gps',
    nombre: 'GPS Travel',
    portal: 'https://gps-travel.com.ar',
    sherpa: 'https://sherpa.gps-travel.com.ar',
    api: 'https://api.gps-travel.com.ar',
  },
];

/**
 * Sitios que no siguen el patron portal / sherpa / api: se declaran enteros.
 */
const OTROS = [
  // La portada nueva de AMV, la que ven primero los clientes: es una app Next.js
  // aparte del portal, asi que se puede caer sola aunque el login siga andando.
  { id: 'amv-home', nombre: 'AMV · Portada', url: 'https://amv.travel/', contiene: '__NEXT_DATA__' },
  { id: 'climbs-web', nombre: 'Climbs · Sitio web', url: 'https://climbs.dev/', contiene: 'CLIMBS Technology' },
  { id: 'micdmc', nombre: 'MIC DMC · Sitio web', url: 'https://micdmc.com/', contiene: 'MIC Web' },
  { id: 'six', nombre: 'SIX · Sitio web', url: 'https://six.travel/', contiene: '<title>Six' },
  // Todavia no se usa (Nico, 2026-09-22) y hoy responde 500.30: la aplicacion no
  // levanta. Activarlo cuando entre en uso, con la ruta de salud que corresponda.
  { id: 'climbs-api', nombre: 'Climbs · API', url: 'https://api.climbs.dev/', contiene: null, activo: false },
];

/** La lista plana que recorre el monitor: un chequeo por direccion declarada. */
export const SITIOS = [
  ...CLIENTES.flatMap((c) =>
    Object.entries(TIPOS)
      .filter(([tipo]) => c[tipo])
      .map(([tipo, t]) => ({
        id: `${c.id}-${tipo}`,
        nombre: `${c.nombre} · ${t.nombre}`,
        url: `${c[tipo].replace(/\/$/, '')}${t.ruta}`,
        contiene: t.contiene,
        activo: c.activo !== false,
      })),
  ),
  ...OTROS.map((s) => ({ activo: true, ...s })),
];

/** Fallas seguidas antes de avisar: una sola puede ser un corte de red del lado de Cloudflare. */
export const FALLAS_PARA_AVISAR = 2;

/** Cada cuanto se repite el aviso mientras un sitio siga caido. */
export const REPETIR_AVISO_MIN = 30;

/** Tiempo maximo de respuesta. Pasado esto, el sitio cuenta como caido. */
export const TIMEOUT_MS = 30_000;

/**
 * Hasta cuanto de cada respuesta se lee buscando el marcador. El plan gratis de
 * Cloudflare da 10 ms de procesador por ejecucion: con 17 sitios no conviene
 * decodificar paginas enteras. Los marcadores estan todos en los primeros KB.
 */
export const MAX_BYTES_A_LEER = 64 * 1024;
