import { test, expect } from '@playwright/test';
import { WebAdminCotizacionPage } from '../../pages/webadmin-cotizacion.page';
import { BackOfficePage } from '../../pages/backoffice.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, formatearFecha, esperarFinDeCarga } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const M = candidatos.markups;
const P = candidatos.tarifario.paquetes;
const SALTO = String.fromCharCode(10);

/**
 * WebAdmin — de cotizacion de grupo a reserva.
 *
 * Es el paso en que una cotizacion se convierte en venta: "Crear reserva" genera la
 * reserva (con su tour, grupo, ciudades y servicios) que despues se emite desde el BO.
 * Si se rompe, la cotizacion aprobada no llega a la bandeja de reservas.
 *
 * Arma una cotizacion nueva en cada corrida, para la agencia propia 6334, con el
 * paquete AUTO-QA 5059 como itinerario (trae sus destinos y servicios; elegirlo no lo
 * modifica). La convierte en reserva, verifica que la ficha quede bloqueada para una
 * segunda reserva y que la reserva llegue a la solapa Grupos de la bandeja del BO. Al
 * terminar elimina la reserva y borra la cotizacion (los dos, borrado logico).
 */
test.describe('WebAdmin — cotizacion de grupo a reserva', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  test('Una cotizacion de grupo se convierte en reserva y llega a la bandeja del BO', async ({ page }) => {
    test.setTimeout(600_000);
    const cotizacion = new WebAdminCotizacionPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const datos = {
      agencia: String(M.agencia.id), ejecutivo: String(M.usuario.webUserId), sucursal: '1',
      itinerario: String(P.id), referencia: `AUTO-QA ${sello}`,
      titulo: `AUTO-QA NO TOCAR - Cotizacion ${sello}`,
      pax: 2, sgl: 0, dbl: 1, tpl: 0, inicio: formatearFecha(fechaDeBusqueda(30)),
    };
    let id = 0;
    let reserva = 0;

    try {
      await paso(page, 'Crear la cotizacion de grupo con el paquete AUTO-QA como itinerario', async () => {
        await cotizacion.nueva();
        id = await cotizacion.crear(datos);
        await adjuntarTexto('Cotizacion creada', `ID ${id}${SALTO}${JSON.stringify(datos, null, 2)}`);
        expect(id, 'Guardar tiene que redirigir a la ficha de la cotizacion').toBeGreaterThan(0);
      });

      await paso(page, 'El itinerario arma los destinos y los servicios del paquete', async () => {
        await cotizacion.abrir(id, 'pnlBudgetDestination');
        const destinos = await cotizacion.filas('pnlBudgetDestination');
        const servicios = await cotizacion.filas('pnlBudgeService');
        await adjuntarTexto('Destinos', destinos.map((f) => f.join(' | ')).join(SALTO));
        await adjuntarTexto('Servicios', servicios.map((f) => f.join(' | ')).join(SALTO));
        for (const c of P.ciudades) {
          expect(destinos.some((f) => f.join(' ').includes(c.nombre)), `La cotizacion tiene que tener el destino ${c.nombre}`).toBe(true);
        }
        // Se cuentan por fila (destino y fecha) y no por nombre: la grilla deja vacio el
        // nombre de la Cena Show (163), que tiene el detalle despublicado en todos los idiomas.
        expect(servicios.filter((f) => /#\d+/.test(f.join(' ')) && /\d{2}\/\d{2}\/\d{4}/.test(f.join(' '))).length,
          `La cotizacion tiene que traer los ${P.serviciosIncluidos.length} servicios del paquete. Trae:` +
          SALTO + servicios.map((f) => f.join(' | ')).join(SALTO))
          .toBeGreaterThanOrEqual(P.serviciosIncluidos.length);
      });

      await paso(page, 'Crear la reserva desde la cotizacion', async () => {
        await cotizacion.abrir(id);
        reserva = await cotizacion.crearReserva();
        await adjuntarTexto('Reserva creada', String(reserva));
        expect(reserva, 'La ficha tiene que mostrar el numero de la reserva').toBeGreaterThan(0);
      });

      await paso(page, 'La cotizacion queda bloqueada para una segunda reserva', async () => {
        await cotizacion.abrir(id);
        await expect(page.locator(cotizacion.botonCrearReserva),
          'Con reserva creada, "Crear reserva" tiene que quedar deshabilitado').toHaveClass(/adminAnchorDisabled/);
      });

      await paso(page, 'BO: la reserva llega a la solapa Grupos de la bandeja', async () => {
        const bo = new BackOfficePage(page);
        await bo.ingresar(process.env.BO_USER!, process.env.BO_PASS!);
        await bo.irABandejaDeReservas();
        await page.locator("a[href='#tabGroups']").first().click();
        const enlace = page.locator(`#tblInboxGroups a[href*="/booking/files/inbox-detail/${reserva}/"]`).first();
        await expect(enlace, `La reserva ${reserva} tiene que aparecer en la solapa Grupos`).toBeAttached({ timeout: 60_000 });
        const fila = page.locator('#tblInboxGroups tr')
          .filter({ has: page.locator(`a[href*="/booking/files/inbox-detail/${reserva}/"]`) }).first();
        const texto = ((await fila.textContent()) ?? '').replace(/\s+/g, ' ');
        await adjuntarTexto('Fila de la reserva en el BO', texto);
        expect(texto, 'La fila tiene que mostrar el titulo de la cotizacion').toContain(datos.titulo);
        expect(texto.toUpperCase(), 'La fila tiene que mostrar la agencia').toContain(M.agencia.nombre.toUpperCase());
      });
    } finally {
      await paso(page, 'Limpiar: eliminar la reserva y borrar la cotizacion', async () => {
        if (reserva) await cotizacion.eliminarReserva(reserva);
        if (id) await cotizacion.borrar(id, datos.referencia);
        await esperarFinDeCarga(page);
        await adjuntarTexto('Limpieza', `reserva ${reserva || '-'} eliminada, cotizacion ${id || '-'} borrada`);
      });
    }
  });
});
