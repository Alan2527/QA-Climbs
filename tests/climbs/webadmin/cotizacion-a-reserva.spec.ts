import { test, expect } from '@playwright/test';
import { CotizacionGrupoNuevaPage } from '../../../pages/climbs/cotizacion-grupo.page';
import { BackofficeNuevoPage } from '../../../pages/climbs/backoffice.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, formatearFecha } from '../../../utils/pasos';
import { abrirSesionDeOtraAgencia } from '../comun/otra-agencia';
import { cancelarReservaEnElPortal } from '../comun/cancelar-reserva';
import candidatos from '../../../data/candidatos.json';

const M = candidatos.markups;
const P = candidatos.tarifario.paquetes;
const SALTO = String.fromCharCode(10);

/**
 * WEBADMIN — app nueva (ClimbsApp). De cotizacion de grupo a reserva.
 *
 * El mismo test que tests/webadmin/cotizacion-a-reserva.spec.ts, con el mismo titulo. En la app
 * nueva la cotizacion de grupo vive en el Backoffice (Ventas › Cotizaciones de grupos): "Crear
 * grupo", con el paquete AUTO-QA 5059 como itinerario (trae sus destinos y servicios). "Crear
 * reserva" + "Aceptar" genera la reserva, que llega a la solapa Grupos de la bandeja.
 *
 * Al terminar borra la cotizacion (Mas acciones › Borrar). La reserva no se puede borrar desde
 * el Backoffice nuevo: se la cancela como la agencia, desde su detalle en el portal.
 */
test.describe('WebAdmin — cotizacion de grupo a reserva', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  test('Una cotizacion de grupo se convierte en reserva y llega a la bandeja del BO', async ({ page, browser, baseURL }) => {
    test.setTimeout(600_000);
    const cotizacion = new CotizacionGrupoNuevaPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const datos = {
      agencia: M.agencia.nombre, sucursal: 'Argentina', itinerario: P.nombre, referencia: `AUTO-QA ${sello}`,
      titulo: `AUTO-QA NO TOCAR - Cotizacion ${sello}`, pax: 2, sgl: 0, dbl: 1, tpl: 0, inicio: formatearFecha(fechaDeBusqueda(30)),
    };
    let id = 0;
    let reserva = 0;

    try {
      await paso(page, 'Crear la cotizacion de grupo con el paquete AUTO-QA como itinerario', async () => {
        await cotizacion.nueva();
        id = await cotizacion.crear(datos);
        await adjuntarTexto('Cotizacion creada', `ID ${id}${SALTO}${JSON.stringify(datos, null, 2)}`);
        expect(id, 'Guardar tiene que llevar a la ficha de la cotizacion').toBeGreaterThan(0);
      });

      await paso(page, 'El itinerario arma los destinos y los servicios del paquete', async () => {
        await cotizacion.abrir(id);
        const destinos = await cotizacion.filas('Destinos');
        const servicios = await cotizacion.filas('Servicios / Restaurantes');
        await adjuntarTexto('Destinos', destinos.map((f) => f.join(' | ')).join(SALTO));
        await adjuntarTexto('Servicios', servicios.map((f) => f.join(' | ')).join(SALTO));
        for (const c of P.ciudades) {
          expect(destinos.some((f) => f.join(' ').includes(c.nombre)), `La cotizacion tiene que tener el destino ${c.nombre}`).toBe(true);
        }
        // Se cuentan por fila con fecha y no por nombre (la Cena Show 163 tiene el detalle despublicado).
        expect(servicios.filter((f) => /\d{2}\/\d{2}\/\d{4}/.test(f.join(' '))).length,
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
        await expect(cotizacion.botonCrearReserva, 'Con reserva creada, "Crear reserva" tiene que quedar deshabilitado').toBeDisabled();
        await expect(cotizacion.botonCrearReserva).toHaveAttribute('title', 'Ya existe una reserva para esta cotización');
      });

      await paso(page, 'BO: la reserva llega a la solapa Grupos de la bandeja', async () => {
        const bo = new BackofficeNuevoPage(page);
        const fila = await bo.filaDeLaBandeja(String(reserva), 'Grupos');
        const texto = ((await fila.innerText()) ?? '').replace(/\s+/g, ' ');
        await adjuntarTexto('Fila de la reserva en el BO', texto);
        expect(texto, 'La fila tiene que mostrar el titulo de la cotizacion').toContain(datos.titulo);
        expect(texto.toUpperCase(), 'La fila tiene que mostrar la agencia').toContain(M.agencia.nombre.toUpperCase());
      });
    } finally {
      await paso(page, 'Limpiar: cancelar la reserva y borrar la cotizacion', async () => {
        const notas: string[] = [];
        if (reserva) {
          const { contexto, pagina } = await abrirSesionDeOtraAgencia(browser, baseURL);
          notas.push(await cancelarReservaEnElPortal(pagina, reserva).catch((e) => `No se pudo cancelar la reserva ${reserva}: ${String(e).split('\n')[0]}`));
          await contexto.close();
        }
        if (id) {
          await cotizacion.borrar(datos.referencia);
          notas.push(`Cotizacion ${id} borrada`);
        }
        await adjuntarTexto('Limpieza', notas.join(SALTO) || 'nada que limpiar');
      });
    }
  });
});
