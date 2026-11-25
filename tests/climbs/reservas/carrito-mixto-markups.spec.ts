import { test, expect, Page, BrowserContext } from '@playwright/test';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { HotelNuevoPage } from '../../../pages/climbs/hotel.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';
import { importe } from './reservas-comun';
import candidatos from '../../../data/candidatos.json';
import { conBackofficeNuevo, costosDelServicio, cortesDeLaHabitacion, tarifaVigente, precioEsperado } from '../../../utils/markups';
import { recargoEnFichaYCarritoNuevo, ServicioConRecargo } from '../../../utils/recargo-por-idioma';

const M = candidatos.markups;
const H = candidatos.extensionTarifas;
const S = candidatos.tarifasServicio;
/**
 * Recargo por idioma en el mismo carrito: a cada carrito ya armado con el hotel y el servicio se le suma
 * la Cena Show AUTO-QA (163) en English, que tiene USD 15 fijos por pasajero en la tarifa Regular. US 4739:
 * "el valor final tiene que calcularse aplicando el markup de la agencia sobre costo + recargo en conjunto,
 * nunca sobre el costo solo". Su linea tiene que ser techo((costo + recargo) / markup de servicios del
 * usuario) x pasajeros, y el total del carrito la suma de las tres lineas. Enero 2031: dentro de su tarifa
 * y entre los meses con salida.
 */
const CS = candidatos.tarifario.cenaShow;
let tarifasCenaShow: Awaited<ReturnType<typeof costosDelServicio>> | undefined;

/**
 * RESERVAS — app nueva (ClimbsApp). Carrito con hotel y servicio: cada uno con su markup.
 *
 * El mismo test que tests/bloque-b/carrito-mixto-markups.spec.ts, con el mismo titulo. Desde
 * la US 4770 hoteles y servicios llevan markups distintos y el carrito es donde conviven. El
 * mismo carrito (hotel 15422, habitacion 18371 "King Deluxe - Edificio Posadas ..", 2 noches
 * DBL, y el servicio 7954 Regular para 2) se arma con dos usuarios:
 * - pablo1: agencia sin markup de mercado, CustomMarkup 0,00;
 * - autoqa.markups: mercado 37 (0,80 hoteles / 0,60 servicios), CustomMarkup 0,00.
 * Con cada uno, cada linea del carrito vale lo que mostro su ficha y el total es la suma; y
 * entre los dos cada item guarda la proporcion de su tipo. Enero 2028. No emite.
 */
