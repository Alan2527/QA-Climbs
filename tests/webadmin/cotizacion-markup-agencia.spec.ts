import { test, expect } from '@playwright/test';
import { WebAdminCotizacionPage } from '../../pages/webadmin-cotizacion.page';
import { WebAdminCotizacionAgenciaPage } from '../../pages/webadmin-cotizacion-agencia.page';
import { WebAdminMarkupsPage } from '../../pages/webadmin-markups.page';
import {
  paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado, fechaDeBusqueda, formatearFecha, esperarFinDeCarga,
} from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const M = candidatos.markups;
const P = candidatos.tarifario.paquetes;
const SALTO = String.fromCharCode(10);

// Valores propios de la agencia: distintos de los del mercado y del pais para que el
// test distinga de donde sale cada dato. El hotel y el servicio llevan markups
// distintos entre si: la cotizacion tiene que tomar el de HOTELES.
const HOTEL_PROPIO = 0.5;
const SERVICIO_PROPIO = 0.4;
// Con decimales a proposito: hasta el fix 4284 (c4f83bc8) la cotizacion guardaba el
// tipo de cambio como entero y lo truncaba a 1234.
const CAMBIO_MANUAL = 1234.56;
const CAMBIO_DEL_PAIS = 1000;

/**
 * WebAdmin — la cotizacion de grupo toma el markup y el tipo de cambio de la agencia.
 *
 * Es sensible porque la cotizacion aprobada se convierte en la reserva del grupo: si
 * al elegir la agencia la cotizacion carga otro markup (el de servicios en vez del de
 * hoteles, el del mercado cuando la agencia tiene uno propio) o otra cotizacion del
 * dolar (la del pais cuando la agencia tiene una manual, o una truncada), la venta
 * sale a otro precio y nadie lo ve hasta que el cliente reclama.
 *
 * Con la agencia propia 6334 (mercado 37: hoteles 0,80 / servicios 0,60; cotizacion
 * del pais 1.000):
 *   1. sin datos propios, la cotizacion carga 0,80 y 1.000 (mercado y pais);
 *   2. con markup propio de hoteles 0,50 (y de servicios 0,40) y cotizacion manual
 *      1.234,56, carga 0,50 y 1.234,56, los guarda tal cual (sin truncar el tipo de
 *      cambio), el listado de cotizaciones muestra el tipo de cambio con decimales y
 *      "Crear reserva" no los altera.
 *
 * Crea una cotizacion nueva en cada corrida (paquete AUTO-QA 5059 como itinerario),
 * le crea la reserva y al final elimina la reserva, borra la cotizacion y deja la
 * agencia como estaba: sin markup propio y con la cotizacion manual destildada (se
 * pasa por 1.000 antes de apagarla, como hace el test de tipo de cambio, porque la
 * fila queda con Deleted=1 y el API no filtra ese campo).
 */
