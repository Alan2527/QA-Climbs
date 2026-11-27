import { test, expect, Page, BrowserContext } from '@playwright/test';
import { WebAdminMarkupsPage } from '../../pages/webadmin-markups.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
import { abrirSesionDeMarkups, tarifasDe, porTarifa, compararPrecios, ItemDelTarifario, leerCostos, exigirImportes, CostosDelItem } from '../../utils/markups';
import candidatos from '../../data/candidatos.json';
import { TarifaDeServicio } from '../../pages/climbs/servicio.page';
import { conBackofficeNuevo, costosDelServicio } from '../../utils/markups';
import { recargoEnFichaYCarritoViejo, ServicioConRecargo } from '../../utils/recargo-por-idioma';

const T = candidatos.tarifario;
const M = candidatos.markups;
const SALTO = String.fromCharCode(10);
const HOTEL = T.hoteles as ItemDelTarifario;
const SERVICIO = T.excursiones as ItemDelTarifario;
/** La tabla del tarifario del hotel 5003 es la de su primera habitacion, King Deluxe. */
const HABITACION_DEL_HOTEL = 9193;
/**
 * Recargo por idioma: la Cena Show AUTO-QA (163, Buenos Aires) tiene English USD 15 fijos por pasajero en
 * la tarifa Regular. Se elige en la ficha y se exige con el markup de servicios vigente, en la ficha y
 * en el carrito (US 4739). Se usa un recargo fijo porque con uno porcentual (el 10 % de Tigre y Delta)
 * aplicar el markup antes o despues del recargo da casi lo mismo y no se nota el error.
 * Enero 2031: dentro de la tarifa y entre los meses con salida.
 */
const CS = T.cenaShow;
const FECHA_IDIOMA = new Date(2031, 0, 13);

/**
 * WebAdmin — markup de mercado y markup propio de agencia.
 *
 * Es el dato que mueve el precio de todas las agencias de un mercado: tarifario,
 * reservas, cotizaciones y la API para clientes. Se cambia desde el WebAdmin y se
 * verifica en el portal, con el usuario propio de markups (`autoqa.markups`,
 * agencia 6334, mercado 37, que solo tiene esa agencia).
 *
 * Importes: en cada lectura, cada precio tiene que ser exactamente techo(costo /
 * cotizacion / markup vigente), con el costo leido en el Backoffice nuevo (servicio 5 en
 * pesos, cotizacion 1.000; habitacion 9193 del hotel en dolares). Ademas se exige la
 * proporcion entre antes y despues, y que el otro tipo de producto NO cambie: un cruce
 * entre hoteles y servicios se nota.
 *
 * Escribe en el WebAdmin, solo sobre el mercado 37 y la agencia 6334, y los deja
 * como estaban aunque el test falle (`finally`).
 */
