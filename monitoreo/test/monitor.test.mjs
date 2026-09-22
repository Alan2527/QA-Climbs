// node --test monitoreo/test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chequear, cuerpoContiene, evaluar, cambioRelevante, mensajeDeAvisos, mensajeDiario, duracion } from '../src/monitor.js';
import { SITIOS } from '../src/sitios.js';

const MIN = 60000;
const T0 = Date.UTC(2026, 8, 21, 13, 0);
const ok = { ok: true, status: 200, ms: 800 };
const mal = { ok: false, status: 503, ms: 300, motivo: 'respondió 503' };

/** Corre una secuencia de pasadas cada 5 minutos y devuelve los avisos de cada una. */
function secuencia(pasos) {
  let estado = {};
  return pasos.map((r, i) => {
    const out = evaluar(estado, { portal: r }, T0 + i * 5 * MIN);
    estado = out.estado;
    return out.avisos.map((a) => a.tipo);
  });
}

test('una falla suelta no avisa', () => {
  assert.deepEqual(secuencia([ok, mal, ok, ok]), [[], [], [], []]);
});

test('avisa a la segunda falla seguida, y una sola vez', () => {
  assert.deepEqual(secuencia([ok, mal, mal, mal, mal]), [[], [], ['cayo'], [], []]);
});

test('repite cada 30 minutos mientras siga caido', () => {
  // cae en la pasada 2 (min 10); 30 min despues es la pasada 8 (min 40)
  const r = secuencia([ok, mal, mal, mal, mal, mal, mal, mal, mal, mal]);
  assert.deepEqual(r.map((a) => a.join()), ['', '', 'cayo', '', '', '', '', '', 'sigue', '']);
});

test('avisa que volvio, con la duracion contada desde la primera falla', () => {
  let estado = {};
  const avisos = [];
  [ok, mal, mal, mal, ok].forEach((r, i) => {
    const out = evaluar(estado, { portal: r }, T0 + i * 5 * MIN);
    estado = out.estado;
    avisos.push(...out.avisos);
  });
  const volvio = avisos.find((a) => a.tipo === 'volvio');
  assert.equal(volvio.minutos, 15); // primera falla en min 5, vuelve en min 20
  assert.equal(estado.portal.caido, false);
  assert.equal(estado.portal.fallas, 0);
});

test('con todo arriba no se escribe en KV', () => {
  const a = evaluar({}, { portal: ok }, T0).estado;
  const b = evaluar(a, { portal: { ...ok, ms: 1500 } }, T0 + 5 * MIN).estado;
  assert.equal(cambioRelevante(a, b), false);
  const c = evaluar(b, { portal: mal }, T0 + 10 * MIN).estado;
  assert.equal(cambioRelevante(b, c), true);
});

test('chequear: 200 con el login, 200 sin el login, 500, error de red y timeout', async () => {
  const sitio = { url: 'https://x/', contiene: 'txtPassword' };
  const resp = (status, body) => async () => new Response(body, { status });
  assert.equal((await chequear(sitio, resp(200, '<input id="txtPassword">'))).ok, true);
  assert.match((await chequear(sitio, resp(200, 'Sitio en mantenimiento'))).motivo, /sin el contenido esperado/);
  assert.match((await chequear(sitio, resp(500, 'error'))).motivo, /respondió 500/);
  assert.match((await chequear(sitio, async () => { throw new TypeError('fetch failed'); })).motivo, /no se pudo conectar/);
  const timeout = async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; };
  assert.match((await chequear(sitio, timeout)).motivo, /no respondió en 30 s/);
});

test('mensajes de Teams', () => {
  const m = mensajeDeAvisos([{ tipo: 'cayo', id: 'amv-portal', motivo: 'respondió 503' }], SITIOS, T0);
  assert.equal(m.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
  assert.match(JSON.stringify(m), /AMV · Portal se cayó/);
  assert.equal(mensajeDeAvisos([], SITIOS, T0), null);
  const d = mensajeDiario({ 'amv-portal': { caido: false, ultimoMs: 900 } }, SITIOS, T0);
  assert.match(JSON.stringify(d), /Monitoreo activo/);
  // Solo aparecen los sitios activos: un sitio desactivado no va al resumen.
  const soloPortal = SITIOS.map((s) => ({ ...s, activo: s.id === 'amv-portal' }));
  assert.doesNotMatch(JSON.stringify(mensajeDiario({}, soloPortal, T0)), /BackOffice/);
  assert.equal(duracion(135), '2 h 15 min');
});

test('la lista por cliente arma un chequeo por direccion, sin repetidos', () => {
  const activos = SITIOS.filter((s) => s.activo);
  assert.equal(activos.length, 18);
  assert.equal(new Set(SITIOS.map((s) => s.id)).size, SITIOS.length);
  const porId = Object.fromEntries(SITIOS.map((s) => [s.id, s]));
  assert.equal(porId['amv-portal'].url, 'https://amv.travel/login.aspx');
  assert.equal(porId['kinich-sherpa'].url, 'https://sherpa.kinich.com/');
  assert.equal(porId['gps-api'].url, 'https://api.gps-travel.com.ar/location/getlanguages');
  assert.equal(porId['amv-apiIa'].url, 'https://api.net.amv.travel/health');
  assert.equal(porId['climbs-api'].activo, false);
  for (const s of activos) assert.ok(s.contiene, `${s.id} tiene que exigir un contenido`);
});

test('cuerpoContiene: encuentra el texto partido entre dos partes y respeta el maximo', async () => {
  const enPartes = (...partes) => new Response(new ReadableStream({
    start(c) { for (const p of partes) c.enqueue(new TextEncoder().encode(p)); c.close(); },
  }));
  assert.equal(await cuerpoContiene(enPartes('<input id="txtPass', 'word">'), 'txtPassword'), true);
  assert.equal(await cuerpoContiene(enPartes('nada', 'por aca'), 'txtPassword'), false);
  // Mas alla del maximo no se busca.
  assert.equal(await cuerpoContiene(enPartes('x'.repeat(100), 'txtPassword'), 'txtPassword', 50), false);
});
