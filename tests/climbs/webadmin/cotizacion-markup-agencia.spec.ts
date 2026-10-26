import { test, expect } from '@playwright/test';
import { CotizacionGrupoNuevaPage } from '../../../pages/climbs/cotizacion-grupo.page';
import { MercadoNuevoPage, AgenciaNuevaPage } from '../../../pages/climbs/agencia.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado, fechaDeBusqueda, formatearFecha } from '../../../utils/pasos';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';
import { cancelarReservaEnElPortal } from '../comun/cancelar-reserva';
import candidatos from '../../../data/candidatos.json';

const M = candidatos.markups;
const P = candidatos.tarifario.paquetes;
const SALTO = String.fromCharCode(10);

// Valores propios de la agencia: distintos de los del mercado y del pais para que el test
// distinga de donde sale cada dato. El hotel y el servicio llevan markups distintos entre si:
// la cotizacion tiene que tomar el de HOTELES.
const HOTEL_PROPIO = 0.5;
const SERVICIO_PROPIO = 0.4;
// Con decimales a proposito: hasta el fix 4284 la cotizacion guardaba el tipo de cambio como entero.
const CAMBIO_MANUAL = 1234.56;
const CAMBIO_DEL_PAIS = 1000;

/**
 * WEBADMIN — app nueva (ClimbsApp). La cotizacion de grupo toma el markup y el tipo de cambio de
 * la agencia.
 *
 * El mismo test que tests/webadmin/cotizacion-markup-agencia.spec.ts, con el mismo titulo. En la
 * app nueva la cotizacion de grupo vive en el Backoffice (Ventas › Cotizaciones de grupos): al
 * elegir la agencia, la pantalla trae su "Markup" y su "Tipo de cambio (moneda base)". El markup
 * propio y la cotizacion propia de la agencia se cargan en su ficha (Clientes › Agencias).
 *
 * Con la agencia propia 6334 (mercado 37: hoteles 0,80 / servicios 0,60; pais 1.000):
 *   1. sin datos propios, la cotizacion carga 0,80 y 1.000 (mercado y pais);
 *   2. con markup propio de hoteles 0,50 (y de servicios 0,40) y cotizacion manual 1.234,56,
 *      carga 0,50 y 1.234,56, los guarda tal cual, el listado muestra el tipo de cambio con
 *      decimales y "Crear reserva" no los altera.
 * Al final cancela la reserva (desde el portal, como la agencia), borra la cotizacion y deja la
 * agencia sin markup propio y sin cotizacion propia.
 */
