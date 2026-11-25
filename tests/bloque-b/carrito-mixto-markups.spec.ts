import { test, expect, Page, BrowserContext } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { HotelPage } from '../../pages/hotel.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage } from '../../pages/carrito.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado, esperarFinDeCarga } from '../../utils/pasos';
import { abrirSesionDeMarkups, conBackofficeNuevo, costosDelServicio, cortesDeLaHabitacion, tarifaVigente, precioEsperado } from '../../utils/markups';
import { importeDelPortal } from './reservas-comun';
import candidatos from '../../data/candidatos.json';
import { recargoEnFichaYCarritoViejo, ServicioConRecargo } from '../../utils/recargo-por-idioma';

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
 * BLOQUE B — Carrito con hotel y servicio: cada uno con su markup.
 *
 * Desde la US 4770 los hoteles y los servicios llevan markups distintos, y el carrito
 * es donde los dos conviven: si el sistema le aplicara a un item el markup del otro
 * tipo, la agencia pagaria otro precio. Los tests de markups miran el tarifario; este
 * mira el carrito.
 *
 * El mismo carrito (hotel 15422 / habitacion 18371, 2 noches DBL, y el servicio 7954,
 * Regular, 2 pasajeros) se arma con dos usuarios:
 * - pablo1: agencia 1 sin markup de mercado, CustomMarkup 0,50;
 * - autoqa.markups: agencia 6334, mercado 37 (0,80 hoteles / 0,60 servicios),
 *   CustomMarkup 1,00.
 * Con cada uno, cada linea del carrito vale lo que mostro su ficha y el total es la
 * suma. Entre los dos, cada item guarda la proporcion de su tipo: precio de
 * autoqa.markups = precio de pablo1 x 0,50 / markup del tipo, con margen por el
 * redondeo hacia arriba. Si los markups se cruzaran, la proporcion no da.
 *
 * Fechas de enero 2028: la habitacion tiene ahi un corte fijo (cargado por SQL) y el
 * servicio tarifas hasta fin de 2028, dentro del tope de 3 anios de la HU 4949.
 * No emite: al final vacia los dos carritos.
 */
