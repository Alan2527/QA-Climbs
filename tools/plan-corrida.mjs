#!/usr/bin/env node
/**
 * Arma las maquinas de una corrida a partir de los desplegables del workflow.
 *
 * Entrada (env): SISTEMA (Ambos / Viejo / Nuevo), AREA (Todas / Tarifario / ...), PRUEBA (una
 * etiqueta de tools/desplegable.json o "(todas las del area)"), FILTRO (texto libre opcional).
 * Salida ($GITHUB_OUTPUT): fase1, fase2, fase3 (listas de maquinas: { carril, proyectos, grep }),
 * suite y filtro (lo que muestra el tablero).
 *
 * Que corre junto y que no (las dos apps usan la misma base de QA):
 *   - Cada sistema reserva con su usuario y su carrito: el viejo con autoqa.viejo (AMV_USER,
 *     creado el 26/11/2026) y la app nueva con pablo1 (el usuario web atado a BO_USER). Dentro
 *     de un sistema, Cobranzas y Reservas comparten carrito: van en serie en la misma maquina.
 *   - Los dos WebAdmin cambian datos AUTO-QA (mercado, agencia, hotel, servicio, serie). Desde
 *     el 26/11/2026 el nuevo corre con su propio juego (AMV_JUEGO_DATOS=B, `juegoBoNuevo` en
 *     candidatos.json) y los dos van a la vez. La serie no tiene copia: el test de series de la
 *     app nueva va en la maquina del WebAdmin viejo, despues del suyo.
 *   - Fuera del WebAdmin, solo dos tests leen precios de los datos del juego de siempre
 *     ("Markups por tipo de producto" y "Carrito con hotel y servicio"). Ademas cargan el
 *     carrito de pablo1, el mismo del carrito de la app nueva (el 26/11/2026 le sumaron un item a
 *     "Anular la carta de cobranza"). Con la app nueva en la corrida van solos, en una fase aparte.
 *   - Tarifario, Seguridad y SIX solo leen. La Seguridad del viejo toma una reserva reciente
 *     del historial de autoqa.viejo: corre despues de su carrito, en la misma maquina.
 * Cada maquina es una lista de tandas que corren en fila ({ proyectos, grep, sin, juego }).
 * Corrida completa con los dos sistemas:
 *   Fase 1: WebAdmin nuevo (juego B) || WebAdmin viejo + series nuevo || carrito viejo + lectura vieja
 *           || carrito nuevo || lectura nueva.
 *   Fase 2: los tests de markups de los dos sistemas.
 *   Hasta el 26/11 eran tres fases y tardaba 1 h 37.
 * Se prueba local con:  SISTEMA=Ambos AREA=Todas node tools/plan-corrida.mjs
 */
import { readFileSync, appendFileSync } from 'node:fs';
import { PROYECTOS, AREAS, SOLO_LEEN, TODAS_LAS_DEL_AREA } from './proyectos.mjs';

const env = process.env;
const sistemaElegido = (env.SISTEMA || 'Viejo').toLowerCase();
const areaElegida = Object.keys(AREAS).find((k) => AREAS[k] === env.AREA) ?? (env.AREA && env.AREA !== 'Todas' ? null : 'todas');
const pruebaElegida = env.PRUEBA && env.PRUEBA !== TODAS_LAS_DEL_AREA ? env.PRUEBA : '';
const filtro = (env.FILTRO || '').trim();

function cortar(mensaje) {
  console.log(`::error::${mensaje}`);
  process.exit(1);
}
if (!['ambos', 'viejo', 'nuevo'].includes(sistemaElegido)) cortar(`Sistema desconocido: "${env.SISTEMA}".`);
if (!areaElegida) cortar(`Area desconocida: "${env.AREA}".`);

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let sistemas = sistemaElegido === 'ambos' ? ['viejo', 'nuevo'] : [sistemaElegido];
let area = areaElegida;
let grep = '';
let filtroDelTablero = '';

if (pruebaElegida) {
  const { opciones } = JSON.parse(readFileSync(new URL('./desplegable.json', import.meta.url), 'utf8'));
  const opcion = opciones.find((o) => o.etiqueta === pruebaElegida);
  if (!opcion) cortar(`La prueba "${pruebaElegida}" no esta en tools/desplegable.json: correr node tools/actualizar-desplegable.mjs.`);
  if (area !== 'todas' && area !== opcion.area) {
    cortar(`La prueba elegida es de ${AREAS[opcion.area]} y el area elegida es ${AREAS[area]}: elegir el area ${AREAS[opcion.area]} o "Todas".`);
  }
  area = opcion.area;
  const faltan = sistemas.filter((s) => !opcion.sistemas.includes(s));
  if (faltan.length === sistemas.length) {
    cortar(`La prueba "${opcion.titulo}" existe solo en el sistema ${opcion.sistemas.join(' y ')}: elegir ese sistema o "Ambos".`);
  }
  sistemas = sistemas.filter((s) => opcion.sistemas.includes(s));
  grep = `${escaparRegex(opcion.titulo)}$`;
  filtroDelTablero = opcion.titulo;
}
if (filtro) {
  // El texto libre manda sobre la prueba elegida: busca ese texto en el titulo.
  grep = escaparRegex(filtro);
  filtroDelTablero = filtro;
}

