import { test, expect } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { FacturaProveedorPage } from '../../pages/factura-proveedor.page';
import { NoAsignadosPage } from '../../pages/no-asignados.page';
import { OrdenDePagoPage } from '../../pages/orden-de-pago.page';
import {
  paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado, formatearFecha,
} from '../../utils/pasos';
import {
  SALTO, CAJA_DE_REGRESION, aFormatoBO, importe, reservarServicioYGenerarFile,
} from './cobranzas-comun';
import { armarFacturaAprobada } from './cobranzas-armado';

/**
 * BLOQUE C — Bandejas de no asignados.
 *
 * No viene de una historia: es parte de lo que el PM no pidio y conviene sumar.
 * Son bandejas de "lo que falta hacer", y lo unico que vale la pena exigirles es
 * que se vacien cuando el trabajo se hace: lo pendiente tiene que figurar, y dejar
 * de figurar al imputarlo.
 *
 * Cubre las tres:
 *
 * - **Items de file sin factura** (`administration/unassigned-items`): el item
 *   figura mientras no tenga factura de proveedor imputada (`FITSI == null`,
 *   `FileItemSvc.cs:1376`).
 * - **Facturas sin imputar** (`administration/unassigned-invoices`): la factura
 *   figura si esta publicada y sin imputar, y es de un proveedor de Costos
 *   (`FileItemSvc.cs:1639`). Se publica al aprobarla, por eso **se aprueba antes de
 *   imputar**, al reves que el eslabon 1: en ese orden nunca entraria a la bandeja.
 *
 * - **Ordenes de pago sin imputar** (`administration/unassigned-payorders`): la
 *   orden figura si esta en estado Pago (30), sin ninguna factura imputada, con
 *   monto y de un proveedor de Costos (`FileItemSvc.cs:1621`). O sea que **tiene
 *   que aprobarse sin imputar**, y la imputacion se hace despues, sobre la orden
 *   ya aprobada. El codigo lo permite: aprobada, la orden sigue mostrando la
 *   grilla de pendientes, que solo se oculta si esta anulada
 *   (`PayOrderAllocationControl.ascx.cs:219`), y confirmar la imputacion valida
 *   importes, no el estado. Lo que `Detail.aspx.cs:350` restringe fuera de la caja
 *   diaria son las formas de pago, no la imputacion.
 *
 * Deja en QA: un file, una factura aprobada e imputada, y una orden de pago
 * aprobada e imputada con su movimiento en la caja de regresion.
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

    // La bandeja compara la fecha de creacion contra el Hasta a las 00:00 y deja afuera
    // lo creado hoy: es el hallazgo 9, confirmado como defecto por el PM. Hasta que se
    // corrija, `abrirFacturas` corre el Hasta a manana (ESQUIVAR_HALLAZGO_9).
    await paso(page, 'La factura aprobada y sin imputar figura en la bandeja de facturas no asignadas', async () => {
      await bandejas.abrirFacturas();
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

  test('No asignados: la orden de pago aprobada figura sin imputar y sale al imputarla', async ({ page }) => {
    test.setTimeout(900_000);

    const orden = new OrdenDePagoPage(page);
    const bandejas = new NoAsignadosPage(page);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);

    // La orden necesita una factura aprobada con saldo del mismo proveedor: sin
    // ella no hay a que imputarla despues.
    const factura = await armarFacturaAprobada(
      page, sello, ahora, await reservarServicioYGenerarFile(page, sello));
    const total = factura.total;
    let idDeLaOrden = '';
    let codigo = '';

    await paso(page, 'Cargar la orden de pago del proveedor y aprobarla sin imputar', async () => {
      await orden.irABandejaDeOrdenes();
      await orden.nuevaOrden();
      // La pantalla recuerda la ultima sucursal usada: se fija, no se supone.
      await orden.asegurarSucursal('Argentina');
      await orden.elegirProveedor('GRUPO SUMMA', 'GRUPO SUMMA SRL');
      await orden.elegirEnCombo(orden.comboMoneda, factura.moneda);
      await orden.elegirEnCombo(orden.comboCaja, CAJA_DE_REGRESION);
      await orden.cargarImporte(aFormatoBO(total));
      await page.locator(orden.campoDetalle)
        .fill(`Orden de pago de regresion automatica ${sello}. No operar.`);

      idDeLaOrden = await orden.guardar();
      expect(idDeLaOrden, `La orden tiene que guardarse. El BO dijo: "${await orden.mensajeDeError()}"`)
        .toMatch(/^\d+$/);
      codigo = (await page.locator(orden.campoCodigo).inputValue()).trim();

      await orden.aprobar(fechaDeHoy, `AUTOQAN${sello.slice(-7)}`);

      const estado = await orden.estado();
      await conResaltado(page, page.locator(orden.btnAprobar), 'Orden aprobada', () => {
        expect(estado.toUpperCase(), 'Aprobada y con el recibo aplicado, la orden tiene que quedar en estado pago')
          .toContain('PAGO');
      });

      const pendiente = importe(await orden.pendiente());
      await conResaltado(page, page.locator(orden.pendienteDeAsignacion), 'Pendiente sin imputar', () => {
        expect(pendiente.valor, 'Aprobada sin imputar, el pendiente de asignacion tiene que ser el total de la orden')
          .toBe(total);
      });

      await adjuntarTexto('Orden de pago cargada', [
        `Orden: ${codigo} (id ${idDeLaOrden})`,
        `Total: ${factura.moneda} ${aFormatoBO(total)}`,
        `Factura a imputar despues: ${factura.puntoDeVenta}-${factura.numeroDeFactura}`,
        `File: ${factura.fileCode}`,
      ].join(SALTO));
    });

    // Igual que la de facturas, esta bandeja compara la fecha de creacion contra el
    // "Hasta" a las 00:00 y una orden creada hoy no figura: es el hallazgo 9. Hasta que
    // se corrija, `abrirOrdenes` corre el Hasta a manana (ESQUIVAR_HALLAZGO_9).
    await paso(page, 'La orden aprobada y sin imputar figura en la bandeja de ordenes de pago no asignadas', async () => {
      await bandejas.abrirOrdenes();
      const figura = await bandejas.figura(bandejas.tablaDeOrdenes, codigo);
      await adjuntarTexto('Fila de la orden en la bandeja', await bandejas.textoDeLaFila(bandejas.tablaDeOrdenes, codigo));
      await conResaltado(page, page.locator(bandejas.tablaDeOrdenes), 'Orden pendiente', () => {
        expect(figura, `La orden ${codigo}, aprobada y sin imputar, tiene que figurar como no asignada`)
          .toBe(true);
      });
    });

    await paso(page, 'Imputar la orden ya aprobada a la factura del proveedor', async () => {
      await orden.abrirPorId(idDeLaOrden);

      const fila = orden.filaPendiente(factura.numeroDeFactura);
      await expect(
        fila,
        `Aprobada, la orden ${codigo} tiene que seguir ofreciendo la factura ` +
        `${factura.puntoDeVenta}-${factura.numeroDeFactura} entre las pendientes de imputar`,
      ).toBeVisible({ timeout: 60_000 });

      await orden.abrirAsignacion(fila);
      await orden.imputar(aFormatoBO(total), `AUTO-QA ${sello.slice(-8)}`);

      const pendiente = importe(await orden.pendiente());
      await adjuntarTexto('Pendiente despues de imputar', await orden.pendiente());
      await conResaltado(page, page.locator(orden.pendienteDeAsignacion), 'Pendiente despues de imputar', () => {
        expect(pendiente.valor, 'Imputada la orden entera, no tiene que quedar nada pendiente de asignacion')
          .toBe(0);
      });
    });

    await paso(page, 'Imputada, la orden sale de la bandeja de ordenes de pago no asignadas', async () => {
      await bandejas.abrirOrdenes();
      const figura = await bandejas.figura(bandejas.tablaDeOrdenes, codigo);
      await conResaltado(page, page.locator(bandejas.tablaDeOrdenes), 'Orden imputada', () => {
        expect(figura, `Imputada, la orden ${codigo} no puede seguir figurando como no asignada`).toBe(false);
      });
    });
  });

});
