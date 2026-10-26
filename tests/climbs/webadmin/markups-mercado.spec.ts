import { test, expect, Page, BrowserContext } from '@playwright/test';
import { MercadoNuevoPage, AgenciaNuevaPage } from '../../../pages/climbs/agencia.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { porTarifa, compararPrecios } from '../../../utils/markups';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';
import { tarifasDelPortal, ItemDelPortal } from '../comun/tarifario-del-portal';
import candidatos from '../../../data/candidatos.json';

const T = candidatos.tarifario as Record<string, any>;
const M = candidatos.markups;
const SALTO = String.fromCharCode(10);
const HOTEL: ItemDelPortal = { solapa: 'Hoteles', nombre: T.hoteles.nombre, terminoBusqueda: T.hoteles.terminoBusqueda };
const SERVICIO: ItemDelPortal = { solapa: 'Excursiones', nombre: T.excursiones.nombre, terminoBusqueda: T.excursiones.terminoBusqueda };

/**
 * WEBADMIN — app nueva (ClimbsApp). Markup de mercado y markup propio de agencia.
 *
 * Los mismos dos tests que tests/webadmin/markups-mercado.spec.ts, con los mismos titulos. En la
 * app nueva el mercado es Finanzas › Mercados (/finance/markets/{id}) y el markup propio de la
 * agencia esta en la ficha de la agencia (Clientes › Agencias, solapa Datos), los dos en el
 * Backoffice. Se verifica en el tarifario del portal nuevo con `autoqa.markups` (agencia 6334,
 * mercado 37, que solo tiene esa agencia).
 *
 * Se lee el tarifario antes y despues del cambio y se exige la proporcion: el precio es
 * techo(tarifa / markup), asi que pasar de 0,80 a 0,50 sube el precio x 0,80 / 0,50. Y se exige
 * que el otro tipo de producto NO cambie. Deja el mercado y la agencia como estaban aunque falle.
 */
