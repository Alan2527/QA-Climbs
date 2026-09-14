import { test, expect } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { FacturaProveedorPage } from '../../pages/factura-proveedor.page';
import { NoAsignadosPage } from '../../pages/no-asignados.page';
import {
  paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado, formatearFecha,
} from '../../utils/pasos';
import { SALTO, aFormatoBO, reservarServicioYGenerarFile } from './cobranzas-comun';

/**
 * BLOQUE C — Bandejas de no asignados.
 *
 * No viene de una historia: es parte de lo que el PM no pidio y conviene sumar.
 * Son bandejas de "lo que falta hacer", y lo unico que vale la pena exigirles es
 * que se vacien cuando el trabajo se hace: lo pendiente tiene que figurar, y dejar
 * de figurar al imputarlo.
 *
 * Cubre dos de las tres:
 *
 * - **Items de file sin factura** (`administration/unassigned-items`): el item
 *   figura mientras no tenga factura de proveedor imputada (`FITSI == null`,
 *   `FileItemSvc.cs:1376`).
 * - **Facturas sin imputar** (`administration/unassigned-invoices`): la factura
 *   figura si esta publicada y sin imputar, y es de un proveedor de Costos
 *   (`FileItemSvc.cs:1639`). Se publica al aprobarla, por eso **se aprueba antes de
 *   imputar**, al reves que el eslabon 1: en ese orden nunca entraria a la bandeja.
 *
 * La tercera, ordenes de pago sin imputar, queda afuera por ahora: una orden
 * aprobada restringe la imputacion (`PayOrders/Detail.aspx.cs:350`) y hay que
 * medir primero si se puede sacar de la bandeja sin pasar por la caja diaria.
 *
 * Deja en QA lo mismo que el eslabon 1: un file y una factura aprobada e imputada.
 */
test.describe('Cobranzas — bandejas de no asignados', () => {

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  test('No asignados: el item y la factura figuran pendientes y salen al imputar', async ({ page }) => {
    test.setTimeout(900_000);

    const factura = new FacturaProveedorPage(page);
    const bandejas = new NoAsignadosPage(page);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const numero = [ahora.getDate(), ahora.getHours(), ahora.getMinutes(), ahora.getSeconds()]
      .map((n) => String(n).padStart(2, '0')).join('');

    const pre = await reservarServicioYGenerarFile(page, sello);
    const total = pre.costoDelItem.valor ?? 0;
    // La bandeja de items muestra el numero del file sin prefijo ni ceros ni
    // sufijo (FILE NUMBER 29898 para AM-0000029898-01, UnassignedItems/Default.aspx:195):
    // buscando el codigo completo, la grilla contesta "Sin resultados".
    const numeroDeFile = String(Number(pre.fileCode.match(/\d{6,}/)?.[0] ?? '0'));
    let idDeLaFactura = '';
    // La bandeja de facturas filtra por fecha de creacion hasta hoy a las 00:00:
    // la factura de este test, creada hoy, sale recien con el "Hasta" en manana.
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    const hastaFacturas = formatearFecha(manana);

    await paso(page, 'El item del file recien generado figura en la bandeja de items no asignados', async () => {
      await bandejas.abrirItems(pre.fechaDelServicio);
      const figura = await bandejas.figura(bandejas.tablaDeItems, numeroDeFile);
      await adjuntarTexto('Fila del item en la bandeja', await bandejas.textoDeLaFila(bandejas.tablaDeItems, numeroDeFile));
      await conResaltado(page, page.locator(bandejas.tablaDeItems), 'Item pendiente', () => {
        expect(figura, `El item del file ${pre.fileCode}, sin factura de proveedor, tiene que figurar como no asignado`)
          .toBe(true);
      });
    });

    await paso(page, 'Cargar la factura del proveedor y aprobarla sin imputar', async () => {
      await factura.irABandejaDeFacturas();
      await factura.nuevaFactura();
      await factura.elegirSucursal('Argentina');
      await factura.elegirProveedor('GRUPO SUMMA', 'GRUPO SUMMA SRL');
      await page.locator(factura.comboTipo).selectOption({ label: 'Factura A' });
      await page.locator(factura.campoPuntoDeVenta).fill('0001');
      await page.locator(factura.campoNumero).fill(numero);
      await page.locator(factura.comboMoneda).selectOption({ label: pre.costoDelItem.moneda });
      await factura.cargarImporte(aFormatoBO(total));
      await page.locator(factura.campoComentario).fill(`Factura de regresion automatica ${sello}. No operar.`);

      idDeLaFactura = await factura.guardar();
      expect(idDeLaFactura, `La factura tiene que guardarse. El BO dijo: "${await factura.mensajeDeError()}"`)
        .toMatch(/^\d+$/);

      await factura.aprobar();
      expect(await factura.estaAprobada(), 'La factura tiene que quedar aprobada sin imputar').toBe(true);
      await adjuntarTexto('Factura cargada', [
        `Comprobante: 0001-${numero} (id ${idDeLaFactura})`,
        `Total: ${pre.costoDelItem.moneda} ${aFormatoBO(total)}`,
        `File: ${pre.fileCode}`,
      ].join(SALTO));
    });

    await paso(page, 'La factura aprobada y sin imputar figura en la bandeja de facturas no asignadas', async () => {
      await bandejas.abrirFacturas();
      await bandejas.filtrarHasta(hastaFacturas, bandejas.tablaDeFacturas);
      const figura = await bandejas.figura(bandejas.tablaDeFacturas, numero);
      await adjuntarTexto('Fila de la factura en la bandeja', await bandejas.textoDeLaFila(bandejas.tablaDeFacturas, numero));
      await conResaltado(page, page.locator(bandejas.tablaDeFacturas), 'Factura pendiente', () => {
        expect(figura, `La factura ${numero}, aprobada y sin imputar, tiene que figurar como no asignada`)
          .toBe(true);
      });
    });

    await paso(page, 'Imputar la factura al item del file', async () => {
      await factura.abrirPorId(idDeLaFactura);
      await factura.buscarPendiente(pre.fileCode);
      const fila = factura.filaPendiente(pre.fileCode);
      await expect(fila, `El item del file ${pre.fileCode} tiene que figurar entre los pendientes de imputar`)
        .toBeVisible({ timeout: 60_000 });
      await factura.abrirAsignacion(fila);
      await factura.imputar(aFormatoBO(total), `AUTO-QA ${sello.slice(-8)}`);
    });

    await paso(page, 'Imputada, la factura sale de la bandeja de facturas no asignadas', async () => {
      await bandejas.abrirFacturas();
      await bandejas.filtrarHasta(hastaFacturas, bandejas.tablaDeFacturas);
      const figura = await bandejas.figura(bandejas.tablaDeFacturas, numero);
      await conResaltado(page, page.locator(bandejas.tablaDeFacturas), 'Factura imputada', () => {
        expect(figura, `Imputada, la factura ${numero} no puede seguir figurando como no asignada`).toBe(false);
      });
    });

    await paso(page, 'Imputado, el item sale de la bandeja de items no asignados', async () => {
      await bandejas.abrirItems(pre.fechaDelServicio);
      const figura = await bandejas.figura(bandejas.tablaDeItems, numeroDeFile);
      await conResaltado(page, page.locator(bandejas.tablaDeItems), 'Item imputado', () => {
        expect(figura, `Con factura imputada, el item del file ${pre.fileCode} no puede seguir como no asignado`)
          .toBe(false);
      });
    });
  });

});
