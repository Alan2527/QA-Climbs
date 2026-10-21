import { test, expect, Page } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const X = candidatos.six;
const FILE_ID = X.fileId;                       // 33379
const PASAJERO = X.pasajeros[0].split(' ')[0];  // "PasajeroSix"

/**
 * SIX — SEGURIDAD: el rooming (PII de pasajeros) por fileid, sin sesion.
 *
 * `GET passenger/getroomingbyfileid/?fileid=` (PassengerAppService.cs:1398, un WebGet
 * sin validacion de sesion) devuelve el rooming del file: nombre, apellido, documento,
 * nacionalidad, fecha de nacimiento, email y telefono de los pasajeros. Es el hallazgo
 * del relevamiento (endpoints de la API que devuelven PII por id sin sesion), de la
 * misma clase que el acceso al viaje por guid.
 *
 * El test entra con el link del pasajero AUTO-QA solo para fijar la base real de la API
 * (control positivo de que la base esta bien), y despues pide el rooming del file de
 * prueba desde un contexto nuevo SIN sesion. Si la API devuelve los pasajeros, no hay
 * control de acceso y el test queda en ROJO; si lo bloquea, pasa.
 *
 * Solo lee. No adjunta el cuerpo de la respuesta (es PII): solo el endpoint, el estado
 * y si aparece o no el nombre del pasajero de prueba. Corre en el proyecto SIX, con el
 * trace apagado, asi la PII no queda en el reporte.
 */
test.describe('SIX — seguridad: rooming (PII) por fileid sin sesion', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  function link(): string {
    const url = process.env.AMV_SIX_AUTOLOGIN_URL;
    expect(url, 'Falta AMV_SIX_AUTOLOGIN_URL en el entorno (.env o secrets): el link de autologin del pasajero AUTO-QA')
      .toMatch(/^https:\/\/[^/]+\/autologin\?token=.+/);
    return url!;
  }

  async function abrirLink(page: Page, url: string, destino: RegExp) {
    try {
      await page.evaluate((u) => { window.location.assign(u); }, url);
      await page.waitForURL(destino, { timeout: 90_000 });
    } catch (e) {
      const limpio = String((e as Error).message ?? e).replace(/token=[^\s"'&]+/gi, 'token=***');
      throw new Error(`No se pudo abrir el link de autologin: ${limpio.split(String.fromCharCode(10))[0]}`);
    }
  }

  async function pasarBienvenida(page: Page) {
    const saltar = page.getByRole('button', { name: 'Saltar' });
    if (await saltar.isVisible().catch(() => false)) await saltar.click();
    const empezar = page.getByRole('button', { name: /Empezar mi viaje/ });
    await empezar.waitFor({ timeout: 5_000 }).catch(() => {});
    if (await empezar.isVisible().catch(() => false)) await empezar.click();
  }

  test('El rooming (PII) de un file se obtiene por fileid sin sesion', async ({ page, browser }) => {
    test.setTimeout(300_000);

    // Se toma la base real de la API del primer request propio a `.../passenger/...`
    // que responde OK: asi no se adivina el host ni el prefijo.
    let basePassenger = '';
    page.on('response', (resp) => {
      if (basePassenger || !resp.ok()) return;
      const m = resp.url().match(/^(https?:\/\/.+?\/passenger\/)/i);
      if (m) basePassenger = m[1];
    });

    await paso(page, 'Control positivo: entrar con el link del pasajero fija la base de la API', async () => {
      await abrirLink(page, link(), /\/dashboard|\/login/i);
      expect(new URL(page.url()).pathname, 'Con un link valido la app tiene que entrar al viaje').toMatch(/^\/dashboard/);
      await pasarBienvenida(page);
      await expect(page.getByRole('button', { name: 'Ver itinerario' }), 'El inicio del viaje tiene que cargar').toBeVisible({ timeout: 60_000 });
      expect(basePassenger, 'Hay que haber detectado la base de la API de SIX (prefijo /passenger/)').toMatch(/\/passenger\/$/);
    });

    await paso(page, `Sin sesion, pidiendo el rooming del file ${FILE_ID}, no tiene que devolver los pasajeros`, async () => {
      const url = `${basePassenger}getroomingbyfileid/?fileid=${FILE_ID}`;
      const anon = await browser.newContext({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
      try {
        const r = await anon.request.get(url, { failOnStatusCode: false });
        const cuerpo = await r.text().catch(() => '');
        const traePII = r.ok() && cuerpo.includes(PASAJERO);
        await adjuntarTexto('Rooming sin sesion', [
          `Endpoint: /passenger/getroomingbyfileid/?fileid=${FILE_ID}`,
          `HTTP ${r.status()}`,
          `Tamano de la respuesta: ${cuerpo.length} caracteres`,
          `Trae los pasajeros del file (nombre "${PASAJERO}"): ${traePII ? 'SI' : 'no'}`,
        ].join('\n'));
        await conResaltado(page, page.locator('body'), 'Rooming sin sesion', () => {
          expect(
            traePII,
            `Sin sesion, la API no tiene que devolver el rooming (PII) del file ${FILE_ID}; respondio HTTP ${r.status()} con ${cuerpo.length} caracteres`,
          ).toBe(false);
        });
      } finally {
        await anon.close();
      }
    });
  });
});