// Los unicos tests fuera del WebAdmin que leen precios de los datos que el WebAdmin cambia.
const LEEN_MARKUPS = '(Markups por tipo de producto|Carrito con hotel y servicio)';
// El test de series del WebAdmin (la serie no tiene juego B).
const SERIES = 'WebAdmin — series: cupo, salidas y tarifas';
// Una tanda: proyectos de Playwright que corren juntos en un solo comando.
const tanda = (pares, { grep: g = grep, sin = '', juego = '' } = {}) =>
  ({ proyectos: pares.map(([s, a]) => PROYECTOS[s][a]).join('|'), grep: g, sin, juego });
// Una maquina: sus tandas corren en fila. `tandas` va como texto JSON (la matriz del workflow).
const maquina = (carril, tandas) => ({ carril, tandas: JSON.stringify(tandas) });
const t = {
  webadmin: (s, opciones) => tanda([[s, 'webadmin']], opciones),
  carrito: (s) => tanda([[s, 'cobranzas'], [s, 'reservas']], { sin: LEEN_MARKUPS }),
  lectura: (s) => tanda(SOLO_LEEN.map((a) => [s, a]), { sin: LEEN_MARKUPS }),
  markups: (ss) => tanda(ss.flatMap((s) => [[s, 'tarifario'], [s, 'reservas']]), { grep: LEEN_MARKUPS }),
};
let fase1 = [];
let fase2 = [];
let fase3 = [];

if (area === 'todas' && !grep) {
  if (sistemas.length === 2) {
    fase1 = [
      maquina('webadmin-nuevo', [t.webadmin('nuevo', { sin: SERIES, juego: 'B' })]),
      maquina('webadmin-viejo', [t.webadmin('viejo'), t.webadmin('nuevo', { grep: SERIES })]),
      maquina('carrito-viejo', [t.carrito('viejo'), t.lectura('viejo')]),
      maquina('carrito-nuevo', [t.carrito('nuevo')]),
      maquina('lectura-nuevo', [t.lectura('nuevo')]),
    ];
    fase2 = [maquina('markups-ambos', [t.markups(sistemas)])];
  } else if (sistemas[0] === 'nuevo') {
    // Solo la app nueva: los de markups usan el carrito de pablo1, como el carrito nuevo: despues.
    fase1 = [maquina('webadmin-nuevo', [t.webadmin('nuevo', { juego: 'B' })]), maquina('carrito-nuevo', [t.carrito('nuevo')]),
      maquina('lectura-nuevo', [t.lectura('nuevo')])];
    fase2 = [maquina('markups-nuevo', [t.markups(['nuevo'])])];
  } else {
    fase1 = [maquina('webadmin-viejo', [t.markups(['viejo']), t.webadmin('viejo')]), maquina('carrito-viejo', [t.carrito('viejo'), t.lectura('viejo')])];
  }
} else if (area === 'todas') {
  // Una prueba elegida o un filtro libre sin area: todo en serie, en una maquina.
  fase1 = [maquina(`todas-${sistemas.length === 2 ? 'ambos' : sistemas[0]}`, [tanda(sistemas.flatMap((s) => Object.keys(AREAS).map((a) => [s, a])))])];
} else if (SOLO_LEEN.includes(area) || area === 'cobranzas') {
  // Solo leen, o Cobranzas (cada sistema con su carrito): con los dos sistemas, una maquina para
  // cada uno. Reservas no: los dos "Carrito con hotel y servicio" usan el carrito de autoqa.markups.
  fase1 = sistemas.map((s) => maquina(`${area}-${s}`, [tanda([[s, area]])]));
} else if (area === 'webadmin' && !grep && sistemas.length === 2) {
  // Los dos WebAdmin a la vez: el nuevo con el juego B y el test de series de los dos en fila.
  fase1 = [maquina('webadmin-nuevo', [t.webadmin('nuevo', { sin: SERIES, juego: 'B' })]),
    maquina('webadmin-viejo', [t.webadmin('viejo'), t.webadmin('nuevo', { grep: SERIES })])];
} else {
  // Reservas y Cobranzas comparten el carrito y los WebAdmin los datos: en serie, en una maquina.
  fase1 = [maquina(`${area}-${sistemas.length === 2 ? 'ambos' : sistemas[0]}`, [tanda(sistemas.map((s) => [s, area]))])];
}

const nombreSistema = sistemas.length === 2 ? '' : ` (${sistemas[0]})`;
const suite = area === 'todas' && !grep ? (sistemas.length === 2 ? 'todas' : `Todas${nombreSistema}`) : `${area === 'todas' ? 'Todas' : AREAS[area]}${nombreSistema}`;

const salida = { fase1, fase2, fase3, suite, filtro: filtroDelTablero };
for (const [k, v] of Object.entries(salida)) {
  const valor = typeof v === 'string' ? v : JSON.stringify(v);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${k}=${valor}\n`);
}
console.log(`Sistema: ${sistemas.join(' y ')} · Area: ${area === 'todas' ? 'todas' : AREAS[area]}${filtroDelTablero ? ` · Prueba: ${filtroDelTablero}` : ''}`);
for (const [n, f] of [['Fase 1', fase1], ['Fase 2', fase2], ['Fase 3', fase3]]) {
  if (!f.length) continue;
  console.log(`${n}:`);
  for (const m of f) {
    const tandas = JSON.parse(m.tandas).map((x) => `[${x.proyectos.split('|').join(', ')}]${x.grep ? ` (solo: ${x.grep})` : ''}${x.sin ? ` (sin: ${x.sin})` : ''}${x.juego ? ` (juego ${x.juego})` : ''}`);
    console.log(`  ${m.carril}: ${tandas.join('  ->  ')}`);
  }
}
