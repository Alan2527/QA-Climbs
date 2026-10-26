import { test, expect } from '@playwright/test';
import { FacturaProveedorNuevaPage } from '../../../pages/climbs/factura-proveedor.page';
import { paso, adjuntarTexto, formatearFecha, reiniciarNumeracionDePasos, importeANumero } from '../../../utils/pasos';
import { reservarServicioYGenerarFile } from '../comun/precondiciones';

/**
 * COBRANZAS — app nueva (ClimbsApp).
 *
 * El mismo flujo que tests/bloque-c/factura-proveedor.spec.ts, con el mismo titulo: el
 * file recien generado se factura al proveedor que carga el costo de su item, se imputa
 * al item y se aprueba. Todo por pantalla.
 */
const soloDigitos = (s: string) => s.replace(/\D/g, '');
/** Las fechas de la app nueva pueden venir como dd/mm/aaaa o aaaa-mm-dd: se comparan como dd/mm/aaaa. */
const comoFecha = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s.trim());
const masDias = (fecha: string, dias: number) => {
  const [d, m, a] = fecha.split('/').map(Number);
  return formatearFecha(new Date(a, m - 1, d + dias));
};

test.describe('Cobranzas', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Factura de proveedor: se carga sobre el file y se imputa al item', async ({ page }) => {
    test.setTimeout(900_000);
    const erroresJS: string[] = [];
    page.on('pageerror', (e) => erroresJS.push(e.message));
    const factura = new FacturaProveedorNuevaPage(page);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const comprobante = {
      // El proveedor que carga el costo del item: los pendientes se listan por proveedor y sucursal.
      proveedor: 'GRUPO SUMMA',
      razonSocial: 'GRUPO SUMMA SRL',
      documento: '30-71422246-1',
      medioDePago: 'Efectivo',
      tipo: 'Factura A',
      sucursal: 'Argentina',
      monedaPorDefecto: 'ARS',
      puntoDeVenta: '0001',
      // Unico por corrida: tipo, punto de venta, numero y proveedor no se pueden repetir.
      numero: [ahora.getDate(), ahora.getHours(), ahora.getMinutes(), ahora.getSeconds()].map((n) => String(n).padStart(2, '0')).join(''),
      plazoDePago: 30,
      comentario: `Factura de regresion automatica ${sello}. No operar.`,
      comentarioDeLaImputacion: `AUTO-QA ${sello.slice(-8)}`,
    };

    const pre = await reservarServicioYGenerarFile(page, sello);
    // La factura se emite por el costo del item, en su misma moneda.
    const moneda = pre.costoDelItem.moneda;
    const total = pre.costoDelItem.valor as number;
    const totalComoTexto = total.toFixed(2).replace('.', ',');
    let idDeLaFactura = '';
    let fechaDeLaFactura = '';

    await paso(page, 'Abrir una factura nueva: sin sucursal ni proveedor el formulario esta bloqueado', async () => {
      await factura.abrirNueva();
      await expect(factura.aviso(), 'Al abrir el alta tiene que pedir sucursal y proveedor').toBeVisible();
      await expect(factura.campo('number'), 'Sin sucursal ni proveedor no se tiene que poder cargar el comprobante').toHaveCount(0);
    });

    await paso(page, 'Elegir la sucursal: sin proveedor el formulario sigue bloqueado', async () => {
      await factura.elegirSucursal(comprobante.sucursal);
      expect(await factura.opcionElegida('branch'), 'El comprobante tiene que quedar en la sucursal del file').toContain(comprobante.sucursal);
      await expect(factura.aviso(), 'Con la sucursal y sin proveedor el aviso tiene que seguir').toBeVisible();
      await expect(factura.campo('number')).toHaveCount(0);
    });

    await paso(page, 'Elegir el proveedor: aparece el formulario con sus valores iniciales', async () => {
      await factura.elegirProveedor(comprobante.proveedor, comprobante.razonSocial);
      await expect(factura.aviso(), 'Elegido el proveedor, el aviso tiene que desaparecer').toBeHidden();
      await expect(factura.campo('number'), 'Elegido el proveedor, se tiene que poder cargar el comprobante').toBeVisible();
      expect(await factura.opcionElegida('currency'), 'Con sucursal Argentina la moneda tiene que proponer pesos').toContain(comprobante.monedaPorDefecto);
      fechaDeLaFactura = comoFecha(await factura.campo('date').inputValue());
      expect(fechaDeLaFactura, 'El comprobante tiene que nacer con la fecha de hoy').toBe(formatearFecha(ahora));
    });

    await paso(page, 'Verificar lo que completa solo el proveedor', async () => {
      const documento = await factura.campo('doc').inputValue();
      const medio = await factura.opcionElegida('payment');
      await adjuntarTexto('Datos que precarga el proveedor', `Documento: ${documento} | Medio de pago: ${medio}`);
      expect(soloDigitos(documento), 'El comprobante tiene que tomar el documento del proveedor').toBe(soloDigitos(comprobante.documento));
      expect(medio, 'El medio de pago tiene que venir del proveedor').toContain(comprobante.medioDePago);
    });

    await paso(page, 'Cargar el tipo, el numero, la moneda y el total del comprobante', async () => {
      await factura.campo('type').selectOption({ label: comprobante.tipo });
      await factura.campo('pos').fill(comprobante.puntoDeVenta);
      await factura.campo('number').fill(comprobante.numero);
      await factura.campo('currency').selectOption({ label: moneda });
      expect(await factura.opcionElegida('currency'), 'La moneda tiene que ser la del costo del item del file').toContain(moneda);
      // El importe va a Exento; el total lo calcula la pantalla y no se puede editar.
      await factura.campo('nontaxable').fill(totalComoTexto);
      await factura.campo('nontaxable').press('Tab');
      await factura.campo('comment').fill(comprobante.comentario);
      await expect(factura.campo('total'), 'El total no se carga a mano').toBeDisabled();
      expect(importeANumero(await factura.campo('total').inputValue()),
        'Cargado el importe como Exento y sin impuestos, el total tiene que ser ese mismo importe').toBe(total);
    });

    await paso(page, 'Guardar el comprobante y verificar que quedo con los datos cargados', async () => {
      idDeLaFactura = await factura.guardar();
      expect(idDeLaFactura, 'Guardar tiene que devolver el id del comprobante').toMatch(/^\d+$/);
      await expect(factura.campo('number'), 'El comprobante tiene que conservar el numero').toHaveValue(comprobante.numero);
      expect(importeANumero(await factura.campo('total').inputValue()), 'El total tiene que ser el costo del item del file').toBe(total);
      expect(comoFecha(await factura.campo('due').inputValue()),
        `El vencimiento tiene que calcularse a ${comprobante.plazoDePago} dias, el plazo de pago del proveedor`)
        .toBe(masDias(fechaDeLaFactura, comprobante.plazoDePago));
      expect(Number(await factura.campo('pos').inputValue()), 'El comprobante tiene que conservar el punto de venta').toBe(Number(comprobante.puntoDeVenta));
      expect(await factura.opcionElegida('type'), 'El comprobante tiene que conservar el tipo').toContain(comprobante.tipo);
      await expect(factura.campo('comment'), 'El comprobante tiene que conservar el comentario').toHaveValue(comprobante.comentario);
      const cotizacion = importeANumero(await factura.campo('exchange').inputValue());
      await adjuntarTexto('Cotizacion del comprobante', String(cotizacion));
      expect(cotizacion as number, 'La cotizacion nunca puede quedar en cero').toBeGreaterThan(0);
      const periodo = await factura.opcionElegida('month');
      const [, mes, anio] = fechaDeLaFactura.split('/');
      const nombreDelMes = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date(Number(anio), Number(mes) - 1, 1)).toUpperCase();
      expect(periodo.toUpperCase(), 'El periodo contable tiene que ser el mes de la fecha de factura').toContain(`${nombreDelMes} ${anio}`);
    });

    await paso(page, 'Verificar el pendiente de asignacion contra el total cargado', async () => {
      const pendiente = (await factura.pendienteDeAsignacion().innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Pendiente de asignacion', pendiente);
      expect(pendiente, 'El pendiente tiene que estar en la moneda del comprobante').toContain(moneda);
      expect(importeANumero(pendiente.split(':')[1] ?? ''), 'Sin retenciones, el pendiente tiene que ser el total del comprobante').toBe(total);
    });

    await paso(page, 'Buscar el file entre los servicios pendientes y comparar la fila', async () => {
      await factura.buscarPendiente(pre.fileCode);
      const fila = factura.filaPendiente(pre.fileCode);
      await expect(fila, `El file ${pre.fileCode} tiene que aparecer entre los servicios pendientes de ${comprobante.razonSocial}`)
        .toBeVisible({ timeout: 60_000 });
      const celdas = (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
      await adjuntarTexto('Fila del servicio pendiente', celdas.join(' | '));
      expect(celdas.join(' | ').toUpperCase(), 'La fila tiene que mostrar el pasajero de la reserva').toContain(pre.apellidoDelPax.toUpperCase());
      const importes = celdas.filter((c) => /^[A-Z]{3}\s*-?\d[\d.,]*$/.test(c)).map(importeANumero);
      expect(importes, 'La fila tiene que mostrar el costo del item tal como quedo en el file').toContain(total);
      expect(importes.at(-1), 'Sin nada imputado, el saldo tiene que ser el costo entero').toBe(total);
    });

    await paso(page, 'Abrir la asignacion y comparar los cuatro importes del dialogo', async () => {
      const dialogo = await factura.abrirAsignacion(factura.filaPendiente(pre.fileCode));
      const i = await factura.importesDelDialogo(dialogo);
      await adjuntarTexto('Importes del dialogo de asignacion', JSON.stringify(i, null, 2));
      expect(i.facturaTotal, 'El dialogo tiene que mostrar la moneda del comprobante').toContain(moneda);
      expect(importeANumero(i.facturaTotal), 'El dialogo tiene que mostrar el total del comprobante').toBe(total);
      expect(importeANumero(i.facturaPendiente), 'Sin nada imputado, el pendiente del comprobante tiene que ser su total').toBe(total);
      expect(importeANumero(i.servicioTotal), 'El dialogo tiene que mostrar el costo del item del file').toBe(total);
      expect(importeANumero(i.servicioPendiente), 'Sin nada imputado, el pendiente del item tiene que ser su costo entero').toBe(total);

      await factura.asignar(dialogo, totalComoTexto, comprobante.comentarioDeLaImputacion);
      await expect.poll(async () => importeANumero((await factura.pendienteDeAsignacion().innerText()).split(':')[1] ?? ''),
        { message: 'Imputado el comprobante entero, no tiene que quedar nada pendiente de asignacion', timeout: 30_000 }).toBe(0);
    });

    await paso(page, 'Verificar que el servicio paso a los asignados', async () => {
      const asignada = factura.filaAsignada(pre.fileCode);
      await expect(asignada, `El servicio del file ${pre.fileCode} tiene que quedar entre los asignados`).toBeVisible({ timeout: 60_000 });
      const texto = (await asignada.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Fila del servicio asignado', texto);
      expect(texto, 'La fila asignada tiene que conservar el comentario').toContain(comprobante.comentarioDeLaImputacion);
      const importes = (texto.match(/[A-Z]{3}\s*\d[\d.]*,\d+/g) ?? []).map(importeANumero);
      expect(importes, 'La fila asignada tiene que mostrar el importe imputado').toContain(total);
      await factura.buscarPendiente(pre.fileCode);
      await expect(factura.filaPendiente(pre.fileCode), 'Imputado el costo entero, el servicio no tiene que seguir entre los pendientes')
        .toHaveCount(0, { timeout: 60_000 });
    });

    await paso(page, 'Aprobar el comprobante y verificar que quede aprobado', async () => {
      await page.getByRole('button', { name: 'Ajustar & aprobar' }).click();
      await expect(page.getByText('Aprobada', { exact: true }), 'Aprobado, el comprobante tiene que mostrarlo').toBeVisible({ timeout: 60_000 });
      await adjuntarTexto('Cadena generada', [
        `Reserva: ${pre.codigo}`, `File: ${pre.fileCode} (id ${pre.fileId})`,
        `Factura de proveedor: ${comprobante.puntoDeVenta}-${comprobante.numero} (id ${idDeLaFactura})`,
        `Total imputado: ${moneda} ${totalComoTexto}`,
      ].join('\n'));
    });

    await paso(page, 'Verificar el comprobante en el listado de facturas', async () => {
      await page.goto('/finance/supplier-invoices');
      await page.getByPlaceholder('Proveedor, razón social o número').fill(comprobante.numero);
      const fila = page.locator('tbody tr').filter({ hasText: comprobante.numero }).first();
      await expect(fila, `El comprobante ${comprobante.puntoDeVenta}-${comprobante.numero} tiene que aparecer en el listado`).toBeVisible({ timeout: 60_000 });
      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Fila del comprobante en el listado', texto);
      expect(texto.toUpperCase(), 'El listado tiene que mostrar la razon social del proveedor').toContain(comprobante.razonSocial.toUpperCase());
      expect(soloDigitos(texto), 'El listado tiene que mostrar el documento del proveedor').toContain(soloDigitos(comprobante.documento));
      expect(texto, 'El listado tiene que mostrar la fecha del comprobante').toContain(fechaDeLaFactura);
      expect(texto, 'El listado tiene que mostrar el vencimiento por el plazo del proveedor').toContain(masDias(fechaDeLaFactura, comprobante.plazoDePago));
      const importes = (texto.match(/[A-Z]{3}\s*\d[\d.]*,\d+/g) ?? []).map(importeANumero);
      expect(importes, 'El listado tiene que mostrar el monto y lo asignado, que imputado entero es el mismo importe')
        .toEqual(expect.arrayContaining([total, total]));
    });

    expect(erroresJS, 'La app nueva no tiene que tirar errores de JavaScript durante el flujo').toEqual([]);
  });
});
