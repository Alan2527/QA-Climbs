import { test, expect, Page, BrowserContext } from '@playwright/test';
import { WebAdminMarkupsPage } from '../../pages/webadmin-markups.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
import { abrirSesionDeMarkups, tarifasDe, porTarifa, compararPrecios, ItemDelTarifario } from '../../utils/markups';
import candidatos from '../../data/candidatos.json';

const T = candidatos.tarifario;
const M = candidatos.markups;
const SALTO = String.fromCharCode(10);
const HOTEL = T.hoteles as ItemDelTarifario;
const SERVICIO = T.excursiones as ItemDelTarifario;

/**
 * WebAdmin — markup de mercado y markup propio de agencia.
 *
 * Es el dato que mueve el precio de todas las agencias de un mercado: tarifario,
 * reservas, cotizaciones y la API para clientes. Se cambia desde el WebAdmin y se
 * verifica en el portal, con el usuario propio de markups (`autoqa.markups`,
 * agencia 6334, mercado 37, que solo tiene esa agencia).
 *
 * No hace falta conocer las tarifas: se lee el tarifario antes y despues del cambio
 * y se exige la proporcion. El precio es techo(tarifa / markup), asi que pasar el
 * markup de 0,80 a 0,50 sube el precio x 0,80 / 0,50. Y se exige que el otro tipo
 * de producto NO cambie: un cruce entre hoteles y servicios se nota.
 *
 * Escribe en el WebAdmin, solo sobre el mercado 37 y la agencia 6334, y los deja
 * como estaban aunque el test falle (`finally`).
 */
