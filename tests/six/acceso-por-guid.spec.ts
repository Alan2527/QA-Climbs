import { test, expect, Page, Request } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const X = candidatos.six;
const NUMERO_DE_RESERVA = X.fileCode.split('-').pop()!; // AMV-AR-30161 -> 30161

/**
 * SIX — SEGURIDAD: acceso al viaje del pasajero sin sesion.
 *
 * El viaje de un pasajero (su reserva, su itinerario, su hotel) lo sirve la API de SIX
 * por `GET itinerary/userfiles/?guid=` y `GET itinerary/itinerary/?fileId&guid`. Segun
 * el relevamiento del codigo (mapa 7-six-pasajero): el token de sesion que devuelve el
 * login "ninguna operacion posterior lo valida" y el itinerario por guid "solo exige
 * que el GUID exista". Es decir: alcanza con el guid del pasajero, sin sesion, para
 * traer su viaje.
 *
 * El test lo comprueba sin inventar datos ni tocar nada: entra con el link del pasajero
 * AUTO-QA (control positivo: se ve su viaje), captura la peticion que la propia app le
 * hace a la API para traer el viaje, y la REPITE desde un contexto nuevo sin sesion
 * (sin cookie ni cabecera de autorizacion). Si la API igual devuelve el viaje, la
 * sesion no protege nada y el test queda en ROJO; si lo bloquea, pasa.
 *
 * Solo lee. El guid viaja en la URL de la peticion: no se adjunta la URL cruda ni el
 * cuerpo de la respuesta, solo el endpoint sin query y si trae o no el numero de
 * reserva. El proyecto SIX corre con el trace apagado, asi que el guid no queda en el
 * reporte.
 */
test.describe('SIX — seguridad: acceso al viaje por GUID sin sesion', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  function link(): string {
    const url = process.env.AMV_SIX_AUTOLOGIN_URL;
    expect(url, 'Falta AMV_SIX_AUTOLOGIN_URL en el entorno (.env o secrets): el link de autologin del pasajero AUTO-QA')
      .toMatch(/^https:\/\/[^/]+\/autologin\?token=.+/);
    return url!;
  }

  /** Abre un link de autologin sin que el token quede en el reporte. */
  async function abrirLink(page: Page, url: string, destino: RegExp) {
    try {
      await page.evaluate((u) => { window.location.assign(u); }, url);
      await page.waitForURL(destino, { timeout: 90_000 });
    } catch (e) {
      const limpio = String((e as Error).message ?? e).replace(/token=[^\s"'&]+/gi, 'token=***');
      throw new Error(`No se pudo abrir el link de autologin: ${limpio.split(String.fromCharCode(10))[0]}`);
    }
  }

  /** Pasa la bienvenida del primer ingreso si aparece. */
  async function pasarBienvenida(page: Page) {
    const saltar = page.getByRole('button', { name: 'Saltar' });
    if (await saltar.isVisible().catch(() => false)) await saltar.click();
    const empezar = page.getByRole('button', { name: /Empezar mi viaje/ });
    await empezar.waitFor({ timeout: 5_000 }).catch(() => {});
    if (await empezar.isVisible().catch(() => false)) await empezar.click();
  }

  test('El viaje del pasajero se obtiene con solo el GUID, sin sesion (la API no valida la sesion)', async ({ page, browser }) => {
    test.setTimeout(300_000);

    // Se juntan las peticiones que la app le hace a la API para traer el viaje: las que
    // llevan el guid del pasajero contra los endpoints del itinerario.
    const peticionesDelViaje: Request[] = [];
    page.on('requestfinished', (req) => {
      const u = req.url();
      if (/[?&]guid=/i.test(u) && /\/itinerary\/(userfiles|itinerary)\//i.test(u)) peticionesDelViaje.push(req);
    });

    await paso(page, 'Control positivo: con el link del pasajero se entra y se ve su viaje', async () => {
      await abrirLink(page, link(), /\/dashboard|\/login/i);
      expect(new URL(page.url()).pathname, 'Con un link valido la app tiene que entrar al viaje').toMatch(/^\/dashboard/);
      await pasarBienvenida(page);
      const verItinerario = page.getByRole('button', { name: 'Ver itinerario' });
      await expect(verItinerario, 'El inicio del viaje tiene que cargar').toBeVisible({ timeout: 60_000 });
      const texto = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      expect(texto, 'El viaje tiene que mostrar el numero de reserva del pasajero').toContain(`Reserva ${NUMERO_DE_RESERVA}`);
      // Se abre el itinerario para asegurar tambien la peticion itinerary/itinerary.
      await verItinerario.click();
      await page.waitForURL(/\/dashboard\/itinerary/i, { timeout: 60_000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
    });

    await paso(page, 'Un tercero sin sesion, repitiendo esa peticion, no tiene que recibir el viaje', async () => {
      const req = peticionesDelViaje.find((r) => /userfiles/i.test(r.url())) ?? peticionesDelViaje[0];
      expect(req, 'La app tiene que haber pedido el viaje a la API por guid (itinerary/userfiles o itinerary)').toBeTruthy();
      const endpoint = new URL(req.url()).pathname; // sin la query: no se expone el guid

      // Contexto nuevo, sin sesion: se copian las cabeceras de la app pero se quitan las
      // de autenticacion (cookie y authorization). Si la API igual responde el viaje, es
      // que no valida ninguna sesion: alcanza el guid de la URL.
      const crudas = await req.allHeaders();
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(crudas)) {
        // Se descartan los pseudo-headers de HTTP/2 (:authority, :method, ...) y las
        // cabeceras de autenticacion y de longitud/host, que no van en el replay.
        if (k.startsWith(':')) continue;
        if (['cookie', 'authorization', 'content-length', 'host'].includes(k.toLowerCase())) continue;
        headers[k] = v;
      }

      const anon = await browser.newContext({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
      try {
        const r = await anon.request.get(req.url(), { headers, failOnStatusCode: false });
        const cuerpo = await r.text().catch(() => '');
        const traeElViaje = r.ok() && cuerpo.includes(NUMERO_DE_RESERVA);
        await adjuntarTexto('Peticion sin sesion', [
          `Endpoint: ${endpoint}`,
          `HTTP ${r.status()}`,
          `Tamano de la respuesta: ${cuerpo.length} caracteres`,
          `Trae el viaje del pasajero (reserva ${NUMERO_DE_RESERVA}): ${traeElViaje ? 'SI' : 'no'}`,
        ].join('\n'));
        await conResaltado(page, page.locator('body'), 'Viaje sin sesion', () => {
          expect(
            traeElViaje,
            `Sin sesion, la API no tiene que devolver el viaje del pasajero (reserva ${NUMERO_DE_RESERVA}); respondio HTTP ${r.status()} con ${cuerpo.length} caracteres`,
          ).toBe(false);
        });
      } finally {
        await anon.close();
      }
    });
  });
});