test.describe('WebAdmin — markups de mercado y agencia', () => {
  // Escribe markups pero restaura en finally: reintentar es seguro. En CI absorbe
  // flakes de ambiente (login/BO lento bajo carga).
  // Modo normal, no serial: los dos tests son independientes (cada uno restaura lo que toca) y solo
  // comparten la preparacion de beforeAll. En serial, si el de mercado fallaba por un error del sistema,
  // el de agencia no corria y quedaba sin probar (corrida del 27/11/2026).
  test.describe.configure({ retries: process.env.CI ? 2 : 0 });

  let contexto: BrowserContext;
  let portal: Page;
  let costosHotel: CostosDelItem;
  let costosServicio: CostosDelItem;
  let tarifasServicio: TarifaDeServicio[];

  test.beforeAll(async ({ browser, baseURL }) => {
    const sesion = await abrirSesionDeMarkups(browser, baseURL);
    contexto = sesion.contexto;
    portal = sesion.pagina;
    costosHotel = await leerCostos(browser, { habitacion: HABITACION_DEL_HOTEL });
    costosServicio = await leerCostos(browser, { servicio: T.excursiones.id });
    tarifasServicio = await conBackofficeNuevo(browser, (bo) => costosDelServicio(bo, CS.id));
  });

  const conRecargo = (): ServicioConRecargo => ({
    pais: 'Argentina', ciudad: 'Buenos Aires', termino: CS.terminoBusqueda, nombre: CS.nombre.replace('Cafe', 'Café'),
    modalidad: 'Regular', fecha: FECHA_IDIOMA, tarifas: tarifasServicio, tipo: 'Cena Show', tipoValor: String(CS.serviceTypeId),
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  /** Lee el tarifario y exige el importe absoluto con el markup que tiene que estar vigente. */
  async function leer(item: ItemDelTarifario, titulo: string, markup: number): Promise<Map<string, number>> {
    const filas = await tarifasDe(portal, item);
    const precios = porTarifa(filas);
    await adjuntarTexto(titulo, filas.map((f) => f.join(' | ')).join(SALTO));
    expect(precios.size, `${M.usuario.userName} tiene que ver tarifas con importe`).toBeGreaterThan(0);
    await exigirImportes(filas, item === HOTEL ? costosHotel : costosServicio, markup * M.usuario.customMarkup, titulo);
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
    await admin.abrirMarkupDeLaAgencia(M.agencia.id);
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
      hotelAntes = await leer(HOTEL, 'Hotel antes', M.mercado.hotelMarkup);
      servicioAntes = await leer(SERVICIO, 'Servicio antes', M.mercado.serviceMarkup);
    });

    try {
      await paso(page, `WebAdmin: llevar el markup de hoteles del mercado ${M.mercado.id} a ${nuevoHotel}`, async () => {
        await admin.guardarMercado(M.mercado.id, nuevoHotel, M.mercado.serviceMarkup);
      });

      await paso(portal, `Portal: el hotel aplica el markup ${nuevoHotel}`, async () => {
        await exigir(hotelAntes, await leer(HOTEL, 'Hotel despues', nuevoHotel), M.mercado.hotelMarkup, nuevoHotel, 'hotel');
      });

      await paso(portal, 'Portal: el servicio no cambia', async () => {
        await exigir(servicioAntes, await leer(SERVICIO, 'Servicio despues', M.mercado.serviceMarkup), M.mercado.serviceMarkup, M.mercado.serviceMarkup, 'servicio');
      });

      await paso(portal, `Portal: el servicio en English cobra techo((costo + recargo) / cotizacion / ${M.mercado.serviceMarkup}) en la ficha y en el carrito`, async () => {
        await recargoEnFichaYCarritoViejo(portal, conRecargo(), M.mercado.serviceMarkup * M.usuario.customMarkup, `Mercado ${M.mercado.serviceMarkup}`);
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
      hotelAntes = await leer(HOTEL, 'Hotel antes', M.mercado.hotelMarkup);
      servicioAntes = await leer(SERVICIO, 'Servicio antes', M.mercado.serviceMarkup);
    });

    try {
      // Desde la 5107 el markup propio es Manual por sucursal y fija los dos numeros: hoteles
      // repite el del mercado para que solo cambie servicios.
      await paso(page, `WebAdmin: darle a la agencia ${M.agencia.id} un markup propio de servicios de ${propioServicio}`, async () => {
        await admin.guardarAgencia(M.agencia.id, M.mercado.hotelMarkup, propioServicio);
      });

      await paso(portal, `Portal: el servicio aplica el markup propio ${propioServicio} y no el del mercado`, async () => {
        await exigir(servicioAntes, await leer(SERVICIO, 'Servicio con markup propio', propioServicio), M.mercado.serviceMarkup, propioServicio, 'servicio');
      });

      await paso(portal, 'Portal: el hotel no cambia', async () => {
        await exigir(hotelAntes, await leer(HOTEL, 'Hotel con markup propio de servicios', M.mercado.hotelMarkup), M.mercado.hotelMarkup, M.mercado.hotelMarkup, 'hotel');
      });

      await paso(portal, `Portal: el servicio en English con el markup propio ${propioServicio}: el recargo también lo lleva`, async () => {
        await recargoEnFichaYCarritoViejo(portal, conRecargo(), propioServicio * M.usuario.customMarkup, `Markup propio ${propioServicio}`);
      });

      await paso(page, `WebAdmin: vaciar el markup propio de la agencia ${M.agencia.id}`, async () => {
        await admin.guardarAgencia(M.agencia.id, null, null);
      });

      await paso(portal, 'Portal: el servicio vuelve al markup del mercado', async () => {
        await exigir(servicioAntes, await leer(SERVICIO, 'Servicio sin markup propio', M.mercado.serviceMarkup), M.mercado.serviceMarkup, M.mercado.serviceMarkup, 'servicio');
      });
    } finally {
      await paso(page, `Restaurar la agencia ${M.agencia.id} sin markup propio`, async () => {
        await admin.guardarAgencia(M.agencia.id, null, null);
      });
    }
  });
});
