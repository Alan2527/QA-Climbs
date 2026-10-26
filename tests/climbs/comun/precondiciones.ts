import { Page, expect } from '@playwright/test';
import { PortalNuevoPage, PasajeroNuevo } from '../../../pages/climbs/portal.page';
import { BackofficeNuevoPage, ImporteNuevo } from '../../../pages/climbs/backoffice.page';
import { FacturaProveedorNuevaPage } from '../../../pages/climbs/factura-proveedor.page';
import { paso, adjuntarTexto, fechaDeBusqueda, formatearFecha, selloEnLetras, importeANumero } from '../../../utils/pasos';

/**
 * Precondiciones de la app nueva, por pantalla y como un usuario real: la agencia
 * reserva en el portal (`/site`) y el personal genera el file en el Backoffice.
 *
 * Es la misma precondicion de la suite actual (tests/bloque-c/cobranzas-comun.ts):
 * el servicio "AUTO-QA NO TOCAR - Tigre y Delta", modalidad Regular, con el minimo de
 * pasajeros, a una semana. Cada test genera la suya: un item de file solo se imputa una vez.
 */
export const SERVICIO_DE_REGRESION = {
  nombre: 'AUTO-QA NO TOCAR - Tigre y Delta',
  termino: 'Tigre y Delta',
  modalidad: 'Regular',
};

export type ReservaNueva = {
  referencia: string;
  fecha: string;
  apellidoDelPax: string;
  cantidadPax: number;
  pasajeros: PasajeroNuevo[];
  /** Codigo que muestra el portal al confirmar, ej. "BO00025832". */
  codigo: string;
};

export async function reservarServicioEnElPortalNuevo(page: Page, sello: string): Promise<ReservaNueva> {
  const portal = new PortalNuevoPage(page);
  const fecha = fechaDeBusqueda();
  const referencia = `AUTO-QA ${sello}`;
  const apellido = `Regresion${selloEnLetras(sello.slice(-6))}`;
  let cantidadPax = 0;
  let pasajeros: PasajeroNuevo[] = [];
  let codigo = '';

  await paso(page, 'Portal nuevo: reservar el servicio de regresion y confirmar la reserva', async () => {
    await portal.vaciarCarrito();
    await portal.buscarServicios(fecha);
    await portal.elegirServicio(SERVICIO_DE_REGRESION.termino, SERVICIO_DE_REGRESION.nombre);
    await expect(portal.bloqueDeModalidad(SERVICIO_DE_REGRESION.modalidad),
      `La ficha tiene que ofrecer la modalidad ${SERVICIO_DE_REGRESION.modalidad} para el ${formatearFecha(fecha)}`).toBeVisible();
    cantidadPax = await portal.minimoDePasajeros(SERVICIO_DE_REGRESION.modalidad);
    await portal.agregarAlCarrito(SERVICIO_DE_REGRESION.modalidad, cantidadPax);
    // El contador cuenta items, no pasajeros: una sola excursion.
    await expect.poll(() => portal.itemsEnElCarrito(), { timeout: 30_000 }).toBe(1);

    pasajeros = Array.from({ length: cantidadPax }, (_, i) => ({
      nombre: `Pasajero${['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho'][i] ?? 'Extra'}`,
      apellido,
      nacimiento: `0${i + 1}/03/1990`,
      nacionalidad: 'Argentina',
      pasaporte: `QA${sello.slice(-8)}${i + 1}`,
    }));
    await portal.reservarDesdeElCarrito(referencia, `Reserva de regresion automatica ${sello}. No operar.`);
    await portal.completarDatosDeLaReserva(pasajeros, `Vuelo de llegada AR1234 ${sello}`);
    codigo = await portal.confirmarReserva();
    await adjuntarTexto('Reserva confirmada en el portal nuevo', `${codigo} · ${referencia} · ${cantidadPax} pax · ${formatearFecha(fecha)}`);
  });

  return { referencia, fecha: formatearFecha(fecha), apellidoDelPax: apellido, cantidadPax, pasajeros, codigo };
}

export type FileNuevo = ReservaNueva & {
  fileId: string;
  fileCode: string;
  cliente: string;
  costoDelItem: ImporteNuevo;
  ventaDelItem: ImporteNuevo;
};

