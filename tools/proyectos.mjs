/**
 * Areas y proyectos de Playwright de cada sistema. Lo usan el desplegable del workflow
 * (tools/actualizar-desplegable.mjs) y el armado de cada corrida (tools/plan-corrida.mjs).
 * Si se agrega un proyecto en playwright.config.ts, se agrega aca.
 */
export const AREAS = {
  tarifario: 'Tarifario',
  reservas: 'Reservas',
  cobranzas: 'Cobranzas',
  webadmin: 'WebAdmin',
  six: 'SIX',
  seguridad: 'Seguridad',
};

export const PROYECTOS = {
  viejo: {
    tarifario: 'Climbs - Bloque A: Tarifario',
    reservas: 'Climbs - Bloque B: Reservas',
    cobranzas: 'Climbs - Bloque C: Cobranzas',
    webadmin: 'Climbs - WebAdmin',
    six: 'Climbs - SIX',
    seguridad: 'Climbs - Bloque Seguridad',
  },
  nuevo: {
    tarifario: 'App nueva - Tarifario',
    reservas: 'App nueva - Reservas',
    cobranzas: 'App nueva - Cobranzas',
    webadmin: 'App nueva - WebAdmin',
    six: 'App nueva - SIX',
    seguridad: 'App nueva - Seguridad',
  },
};

/** Areas que solo leen: con los dos sistemas van en dos maquinas a la vez. */
export const SOLO_LEEN = ['tarifario', 'six', 'seguridad'];

export const TODAS_LAS_DEL_AREA = '(todas las del area)';
