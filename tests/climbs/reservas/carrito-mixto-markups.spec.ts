import { test, expect, Page, BrowserContext } from '@playwright/test';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { HotelNuevoPage } from '../../../pages/climbs/hotel.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';
import { importe } from './reservas-comun';
import candidatos from '../../../data/candidatos.json';

const M = candidatos.markups;
const H = candidatos.extensionTarifas;
const S = candidatos.tarifasServicio;

/**
 * RESERVAS — app nueva (ClimbsApp). Carrito con hotel y servicio: cada uno con su markup.
 *
 * El mismo test que tests/bloque-b/carrito-mixto-markups.spec.ts, con el mismo titulo. Desde
 * la US 4770 hoteles y servicios llevan markups distintos y el carrito es donde conviven. El
 * mismo carrito (hotel 15422, habitacion 18371 "King Deluxe - Edificio Posadas ..", 2 noches
 * DBL, y el servicio 7954 Regular para 2) se arma con dos usuarios:
 * - pablo1: agencia sin markup de mercado, CustomMarkup 0,50;
 * - autoqa.markups: mercado 37 (0,80 hoteles / 0,60 servicios), CustomMarkup 1,00.
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

  async function armarCarrito(page: Page, usuario: string): Promise<Carrito> {
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
      const lineas = (await page.locator('main').getByRole('complementary').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
      c.total = valor(lineas[lineas.indexOf('Total') + 1] ?? '', 'Total del carrito');
      await adjuntarTexto(`Carrito de ${usuario}`, JSON.stringify(c, null, 1));
      await conResaltado(page, portal.itemDelCarrito(H.hotelNombre), `${usuario}: linea del hotel`, () => {
        expect(c.hotelLinea, 'El carrito tiene que cobrar el hotel lo que mostro su ficha').toBe(c.hotelFicha);
      });
      await conResaltado(page, portal.itemDelCarrito(S.nombre), `${usuario}: linea del servicio`, () => {
        expect(c.servicioLinea, 'El carrito tiene que cobrar el servicio lo que mostro su ficha').toBe(c.servicioFicha);
      });
      await conResaltado(page, page.locator('main').getByRole('complementary'), `${usuario}: total`, () => {
        expect(c.total, 'El total del carrito tiene que ser la suma de sus lineas').toBe(c.hotelLinea + c.servicioLinea);
      });
    });
    return c;
  }

  test('Hotel y servicio en el mismo carrito: cada uno lleva el markup de su tipo', async ({ page }) => {
    test.setTimeout(900_000);
    try {
      const pablo = await armarCarrito(page, 'pablo1');
      const propio = await armarCarrito(pagina, 'autoqa.markups');

      await paso(page, 'Entre los dos usuarios, cada item guarda la proporcion del markup de su tipo', async () => {
        // precio = techo(tarifa / markup / CustomMarkup): el de autoqa.markups es el de pablo1
        // x 0,50 / markup del tipo. El techo va por noche y por pasajero: el margen crece con las unidades.
        const esperado = (p: number, markup: number) => (p * 0.5) / markup;
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