/**
 * Lo que un usuario ya tendria hecho antes de facturar: la reserva del portal y su file
 * generado desde la bandeja del Backoffice. No se verifica aca —de eso se ocupa el bloque
 * de Reservas—, pero se corta con un motivo claro si algo no esta.
 */
export async function reservarServicioYGenerarFile(page: Page, sello: string): Promise<FileNuevo> {
  const reserva = await reservarServicioEnElPortalNuevo(page, sello);
  const bo = new BackofficeNuevoPage(page);
  let file = { fileId: '', fileCode: '' };
  let cliente = '';
  let item = { costo: { moneda: '', valor: null } as ImporteNuevo, venta: { moneda: '', valor: null } as ImporteNuevo, texto: '' };

  await paso(page, 'Backoffice nuevo: generar el file de la reserva desde la bandeja', async () => {
    const dialogo = await bo.abrirReservaDeLaBandeja(reserva.codigo);
    file = await bo.generarFile(dialogo, 'Argentina');
    expect(file.fileId, 'Generar el file tiene que devolver su id').toMatch(/^\d+$/);
    cliente = await bo.clienteDelFile();
    item = await bo.importesDelItem(SERVICIO_DE_REGRESION.termino);
    await adjuntarTexto('Precondicion generada', [
      `Reserva: ${reserva.codigo}`,
      `File: ${file.fileCode} (id ${file.fileId})`,
      `Cliente: ${cliente}`,
      `Item: ${item.texto}`,
    ].join('\n'));
    expect(cliente, 'El file tiene que quedar con el cliente de la agencia').not.toBe('');
    // Sin costo no hay nada que facturar al proveedor; sin venta, nada al cliente.
    expect(item.costo.valor, 'El item del file tiene que tener costo. Si viene en cero, revisar las tarifas de costo del servicio').toBeGreaterThan(0);
    expect(item.venta.valor, 'El item del file tiene que tener venta').toBeGreaterThan(0);
  });

  return { ...reserva, ...file, cliente, costoDelItem: item.costo, ventaDelItem: item.venta };
}

/** El proveedor que carga el costo del servicio de regresion. */
export const PROVEEDOR_DE_REGRESION = { termino: 'GRUPO SUMMA', razonSocial: 'GRUPO SUMMA SRL' };

/** La caja AUTO-QA de cada moneda: la orden de pago solo ofrece cajas de su misma moneda. */
export const cajaDeRegresion = (moneda: string) =>
  ({ USD: 'AUTO-QA NO TOCAR - CAJA USD', ARS: 'AUTO-QA NO TOCAR - CAJA ARS' } as Record<string, string>)[moneda] ?? `(sin caja AUTO-QA para ${moneda})`;

export type ComprobanteAlCliente = { fileCode: string; cliente: string; comprobante: string; total: number; moneda: string };

/**
 * Precondicion de la orden de cobro: la carta de cobranza emitida al cliente sobre el file,
 * pendiente de cobro. Repite sin verificar lo que revisa el test de la factura al cliente.
 */