test.describe('WebAdmin — cotizacion de grupo: markup y tipo de cambio de la agencia', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  test('La cotizacion carga el markup de hoteles y el tipo de cambio de la agencia y los conserva al crear la reserva', async ({ page }) => {
    test.setTimeout(900_000);
    const cotizacion = new WebAdminCotizacionPage(page);
    const agenciaEnCotizacion = new WebAdminCotizacionAgenciaPage(page);
    const admin = new WebAdminMarkupsPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const datos = {
      agencia: String(M.agencia.id), ejecutivo: String(M.usuario.webUserId), sucursal: '1',
      itinerario: String(P.id), referencia: `AUTO-QA MKT ${sello}`,
      titulo: `AUTO-QA NO TOCAR - Cotizacion markup ${sello}`,
      pax: 2, sgl: 0, dbl: 1, tpl: 0, inicio: formatearFecha(fechaDeBusqueda(30)),
    };
    let id = 0;
    let reserva = 0;
    // Se pasa a true apenas se toca la agencia: el finally solo restaura si hizo falta.
    let agenciaTocada = false;

    await paso(page, `Verificar el punto de partida: mercado ${M.mercado.id} y agencia ${M.agencia.id} sin datos propios`, async () => {
      await admin.abrirMercado(M.mercado.id);
      const mercado = await admin.markupsDelMercado();
      await admin.abrirAgencia(M.agencia.id);
      const markups = await admin.markupsDeLaAgencia();
      const cambio = await admin.tipoDeCambioDeLaAgencia();
      await adjuntarTexto('Punto de partida', JSON.stringify({ mercado, markups, cambio }, null, 2));
      expect(mercado, `El mercado ${M.mercado.id} tiene que arrancar en 0,80 / 0,60`)
        .toEqual({ hotel: M.mercado.hotelMarkup, servicio: M.mercado.serviceMarkup });
      expect(markups, `La agencia ${M.agencia.id} tiene que arrancar sin markup propio`).toEqual({ hotel: null, servicio: null });
      expect(cambio.manual, 'La agencia tiene que arrancar sin tipo de cambio manual').toBe(false);
      expect(cambio.general, `La cotizacion del pais tiene que ser ${CAMBIO_DEL_PAIS}`).toBe(CAMBIO_DEL_PAIS);
    });

    try {
      await paso(page, 'Cotizacion nueva: al elegir la agencia sin datos propios carga el markup del mercado y el tipo de cambio del pais', async () => {
        await cotizacion.nueva();
        await agenciaEnCotizacion.elegirAgencia(datos.agencia);
        const v = await agenciaEnCotizacion.valores();
        await adjuntarTexto('Precarga sin datos propios', JSON.stringify(v));
        await conResaltado(page, page.locator(agenciaEnCotizacion.campoMarkup), 'Markup precargado sin datos propios', () => {
          expect(v.markup, `El markup tiene que ser el de hoteles del mercado (${M.mercado.hotelMarkup}), no el de servicios (${M.mercado.serviceMarkup})`)
            .toBe(M.mercado.hotelMarkup);
        });
        await conResaltado(page, page.locator(agenciaEnCotizacion.campoTipoDeCambio), 'Tipo de cambio precargado sin datos propios', () => {
          expect(v.tipoDeCambio, `El tipo de cambio tiene que ser el del pais (${CAMBIO_DEL_PAIS})`).toBe(CAMBIO_DEL_PAIS);
        });
      });

      agenciaTocada = true;
      await paso(page, `WebAdmin: darle a la agencia ${M.agencia.id} markup propio de hoteles ${HOTEL_PROPIO} (servicios ${SERVICIO_PROPIO}) y cotizacion manual ${CAMBIO_MANUAL}`, async () => {
        await admin.guardarAgencia(M.agencia.id, HOTEL_PROPIO, SERVICIO_PROPIO);
        await admin.guardarTipoDeCambio(M.agencia.id, true, CAMBIO_MANUAL);
        // guardarTipoDeCambio solo relee la cotizacion: se confirma que el markup no se perdio.
        await admin.abrirAgencia(M.agencia.id);
        expect(await admin.markupsDeLaAgencia(), 'Los markups propios tienen que seguir guardados')
          .toEqual({ hotel: HOTEL_PROPIO, servicio: SERVICIO_PROPIO });
      });

      await paso(page, 'Cotizacion nueva: al elegir la agencia carga el markup de hoteles y el tipo de cambio propios, y los guarda', async () => {
        await cotizacion.nueva();
        await agenciaEnCotizacion.elegirAgencia(datos.agencia);
        const precarga = await agenciaEnCotizacion.valores();
        await adjuntarTexto('Precarga con datos propios', JSON.stringify(precarga));
        await conResaltado(page, page.locator(agenciaEnCotizacion.campoMarkup), 'Markup precargado con markup propio', () => {
          expect(precarga.markup, `El markup tiene que ser el propio de hoteles (${HOTEL_PROPIO}), no el del mercado (${M.mercado.hotelMarkup}) ni el de servicios (${SERVICIO_PROPIO})`)
            .toBe(HOTEL_PROPIO);
        });
        await conResaltado(page, page.locator(agenciaEnCotizacion.campoTipoDeCambio), 'Tipo de cambio precargado con cotizacion manual', () => {
          expect(precarga.tipoDeCambio, `El tipo de cambio tiene que ser el manual de la agencia (${CAMBIO_MANUAL}), no el del pais (${CAMBIO_DEL_PAIS})`)
            .toBe(CAMBIO_MANUAL);
        });

        id = await cotizacion.crear(datos);
        await adjuntarTexto('Cotizacion creada', `ID ${id}${SALTO}${JSON.stringify(datos, null, 2)}`);
        expect(id, 'Guardar tiene que redirigir a la ficha de la cotizacion').toBeGreaterThan(0);

        // Se relee de una carga nueva: lo que importa es lo que quedo guardado.
        await cotizacion.abrir(id);
        const guardado = await agenciaEnCotizacion.valores();
        await adjuntarTexto('Valores guardados en la cotizacion', JSON.stringify(guardado));
        await conResaltado(page, page.locator(agenciaEnCotizacion.campoMarkup), 'Markup guardado', () => {
          expect(guardado.markup, 'La cotizacion tiene que guardar el markup que cargo').toBe(HOTEL_PROPIO);
        });
        await conResaltado(page, page.locator(agenciaEnCotizacion.campoTipoDeCambio), 'Tipo de cambio guardado', () => {
          expect(guardado.tipoDeCambio, 'La cotizacion tiene que guardar el tipo de cambio con sus decimales, sin truncarlo').toBe(CAMBIO_MANUAL);
        });
      });

      await paso(page, 'El listado de cotizaciones muestra el tipo de cambio con decimales', async () => {
        await page.goto(`/administration/budgets/default.aspx?refs=${encodeURIComponent(datos.referencia)}`);
        await esperarFinDeCarga(page);
        const fila = cotizacion.filaDelListado(id);
        await expect(fila, `El listado tiene que mostrar la cotizacion ${id}`).toBeVisible();
        const texto = ((await fila.textContent()) ?? '').replace(/\s+/g, ' ');
        await adjuntarTexto('Fila de la cotizacion en el listado', texto);
        await conResaltado(page, fila, 'Tipo de cambio en el listado', () => {
          expect(texto, 'La fila tiene que mostrar el tipo de cambio 1234,56 (dos decimales)').toMatch(/1234[.,]56/);
        });
      });

      await paso(page, 'Crear la reserva desde la cotizacion no altera el markup ni el tipo de cambio', async () => {
        await cotizacion.abrir(id);
        reserva = await cotizacion.crearReserva();
        await adjuntarTexto('Reserva creada', String(reserva));
        expect(reserva, 'La ficha tiene que mostrar el numero de la reserva').toBeGreaterThan(0);
        await cotizacion.abrir(id);
        const despues = await agenciaEnCotizacion.valores();
        await adjuntarTexto('Valores de la cotizacion con la reserva creada', JSON.stringify(despues));
        await conResaltado(page, page.locator(agenciaEnCotizacion.campoMarkup), 'Datos comerciales tras crear la reserva', () => {
          expect(despues, 'Con la reserva creada, la cotizacion tiene que conservar el markup y el tipo de cambio')
            .toEqual({ markup: HOTEL_PROPIO, tipoDeCambio: CAMBIO_MANUAL });
        });
      });
    } finally {
      try {
        await paso(page, 'Limpiar: eliminar la reserva y borrar la cotizacion', async () => {
          if (reserva) await cotizacion.eliminarReserva(reserva);
          if (id) await cotizacion.borrar(id, datos.referencia);
          await esperarFinDeCarga(page);
          await adjuntarTexto('Limpieza', `reserva ${reserva || '-'} eliminada, cotizacion ${id || '-'} borrada`);
        });
      } finally {
        if (agenciaTocada) {
          await paso(page, `Restaurar la agencia ${M.agencia.id}: sin markup propio y sin cotizacion manual`, async () => {
            await admin.guardarAgencia(M.agencia.id, null, null);
            // Se pasa por la del pais antes de apagarla: la fila queda con Deleted=1 y el API la sigue leyendo.
            await admin.guardarTipoDeCambio(M.agencia.id, true, CAMBIO_DEL_PAIS);
            await admin.guardarTipoDeCambio(M.agencia.id, false);
          });
        }
      }
    }
  });
});
