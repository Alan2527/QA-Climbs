#!/usr/bin/env node
/**
 * Arma el desplegable "Prueba" del workflow a partir de los tests que existen.
 *
 * Corre `playwright test --list`, junta cada titulo con su area y en que sistema existe
 * (viejo / nuevo: los pares tienen el mismo titulo), y deja:
 *   - tools/desplegable.json: la etiqueta de cada opcion con su titulo exacto, que lee
 *     tools/plan-corrida.mjs para armar el filtro;
 *   - las opciones del input `prueba` de .github/workflows/qa-e2e.yml, entre las marcas
 *     "# desplegable:desde" y "# desplegable:hasta".
 *
 * Correrlo cada vez que se agrega o se renombra un test:  node tools/actualizar-desplegable.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { PROYECTOS, AREAS, TODAS_LAS_DEL_AREA } from './proyectos.mjs';

const WORKFLOW = '.github/workflows/qa-e2e.yml';
const SALIDA = 'tools/desplegable.json';
const LARGO_MAXIMO = 110;

// Proyecto de Playwright -> { area, sistema }
const deProyecto = {};
for (const [sistema, areas] of Object.entries(PROYECTOS)) {
  for (const [area, proyecto] of Object.entries(areas)) deProyecto[proyecto] = { area, sistema };
}

const lista = JSON.parse(execSync('npx playwright test --list --reporter=json', { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' }));

const porClave = new Map();
function recorrer(suite) {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const p = deProyecto[t.projectName];
      if (!p) continue; // logins y precondiciones: no son pruebas que se elijan solas
      const clave = `${p.area}|${spec.title}`;
      if (!porClave.has(clave)) porClave.set(clave, { area: p.area, titulo: spec.title, sistemas: new Set() });
      porClave.get(clave).sistemas.add(p.sistema);
    }
  }
  for (const hija of suite.suites ?? []) recorrer(hija);
}
for (const s of lista.suites ?? []) recorrer(s);

const ordenArea = Object.keys(AREAS);
const opciones = [...porClave.values()]
  .sort((a, b) => ordenArea.indexOf(a.area) - ordenArea.indexOf(b.area) || a.titulo.localeCompare(b.titulo, 'es'))
  .map((o) => {
    const soloEn = o.sistemas.size === 1 ? ` [solo ${[...o.sistemas][0]}]` : '';
    let etiqueta = `${AREAS[o.area]} · ${o.titulo}`;
    if (etiqueta.length + soloEn.length > LARGO_MAXIMO) etiqueta = etiqueta.slice(0, LARGO_MAXIMO - soloEn.length - 1).trimEnd() + '…';
    return { etiqueta: etiqueta + soloEn, area: o.area, titulo: o.titulo, sistemas: [...o.sistemas].sort().reverse() };
  });

const vistas = new Set();
for (const o of opciones) {
  if (vistas.has(o.etiqueta)) throw new Error(`Dos pruebas quedan con la misma etiqueta: "${o.etiqueta}". Alargar LARGO_MAXIMO.`);
  vistas.add(o.etiqueta);
}

writeFileSync(SALIDA, JSON.stringify({ generado: new Date().toISOString(), opciones }, null, 2) + '\n', 'utf8');

const yml = readFileSync(WORKFLOW, 'utf8');
const desde = yml.indexOf('# desplegable:desde');
const hasta = yml.indexOf('# desplegable:hasta');
if (desde < 0 || hasta < 0) throw new Error(`Faltan las marcas del desplegable en ${WORKFLOW}`);
const inicioLinea = yml.lastIndexOf('\n', desde) + 1;
const sangria = yml.slice(inicioLinea, desde);
const lineas = [TODAS_LAS_DEL_AREA, ...opciones.map((o) => o.etiqueta)].map((e) => `${sangria}- ${JSON.stringify(e)}`);
const nuevo = yml.slice(0, desde) + '# desplegable:desde (lo arma tools/actualizar-desplegable.mjs: no editar a mano)\n' + lineas.join('\n') + '\n' + sangria + yml.slice(hasta);
writeFileSync(WORKFLOW, nuevo, 'utf8');

console.log(`${opciones.length} pruebas en el desplegable (${opciones.filter((o) => o.sistemas.length === 1).length} existen en un solo sistema).`);