test.describe('WebAdmin — markups de mercado y agencia', () => {
  // Escribe markups pero restaura en finally: reintentar es seguro. En CI absorbe
  // flakes de ambiente (login/BO lento bajo carga).
  test.describe.configure({ mode: 'serial', retries: process.env.CI ? 2 : 0 });

  let contexto: BrowserContext;
  let portal: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    const sesion = await abrirSesionDeMarkups(browser, baseURL);
    contexto = sesion.contexto;
    portal = sesion.pagina;
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  async function leer(item: ItemDelTarifario, titulo: string): Promise<Map<string, number>> {
    const filas = await tarifasDe(portal, item);
    const precios = porTarifa(filas);
    await adjuntarTexto(titulo, filas.map((f) => f.join(' | ')).join(SALTO));
    expect(precios.size, `${M.usuario.userName} tiene que ver tarifas con importe`).toBeGreaterThan(0);
    return precios;
  }

  function exigir(antes: Map<string, number>, despues: Map<string, number>, divAntes: number, divDespues: number, que: string) {
    const { lineas, fuera } = compararPrecios(antes, despues, divAntes, divDespues);
    return adjuntarTexto(`Comparacion: ${que}`,
      `markup ${divAntes} -> ${divDespues}` + SALTO + SALTO + lineas.join(SALTO))
      .then(() => {
        expect(fuera, `${que}: tarifas fuera de lo esperado` + SALTO + fuera.join(SALTO)).toEqual([]);
      });
  }

  /** Antes de tocar nada: el mercado y la agencia tienen que estar como los dejo el test. */
  async function verificarPuntoDePartida(admin: WebAdminMarkupsPage) {
    await admin.abrirMercado(M.mercado.id);
    expect(await admin.markupsDelMercado(), `El mercado ${M.mercado.id} tiene que arrancar en 0,80 / 0,60`)
      .toEqual({ hotel: M.mercado.hotelMarkup, servicio: M.mercado.serviceMarkup });
    await admin.abrirAgencia(M.agencia.id);
    expect(await admin.markupsDeLaAgencia(), `La agencia ${M.agencia.id} tiene que arrancar sin markup propio`)
      .toEqual({ hotel: null, servicio: null });
  }

  test('Mercado: cambiar el markup de hoteles mueve solo los precios de hoteles', async ({ page }) => {
    const admin = new WebAdminMarkupsPage(page);
    const nuevoHotel = 0.5;
    let hotelAntes = new Map<string, number>();
    let servicioAntes = new Map<string, number>();

    await paso(page, `Verificar que el mercado ${M.mercado.id} y la agencia ${M.agencia.id} estan en su punto de partida`, async () => {
      await verificarPuntoDePartida(admin);
    });

    await paso(portal, 'Leer en el portal el tarifario del hotel y del servicio', async () => {
      hotelAntes = await leer(HOTEL, 'Hotel antes');
      servicioAntes = await leer(SERVICIO, 'Servicio antes');
    });

    try {
      await paso(page, `WebAdmin: llevar el markup de hoteles del mercado ${M.mercado.id} a ${nuevoHotel}`, async () => {
        await admin.guardarMercado(M.mercado.id, nuevoHotel, M.mercado.serviceMarkup);
      });

      await paso(portal, `Portal: el hotel aplica el markup ${nuevoHotel}`, async () => {
        await exigir(hotelAntes, await leer(HOTEL, 'Hotel despues'), M.mercado.hotelMarkup, nuevoHotel, 'hotel');
      });

      await paso(portal, 'Portal: el servicio no cambia', async () => {
        await exigir(servicioAntes, await leer(SERVICIO, 'Servicio despues'), M.mercado.serviceMarkup, M.mercado.serviceMarkup, 'servicio');
      });
    } finally {
      await paso(page, `Restaurar el mercado ${M.mercado.id} en 0,80 / 0,60`, async () => {
        await admin.guardarMercado(M.mercado.id, M.mercado.hotelMarkup, M.mercado.serviceMarkup);
      });
    }
  });

  test('Agencia: el markup propio de servicios gana sobre el del mercado y al vaciarlo vuelve al mercado', async ({ page }) => {
    const admin = new WebAdminMarkupsPage(page);
    const propioServicio = 0.4;
    let hotelAntes = new Map<string, number>();
    let servicioAntes = new Map<string, number>();

    await paso(page, `Verificar que el mercado ${M.mercado.id} y la agencia ${M.agencia.id} estan en su punto de partida`, async () => {
      await verificarPuntoDePartida(admin);
    });

    await paso(portal, 'Leer en el portal el tarifario del hotel y del servicio', async () => {
      hotelAntes = await leer(HOTEL, 'Hotel antes');
      servicioAntes = await leer(SERVICIO, 'Servicio antes');
    });

    try {
      await paso(page, `WebAdmin: darle a la agencia ${M.agencia.id} un markup propio de servicios de ${propioServicio}`, async () => {
        await admin.guardarAgencia(M.agencia.id, null, propioServicio);
      });

      await paso(portal, `Portal: el servicio aplica el markup propio ${propioServicio} y no el del mercado`, async () => {
        await exigir(servicioAntes, await leer(SERVICIO, 'Servicio con markup propio'), M.mercado.serviceMarkup, propioServicio, 'servicio');
      });

      await paso(portal, 'Portal: el hotel no cambia', async () => {
        await exigir(hotelAntes, await leer(HOTEL, 'Hotel con markup propio de servicios'), M.mercado.hotelMarkup, M.mercado.hotelMarkup, 'hotel');
      });

      await paso(page, `WebAdmin: vaciar el markup propio de la agencia ${M.agencia.id}`, async () => {
        await admin.guardarAgencia(M.agencia.id, null, null);
      });

      await paso(portal, 'Portal: el servicio vuelve al markup del mercado', async () => {
        await exigir(servicioAntes, await leer(SERVICIO, 'Servicio sin markup propio'), M.mercado.serviceMarkup, M.mercado.serviceMarkup, 'servicio');
      });
    } finally {
      await paso(page, `Restaurar la agencia ${M.agencia.id} sin markup propio`, async () => {
        await admin.guardarAgencia(M.agencia.id, null, null);
      });
    }
  });
});
