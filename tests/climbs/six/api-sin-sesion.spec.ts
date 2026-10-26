import { test, expect } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { API_NUEVA } from './six-comun';
import candidatos from '../../../data/candidatos.json';

const X = candidatos.six;
const BOOK = Number(X.reserva.replace(/\D/g, ''));
const PASAJERO = X.pasajeros[0].split(' ')[0];

/**
 * SIX — app nueva (ClimbsApp). Seguridad: endpoints de la API sin sesion.
 *
 * El mismo test que tests/six/api-sin-sesion.spec.ts, con el mismo titulo, contra la API
 * mayorista de la app nueva: `GET /api/wholesale/bookingservice/getbookpassengers?book=` (misma
 * ruta y contrato que la vieja), que en el sistema actual devuelve los pasajeros (PII) de una
 * reserva sin validar sesion. Se pide desde un contexto SIN sesion.
 * Solo lee. No adjunta el cuerpo (PII): solo el endpoint, el estado y si aparece el pasajero.
 */
test.describe('Seguridad — API sin sesion: PII de la reserva', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  test('bookingservice/getbookpassengers devuelve los pasajeros (PII) de una reserva sin sesion', async ({ page, browser }) => {
    test.setTimeout(120_000);
    expect(BOOK, 'Tiene que haber un numero de reserva de prueba').toBeGreaterThan(0);

    await paso(page, `Sin sesion, pedir los pasajeros de la reserva ${BOOK} no tiene que devolver PII`, async () => {
      const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      try {
        const r = await anon.request.get(`${API_NUEVA}/bookingservice/getbookpassengers/?book=${BOOK}`, { failOnStatusCode: false });
        const cuerpo = await r.text().catch(() => '');
        const traePII = r.ok() && cuerpo.includes(PASAJERO);
        await adjuntarTexto('getbookpassengers sin sesion', [
          `Endpoint: /api/wholesale/bookingservice/getbookpassengers/?book=${BOOK}`,
          `HTTP ${r.status()}`,
          `Tamano de la respuesta: ${cuerpo.length} caracteres`,
          `Trae los pasajeros (nombre "${PASAJERO}"): ${traePII ? 'SI' : 'no'}`,
        ].join('\n'));
        expect(traePII, `Sin sesion, la API no tiene que devolver los pasajeros de la reserva ${BOOK}; respondio HTTP ${r.status()} con ${cuerpo.length} caracteres`).toBe(false);
      } finally {
        await anon.close();
      }
    });
  });
});