test.describe('WebAdmin — markups de mercado y agencia', () => {
  test.describe.configure({ mode: 'serial', retries: process.env.CI ? 2 : 0 });

  let contexto: BrowserContext;
  let portal: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    ({ contexto, pagina: portal } = await abrirSesionDeOtraAgencia(browser, baseURL));
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  async function leer(item: ItemDelPortal, titulo: string): Promise<Map<string, number>> {
    // Sin la marca "Tarifa extendida": se comparan precios, no la marca.
    const filas = (await tarifasDelPortal(portal, item)).map((f) => f.map((c) => c.replace(/\s*Tarifa extendida/gi, '').trim()));
    const precios = porTarifa(filas);
    await adjuntarTexto(titulo, filas.map((f) => f.join(' | ')).join(SALTO));
    expect(precios.size, `${M.usuario.userName} tiene que ver tarifas con importe`).toBeGreaterThan(0);
    return precios;
  }

  async function exigir(antes: Map<string, number>, despues: Map<string, number>, divAntes: number, divDespues: number, que: string) {
    const { lineas, fuera } = compararPrecios(antes, despues, divAntes, divDespues);
    await adjuntarTexto(`Comparacion: ${que}`, `markup ${divAntes} -> ${divDespues}` + SALTO + SALTO + lineas.join(SALTO));
    expect(fuera, `${que}: tarifas fuera de lo esperado` + SALTO + fuera.join(SALTO)).toEqual([]);
  }

  /** Antes de tocar nada: el mercado y la agencia tienen que estar como los dejo el test. */
  async function verificarPuntoDePartida(mercado: MercadoNuevoPage, agencia: AgenciaNuevaPage) {
    await mercado.abrir(M.mercado.id);
    expect(await mercado.markups(), `El mercado ${M.mercado.id} tiene que arrancar en 0,80 / 0,60`)
      .toEqual({ hotel: M.mercado.hotelMarkup, servicio: M.mercado.serviceMarkup });
    await agencia.abrir(M.agencia.id);
    expect(await agencia.markups(), `La agencia ${M.agencia.id} tiene que arrancar sin markup propio`).toEqual({ hotel: null, servicio: null });
  }

  test('Mercado: cambiar el markup de hoteles mueve solo los precios de hoteles', async ({ page }) => {
    test.setTimeout(600_000);
    const mercado = new MercadoNuevoPage(page);
    const agencia = new AgenciaNuevaPage(page);
    const nuevoHotel = 0.5;
    let hotelAntes = new Map<string, number>();
    let servicioAntes = new Map<string, number>();

    await paso(page, `Verificar que el mercado ${M.mercado.id} y la agencia ${M.agencia.id} estan en su punto de partida`, async () => {
      await verificarPuntoDePartida(mercado, agencia);
    });

    await paso(portal, 'Leer en el portal el tarifario del hotel y del servicio', async () => {
      hotelAntes = await leer(HOTEL, 'Hotel antes');
      servicioAntes = await leer(SERVICIO, 'Servicio antes');
    });

    try {
      await paso(page, `WebAdmin: llevar el markup de hoteles del mercado ${M.mercado.id} a ${nuevoHotel}`, async () => {
        await mercado.guardarMarkups(M.mercado.id, nuevoHotel, M.mercado.serviceMarkup);
      });

      await paso(portal, `Portal: el hotel aplica el markup ${nuevoHotel}`, async () => {
        await exigir(hotelAntes, await leer(HOTEL, 'Hotel despues'), M.mercado.hotelMarkup, nuevoHotel, 'hotel');
      });

      await paso(portal, 'Portal: el servicio no cambia', async () => {
        await exigir(servicioAntes, await leer(SERVICIO, 'Servicio despues'), M.mercado.serviceMarkup, M.mercado.serviceMarkup, 'servicio');
      });
    } finally {
      await paso(page, `Restaurar el mercado ${M.mercado.id} en 0,80 / 0,60`, async () => {
        await mercado.guardarMarkups(M.mercado.id, M.mercado.hotelMarkup, M.mercado.serviceMarkup);
      });
    }
  });

  test('Agencia: el markup propio de servicios gana sobre el del mercado y al vaciarlo vuelve al mercado', async ({ page }) => {
    test.setTimeout(600_000);
    const mercado = new MercadoNuevoPage(page);
    const agencia = new AgenciaNuevaPage(page);
    const propioServicio = 0.4;
    let hotelAntes = new Map<string, number>();
    let servicioAntes = new Map<string, number>();

    await paso(page, `Verificar que el mercado ${M.mercado.id} y la agencia ${M.agencia.id} estan en su punto de partida`, async () => {
      await verificarPuntoDePartida(mercado, agencia);
    });

    await paso(portal, 'Leer en el portal el tarifario del hotel y del servicio', async () => {
      hotelAntes = await leer(HOTEL, 'Hotel antes');
      servicioAntes = await leer(SERVICIO, 'Servicio antes');
    });

    try {
      await paso(page, `WebAdmin: darle a la agencia ${M.agencia.id} un markup propio de servicios de ${propioServicio}`, async () => {
        await agencia.guardarMarkups(M.agencia.id, null, propioServicio);
      });

      await paso(portal, `Portal: el servicio aplica el markup propio ${propioServicio} y no el del mercado`, async () => {
        await exigir(servicioAntes, await leer(SERVICIO, 'Servicio con markup propio'), M.mercado.serviceMarkup, propioServicio, 'servicio');
      });

      await paso(portal, 'Portal: el hotel no cambia', async () => {
        await exigir(hotelAntes, await leer(HOTEL, 'Hotel con markup propio de servicios'), M.mercado.hotelMarkup, M.mercado.hotelMarkup, 'hotel');
      });

      await paso(page, `WebAdmin: vaciar el markup propio de la agencia ${M.agencia.id}`, async () => {
        await agencia.guardarMarkups(M.agencia.id, null, null);
      });

      await paso(portal, 'Portal: el servicio vuelve al markup del mercado', async () => {
        await exigir(servicioAntes, await leer(SERVICIO, 'Servicio sin markup propio'), M.mercado.serviceMarkup, M.mercado.serviceMarkup, 'servicio');
      });
    } finally {
      await paso(page, `Restaurar la agencia ${M.agencia.id} sin markup propio`, async () => {
        await agencia.guardarMarkups(M.agencia.id, null, null);
      });
    }
  });
});
