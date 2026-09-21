/**
 * Resumen de una corrida para el tablero de pruebas.
 *
 * Lee el JSON que deja el reporter `json` de Playwright y escribe, dentro de la
 * carpeta que se publica en GitHub Pages:
 *
 *   tablero/corridas/{numero}.json   el detalle de la corrida, prueba por prueba
 *   tablero/corridas.json            el indice de las ultimas corridas, la mas nueva primero
 *
 * Las corridas anteriores se toman de la publicacion previa: cada publicacion
 * reemplaza la rama gh-pages entera (`force_orphan`), asi que lo que no se copie
 * de nuevo se pierde.
 *
 * No toca nada de Allure: lee otro archivo y escribe en otra carpeta.
 *
 * Uso:
 *   node tools/resumen-corrida.mjs <json de playwright> <tablero anterior> <tablero nuevo>
 *
 * Los datos de la corrida vienen del entorno que arma el workflow: CORRIDA,
 * CORRIDA_ID, SUITE, FILTRO, EVENTO, COMMIT, REPO.
 */
import fs from 'node:fs';
import path from 'node:path';

// El resumen pesa pocos KB: se guardan muchas mas corridas que los 5 reportes de Allure.
const CORRIDAS_A_CONSERVAR = 30;

const [archivoPlaywright, tableroAnterior, tableroNuevo] = process.argv.slice(2);
if (!archivoPlaywright || !tableroAnterior || !tableroNuevo) {
  console.error('Uso: node tools/resumen-corrida.mjs <json de playwright> <tablero anterior> <tablero nuevo>');
  process.exit(1);
}

const env = process.env;
const numero = Number(env.CORRIDA);
if (!Number.isInteger(numero) || numero <= 0) {
  console.error(`CORRIDA invalida: "${env.CORRIDA}"`);
  process.exit(1);
}

/** El area del tablero sale de la carpeta del archivo, no del nombre del proyecto. */
function areaDe(archivo) {
  if (archivo.startsWith('bloque-a/')) return 'tarifario';
  if (archivo.startsWith('bloque-b/')) return 'reservas';
  if (archivo.startsWith('bloque-c/')) return 'cobranzas';
  // Login y precondiciones: no son pruebas de negocio, pero si fallan el resto no corre.
  return 'preparacion';
}

/**
 * Playwright anida describe dentro de describe: se recorre el arbol entero.
 * `status` de cada test ya es el veredicto final despues de los reintentos:
 * expected, unexpected, flaky o skipped.
 */
function recolectar(suite, titulos, pruebas) {
  const actuales = suite.title ? [...titulos, suite.title] : titulos;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const intentos = t.results ?? [];
      const ultimo = intentos.at(-1);
      const conError = [...intentos].reverse().find((r) => r.error?.message);
      pruebas.push({
        area: areaDe(spec.file),
        archivo: spec.file,
        linea: spec.line,
        grupo: actuales.join(' › '),
        titulo: spec.title,
        proyecto: t.projectName,
        estado: traducirEstado(t.status),
        duracionMs: intentos.reduce((s, r) => s + (r.duration ?? 0), 0),
        intentos: intentos.length,
        error: conError ? primeraLinea(conError.error.message) : null,
        ...(ultimo?.status === 'interrupted' ? { interrumpida: true } : {}),
      });
    }
  }
  for (const hija of suite.suites ?? []) recolectar(hija, actuales, pruebas);
}

function traducirEstado(status) {
  return { expected: 'paso', unexpected: 'fallo', flaky: 'inestable', skipped: 'omitida' }[status] ?? status;
}

