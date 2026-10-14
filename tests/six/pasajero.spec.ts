import { test, expect, Page } from '@playwright/test';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const X = candidatos.six;
const H = candidatos.extensionTarifas;
const S = candidatos.tarifasServicio;

/**
 * SIX — la app del pasajero.
 *
 * Es lo que ve el pasajero de su viaje: si no entra o el itinerario no trae lo que
 * compro, no tiene con que presentarse en destino. La app cambia seguido (rediseño
 * 4820, inicio y onboarding, itinerario 4400/4402/4439, token sin vencimiento 18e64b3).
 *
 * Se entra con el link de autologin del pasajero AUTO-QA del file 33379 (hotel 15422
 * del 13 al 15/01/2031 y servicio 7954 el 13/01), que no vence y vive en
 * AMV_SIX_AUTOLOGIN_URL (.env y secrets: es una credencial). El alta se hizo a mano
 * en el Rooming del BO: usuario de la app 4173, espanol.
 *
 * 1. Con el link entra al inicio del viaje: el saludo, el numero de reserva, las
 *    fechas, el destino y los dos items del file.
 * 2. "Ver itinerario" abre el dia con el pickup, la excursion y el hotel.
 * 3. Con un token adulterado no entra: vuelve al login.
 *
 * Solo lee. La primera vez que se entra la app muestra la bienvenida (pasaporte y
 * carta) y al pasarla la marca como leida; el test la pasa si aparece.
 */
test.describe('SIX — app del pasajero', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const NUMERO_DE_RESERVA = X.fileCode.split('-').pop()!; // AMV-AR-30161 -> 30161
  const SERVICIO = S.nombre;
  const HOTEL = H.hotelNombre;

  function link(): string {
    const url = process.env.AMV_SIX_AUTOLOGIN_URL;
    expect(url, 'Falta AMV_SIX_AUTOLOGIN_URL en el entorno (.env o secrets): el link de autologin del pasajero AUTO-QA')
      .toMatch(/^https:\/\/[^/]+\/autologin\?token=.+/);
    return url!;
  }

  /**
   * Abre un link de autologin sin que el token quede en el reporte.
   *
   * `page.goto(url)` deja la URL completa en el titulo del paso (Allure, que se publica
   * en gh-pages) y en el log de cualquier error. Se navega desde la pagina con
   * `location.assign`, cuyo paso se registra como "Evaluate" sin argumentos, y si la
   * navegacion falla se relanza el error sin la URL. El trace va apagado en este
   * proyecto por lo mismo (registra las URLs de la red).
   */
  async function abrirLink(page: Page, url: string, destino: RegExp) {
    try {
      await page.evaluate((u) => { window.location.assign(u); }, url);
      await page.waitForURL(destino, { timeout: 90_000 });
    } catch (e) {
      const limpio = String((e as Error).message ?? e).replace(/token=[^\s"'&]+/gi, 'token=***');
      throw new Error(`No se pudo abrir el link de autologin: ${limpio.split(String.fromCharCode(10))[0]}`);
    }
  }

  /** Pasa la bienvenida del primer ingreso si aparece: el pasaporte ("Saltar") y la carta ("Empezar mi viaje"). */
  async function pasarBienvenida(page: Page) {
    const saltar = page.getByRole('button', { name: 'Saltar' });
    if (await saltar.isVisible().catch(() => false)) await saltar.click();
    const empezar = page.getByRole('button', { name: /Empezar mi viaje/ });
    await empezar.waitFor({ timeout: 5_000 }).catch(() => {});
    if (await empezar.isVisible().catch(() => false)) await empezar.click();
  }

  test('Pasajero: con el link entra a su viaje y el itinerario trae lo del file', async ({ page }) => {
    test.setTimeout(300_000);

    await paso(page, 'Entrar con el link de autologin y llegar al inicio del viaje', async () => {
      // El link no se adjunta ni se loguea: es la credencial del pasajero.
      await abrirLink(page, link(), /\/dashboard|\/login/i);
      expect(new URL(page.url()).pathname, 'Con un link valido la app tiene que entrar al viaje, no volver al login')
        .toMatch(/^\/dashboard/);
      await pasarBienvenida(page);
      await expect(page.getByRole('button', { name: 'Ver itinerario' }), 'El inicio del viaje tiene que cargar')
        .toBeVisible({ timeout: 60_000 });
    });

    await paso(page, 'El inicio muestra al pasajero, la reserva, las fechas y lo que compro', async () => {
      const cuerpo = page.locator('body');
      const texto = (await cuerpo.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Inicio del viaje', texto.slice(0, 2000));
      await conResaltado(page, cuerpo, 'Inicio del viaje', () => {
        expect(texto, 'Tiene que saludar al pasajero por su nombre').toContain('¡Hola, PasajeroSix!');
        expect(texto, 'Tiene que mostrar el numero de reserva del file').toContain(`Reserva ${NUMERO_DE_RESERVA}`);
        expect(texto, 'Tiene que mostrar las fechas del viaje').toMatch(/Lun 13 ene\s*–\s*Mié 15 ene · 3 días/);
        expect(texto, 'Tiene que mostrar el destino').toContain('Buenos Aires');
        expect(texto, 'Tiene que mostrar la excursion del file').toContain(SERVICIO);
        expect(texto, 'Tiene que mostrar el hotel del file').toContain(HOTEL);
      });
      await expect(page.getByRole('button', { name: 'Voucher' }), 'Tiene que ofrecer el voucher').toBeVisible();
    });

    await paso(page, 'Ver itinerario: el dia trae el pickup, la excursion y el hotel', async () => {
      await page.getByRole('button', { name: 'Ver itinerario' }).click();
      await page.waitForURL(/\/dashboard\/itinerary/i, { timeout: 60_000 });
      await expect(page.getByText(SERVICIO).first(), 'El itinerario tiene que cargar los servicios').toBeVisible({ timeout: 60_000 });
      const cuerpo = page.locator('body');
      const texto = (await cuerpo.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Itinerario', texto.slice(0, 2000));
      await conResaltado(page, cuerpo, 'Itinerario', () => {
        expect(texto, 'El itinerario tiene que ser el de la reserva del file').toContain(`Reserva ${NUMERO_DE_RESERVA}`);
        expect(texto, 'Tiene que mostrar el primer dia del viaje').toContain('Lunes 13 de enero');
        expect(texto, 'Tiene que mostrar el horario de pickup de la excursion').toMatch(/08:55\s*Pickup/);
        expect(texto, 'Tiene que mostrar la excursion').toContain(SERVICIO);
        expect(texto, 'Tiene que mostrar el hotel').toContain(HOTEL);
        expect(texto, 'Cada item es para los dos pasajeros del file').toContain('2 Personas');
      });
    });
  });

  test('Pasajero: con un token adulterado no entra y vuelve al login', async ({ page }) => {
    test.setTimeout(120_000);
    await paso(page, 'Entrar con el link alterado: la app tiene que mandar al login', async () => {
      const valido = new URL(link());
      const token = valido.searchParams.get('token') ?? '';
      // Se cambia el ultimo caracter de la firma: el token sigue teniendo forma valida.
      const ultimo = token.slice(-1);
      const alterado = token.slice(0, -1) + (ultimo === 'A' ? 'B' : 'A');
      await abrirLink(page, `${valido.origin}/autologin?token=${encodeURIComponent(alterado)}`, /\/login|\/dashboard/i);
      expect(new URL(page.url()).pathname, 'Con un token que no valida la app no puede entrar al viaje').toMatch(/^\/login/);
    });
  });
});