export async function armarFacturaAlCliente(page: Page, sello: string, file: FileNuevo): Promise<ComprobanteAlCliente> {
  const digitos = file.fileCode.match(/\d+$/)?.[0] ?? '';
  let comprobante = '';
  let total = 0;
  let moneda = '';

  await paso(page, 'Emitir la carta de cobranza al cliente sobre el file', async () => {
    await page.goto('/finance/invoicing/letters?state=issued');
    await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
    await page.getByRole('button', { name: 'Elegir destinatario' }).click();
    const destinatarios = page.getByRole('dialog', { name: 'Destinatarios' });
    await destinatarios.getByRole('searchbox').fill(file.cliente);
    await destinatarios.locator('tbody tr').filter({ hasText: file.cliente }).first().click();
    await page.getByRole('button', { name: 'Cargar desde un file' }).click();
    const files = page.getByRole('dialog', { name: 'Files del cliente' });
    await files.getByRole('searchbox').fill(digitos);
    await files.locator('tbody tr').filter({ hasText: digitos }).first().click();
    await expect(files).toBeHidden({ timeout: 30_000 });
    await expect(page.getByRole('textbox', { name: 'Producto 1', exact: true }), 'La precondicion necesita los conceptos del file').not.toHaveValue('', { timeout: 30_000 });
    total = importeANumero(await page.locator('#inv-total').inputValue()) ?? 0;
    moneda = await page.locator('#inv-currency').evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text ?? '');
    expect(total, 'La precondicion necesita un comprobante con importe').toBeGreaterThan(0);
    await page.locator('#inv-detail').fill(`Factura de regresion automatica ${sello}. No operar.`);
    const guardado = page.waitForResponse((r) => /\/api\/finance\/invoicing$/.test(r.url()) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    expect((await guardado).status(), 'La precondicion tiene que poder emitir la carta de cobranza').toBe(200);

    await page.goto(`/finance/invoicing/letters?state=issued&q=${digitos}`);
    const fila = page.locator('tbody tr').filter({ hasText: digitos }).first();
    await expect(fila, `La precondicion necesita la carta del file ${file.fileCode} en Cartas emitidas`).toBeVisible({ timeout: 60_000 });
    comprobante = (await fila.innerText()).match(/[A-Z]{2}\d{5}-\d{8}/)?.[0] ?? '';
    expect(comprobante, 'No se pudo leer el numero de la carta en Cartas emitidas').not.toBe('');
    await adjuntarTexto('Carta de cobranza de la precondicion', `${comprobante} · ${file.cliente} · ${moneda} ${total}`);
  });

  return { fileCode: file.fileCode, cliente: file.cliente, comprobante, total, moneda };
}

export type FacturaAprobada ={ fileCode: string; numeroDeFactura: string; puntoDeVenta: string; total: number; moneda: string };

/**
 * Precondicion de la orden de pago: la factura del proveedor por el costo del item, imputada
 * y aprobada. Repite sin verificar lo que el test de la factura de proveedor revisa paso por
 * paso; solo corta con un motivo claro si algo no esta.
 */
export async function armarFacturaAprobada(page: Page, sello: string, ahora: Date, file: FileNuevo): Promise<FacturaAprobada> {
  const factura = new FacturaProveedorNuevaPage(page);
  const total = file.costoDelItem.valor as number;
  const totalComoTexto = total.toFixed(2).replace('.', ',');
  const puntoDeVenta = '0001';
  const numero = [ahora.getDate(), ahora.getHours(), ahora.getMinutes(), ahora.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');

  await paso(page, 'Cargar la factura del proveedor, imputarla al file y aprobarla', async () => {
    await factura.abrirNueva();
    await factura.elegirSucursal('Argentina');
    await factura.elegirProveedor(PROVEEDOR_DE_REGRESION.termino, PROVEEDOR_DE_REGRESION.razonSocial);
    await factura.campo('type').selectOption({ label: 'Factura A' });
    await factura.campo('pos').fill(puntoDeVenta);
    await factura.campo('number').fill(numero);
    await factura.campo('currency').selectOption({ label: file.costoDelItem.moneda });
    await factura.campo('nontaxable').fill(totalComoTexto);
    await factura.campo('nontaxable').press('Tab');
    await factura.campo('comment').fill(`Factura de regresion automatica ${sello}. No operar.`);
    const id = await factura.guardar();
    expect(id, 'La precondicion tiene que poder crear la factura del proveedor').toMatch(/^\d+$/);

    await factura.buscarPendiente(file.fileCode);
    const fila = factura.filaPendiente(file.fileCode);
    await expect(fila, `La precondicion necesita el servicio del file ${file.fileCode} entre los pendientes de la factura`)
      .toBeVisible({ timeout: 60_000 });
    await factura.asignar(await factura.abrirAsignacion(fila), totalComoTexto, `AUTO-QA ${sello.slice(-8)}`);
    await expect(factura.filaAsignada(file.fileCode), 'La precondicion necesita la factura imputada al servicio').toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Ajustar & aprobar' }).click();
    await expect(page.getByText('Aprobada', { exact: true }), 'La precondicion necesita la factura aprobada').toBeVisible({ timeout: 60_000 });
    await adjuntarTexto('Factura de proveedor de la precondicion', `${puntoDeVenta}-${numero} (id ${id}) · ${file.costoDelItem.moneda} ${totalComoTexto}`);
  });

  return { fileCode: file.fileCode, numeroDeFactura: numero, puntoDeVenta, total, moneda: file.costoDelItem.moneda };
}
