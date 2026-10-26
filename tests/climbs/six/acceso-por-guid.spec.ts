import { test, expect, Request } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';
import { API_VIEJA, API_NUEVA, link, abrirLink, pasarBienvenida } from './six-comun';
import candidatos from '../../../data/candidatos.json';

const X = candidatos.six;
const NUMERO_DE_RESERVA = X.fileCode.split('-').pop()!;

/**
 * SIX — app nueva (ClimbsApp). Seguridad: acceso al viaje del pasajero por GUID, sin sesion.
 *
 * El mismo test que tests/six/acceso-por-guid.spec.ts, con el mismo titulo: el viaje del pasajero
 * lo sirve `itinerary/userfiles?guid=`; en el sistema actual alcanza con el guid, sin sesion. Aca
 * se repite ese pedido contra la API mayorista de la app nueva (/api/wholesale/itinerary/userfiles).
 *
 * El guid sale del ingreso real del pasajero AUTO-QA con su link. Ese ingreso se hace con la app
 * del pasajero tal como esta hoy (API actual): con la API nueva el autologin no entra en QA (ver
 * pasajero.spec.ts). La API nueva acepta el guid de sesion viejo mientras convivan (ARQUITECTURA,
 * "Convivencia"), asi que el pedido es el mismo que haria la app despues del pasaje.
 *
 * Solo lee. No se adjunta la URL cruda (lleva el guid) ni el cuerpo: solo el endpoint y si trae el
 * numero de reserva. Trace apagado en el proyecto.
 */
test.describe('SIX — seguridad: acceso al viaje por GUID sin sesion', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  test('El viaje del pasajero se obtiene con solo el GUID, sin sesion (la API no valida la sesion)', async ({ page, browser }) => {
    test.setTimeout(300_000);
    const peticiones: Request[] = [];
    page.on('requestfinished', (req) => {
      if (/[?&]guid=/i.test(req.url()) && /\/itinerary\/userfiles/i.test(req.url())) peticiones.push(req);
    });

    await paso(page, 'Control positivo: con el link del pasajero se entra y se ve su viaje', async () => {
      await abrirLink(page, link(), /\/dashboard|\/login/i);
      expect(new URL(page.url()).pathname, 'Con un link valido la app tiene que entrar al viaje').toMatch(/^\/dashboard/);
      await pasarBienvenida(page);
      await expect(page.getByRole('button', { name: 'Ver itinerario' }), 'El inicio del viaje tiene que cargar').toBeVisible({ timeout: 60_000 });
      const texto = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      expect(texto, 'El viaje tiene que mostrar el numero de reserva del pasajero').toContain(`Reserva ${NUMERO_DE_RESERVA}`);
    });

    await paso(page, 'Un tercero sin sesion, repitiendo esa peticion, no tiene que recibir el viaje', async () => {
      const req = peticiones[0];
      expect(req, 'La app tiene que haber pedido el viaje a la API por guid (itinerary/userfiles)').toBeTruthy();
      const enLaNueva = req.url().replace(API_VIEJA, API_NUEVA);
      const endpoint = new URL(enLaNueva).pathname;
      const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      try {
        const r = await anon.request.get(enLaNueva, { failOnStatusCode: false });
        const cuerpo = await r.text().catch(() => '');
        const traeElViaje = r.ok() && cuerpo.includes(NUMERO_DE_RESERVA);
        await adjuntarTexto('Peticion sin sesion', [
          `Endpoint: ${endpoint}`, `HTTP ${r.status()}`, `Tamano de la respuesta: ${cuerpo.length} caracteres`,
          `Trae el viaje del pasajero (reserva ${NUMERO_DE_RESERVA}): ${traeElViaje ? 'SI' : 'no'}`,
        ].join('\n'));
        await conResaltado(page, page.locator('body'), 'Viaje sin sesion', () => {
          expect(traeElViaje, `Sin sesion, la API no tiene que devolver el viaje del pasajero (reserva ${NUMERO_DE_RESERVA}); respondio HTTP ${r.status()} con ${cuerpo.length} caracteres`).toBe(false);
        });
      } finally {
        await anon.close();
      }
    });
  });
});
