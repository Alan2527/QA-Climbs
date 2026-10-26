import { test, expect } from '@playwright/test';
import { FacturaProveedorNuevaPage } from '../../../pages/climbs/factura-proveedor.page';
import { OrdenDePagoNuevaPage } from '../../../pages/climbs/orden-de-pago.page';
import { paso, adjuntarTexto, formatearFecha, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { cajaDeRegresion, PROVEEDOR_DE_REGRESION } from '../comun/precondiciones';

/**
 * COBRANZAS — app nueva (ClimbsApp). Validaciones.
 *
 * El mismo test que tests/bloque-c/validaciones-bo.spec.ts, con el mismo titulo: el
 * Backoffice rechaza la factura de proveedor sin proveedor, con total cero o con numero
 * repetido; la orden de pago sin forma de pago, y la aprobacion con recibo de fecha futura.
 * No reserva ni genera file. Deja en QA una factura sin imputar y una orden sin aprobar.
 */
test.describe('Cobranzas', () => {
  // Prueba rechazos: los intentos no dejan datos, asi que reintentar es seguro.
  test.describe.configure({ retries: process.env.CI ? 2 : 0 });
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Validaciones: el BO rechaza lo que no debe permitir', async ({ page }) => {
    test.setTimeout(600_000);
    const factura = new FacturaProveedorNuevaPage(page);
    const orden = new OrdenDePagoNuevaPage(page);
    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const datos = {
      tipo: 'Factura A', sucursal: 'Argentina', moneda: 'USD', puntoDeVenta: '0001',
      numero: [ahora.getDate(), ahora.getHours(), ahora.getMinutes(), ahora.getSeconds()].map((n) => String(n).padStart(2, '0')).join(''),
      importe: '10,00',
    };

    /** Espera el aviso de rechazo y lo deja en el reporte. */
    const esperarAviso = async (mensaje: string, etiqueta: string) => {
      await expect(page.getByText(mensaje).first(), `El Backoffice tiene que avisar "${mensaje}"`).toBeVisible({ timeout: 30_000 });
      await adjuntarTexto(etiqueta, mensaje);
    };
    const completarFactura = async () => {
      await factura.elegirSucursal(datos.sucursal);
      await factura.elegirProveedor(PROVEEDOR_DE_REGRESION.termino, PROVEEDOR_DE_REGRESION.razonSocial);
      await factura.campo('type').selectOption({ label: datos.tipo });
      await factura.campo('pos').fill(datos.puntoDeVenta);
      await factura.campo('number').fill(datos.numero);
      await factura.campo('currency').selectOption({ label: datos.moneda });
    };
    const cargarImporte = async () => {
      await factura.campo('nontaxable').fill(datos.importe);
      await factura.campo('nontaxable').press('Tab');
    };
    const guardarFactura = () => page.getByRole('button', { name: 'Guardar', exact: true }).click();

    await paso(page, 'Abrir una factura de proveedor nueva: sin sucursal ni proveedor esta bloqueada', async () => {
      await factura.abrirNueva();
      await expect(factura.aviso(), 'Al abrir el alta tiene que pedir sucursal y proveedor').toBeVisible();
      await expect(factura.campo('number')).toHaveCount(0);
    });

    await paso(page, 'Sin proveedor no se puede guardar la factura', async () => {
      await factura.elegirSucursal(datos.sucursal);
      await expect(factura.aviso(), 'Con la sucursal y sin proveedor el aviso tiene que seguir').toBeVisible();
      await expect(page.getByRole('button', { name: 'Guardar', exact: true }), 'Sin proveedor no se tiene que ofrecer Guardar').toHaveCount(0);
      await expect(page, 'La pantalla no tiene que navegar si falta el proveedor').toHaveURL(/supplier-invoices\/new/);
    });

    await paso(page, 'Intentar guardar la factura con importe en cero', async () => {
      await completarFactura();
      await guardarFactura();
      await esperarAviso('El monto total no puede ser igual a 0', 'Factura con total cero');
      await expect(page, 'La pantalla no tiene que navegar si el total es cero').toHaveURL(/supplier-invoices\/new/);
    });

    let idDeLaFactura = '';
    await paso(page, 'Cargar el importe y guardar la factura', async () => {
      await cargarImporte();
      idDeLaFactura = await factura.guardar();
      expect(idDeLaFactura, 'Con el importe cargado, la factura tiene que poder guardarse').toMatch(/^\d+$/);
    });

    await paso(page, 'Intentar cargar otra factura con el mismo numero y proveedor', async () => {
      await factura.abrirNueva();
      await completarFactura();
      await cargarImporte();
      await guardarFactura();
      await esperarAviso('Ya existe un comprobante con el mismo número y el mismo proveedor', 'Factura con numero repetido');
      await expect(page, 'El comprobante repetido no tiene que crearse').toHaveURL(/supplier-invoices\/new/);
    });

    let idDeLaOrden = '';
    await paso(page, 'Intentar guardar una orden de pago sin forma de pago', async () => {
      await orden.abrirNueva();
      if (!(await orden.opcionElegida('branch')).includes(datos.sucursal)) await orden.campo('branch').selectOption({ label: datos.sucursal });
      await orden.elegirProveedor(PROVEEDOR_DE_REGRESION.termino, PROVEEDOR_DE_REGRESION.razonSocial);
      await orden.campo('currency').selectOption({ label: datos.moneda });
      await orden.campo('amount-0').fill(datos.importe);
      await orden.campo('amount-0').press('Tab');
      await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      await esperarAviso('Debe seleccionar Medios de Pago', 'Orden sin forma de pago');
      await expect(page, 'La orden no tiene que crearse sin forma de pago').toHaveURL(/pay-orders\/new/);
    });

    await paso(page, 'Guardar la orden e intentar cargar un recibo con fecha futura', async () => {
      await orden.campo('cf-0').selectOption({ label: cajaDeRegresion(datos.moneda) });
      idDeLaOrden = await orden.guardar();
      expect(idDeLaOrden, 'Con la caja elegida, la orden tiene que poder guardarse').toMatch(/^\d+$/);

      // Tres dias y no uno: el servidor puede estar en otro huso que la maquina del test.
      const futura = new Date(ahora); futura.setDate(futura.getDate() + 3);
      const fechaFutura = formatearFecha(futura);
      const fecha = orden.campo('receipt-date');
      await fecha.fill(fechaFutura);
      await fecha.press('Tab');
      // En la app nueva el campo no acepta una fecha posterior a hoy: la descarta al salir.
      // Es el rechazo de lo que en el BO actual se rechazaba al aprobar.
      const quedo = await fecha.inputValue();
      await adjuntarTexto('Recibo con fecha futura', `Se escribio ${fechaFutura}; el campo quedo en "${quedo}"`);
      expect(quedo, 'La fecha del recibo no puede ser posterior a hoy: el campo no tiene que aceptarla').not.toBe(fechaFutura);
      await expect(page.getByText('Pendiente', { exact: true }).first(), 'Sin recibo valido, la orden tiene que seguir pendiente').toBeVisible();
      await adjuntarTexto('Datos que deja este test en QA', [
        `Factura de proveedor: ${datos.puntoDeVenta}-${datos.numero} (id ${idDeLaFactura}), sin imputar`,
        `Orden de pago: id ${idDeLaOrden}, sin aprobar`,
      ].join('\n'));
    });
  });
});
