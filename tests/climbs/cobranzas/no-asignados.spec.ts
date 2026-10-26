import { test, expect } from '@playwright/test';
import { NoAsignadosNuevaPage } from '../../../pages/climbs/no-asignados.page';
import { FacturaProveedorNuevaPage } from '../../../pages/climbs/factura-proveedor.page';
import { OrdenDePagoNuevaPage } from '../../../pages/climbs/orden-de-pago.page';
import { paso, adjuntarTexto, formatearFecha, numeroDelFile, reiniciarNumeracionDePasos, importeANumero } from '../../../utils/pasos';
import { reservarServicioYGenerarFile, armarFacturaAprobada, cajaDeRegresion, PROVEEDOR_DE_REGRESION } from '../comun/precondiciones';

/**
 * COBRANZAS — app nueva (ClimbsApp). Bandejas de no asignados.
 *
 * Los mismos dos tests que tests/bloque-c/no-asignados.spec.ts, con los mismos titulos:
 * lo pendiente tiene que figurar en su bandeja y dejar de figurar al imputarlo.
 * - Servicios sin asignar: el item figura mientras no tenga factura de proveedor imputada.
 * - Facturas sin asignar: la factura aprobada y sin imputar figura; imputada, sale.
 * - Ordenes de pago sin asignar: la orden aprobada sin imputar figura; imputada, sale.
 *
 * Las bandejas se usan como vienen; solo la de servicios se corre hasta la fecha del
 * servicio, que esta a futuro, como haria una persona.
 */
const coma = (x: number) => x.toFixed(2).replace('.', ',');

