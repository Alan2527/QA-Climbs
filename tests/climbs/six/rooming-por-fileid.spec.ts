import { test, expect } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { API_NUEVA } from './six-comun';
import candidatos from '../../../data/candidatos.json';

const X = candidatos.six;
const FILE_ID = X.fileId;
const PASAJERO = X.pasajeros[0].split(' ')[0];

/**
 * SIX — app nueva (ClimbsApp). Seguridad: el rooming (PII de pasajeros) por fileid, sin sesion.
 *
 * El mismo test que tests/six/rooming-por-fileid.spec.ts, con el mismo titulo, contra la API
 * mayorista de la app nueva: `GET /api/wholesale/passenger/getroomingbyfileid?fileid=` (la misma
 * ruta y contrato que la vieja). En el sistema actual devuelve nombre, documento, nacionalidad,
 * nacimiento, email y telefono de los pasajeros sin validar sesion (hallazgo del relevamiento).
 *
 * El actual entraba con el link del pasajero solo para fijar la base de la API; aca la base es la
 * de la app nueva y el control positivo es que responda (passenger/sixConfig). Despues se pide el
 * rooming del file de prueba desde un contexto SIN sesion: si devuelve los pasajeros, rojo.
 * Solo lee. No adjunta el cuerpo (PII): solo el endpoint, el estado y si aparece el pasajero.
 */
test.describe('SIX — seguridad: rooming (PII) por fileid sin sesion', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  test('El rooming (PII) de un file se obtiene por fileid sin sesion', async ({ page, browser }) => {
    test.setTimeout(120_000);

    await paso(page, 'Control positivo: la API mayorista de la app nueva responde', async () => {
      const r = await page.request.get(`${API_NUEVA}/passenger/sixConfig`, { failOnStatusCode: false });
      await adjuntarTexto('Base de la API', `GET /api/wholesale/passenger/sixConfig -> HTTP ${r.status()}`);
      expect(r.ok(), 'La API mayorista de la app nueva tiene que responder').toBe(true);
    });

    await paso(page, `Sin sesion, pidiendo el rooming del file ${FILE_ID}, no tiene que devolver los pasajeros`, async () => {
      const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      try {
        const r = await anon.request.get(`${API_NUEVA}/passenger/getroomingbyfileid/?fileid=${FILE_ID}`, { failOnStatusCode: false });
        const cuerpo = await r.text().catch(() => '');
        const traePII = r.ok() && cuerpo.includes(PASAJERO);
        await adjuntarTexto('Rooming sin sesion', [
          `Endpoint: /api/wholesale/passenger/getroomingbyfileid/?fileid=${FILE_ID}`,
          `HTTP ${r.status()}`,
          `Tamano de la respuesta: ${cuerpo.length} caracteres`,
          `Trae los pasajeros del file (nombre "${PASAJERO}"): ${traePII ? 'SI' : 'no'}`,
        ].join('\n'));
        expect(traePII, `Sin sesion, la API no tiene que devolver el rooming (PII) del file ${FILE_ID}; respondio HTTP ${r.status()} con ${cuerpo.length} caracteres`).toBe(false);
      } finally {
        await anon.close();
      }
    });
  });
});