test.describe('WebAdmin — cotizacion de grupo: markup y tipo de cambio de la agencia', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  test('La cotizacion carga el markup de hoteles y el tipo de cambio de la agencia y los conserva al crear la reserva', async ({ page, browser, baseURL }) => {
    test.setTimeout(900_000);
    const cotizacion = new CotizacionGrupoNuevaPage(page);
    const mercado = new MercadoNuevoPage(page);
    const agencia = new AgenciaNuevaPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const datos = {
      agencia: M.agencia.nombre, sucursal: 'Argentina', itinerario: P.nombre, referencia: `AUTO-QA MKT ${sello}`,
      titulo: `AUTO-QA NO TOCAR - Cotizacion markup ${sello}`, pax: 2, sgl: 0, dbl: 1, tpl: 0, inicio: formatearFecha(fechaDeBusqueda(30)),
    };
    let id = 0;
    let reserva = 0;
    let agenciaTocada = false;
    const campoMarkup = () => cotizacion.ficha.locator('#bq-markup');
    const campoCambio = () => cotizacion.ficha.locator('#bq-rate');

    await paso(page, `Verificar el punto de partida: mercado ${M.mercado.id} y agencia ${M.agencia.id} sin datos propios`, async () => {
      await mercado.abrir(M.mercado.id);
      const markupsDelMercado = await mercado.markups();
      await agencia.abrir(M.agencia.id);
      const markups = await agencia.markups();
      let cambio = await agencia.tipoDeCambio();
      // La cotizacion propia que el WebAdmin dejo marcada como borrada, la ficha nueva la muestra tildada.
      if (cambio.manual) { await agencia.guardarTipoDeCambio(M.agencia.id, false); cambio = await agencia.tipoDeCambio(); }
      await adjuntarTexto('Punto de partida', JSON.stringify({ mercado: markupsDelMercado, markups, cambio }, null, 2));
      expect(markupsDelMercado, `El mercado ${M.mercado.id} tiene que arrancar en 0,80 / 0,60`)
        .toEqual({ hotel: M.mercado.hotelMarkup, servicio: M.mercado.serviceMarkup });
      expect(markups, `La agencia ${M.agencia.id} tiene que arrancar sin markup propio`).toEqual({ hotel: null, servicio: null });
      expect(cambio.manual, 'La agencia tiene que arrancar sin tipo de cambio manual').toBe(false);
      expect(cambio.valor, `La cotizacion del pais tiene que ser ${CAMBIO_DEL_PAIS}`).toBe(CAMBIO_DEL_PAIS);
    });

    try {
      await paso(page, 'Cotizacion nueva: al elegir la agencia sin datos propios carga el markup del mercado y el tipo de cambio del pais', async () => {
        await cotizacion.nueva();
        await cotizacion.elegirAgencia(datos.agencia);
        const v = await cotizacion.valores();
        await adjuntarTexto('Precarga sin datos propios', JSON.stringify(v));
        await conResaltado(page, campoMarkup(), 'Markup precargado sin datos propios', () => {
          expect(v.markup, `El markup tiene que ser el de hoteles del mercado (${M.mercado.hotelMarkup}), no el de servicios (${M.mercado.serviceMarkup})`)
            .toBe(M.mercado.hotelMarkup);
        });
        await conResaltado(page, campoCambio(), 'Tipo de cambio precargado sin datos propios', () => {
          expect(v.tipoDeCambio, `El tipo de cambio tiene que ser el del pais (${CAMBIO_DEL_PAIS})`).toBe(CAMBIO_DEL_PAIS);
        });
      });

      agenciaTocada = true;
      await paso(page, `WebAdmin: darle a la agencia ${M.agencia.id} markup propio de hoteles ${HOTEL_PROPIO} (servicios ${SERVICIO_PROPIO}) y cotizacion manual ${CAMBIO_MANUAL}`, async () => {
        await agencia.guardarMarkups(M.agencia.id, HOTEL_PROPIO, SERVICIO_PROPIO);
        await agencia.guardarTipoDeCambio(M.agencia.id, true, CAMBIO_MANUAL);
        await agencia.abrir(M.agencia.id);
        expect(await agencia.markups(), 'Los markups propios tienen que seguir guardados').toEqual({ hotel: HOTEL_PROPIO, servicio: SERVICIO_PROPIO });
      });

      await paso(page, 'Cotizacion nueva: al elegir la agencia carga el markup de hoteles y el tipo de cambio propios, y los guarda', async () => {
        await cotizacion.nueva();
        await cotizacion.elegirAgencia(datos.agencia);
        const precarga = await cotizacion.valores();
        await adjuntarTexto('Precarga con datos propios', JSON.stringify(precarga));
        await conResaltado(page, campoMarkup(), 'Markup precargado con markup propio', () => {
          expect(precarga.markup, `El markup tiene que ser el propio de hoteles (${HOTEL_PROPIO}), no el del mercado (${M.mercado.hotelMarkup}) ni el de servicios (${SERVICIO_PROPIO})`)
            .toBe(HOTEL_PROPIO);
        });
        await conResaltado(page, campoCambio(), 'Tipo de cambio precargado con cotizacion manual', () => {
          expect(precarga.tipoDeCambio, `El tipo de cambio tiene que ser el manual de la agencia (${CAMBIO_MANUAL}), no el del pais (${CAMBIO_DEL_PAIS})`)
            .toBe(CAMBIO_MANUAL);
        });

        id = await cotizacion.crear(datos);
        await adjuntarTexto('Cotizacion creada', `ID ${id}${SALTO}${JSON.stringify(datos, null, 2)}`);
        expect(id, 'Guardar tiene que llevar a la ficha de la cotizacion').toBeGreaterThan(0);

        // Se relee de una carga nueva: lo que importa es lo que quedo guardado.
        await cotizacion.abrir(id);
        const guardado = await cotizacion.valores();
        await adjuntarTexto('Valores guardados en la cotizacion', JSON.stringify(guardado));
        await conResaltado(page, campoMarkup(), 'Markup guardado', () => {
          expect(guardado.markup, 'La cotizacion tiene que guardar el markup que cargo').toBe(HOTEL_PROPIO);
        });
        await conResaltado(page, campoCambio(), 'Tipo de cambio guardado', () => {
          expect(guardado.tipoDeCambio, 'La cotizacion tiene que guardar el tipo de cambio con sus decimales, sin truncarlo').toBe(CAMBIO_MANUAL);
        });
      });

      await paso(page, 'El listado de cotizaciones muestra el tipo de cambio con decimales', async () => {
        const fila = await cotizacion.filaDelListado(datos.referencia);
        const texto = ((await fila.textContent()) ?? '').replace(/\s+/g, ' ');
        await adjuntarTexto('Fila de la cotizacion en el listado', texto);
        await conResaltado(page, fila, 'Tipo de cambio en el listado', () => {
          expect(texto, 'La fila tiene que mostrar el tipo de cambio 1234,56 (dos decimales)').toMatch(/1\.?234[.,]56/);
        });
      });

      await paso(page, 'Crear la reserva desde la cotizacion no altera el markup ni el tipo de cambio', async () => {
        await cotizacion.abrir(id);
        reserva = await cotizacion.crearReserva();
        await adjuntarTexto('Reserva creada', String(reserva));
        expect(reserva, 'La ficha tiene que mostrar el numero de la reserva').toBeGreaterThan(0);
        await cotizacion.abrir(id);
        const despues = await cotizacion.valores();
        await adjuntarTexto('Valores de la cotizacion con la reserva creada', JSON.stringify(despues));
        await conResaltado(page, campoMarkup(), 'Datos comerciales tras crear la reserva', () => {
          expect(despues, 'Con la reserva creada, la cotizacion tiene que conservar el markup y el tipo de cambio')
            .toEqual({ markup: HOTEL_PROPIO, tipoDeCambio: CAMBIO_MANUAL });
        });
      });
    } finally {
      try {
        await paso(page, 'Limpiar: cancelar la reserva y borrar la cotizacion', async () => {
          const notas: string[] = [];
          if (reserva) {
            const { contexto, pagina } = await abrirSesionDeOtraAgencia(browser, baseURL);
            notas.push(await cancelarReservaEnElPortal(pagina, reserva).catch((e) => `No se pudo cancelar la reserva ${reserva}: ${String(e).split('\n')[0]}`));
            await contexto.close();
          }
          if (id) { await cotizacion.borrar(datos.referencia); notas.push(`Cotizacion ${id} borrada`); }
          await adjuntarTexto('Limpieza', notas.join(SALTO) || 'nada que limpiar');
        });
      } finally {
        if (agenciaTocada) {
          await paso(page, `Restaurar la agencia ${M.agencia.id}: sin markup propio y sin cotizacion manual`, async () => {
            await agencia.guardarMarkups(M.agencia.id, null, null);
            await agencia.guardarTipoDeCambio(M.agencia.id, false);
          });
        }
      }
    }
  });
});
