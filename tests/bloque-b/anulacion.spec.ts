import { test, expect, Page, Locator } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage } from '../../pages/carrito.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, fechaDeBusqueda, formatearFecha,
  resaltarYCapturar, reiniciarNumeracionDePasos,
} from '../../utils/pasos';

/**
 * BLOQUE B — anulacion de una reserva emitida.
 *
 * Los cuatro flujos emiten y verifican que los datos lleguen al BO. Este cubre lo
 * que faltaba del otro lado: que una reserva emitida se pueda **cancelar** y que
 * el portal lo refleje.
 *
 * Archivo aparte para no editar los cuatro flujos, que estan terminados.
 *
 * A diferencia de ellos, este test **no deja una reserva viva en QA**: la que
 * emite es la que despues cancela.
 *
 * Referencias:
 *   Online/BookingHistoryDetail.aspx:583 -> lnkCancelBook, visible solo si la
 *     reserva no esta confirmada ni cancelada (BookingHistoryDetail.aspx.cs:222)
 *   Online/Module/CancelBookControl.ascx -> modal-bookcancel, chkTerms, btnCancelBook
 *
 * El portal tiene selector de idioma pero **no tiene tema oscuro**: no aplica esa
 * consideracion transversal.
 */
test.describe('Reservas — anulacion', () => {

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  async function conResaltado(
    page: Page, locator: Locator, etiqueta: string, fn: () => void | Promise<void>,
  ) {
    try {
      await fn();
    } catch (error) {
      await resaltarYCapturar(page, locator, `FALLA: ${etiqueta}`);
      expect.soft(false, (error as Error).message).toBe(true);
    }
  }

  test('Una reserva emitida se puede cancelar y el portal lo refleja', async ({ page }) => {
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const servicio = new ServicioPage(page);
    const carrito = new CarritoPage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

    /**
     * A **30 dias**, no a los 7 que usan los cuatro flujos.
     *
     * El riel clasico pone la fecha limite de cancelacion en **la fecha del
     * servicio menos 15 dias**. Reservando a 7 dias vista la reserva nace ya
     * dentro de la ventana de penalidad y el portal contesta "Esta reserva no
     * puede ser cancelada", que es la politica funcionando bien y no un defecto.
     * Medido en QA: las reservas a 7 dias quedan con ExpirationDate 27/08 cuando
     * el servicio es el 11/09.
     */
    const fecha = fechaDeBusqueda(30);

    const datos = {
      servicio: 'AUTO-QA NO TOCAR - Tigre y Delta',
      terminoDeBusqueda: 'Tigre y Delta',
      modalidad: 'Regular',
      fecha: formatearFecha(fecha),
      referencia: `AUTO-QA ${sello}`,
      observaciones: `Anulacion de regresion automatica ${sello}. No operar.`,
      cantidadPax: 0,
      avisoDeGastos: 'puede llegar a incurrir en gastos',
      avisoDeCancelada: 'Reserva cancelada',
    };

    let codigo = '';

    /**
     * El cartel de reserva cancelada.
     *
     * Acotado a lo visible: en la pantalla hay **otro elemento con la misma
     * frase**, oculto, asi que `getByText` a secas resuelve al equivocado y la
     * verificacion falla estando la reserva bien cancelada.
     */
    const avisoDeCancelada = page.getByText('Reserva cancelada', { exact: false })
      .filter({ visible: true }).first();

    await paso(page, 'Reservar un servicio y emitirlo', async () => {
      await carrito.vaciar();
      await inicio.abrir();
      const panel = await inicio.abrirSolapa('servicios');
      await servicio.buscar({
        panel, pais: 'Argentina', ciudad: 'Buenos Aires', tipo: 'Excursión', fecha,
      });
      await servicio.buscarPorNombre(datos.terminoDeBusqueda, datos.servicio);
      await servicio.abrirFicha(datos.servicio.slice(0, 24));

      const fila = page.locator('tr')
        .filter({ has: page.locator("select[id*='ddPax']") })
        .filter({ hasText: datos.modalidad }).first();
      await expect(
        fila,
        `La ficha tiene que ofrecer la modalidad ${datos.modalidad} para el ${datos.fecha}`,
      ).toBeVisible({ timeout: 30_000 });

      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      datos.cantidadPax = Number(texto.match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
      await fila.locator("select[id*='ddPax']").selectOption(String(datos.cantidadPax));
      await esperarFinDeCarga(page);
      await page.locator("[id$='lnkBookService']").first().click();
      await esperarFinDeCarga(page);

      await carrito.irAlCarrito();
      await carrito.crearReserva(datos.referencia, datos.observaciones);
      await carrito.asegurarPasajeros(datos.cantidadPax);
      for (let i = 0; i < datos.cantidadPax; i++) {
        await carrito.completarPasajero(i, {
          nombre: `Pasajero${i + 1}`,
          apellido: `Regresion${sello.slice(-6)}`,
          pasaporte: `QA${sello.slice(-8)}${i + 1}`,
          nacimiento: `0${i + 1}/03/1990`,
          nacionalidad: 'Argentina',
        });
      }
      await carrito.completarDatosDeLaReserva(
        datos.cantidadPax, datos.referencia, datos.observaciones,
      );
      await carrito.aceptarTerminos();

      codigo = await carrito.confirmarReserva();
      expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
        .toMatch(/^BO\d{8}$/);
      await adjuntarTexto('Reserva emitida para anular', codigo);
    });

    await paso(page, 'Abrir el detalle y verificar que la reserva se pueda cancelar', async () => {
      await page.locator("a[href*='BookingHistoryDetail.aspx?book=']")
        .filter({ hasText: codigo }).first().click();
      await page.waitForURL(/bookinghistorydetail/i, { timeout: 60_000 });
      await esperarFinDeCarga(page);

      // Solo se ofrece si la reserva no esta confirmada ni cancelada
      // (BookingHistoryDetail.aspx.cs:222). Recien emitida, tiene que estar.
      const cancelar = page.locator("[id$='lnkCancelBook']").first();
      await conResaltado(page, page.locator('body'), 'Boton de cancelar disponible', async () => {
        await expect(
          cancelar,
          'Una reserva recien emitida tiene que ofrecer la opcion de cancelarla',
        ).toBeVisible({ timeout: 30_000 });
      });

      // Y no tiene que estar ya cancelada. Se busca el span del PlaceHolder y no
      // el texto suelto: hay otro elemento con la misma frase que vive oculto y
      // matchearlo daria un falso positivo en los dos sentidos.
      await conResaltado(page, page.locator('body'), 'Reserva no cancelada', async () => {
        await expect(
          avisoDeCancelada,
          'La reserva recien emitida no puede figurar como cancelada',
        ).toBeHidden({ timeout: 15_000 });
      });
    });

    await paso(page, 'Abrir el modal y verificar que avise de los gastos antes de aceptar', async () => {
      await page.locator("[id$='lnkCancelBook']").first().click();
      const modal = page.locator('#modal-bookcancel');
      await expect(modal, 'El boton tiene que abrir el modal de cancelacion')
        .toBeVisible({ timeout: 30_000 });

      const texto = (await modal.innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto('Modal de cancelacion', texto);

      await conResaltado(page, modal, 'Aviso de gastos', () => {
        expect(texto,
          'El modal tiene que advertir que cancelar puede incurrir en gastos segun las ' +
          'politicas de cancelacion')
          .toContain(datos.avisoDeGastos);
      });

      // El Aceptar arranca deshabilitado y lo habilita el check: es la unica
      // barrera antes de una accion que no se puede deshacer.
      const aceptar = modal.locator("[id$='btnCancelBook']").first();
      await conResaltado(page, modal, 'Aceptar deshabilitado sin tildar', async () => {
        await expect(
          aceptar,
          'Sin tildar la confirmacion, Aceptar tiene que estar deshabilitado',
        ).toBeDisabled();
      });

      await modal.locator('#chkTerms').check();
      await conResaltado(page, modal, 'Aceptar habilitado al tildar', async () => {
        await expect(
          aceptar,
          'Tildada la confirmacion, Aceptar tiene que habilitarse',
        ).toBeEnabled({ timeout: 15_000 });
      });
    });

    await paso(page, 'Cancelar la reserva y verificar que caiga cancelada en el historial', async () => {
      // Aceptar **redirige al historial** (`CancelBookControl.ascx.cs:128`): no se
      // vuelve al detalle, asi que es ahi donde hay que mirar el resultado.
      await page.locator('#modal-bookcancel').locator("[id$='btnCancelBook']").first().click();
      await page.waitForURL(/bookinghistory/i, { timeout: 120_000 });
      await esperarFinDeCarga(page);

      // El historial tiene dos solapas y cual queda activa lo decide el
      // servidor: la reserva de un servicio vive en la primera.
      const solapa = page.locator("a[href='#tabBooking']").first();
      if (await solapa.count()) {
        await solapa.click();
        await esperarFinDeCarga(page);
      }

      const fila = page.locator('tr').filter({ hasText: codigo }).first();
      await expect(
        fila,
        `La reserva ${codigo} tiene que seguir figurando en el historial despues de cancelarla`,
      ).toBeVisible({ timeout: 60_000 });

      const texto = (await fila.innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto('Fila del historial', texto);

      await conResaltado(page, fila, 'Estado en el historial', () => {
        expect(texto, 'El historial tiene que mostrar la reserva como cancelada')
          .toContain(datos.avisoDeCancelada);
      });
      await conResaltado(page, fila, 'Referencia en el historial', () => {
        expect(texto, 'Cancelada, la reserva tiene que conservar su referencia')
          .toContain(datos.referencia);
      });
    });

    await paso(page, 'Volver al detalle y verificar que ya no se pueda cancelar', async () => {
      await page.locator("a[href*='BookingHistoryDetail.aspx?book=']")
        .filter({ hasText: codigo }).first().click();
      await page.waitForURL(/bookinghistorydetail/i, { timeout: 60_000 });
      await esperarFinDeCarga(page);

      // El detalle lo refleja como **"Elementos cancelados"**, no con el cartel de
      // reserva cancelada: lo que la cancelacion marca son los elementos, y el
      // flag `Canceled` de la reserva queda en cero. El historial deriva su
      // cartel de los elementos. Medido en QA sobre la reserva que cancela este
      // mismo test.
      await conResaltado(page, page.locator('body'), 'Elementos cancelados en el detalle', async () => {
        await expect(
          page.getByText('Elementos cancelados', { exact: false }).filter({ visible: true }).first(),
          'Cancelada, el detalle tiene que listar los elementos cancelados',
        ).toBeVisible({ timeout: 60_000 });
      });

      await conResaltado(page, page.locator('body'), 'Sin opcion de volver a cancelar', async () => {
        await expect(
          page.locator("[id$='lnkCancelBook']").first(),
          'Una reserva cancelada no tiene que ofrecer la opcion de cancelarla otra vez',
        ).toBeHidden({ timeout: 30_000 });
      });
    });
  });
});
