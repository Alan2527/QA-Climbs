import { test, expect, Page } from '@playwright/test';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { paso, adjuntarTexto, fechaDeBusqueda, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';
import { reservarServicioEnElPortalNuevo } from '../comun/precondiciones';
import { Importe, armarCircuitoYEmitir, reservaDeCircuito, reservarHotelEnElPortalNuevo } from './reservas-comun';

/**
 * RESERVAS — app nueva (ClimbsApp). Anulacion de una reserva emitida.
 *
 * Los mismos tres tests que tests/bloque-b/anulacion.spec.ts, con los mismos titulos: que
 * una reserva emitida se pueda cancelar desde el portal y que el portal lo refleje.
 *
 * La ventana de cancelacion no es la misma en los dos rieles: en el clasico (servicio,
 * hotel) vence 15 dias antes del servicio, asi que se reserva a 30 dias; en circuitos
 * vence 48 hs antes del inicio, y alcanza con 7. Ninguno deja una reserva viva en QA: la
 * que emite cada test es la que despues cancela.
 */
test.describe('Reservas — anulacion', () => {
  const AVISO_DE_GASTOS = 'puede llegar a incurrir en gastos';
  const CANCELADA = 'Reserva cancelada';

  test.beforeEach(() => reiniciarNumeracionDePasos());

  async function cancelarYVerificar(page: Page, opciones: {
    codigo: string; solapa: 'Carrito de compras' | 'Multidestino'; referencia: string; conHoteleria: boolean;
  }) {
    const { codigo, solapa, referencia } = opciones;
    const portal = new PortalNuevoPage(page);
    const estado = page.locator('main');
    const cancelar = page.locator('main').getByRole('button', { name: 'Cancelar reserva', exact: true });
    const modal = page.getByRole('dialog', { name: 'Cancelación de la reserva' });

    await paso(page, 'Abrir el detalle y verificar que la reserva se pueda cancelar', async () => {
      await portal.abrirDetalleDeLaReserva(await portal.filaDelHistorial(codigo, solapa), codigo);
      await conResaltado(page, estado, 'Boton de cancelar disponible', async () => {
        await expect(cancelar, 'Una reserva recien emitida tiene que ofrecer la opcion de cancelarla').toBeVisible({ timeout: 30_000 });
      });
      await conResaltado(page, estado, 'Reserva no cancelada', async () => {
        await expect(estado, 'La reserva recien emitida no puede figurar como cancelada').not.toContainText(CANCELADA);
      });
    });

    await paso(page, 'Abrir el modal y verificar que avise de los gastos antes de aceptar', async () => {
      await cancelar.click();
      await expect(modal, 'El boton tiene que abrir el modal de cancelacion').toBeVisible({ timeout: 30_000 });
      // El modal abre con "Cargando…" y despues muestra el aviso y el tilde.
      await expect(modal.getByRole('checkbox', { name: '¿Desea cancelarla de todas formas?' })).toBeVisible({ timeout: 30_000 });
      const texto = (await modal.innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto('Modal de cancelacion', texto);
      await conResaltado(page, modal, 'Aviso de gastos', () => {
        expect(texto, 'El modal tiene que advertir que cancelar puede incurrir en gastos segun las politicas de cancelacion').toContain(AVISO_DE_GASTOS);
      });
      // Aceptar arranca deshabilitado y lo habilita el tilde: es la unica barrera antes de
      // una accion que no se puede deshacer.
      const aceptar = modal.getByRole('contentinfo').getByRole('button', { name: 'Cancelar reserva' });
      await conResaltado(page, modal, 'Aceptar deshabilitado sin tildar', async () => {
        await expect(aceptar, 'Sin tildar la confirmacion, Aceptar tiene que estar deshabilitado').toBeDisabled();
      });
      await modal.getByRole('checkbox', { name: '¿Desea cancelarla de todas formas?' }).check();
      await conResaltado(page, modal, 'Aceptar habilitado al tildar', async () => {
        await expect(aceptar, 'Tildada la confirmacion, Aceptar tiene que habilitarse').toBeEnabled({ timeout: 15_000 });
      });
    });

    await paso(page, 'Cancelar la reserva y verificar que caiga cancelada en el historial', async () => {
      await modal.getByRole('contentinfo').getByRole('button', { name: 'Cancelar reserva' }).click();
      // Aceptar lleva al historial, como en el portal actual.
      await expect(page, 'Cancelar tiene que volver al historial').toHaveURL(/\/site\/bookings$/, { timeout: 120_000 });
      const fila = await portal.filaDelHistorial(codigo, solapa);
      const texto = (await fila.innerText()).replace(/\s+/g, ' ').trim();
      await adjuntarTexto('Fila del historial', texto);
      await conResaltado(page, fila, 'Estado en el historial', () => {
        expect(texto, 'El historial tiene que mostrar la reserva como cancelada').toContain(CANCELADA);
      });
      await conResaltado(page, fila, 'Referencia en el historial', () => {
        expect(texto, 'Cancelada, la reserva tiene que conservar su referencia').toContain(referencia);
      });
    });

    await paso(page, 'Volver al detalle y verificar que ya no se pueda cancelar', async () => {
      await portal.abrirDetalleDeLaReserva(await portal.filaDelHistorial(codigo, solapa), codigo);
      await adjuntarTexto('Detalle de la reserva cancelada', (await estado.innerText()).replace(/\s+/g, ' '));
      await conResaltado(page, estado, 'Estado cancelada en el detalle', async () => {
        await expect(estado, 'Cancelada, el detalle tiene que mostrarla como cancelada').toContainText(CANCELADA);
      });
      // La tarjeta "Elementos cancelados" lista hoteles: solo aplica si la reserva tiene hoteleria.
      if (opciones.conHoteleria) {
        await conResaltado(page, estado, 'Elementos cancelados en el detalle', async () => {
          await expect(estado, 'Cancelada, el detalle tiene que listar los elementos cancelados').toContainText('Elementos cancelados');
        });
      }
      await conResaltado(page, estado, 'Sin opcion de volver a cancelar', async () => {
        await expect(cancelar, 'Una reserva cancelada no tiene que ofrecer la opcion de cancelarla otra vez').toBeHidden({ timeout: 30_000 });
      });
    });
  }

  test('Servicio: una reserva emitida se puede cancelar y el portal lo refleja', async ({ page }) => {
    test.setTimeout(600_000);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    // A 30 dias: el riel clasico vence 15 dias antes del servicio.
    const reserva = await reservarServicioEnElPortalNuevo(page, sello, 30);
    await adjuntarTexto('Reserva emitida para anular', reserva.codigo);
    await cancelarYVerificar(page, { codigo: reserva.codigo, solapa: 'Carrito de compras', referencia: reserva.referencia, conHoteleria: false });
  });

  test('Hotel: una reserva emitida se puede cancelar y el portal lo refleja', async ({ page }) => {
    test.setTimeout(600_000);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const referencia = `AUTO-QA ${sello}`;
    let codigo = '';
    await paso(page, 'Reservar una habitacion y emitirla', async () => {
      codigo = await reservarHotelEnElPortalNuevo(page, sello, { diasExtra: 30, referencia, observaciones: `Anulacion de regresion automatica ${sello}. No operar.` });
      await adjuntarTexto('Reserva emitida para anular', codigo);
    });
    await cancelarYVerificar(page, { codigo, solapa: 'Carrito de compras', referencia, conHoteleria: true });
  });

  test('Multidestino: una reserva emitida se puede cancelar y el portal lo refleja', async ({ page }) => {
    test.setTimeout(600_000);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    // A 7 dias alcanza: el riel de circuitos vence 48 hs antes del inicio.
    const fecha = fechaDeBusqueda();
    const reserva = {
      ...reservaDeCircuito(sello, fecha),
      item: 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)',
      observaciones: `Anulacion de regresion automatica ${sello}. No operar.`,
    };
    const importes: Record<string, Importe> = {};
    const codigo = await armarCircuitoYEmitir(page, { solapa: 'MULTIDESTINO', viaje: reserva.item, fecha, sello, reserva, importes });
    await cancelarYVerificar(page, { codigo, solapa: 'Multidestino', referencia: reserva.referencia, conHoteleria: true });
  });

  // Serie: no tiene caso de anulacion (las Series no se cancelan desde el portal, confirmado
  // por Nicolas Angulo el 13/10/2026), igual que en la suite actual.
});