test.describe('Carrito con hotel y servicio', () => {
  let contexto: BrowserContext;
  let pagina: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    ({ contexto, pagina } = await abrirSesionDeMarkups(browser, baseURL));
  });

  test.afterAll(async () => {
    await contexto?.close();
  });

  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const ENTRADA = new Date(2028, 0, 13);
  const SALIDA = new Date(2028, 0, 15);
  const HOTEL = { id: H.hotelId, room: H.roomId, nombre: H.hotelNombre.replace(/^AUTO-QA NO TOCAR - /, '') };
  const SERVICIO = { nombre: S.nombre, termino: S.terminoBusqueda, modalidad: 'Regular', pax: 2 };

  type Carrito = {
    hotelFicha: number; servicioFicha: number;
    hotelLinea: number; servicioLinea: number; total: number;
  };
  const valor = (texto: string, que: string) => {
    const v = importeDelPortal(texto).valor;
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
      cortes: await cortesDeLaHabitacion(bo, HOTEL.room),
      costos: await costosDelServicio(bo, S.servicioId),
    }));
    const corte = cortes.find((c) => desdeBO(c.desde) <= ENTRADA && desdeBO(c.hasta) >= SALIDA);
    const tarifa = tarifaVigente(costos, SERVICIO.modalidad, ENTRADA, SERVICIO.pax);
    expect(corte?.dbl, `La habitacion ${HOTEL.room} tiene que tener un corte DBL que cubra la estadia`).toBeTruthy();
    expect(tarifa, `El servicio ${S.servicioId} tiene que tener una tarifa ${SERVICIO.modalidad} vigente`).toBeDefined();
    const de = (divisorHotel: number, divisorServicio: number) => ({
      hotel: precioEsperado(corte!.dbl!, 'USD', divisorHotel)! * 2 * NOCHES,
      servicio: precioEsperado(tarifa!.costo!, tarifa!.moneda, divisorServicio)! * SERVICIO.pax,
    });
    const esperados = {
      pablo1: de(MARKUP_PABLO, MARKUP_PABLO),
      'autoqa.markups': de(M.mercado.hotelMarkup * M.usuario.customMarkup, M.mercado.serviceMarkup * M.usuario.customMarkup),
    } as Record<string, { hotel: number; servicio: number }>;
    await adjuntarTexto('Importes esperados desde los costos', [
      `Corte ${corte!.desde} - ${corte!.hasta}: DBL USD ${corte!.dbl} por persona y noche | ${NOCHES} noches, 2 pax`,
      `Tarifa ${tarifa!.vigencia} | ${tarifa!.modalidad} | ${tarifa!.moneda} ${tarifa!.costo} | ${SERVICIO.pax} pax`,
      ...Object.entries(esperados).map(([u, e]) => `${u}: hotel USD ${e.hotel}, servicio USD ${e.servicio}`),
    ].join(String.fromCharCode(10)));
    return esperados;
  }

  /** Arma el carrito con el hotel y el servicio y devuelve lo que cobro cada pantalla. */
  async function armarCarrito(page: Page, usuario: string, esperado?: { hotel: number; servicio: number }): Promise<Carrito> {
    const inicio = new InicioPage(page);
    const hotel = new HotelPage(page);
    const servicio = new ServicioPage(page);
    const carrito = new CarritoPage(page);
    const c = {} as Carrito;

    await paso(page, `${usuario}: vaciar el carrito y agregar la habitacion del hotel ${HOTEL.id}`, async () => {
      await inicio.abrir();
      await carrito.vaciar();
      await inicio.abrir();
      await inicio.abrirSolapa('hoteles');
      await hotel.verificarResidente();
      await hotel.elegirHotel(HOTEL.id, HOTEL.nombre, H.terminoBusqueda);
      await hotel.fijarViajeros(1, 2);
      await hotel.elegirFechas(ENTRADA, SALIDA);
      await hotel.buscar();
      await hotel.abrirFicha(HOTEL.id);
      c.hotelFicha = valor(`USD ${await hotel.precioDeLaHabitacion(HOTEL.room)}`, 'Ficha del hotel');
      await hotel.reservarHabitacion(HOTEL.room, 1);
    });

    await paso(page, `${usuario}: agregar el servicio ${S.servicioId}`, async () => {
      await inicio.abrir();
      const panel = await inicio.abrirSolapa('servicios');
      await servicio.buscar({ panel, pais: 'Argentina', ciudad: 'Buenos Aires', tipo: 'Excursión', fecha: ENTRADA });
      await servicio.buscarPorNombre(SERVICIO.termino, SERVICIO.nombre);
      await servicio.abrirFicha(SERVICIO.nombre.slice(0, 24));
      await servicio.elegirCantidadDePax(SERVICIO.modalidad, SERVICIO.pax);
      c.servicioFicha = valor(await servicio.esperarTotal(), 'Ficha del servicio');
      await servicio.agregarAlCarrito();
    });

    await paso(page, `${usuario}: cada linea del carrito vale lo de su ficha y el total es la suma`, async () => {
      await carrito.irAlCarrito();
      const filaHotel = carrito.filaDelCarrito(HOTEL.nombre.slice(0, 20));
      const filaServicio = carrito.filaDelCarrito(SERVICIO.nombre.replace(/^AUTO-QA NO TOCAR - /, '').slice(0, 20));
      await expect(page.locator(carrito.filas), 'El carrito tiene que tener los dos items').toHaveCount(2);
      c.hotelLinea = valor(await filaHotel.locator('.ct-row__total').innerText(), 'Linea del hotel');
      c.servicioLinea = valor(await filaServicio.locator('.ct-row__total').innerText(), 'Linea del servicio');
      c.total = valor(await page.locator('.ct-total .ct-opt__total-val').first().innerText(), 'Total del carrito');
      await adjuntarTexto(`Carrito de ${usuario}`, JSON.stringify(c, null, 1));

      await conResaltado(page, filaHotel, `${usuario}: linea del hotel`, () => {
        expect(c.hotelLinea, 'El carrito tiene que cobrar el hotel lo que mostro su ficha').toBe(c.hotelFicha);
      });
      await conResaltado(page, filaServicio, `${usuario}: linea del servicio`, () => {
        expect(c.servicioLinea, 'El carrito tiene que cobrar el servicio lo que mostro su ficha').toBe(c.servicioFicha);
      });
      await conResaltado(page, page.locator('.ct-total').first(), `${usuario}: total`, () => {
        expect(c.total, 'El total del carrito tiene que ser la suma de sus lineas').toBe(c.hotelLinea + c.servicioLinea);
      });
      if (esperado) {
        await conResaltado(page, filaHotel, `${usuario}: hotel contra su costo`, () => {
          expect(c.hotelFicha, `${usuario}: el hotel tiene que valer techo(costo DBL / divisor) x 2 pax x ${NOCHES} noches`).toBe(esperado.hotel);
        });
        await conResaltado(page, filaServicio, `${usuario}: servicio contra su costo`, () => {
          expect(c.servicioFicha, `${usuario}: el servicio tiene que valer techo(costo / cotizacion / divisor) x ${SERVICIO.pax} pax`).toBe(esperado.servicio);
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
      const lineaCena = await recargoEnFichaYCarritoViejo(page, cena, divisor, usuario, true);
      const total = valor(await page.locator('.ct-total .ct-opt__total-val').first().innerText(), 'Total del carrito con la Cena Show');
      await adjuntarTexto(`${usuario}: total con la Cena Show`, `hotel ${c.hotelLinea} + servicio ${c.servicioLinea} + Cena Show ${lineaCena} = ${total}`);
      await conResaltado(page, page.locator('.ct-total').first(), `${usuario}: total con la Cena Show`, () => {
        expect.soft(total, 'El total del carrito tiene que ser la suma de sus tres lineas').toBe(c.hotelLinea + c.servicioLinea + lineaCena);
      });
    });

    return c;
  }

  test('Hotel y servicio en el mismo carrito: cada uno lleva el markup de su tipo', async ({ page }) => {
    test.setTimeout(900_000);
    let pablo = {} as Carrito;
    let propio = {} as Carrito;

    try {
      const esperados = await esperadosDesdeLosCostos(page);
      pablo = await armarCarrito(page, 'pablo1', esperados.pablo1);
      propio = await armarCarrito(pagina, 'autoqa.markups', esperados['autoqa.markups']);

      await paso(page, 'Entre los dos usuarios, cada item guarda la proporcion del markup de su tipo', async () => {
        // precio = techo(tarifa / markup / CustomMarkup): el de autoqa.markups es el de
        // pablo1 x 0,50 / markup del tipo. El techo se aplica por noche y por pasajero,
        // asi que el margen crece con las unidades del item.
        const esperado = (p: number, markup: number) => (p * 0.5) / markup;
        const filas = [
          { item: 'hotel', pablo: pablo.hotelLinea, propio: propio.hotelLinea, markup: M.mercado.hotelMarkup, margen: 4 },
          { item: 'servicio', pablo: pablo.servicioLinea, propio: propio.servicioLinea, markup: M.mercado.serviceMarkup, margen: 2 },
        ];
        await adjuntarTexto('Proporcion por tipo', filas.map((f) =>
          `${f.item}: pablo1 ${f.pablo} -> esperado ${esperado(f.pablo, f.markup).toFixed(2)} (markup ${f.markup}), autoqa.markups ${f.propio}`).join('\n'));
        for (const f of filas) {
          expect(Math.abs(f.propio - esperado(f.pablo, f.markup)),
            `El ${f.item} tiene que llevar el markup de ${f.item}s (${f.markup}): pablo1 ${f.pablo}, autoqa.markups ${f.propio}`)
            .toBeLessThanOrEqual(f.margen);
        }
      });
    } finally {
      // La captura automatica del fallo es solo de `page` (pablo1): la de la otra sesion
      // se adjunta a mano, antes de vaciar, para ver donde quedo.
      await test.info().attach('Pantalla de autoqa.markups al terminar', {
        body: await pagina.screenshot({ fullPage: false }).catch(() => Buffer.from('')), contentType: 'image/png',
      });
      await adjuntarTexto('URL de autoqa.markups al terminar', pagina.url());
      for (const [p, quien] of [[page, 'pablo1'], [pagina, 'autoqa.markups']] as const) {
        await new InicioPage(p).abrir().catch(() => {});
        await new CarritoPage(p).vaciar().catch(() => {});
        await esperarFinDeCarga(p).catch(() => {});
        await adjuntarTexto(`Carrito vaciado (${quien})`, 'ok');
      }
    }
  });
});