test.describe('Carrito con hotel y servicio', () => {
  let contexto: BrowserContext;
  let pagina: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    ({ contexto, pagina } = await abrirSesionDeOtraAgencia(browser, baseURL));
  });
  test.afterAll(async () => { await contexto?.close(); });
  test.beforeEach(() => reiniciarNumeracionDePasos());

  const ENTRADA = new Date(2028, 0, 13);
  const SALIDA = new Date(2028, 0, 15);
  const HABITACION = 'King Deluxe - Edificio Posadas ..';
  const MODALIDAD = 'Regular';
  const PAX = 2;

  type Carrito = { hotelFicha: number; servicioFicha: number; hotelLinea: number; servicioLinea: number; total: number };
  const valor = (texto: string, que: string) => {
    const v = importe(texto).valor;
    expect(v, `${que}: no se pudo leer un importe de "${texto}"`).not.toBeNull();
    return v!;
  };

  const NOCHES = 2;
  // CustomMarkup de pablo1 (agencia 1, sin markup de mercado): el de la linea base de la suite.
  const MARKUP_PABLO = candidatos._formulaPrecio.markupPorDefecto;
  const desdeBO = (t: string) => { const [d, m, a] = t.split('/').map(Number); return new Date(a, m - 1, d); };
  /**
   * Lo que tiene que cobrar cada item, desde los costos del Backoffice nuevo:
   * - hotel: techo(costo DBL por persona / divisor) por pasajero y por noche, con el corte que cubre la estadia;
   * - servicio: techo(costo / cotizacion / divisor) por pasajero, con la tarifa Regular vigente.
   * El divisor es el markup del tipo x el CustomMarkup del usuario.
   */
  async function esperadosDesdeLosCostos(page: Page) {
    const { cortes, costos } = await conBackofficeNuevo(page.context().browser()!, async (bo) => ({
      cortes: await cortesDeLaHabitacion(bo, H.roomId),
      costos: await costosDelServicio(bo, S.servicioId),
    }));
    const corte = cortes.find((c) => desdeBO(c.desde) <= ENTRADA && desdeBO(c.hasta) >= SALIDA);
    const tarifa = tarifaVigente(costos, MODALIDAD, ENTRADA, PAX);
    expect(corte?.dbl, `La habitacion ${H.roomId} tiene que tener un corte DBL que cubra la estadia`).toBeTruthy();
    expect(tarifa, `El servicio ${S.servicioId} tiene que tener una tarifa ${MODALIDAD} vigente`).toBeDefined();
    const de = (divisorHotel: number, divisorServicio: number) => ({
      hotel: precioEsperado(corte!.dbl!, 'USD', divisorHotel)! * 2 * NOCHES,
      servicio: precioEsperado(tarifa!.costo!, tarifa!.moneda, divisorServicio)! * PAX,
    });
    const esperados = {
      pablo1: de(MARKUP_PABLO, MARKUP_PABLO),
      'autoqa.markups': de(M.mercado.hotelMarkup * M.usuario.customMarkup, M.mercado.serviceMarkup * M.usuario.customMarkup),
    } as Record<string, { hotel: number; servicio: number }>;
    await adjuntarTexto('Importes esperados desde los costos', [
      `Corte ${corte!.desde} - ${corte!.hasta}: DBL USD ${corte!.dbl} por persona y noche | ${NOCHES} noches, 2 pax`,
      `Tarifa ${tarifa!.vigencia} | ${tarifa!.modalidad} | ${tarifa!.moneda} ${tarifa!.costo} | ${PAX} pax`,
      ...Object.entries(esperados).map(([u, e]) => `${u}: hotel USD ${e.hotel}, servicio USD ${e.servicio}`),
    ].join(String.fromCharCode(10)));
    return esperados;
  }

  async function armarCarrito(page: Page, usuario: string, esperado?: { hotel: number; servicio: number }): Promise<Carrito> {
    const portal = new PortalNuevoPage(page);
    const hotel = new HotelNuevoPage(page);
    const c = {} as Carrito;

    await paso(page, `${usuario}: vaciar el carrito y agregar la habitacion del hotel ${H.hotelId}`, async () => {
      await portal.vaciarCarrito();
      await hotel.elegirHotel(H.terminoBusqueda, H.hotelNombre);
      await hotel.elegirFechas(ENTRADA, SALIDA);
      await hotel.cargarViajeros(1, 2);
      await hotel.buscar(ENTRADA, SALIDA);
      await hotel.abrirFicha(H.hotelNombre);
      c.hotelFicha = valor(await hotel.reservarHabitacion(HABITACION, 1), 'Ficha del hotel');
      await expect.poll(() => portal.itemsEnElCarrito(), { timeout: 30_000 }).toBe(1);
    });

    await paso(page, `${usuario}: agregar el servicio ${S.servicioId}`, async () => {
      await portal.buscarServicios(ENTRADA);
      await portal.elegirServicio(S.terminoBusqueda, S.nombre);
      await portal.elegirPasajeros(MODALIDAD, PAX);
      c.servicioFicha = valor(await portal.totalDeLaFicha(), 'Ficha del servicio');
      await portal.agregarAlCarrito(MODALIDAD, PAX);
      await expect.poll(() => portal.itemsEnElCarrito(), { timeout: 30_000 }).toBe(2);
    });

    await paso(page, `${usuario}: cada linea del carrito vale lo de su ficha y el total es la suma`, async () => {
      await portal.irAlCarrito();
      const items = page.locator('main article');
      await expect(items, 'El carrito tiene que tener los dos items').toHaveCount(2);
      const lineaDe = async (nombre: string) => (await portal.itemDelCarrito(nombre).innerText()).replace(/\s+/g, ' ').match(/[A-Z]{3}\s*[\d.,]+/g)?.at(-1) ?? '';
      c.hotelLinea = valor(await lineaDe(H.hotelNombre), 'Linea del hotel');
      c.servicioLinea = valor(await lineaDe(S.nombre), 'Linea del servicio');
      c.total = valor(await portal.totalDelCarrito(), 'Total del carrito');
      await adjuntarTexto(`Carrito de ${usuario}`, JSON.stringify(c, null, 1));
      await conResaltado(page, portal.itemDelCarrito(H.hotelNombre), `${usuario}: linea del hotel`, () => {
        expect(c.hotelLinea, 'El carrito tiene que cobrar el hotel lo que mostro su ficha').toBe(c.hotelFicha);
      });
      await conResaltado(page, portal.itemDelCarrito(S.nombre), `${usuario}: linea del servicio`, () => {
        expect(c.servicioLinea, 'El carrito tiene que cobrar el servicio lo que mostro su ficha').toBe(c.servicioFicha);
      });
      await conResaltado(page, portal.cajaDelTotal, `${usuario}: total`, () => {
        expect(c.total, 'El total del carrito tiene que ser la suma de sus lineas').toBe(c.hotelLinea + c.servicioLinea);
      });
      if (esperado) {
        await conResaltado(page, portal.itemDelCarrito(H.hotelNombre), `${usuario}: hotel contra su costo`, () => {
          expect(c.hotelFicha, `${usuario}: el hotel tiene que valer techo(costo DBL / divisor) x 2 pax x ${NOCHES} noches`).toBe(esperado.hotel);
        });
        await conResaltado(page, portal.itemDelCarrito(S.nombre), `${usuario}: servicio contra su costo`, () => {
          expect(c.servicioFicha, `${usuario}: el servicio tiene que valer techo(costo / cotizacion / divisor) x ${PAX} pax`).toBe(esperado.servicio);
        });
      }
    });
    await paso(page, `${usuario}: sumar la Cena Show en English al mismo carrito, con el recargo llevando el markup de servicios`, async () => {
      tarifasCenaShow ??= await conBackofficeNuevo(page.context().browser()!, (bo) => costosDelServicio(bo, CS.id));
      const cena: ServicioConRecargo = {
        pais: 'Argentina', ciudad: 'Buenos Aires', termino: CS.terminoBusqueda, nombre: CS.nombre.replace('Cafe', 'Café'),
        modalidad: 'Regular', fecha: new Date(2031, 0, 13), tarifas: tarifasCenaShow, tipo: 'Cena Show', tipoValor: String(CS.serviceTypeId),
      };
      // El markup de servicios de cada usuario: pablo1 su CustomMarkup; autoqa.markups el del mercado x su CustomMarkup.
      const divisor = usuario === 'pablo1' ? MARKUP_PABLO : M.mercado.serviceMarkup * M.usuario.customMarkup;
      const lineaCena = await recargoEnFichaYCarritoNuevo(page, cena, divisor, usuario, true);
      const total = valor(await new PortalNuevoPage(page).totalDelCarrito(), 'Total del carrito con la Cena Show');
      await adjuntarTexto(`${usuario}: total con la Cena Show`, `hotel ${c.hotelLinea} + servicio ${c.servicioLinea} + Cena Show ${lineaCena} = ${total}`);
      await conResaltado(page, new PortalNuevoPage(page).cajaDelTotal, `${usuario}: total con la Cena Show`, () => {
        expect.soft(total, 'El total del carrito tiene que ser la suma de sus tres lineas').toBe(c.hotelLinea + c.servicioLinea + lineaCena);
      });
    });

    return c;
  }

  test('Hotel y servicio en el mismo carrito: cada uno lleva el markup de su tipo', async ({ page }) => {
    test.setTimeout(900_000);
    try {
      const esperados = await esperadosDesdeLosCostos(page);
      const pablo = await armarCarrito(page, 'pablo1', esperados.pablo1);
      const propio = await armarCarrito(pagina, 'autoqa.markups', esperados['autoqa.markups']);

      await paso(page, 'Entre los dos usuarios, cada item guarda la proporcion del markup de su tipo', async () => {
        // precio = techo(tarifa / markup del tipo / CustomMarkup): el de autoqa.markups es el de pablo1
        // x CustomMarkup de pablo1 / markup del tipo (autoqa.markups no tiene markup propio). El techo va
        // por noche y por pasajero: el margen crece con las unidades. Antes se suponia pablo1 en 0,00; hoy
        // la linea base de la suite lo tiene en 0,50, igual que el portal viejo.
        const esperado = (p: number, markup: number) => (p * MARKUP_PABLO) / markup;
        const filas = [
          { item: 'hotel', pablo: pablo.hotelLinea, propio: propio.hotelLinea, markup: M.mercado.hotelMarkup, margen: 4 },
          { item: 'servicio', pablo: pablo.servicioLinea, propio: propio.servicioLinea, markup: M.mercado.serviceMarkup, margen: 2 },
        ];
        await adjuntarTexto('Proporcion por tipo', filas.map((f) =>
          `${f.item}: pablo1 ${f.pablo} -> esperado ${esperado(f.pablo, f.markup).toFixed(2)} (markup ${f.markup}), autoqa.markups ${f.propio}`).join('\n'));
        for (const f of filas) {
          expect(Math.abs(f.propio - esperado(f.pablo, f.markup)), `El ${f.item} tiene que llevar el markup de ${f.item}s (${f.markup}): pablo1 ${f.pablo}, autoqa.markups ${f.propio}`)
            .toBeLessThanOrEqual(f.margen);
        }
      });
    } finally {
      await test.info().attach('Pantalla de autoqa.markups al terminar', {
        body: await pagina.screenshot({ fullPage: false }).catch(() => Buffer.from('')), contentType: 'image/png',
      });
      for (const [p, quien] of [[page, 'pablo1'], [pagina, 'autoqa.markups']] as const) {
        await new PortalNuevoPage(p).vaciarCarrito().catch(() => {});
        await adjuntarTexto(`Carrito vaciado (${quien})`, 'ok');
      }
    }
  });
});
