import { test, expect, Page, Browser } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const X = candidatos.six;
const BOOK = Number(X.reserva.replace(/\D/g, '')); // "BO00025513" -> 25513
const PASAJERO = X.pasajeros[0].split(' ')[0];      // "PasajeroSix"

/**
 * SEGURIDAD — endpoints de la API (Whole.Api) sin sesion.
 *
 * `bookingservice/getbookpassengers/?book=` (WholesalerBookingService.cs:573) devuelve
 * los pasajeros (PII) de una reserva sin validar sesion. Es el mismo hallazgo del
 * relevamiento que el rooming por fileid, por otra ruta.
 *
 * La base real de la API se toma del propio flujo de SIX (una vez, en beforeAll), asi no
 * se adivina el host. Despues se pega la peticion desde un contexto SIN sesion.
 *
 * Solo lee. No adjunta el cuerpo de la respuesta (PII): solo el endpoint, el estado y si
 * aparece el pasajero de prueba. Corre en el proyecto SIX, con el trace apagado.
 */
test.describe('Seguridad — API sin sesion: PII de la reserva', () => {
  let apiOrigin = '';

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  function link(): string {
    const url = process.env.AMV_SIX_AUTOLOGIN_URL;
    expect(url, 'Falta AMV_SIX_AUTOLOGIN_URL en el entorno (.env o secrets)')
      .toMatch(/^https:\/\/[^/]+\/autologin\?token=.+/);
    return url!;
  }

  // Entra una sola vez con el pasajero AUTO-QA para descubrir el origin real de la API
  // (los endpoints passenger/ e itinerary/ viven en el mismo host que bookingservice/).
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    page.on('response', (resp) => {
      if (apiOrigin || !resp.ok()) return;
      const m = resp.url().match(/^(https?:\/\/[^/]+)\/(passenger|itinerary)\//i);
      if (m) apiOrigin = m[1];
    });
    try {
      await page.evaluate((u) => { window.location.assign(u); }, link());
      await page.waitForURL(/\/dashboard|\/login/i, { timeout: 90_000 });
      const saltar = page.getByRole('button', { name: 'Saltar' });
      if (await saltar.isVisible().catch(() => false)) await saltar.click();
      // Un momento para que salgan los requests de datos del inicio del viaje.
      await page.waitForLoadState('networkidle').catch(() => {});
    } finally {
      await ctx.close();
    }
    expect(apiOrigin, 'No se pudo descubrir la base de la API de SIX desde el flujo del pasajero').toMatch(/^https?:\/\//);
  });

  test('bookingservice/getbookpassengers devuelve los pasajeros (PII) de una reserva sin sesion', async ({ page, browser }) => {
    test.setTimeout(120_000);
    expect(BOOK, 'Tiene que haber un numero de reserva de prueba').toBeGreaterThan(0);

    await paso(page, `Sin sesion, pedir los pasajeros de la reserva ${BOOK} no tiene que devolver PII`, async () => {
      const url = `${apiOrigin}/bookingservice/getbookpassengers/?book=${BOOK}`;
      const anon = await browser.newContext({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
      try {
        const r = await anon.request.get(url, { failOnStatusCode: false });
        const cuerpo = await r.text().catch(() => '');
        const traePII = r.ok() && cuerpo.includes(PASAJERO);
        await adjuntarTexto('getbookpassengers sin sesion', [
          `Endpoint: /bookingservice/getbookpassengers/?book=${BOOK}`,
          `HTTP ${r.status()}`,
          `Tamano de la respuesta: ${cuerpo.length} caracteres`,
          `Trae los pasajeros (nombre "${PASAJERO}"): ${traePII ? 'SI' : 'no'}`,
        ].join('\n'));
        await conResaltado(page, page.locator('body'), 'getbookpassengers sin sesion', () => {
          expect(
            traePII,
            `Sin sesion, la API no tiene que devolver los pasajeros de la reserva ${BOOK}; respondio HTTP ${r.status()} con ${cuerpo.length} caracteres`,
          ).toBe(false);
        });
      } finally {
        await anon.close();
      }
    });
  });

});
