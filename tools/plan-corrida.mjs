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
 *   - Los dos WebAdmin cambian los mismos datos AUTO-QA (candidatos.json: agencia 6334,
 *     mercado 37, hotel 15422, servicio 7954, serie 20): nunca a la vez.
 *   - Fuera del WebAdmin, solo dos tests leen precios de esos datos ("Markups por tipo de
 *     producto" y "Carrito con hotel y servicio"): se sacan de su maquina y van al final.
 *   - Tarifario, Seguridad y SIX solo leen. La Seguridad del viejo toma una reserva reciente
 *     del historial de autoqa.viejo: corre despues de su carrito.
 * Corrida completa con los dos sistemas:
 *   Fase 1: WebAdmin nuevo || carrito viejo || carrito nuevo || lectura nueva.
 *   Fase 2: WebAdmin viejo || lectura vieja.
 *   Fase 3: los tests de markups de los dos sistemas.
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
const maquina = (carril, pares, sin = '') => ({ carril, proyectos: pares.map(([s, a]) => PROYECTOS[s][a]).join('|'), grep, sin });
const lectura = (s) => maquina(`lectura-${s}`, SOLO_LEEN.map((a) => [s, a]), LEEN_MARKUPS);
const carrito = (s) => maquina(`carrito-${s}`, [[s, 'cobranzas'], [s, 'reservas']], LEEN_MARKUPS);
const markups = (ss) => ({ ...maquina(`markups-${ss.length === 2 ? 'ambos' : ss[0]}`, ss.flatMap((s) => [[s, 'tarifario'], [s, 'reservas']])), grep: LEEN_MARKUPS });
let fase1 = [];
let fase2 = [];
let fase3 = [];

if (area === 'todas' && !grep) {
  if (sistemas.length === 2) {
    fase1 = [maquina('webadmin-nuevo', [['nuevo', 'webadmin']]), carrito('viejo'), carrito('nuevo'), lectura('nuevo')];
    fase2 = [maquina('webadmin-viejo', [['viejo', 'webadmin']]), lectura('viejo')];
    fase3 = [markups(sistemas)];
  } else {
    const [s] = sistemas;
    fase1 = [maquina(`webadmin-${s}`, [[s, 'webadmin']]), carrito(s)];
    fase2 = [lectura(s), markups([s])];
  }
} else if (area === 'todas') {
  // Una prueba elegida o un filtro libre sin area: todo en serie, en una maquina.
  fase1 = [maquina(`todas-${sistemas.length === 2 ? 'ambos' : sistemas[0]}`, sistemas.flatMap((s) => Object.keys(AREAS).map((a) => [s, a])))];
} else if (SOLO_LEEN.includes(area) || area === 'cobranzas') {
  // Solo leen, o Cobranzas (cada sistema con su carrito): con los dos sistemas, una maquina para
  // cada uno. Reservas no: los dos "Carrito con hotel y servicio" usan el carrito de autoqa.markups.
  fase1 = sistemas.map((s) => maquina(`${area}-${s}`, [[s, area]]));
} else {
  // Reservas y Cobranzas comparten el carrito y los WebAdmin los datos: en serie, en una maquina.
  fase1 = [maquina(`${area}-${sistemas.length === 2 ? 'ambos' : sistemas[0]}`, sistemas.map((s) => [s, area]))];
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
  if (f.length) console.log(`${n}: ${f.map((m) => `${m.carril} [${m.proyectos.split('|').join(', ')}]${m.sin ? ' (sin markups)' : ''}${m.grep && m.grep === LEEN_MARKUPS ? ' (solo markups)' : ''}`).join('  ||  ')}`);
}