test.describe('Cobranzas — bandejas de no asignados', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('No asignados: el item y la factura figuran pendientes y salen al imputar', async ({ page }) => {
    test.setTimeout(900_000);
    const bandejas = new NoAsignadosNuevaPage(page);
    const factura = new FacturaProveedorNuevaPage(page);
    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const numero = [ahora.getDate(), ahora.getHours(), ahora.getMinutes(), ahora.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');

    const pre = await reservarServicioYGenerarFile(page, sello);
    const total = pre.costoDelItem.valor ?? 0;
    // La bandeja de servicios muestra el numero del file sin prefijo.
    const numeroDeFile = String(Number(numeroDelFile(pre.fileCode) || '0'));
    let idDeLaFactura = '';

    await paso(page, 'El item del file recien generado figura en la bandeja de servicios sin asignar', async () => {
      await bandejas.abrir('items');
      await bandejas.filtrarHasta(pre.fecha);
      const figura = await bandejas.figura(numeroDeFile);
      await adjuntarTexto('Fila del item en la bandeja', await bandejas.textoDeLaFila(numeroDeFile));
      expect(figura, `El item del file ${pre.fileCode}, sin factura de proveedor, tiene que figurar como no asignado`).toBe(true);
    });

    await paso(page, 'Cargar la factura del proveedor y aprobarla sin imputar', async () => {
      await factura.abrirNueva();
      await factura.elegirSucursal('Argentina');
      await factura.elegirProveedor(PROVEEDOR_DE_REGRESION.termino, PROVEEDOR_DE_REGRESION.razonSocial);
      await factura.campo('type').selectOption({ label: 'Factura A' });
      await factura.campo('pos').fill('0001');
      await factura.campo('number').fill(numero);
      await factura.campo('currency').selectOption({ label: pre.costoDelItem.moneda });
      await factura.campo('nontaxable').fill(coma(total));
      await factura.campo('nontaxable').press('Tab');
      await factura.campo('comment').fill(`Factura de regresion automatica ${sello}. No operar.`);
      idDeLaFactura = await factura.guardar();
      await page.getByRole('button', { name: 'Ajustar & aprobar' }).click();
      await expect(page.getByText('Aprobada', { exact: true }), 'La factura tiene que quedar aprobada sin imputar').toBeVisible({ timeout: 60_000 });
      await adjuntarTexto('Factura cargada', `0001-${numero} (id ${idDeLaFactura}) · ${pre.costoDelItem.moneda} ${coma(total)} · file ${pre.fileCode}`);
    });

    await paso(page, 'La factura aprobada y sin imputar figura en la bandeja de facturas sin asignar', async () => {
      await bandejas.abrir('invoices');
      const figura = await bandejas.figura(numero);
      await adjuntarTexto('Fila de la factura en la bandeja', await bandejas.textoDeLaFila(numero));
      expect(figura, `La factura ${numero}, aprobada y sin imputar, tiene que figurar como no asignada`).toBe(true);
    });

    await paso(page, 'Imputar la factura al item del file', async () => {
      await page.goto(`/finance/supplier-invoices/${idDeLaFactura}`);
      await factura.buscarPendiente(pre.fileCode);
      const fila = factura.filaPendiente(pre.fileCode);
      await expect(fila, `Aprobada, la factura tiene que seguir ofreciendo el item del file ${pre.fileCode} para imputar`).toBeVisible({ timeout: 60_000 });
      await factura.asignar(await factura.abrirAsignacion(fila), coma(total), `AUTO-QA ${sello.slice(-8)}`);
      await expect(factura.filaAsignada(pre.fileCode), 'El item tiene que quedar asignado a la factura').toBeVisible({ timeout: 60_000 });
    });

    await paso(page, 'Imputada, la factura sale de la bandeja de facturas sin asignar', async () => {
      await bandejas.abrir('invoices');
      expect(await bandejas.figura(numero), `Imputada, la factura ${numero} no puede seguir figurando como no asignada`).toBe(false);
    });

    await paso(page, 'Imputado, el item sale de la bandeja de servicios sin asignar', async () => {
      await bandejas.abrir('items');
      await bandejas.filtrarHasta(pre.fecha);
      expect(await bandejas.figura(numeroDeFile), `Con factura imputada, el item del file ${pre.fileCode} no puede seguir como no asignado`).toBe(false);
    });
  });

  test('No asignados: la orden de pago aprobada figura sin imputar y sale al imputarla', async ({ page }) => {
    test.setTimeout(900_000);
    const bandejas = new NoAsignadosNuevaPage(page);
    const orden = new OrdenDePagoNuevaPage(page);
    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);

    const factura = await armarFacturaAprobada(page, sello, ahora, await reservarServicioYGenerarFile(page, sello));
    const total = factura.total;
    let idDeLaOrden = '';
    let codigo = '';
    const pendienteDeLaOrden = async () => importeANumero((await orden.pendienteDeAsignacion().innerText()).split(':')[1] ?? '') ?? 0;

    await paso(page, 'Cargar la orden de pago del proveedor y aprobarla sin imputar', async () => {
      await orden.abrirNueva();
      if (!(await orden.opcionElegida('branch')).includes('Argentina')) await orden.campo('branch').selectOption({ label: 'Argentina' });
      await orden.elegirProveedor(PROVEEDOR_DE_REGRESION.termino, PROVEEDOR_DE_REGRESION.razonSocial);
      await orden.campo('currency').selectOption({ label: factura.moneda });
      await orden.campo('cf-0').selectOption({ label: cajaDeRegresion(factura.moneda) });
      await orden.campo('amount-0').fill(coma(total));
      await orden.campo('amount-0').press('Tab');
      await orden.campo('detail').fill(`Orden de pago de regresion automatica ${sello}. No operar.`);
      idDeLaOrden = await orden.guardar();
      codigo = (await orden.campo('code').inputValue()).trim();
      await orden.aprobar(fechaDeHoy, `AUTOQAN${sello.slice(-7)}`);
      await expect(page.getByText('Pago', { exact: true }), 'Aprobada y con el recibo aplicado, la orden tiene que quedar en estado Pago').toBeVisible({ timeout: 60_000 });
      expect(await pendienteDeLaOrden(), 'Aprobada sin imputar, el pendiente de asignacion tiene que ser el total de la orden').toBe(total);
      await adjuntarTexto('Orden de pago cargada', `${codigo} (id ${idDeLaOrden}) · ${factura.moneda} ${coma(total)} · factura ${factura.puntoDeVenta}-${factura.numeroDeFactura}`);
    });

    await paso(page, 'La orden aprobada y sin imputar figura en la bandeja de ordenes de pago sin asignar', async () => {
      await bandejas.abrir('pay-orders');
      const figura = await bandejas.figura(codigo);
      await adjuntarTexto('Fila de la orden en la bandeja', await bandejas.textoDeLaFila(codigo));
      expect(figura, `La orden ${codigo}, aprobada y sin imputar, tiene que figurar como no asignada`).toBe(true);
    });

    await paso(page, 'Imputar la orden ya aprobada a la factura del proveedor', async () => {
      await page.goto(`/finance/pay-orders/${idDeLaOrden}`);
      const fila = orden.filaPendiente(factura.numeroDeFactura);
      await expect(fila, `Aprobada, la orden ${codigo} tiene que seguir ofreciendo la factura ${factura.puntoDeVenta}-${factura.numeroDeFactura} para imputar`)
        .toBeVisible({ timeout: 60_000 });
      await orden.asignar(await orden.abrirAsignacion(fila), coma(total), `AUTO-QA ${sello.slice(-8)}`);
      await expect.poll(pendienteDeLaOrden, { message: 'Imputada la orden entera, no tiene que quedar nada pendiente de asignacion', timeout: 30_000 }).toBe(0);
    });

    await paso(page, 'Imputada, la orden sale de la bandeja de ordenes de pago sin asignar', async () => {
      await bandejas.abrir('pay-orders');
      expect(await bandejas.figura(codigo), `Imputada, la orden ${codigo} no puede seguir figurando como no asignada`).toBe(false);
    });
  });
});