/** El mensaje de Playwright trae colores ANSI y el diff entero: al tablero va la primera linea. */
function primeraLinea(mensaje) {
  const limpio = mensaje.replace(/\u001b\[[0-9;]*m/g, '');
  const linea = limpio.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  return linea.length > 300 ? `${linea.slice(0, 297)}...` : linea;
}

function contar(pruebas) {
  const t = { total: pruebas.length, paso: 0, fallo: 0, inestable: 0, omitida: 0 };
  for (const p of pruebas) if (p.estado in t) t[p.estado]++;
  return t;
}

// --- La corrida de hoy ---------------------------------------------------------

let pruebas = [];
let erroresGlobales = [];
let inicio = null;
let duracionMs = null;
let hayResultados = false;

if (fs.existsSync(archivoPlaywright)) {
  const reporte = JSON.parse(fs.readFileSync(archivoPlaywright, 'utf8'));
  // El primer nivel es el archivo, que ya viaja en `archivo`: el grupo arranca en los describe.
  for (const archivo of reporte.suites ?? []) recolectar({ ...archivo, title: undefined }, [], pruebas);
  erroresGlobales = (reporte.errors ?? []).map((e) => primeraLinea(e.message ?? String(e)));
  inicio = reporte.stats?.startTime ?? null;
  duracionMs = reporte.stats?.duration ?? null;
  hayResultados = true;
} else {
  // La corrida murio antes de llegar a los tests (dependencias, navegador): igual
  // se registra, para que el tablero no muestre la ultima verde como si fuera hoy.
  console.warn(`No esta ${archivoPlaywright}: la corrida se registra sin resultados.`);
}

const totales = contar(pruebas);
const deNegocio = contar(pruebas.filter((p) => p.area !== 'preparacion'));

let estado;
if (!hayResultados) estado = 'sin-resultados';
else if (totales.fallo > 0 || erroresGlobales.length > 0) estado = 'con-fallas';
else if (deNegocio.total === 0) estado = 'sin-resultados';
else estado = 'sin-fallas';

const areas = {};
for (const area of ['tarifario', 'reservas', 'cobranzas', 'preparacion']) {
  const delArea = pruebas.filter((p) => p.area === area);
  if (delArea.length) areas[area] = contar(delArea);
}

const [dueno, repo] = (env.REPO ?? '').split('/');
const sitio = dueno && repo ? `https://${dueno.toLowerCase()}.github.io/${repo}` : null;
const corrida = {
  corrida: numero,
  fecha: inicio ?? new Date().toISOString(),
  duracionMs,
  estado,
  suite: env.SUITE || null,
  filtro: env.FILTRO || null,
  evento: env.EVENTO || null,
  commit: env.COMMIT || null,
  enlaces: {
    // El reporte de Allure de esta corrida, mientras siga entre los que se conservan.
    allure: sitio ? `${sitio}/${numero}/` : null,
    github: env.REPO && env.CORRIDA_ID ? `https://github.com/${env.REPO}/actions/runs/${env.CORRIDA_ID}` : null,
  },
  totales,
  areas,
  erroresGlobales,
  pruebas,
};

// --- Armar la carpeta nueva ------------------------------------------------------

const dirCorridas = path.join(tableroNuevo, 'corridas');
fs.mkdirSync(dirCorridas, { recursive: true });

let indiceAnterior = [];
const archivoIndiceAnterior = path.join(tableroAnterior, 'corridas.json');
if (fs.existsSync(archivoIndiceAnterior)) {
  try {
    indiceAnterior = JSON.parse(fs.readFileSync(archivoIndiceAnterior, 'utf8')).corridas ?? [];
  } catch (e) {
    // Un indice roto no puede frenar la publicacion: se arranca de cero.
    console.warn(`corridas.json anterior ilegible, se descarta: ${e.message}`);
  }
}

const entrada = {
  corrida: numero,
  fecha: corrida.fecha,
  duracionMs,
  estado,
  suite: corrida.suite,
  filtro: corrida.filtro,
  evento: corrida.evento,
  commit: corrida.commit,
  totales,
  areas,
  detalle: `corridas/${numero}.json`,
};

const indice = [entrada, ...indiceAnterior.filter((c) => c.corrida !== numero)]
  .sort((a, b) => b.corrida - a.corrida)
  .slice(0, CORRIDAS_A_CONSERVAR);

// Solo se copian las corridas que siguen en el indice: el resto queda fuera de la publicacion.
for (const c of indice) {
  if (c.corrida === numero) continue;
  const origen = path.join(tableroAnterior, 'corridas', `${c.corrida}.json`);
  if (fs.existsSync(origen)) fs.copyFileSync(origen, path.join(dirCorridas, `${c.corrida}.json`));
}

fs.writeFileSync(path.join(dirCorridas, `${numero}.json`), JSON.stringify(corrida, null, 2));
fs.writeFileSync(
  path.join(tableroNuevo, 'corridas.json'),
  JSON.stringify({ actualizado: new Date().toISOString(), corridas: indice }, null, 2),
);

console.log(`Corrida ${numero}: ${estado} — ${totales.paso} pasaron, ${totales.fallo} fallaron, ` +
  `${totales.inestable} inestables, ${totales.omitida} omitidas. Indice con ${indice.length} corridas.`);
