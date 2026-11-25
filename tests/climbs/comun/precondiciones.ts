import { Page, expect } from '@playwright/test';
import { PortalNuevoPage, PasajeroNuevo } from '../../../pages/climbs/portal.page';
import { BackofficeNuevoPage, ImporteNuevo } from '../../../pages/climbs/backoffice.page';
import { FacturaProveedorNuevaPage } from '../../../pages/climbs/factura-proveedor.page';
import { OrdenDePagoNuevaPage } from '../../../pages/climbs/orden-de-pago.page';
import { OrdenDeCobroNuevaPage } from '../../../pages/climbs/orden-de-cobro.page';
import { paso, adjuntarTexto, fechaDeBusqueda, formatearFecha, selloEnLetras, importeANumero } from '../../../utils/pasos';
import { conBackofficeNuevo, costosDelServicio, tarifaVigente, precioEsperado } from '../../../utils/markups';

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

/** `diasExtra`: a cuantos dias de hoy se reserva (una semana por defecto, como la suite actual). */
export async function reservarServicioEnElPortalNuevo(page: Page, sello: string, diasExtra = 7, conIdioma = false): Promise<ReservaNueva> {
  const portal = new PortalNuevoPage(page);
  const fecha = fechaDeBusqueda(diasExtra);
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
    if (conIdioma) {
      const idioma = page.locator('main').getByRole('combobox', { name: 'Idioma del servicio' });
      await expect(idioma, 'La ficha tiene que mostrar el selector "Idioma del servicio"').toBeVisible();
      const opciones = (await idioma.locator('option').allInnerTexts()).map((t) => t.trim());
      const ingles = opciones.find((o) => /^(English|Ingl[eé]s)$/i.test(o));
      expect(ingles, `La ficha tiene que ofrecer el idioma English. Ofrece: ${opciones.join(', ')}`).toBeDefined();
      await idioma.selectOption({ label: ingles! });
      await page.waitForLoadState('networkidle');
    }
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
  /** Con `conIdioma`: el item "Adicional Idioma" del file. */
  adicionalDelIdioma: { costo: ImporteNuevo; venta: ImporteNuevo } | null;
  /** La venta de todo el file (el servicio y, si hay, su Adicional Idioma). */
  ventaDelFile: ImporteNuevo;
  /** Cuantos items trae el file. */
  itemsDelFile: number;
};

/**
 * Lo que un usuario ya tendria hecho antes de facturar: la reserva del portal y su file
 * generado desde la bandeja del Backoffice. No se verifica aca —de eso se ocupa el bloque
 * de Reservas—, pero se corta con un motivo claro si algo no esta.
 */
/** Tigre y Delta (AUTO-QA), el servicio de la precondicion: su costo se lee en el Backoffice nuevo. */
const SERVICIO_REGRESION_ID = 5;

/**
 * Con `conIdioma` la reserva se hace en English (US 4739): Tigre y Delta tiene un recargo del 10% para English en
 * su tarifa Regular. El file suma la fila "Adicional Idioma" del servicio y la venta de las dos filas tiene que ser
 * techo((costo + recargo) por persona / cotizacion / markup de la agencia) x pasajeros: la US pide que "el valor
 * final tiene que calcularse aplicando el markup de la agencia sobre costo + recargo en conjunto, nunca sobre el
 * costo solo", y que el idioma y el recargo "tienen que llegar completos hasta el item de la reserva".
 */
export async function reservarServicioYGenerarFile(page: Page, sello: string, opciones: { conIdioma?: boolean } = {}): Promise<FileNuevo> {
  const reserva = await reservarServicioEnElPortalNuevo(page, sello, 7, opciones.conIdioma);
  const bo = new BackofficeNuevoPage(page);
  let file = { fileId: '', fileCode: '' };
  let cliente = '';
  let item = { costo: { moneda: '', valor: null } as ImporteNuevo, venta: { moneda: '', valor: null } as ImporteNuevo, texto: '' };
  let adicionalDelIdioma: { costo: ImporteNuevo; venta: ImporteNuevo } | null = null;
  let itemsDelFile = 0;

  await paso(page, 'Backoffice nuevo: generar el file de la reserva desde la bandeja', async () => {
    const dialogo = await bo.abrirReservaDeLaBandeja(reserva.codigo);
    file = await bo.generarFile(dialogo, 'Argentina');
    expect(file.fileId, 'Generar el file tiene que devolver su id').toMatch(/^\d+$/);
    cliente = await bo.clienteDelFile();
    item = await bo.importesDelItem(SERVICIO_DE_REGRESION.termino);
    if (opciones.conIdioma) {
      const a = await bo.importesDelItem('Adicional Idioma');
      adicionalDelIdioma = { costo: a.costo, venta: a.venta };
    }
    itemsDelFile = await bo.fichaDelFile.locator('section.fs-dest tbody tr').filter({ has: page.locator('td') }).count();
    await adjuntarTexto('Precondicion generada', [
      `Reserva: ${reserva.codigo}`,
      `File: ${file.fileCode} (id ${file.fileId})`,
      `Cliente: ${cliente}`,
      `Item: ${item.texto}`,
      ...(adicionalDelIdioma ? [`Adicional Idioma: costo ${adicionalDelIdioma.costo.valor} / venta ${adicionalDelIdioma.venta.valor}`] : []),
      `Items del file: ${itemsDelFile}`,
    ].join('\n'));
    expect(cliente, 'El file tiene que quedar con el cliente de la agencia').not.toBe('');
    // Sin costo no hay nada que facturar al proveedor; sin venta, nada al cliente.
    expect(item.costo.valor, 'El item del file tiene que tener costo. Si viene en cero, revisar las tarifas de costo del servicio').toBeGreaterThan(0);
    expect(item.venta.valor, 'El item del file tiene que tener venta').toBeGreaterThan(0);
  });

  await paso(page, 'El item del file tiene el costo y la venta de la tarifa del servicio', async () => {
    // Costo = costo por persona de la tarifa Regular vigente x pasajeros, en su moneda.
    // Venta = lo que AMV le cobra a la agencia: techo(costo por persona / cotizacion / markup de la
    // agencia) x pasajeros. La agencia de pablo1 (1) no tiene markup de mercado (1); el CustomMarkup
    // de pablo1 es el que la agencia muestra en el sitio y no entra en la venta de AMV.
    const [d, m, a] = reserva.fecha.split('/').map(Number);
    const costos = await conBackofficeNuevo(page.context().browser()!, (b) => costosDelServicio(b, SERVICIO_REGRESION_ID));
    const tarifa = tarifaVigente(costos, SERVICIO_DE_REGRESION.modalidad, new Date(a, m - 1, d), reserva.cantidadPax);
    expect(tarifa, `El servicio ${SERVICIO_REGRESION_ID} tiene que tener una tarifa ${SERVICIO_DE_REGRESION.modalidad} vigente el ${reserva.fecha}`).toBeDefined();
    const costo = Number((tarifa!.costo! * reserva.cantidadPax).toFixed(2));
    const venta = precioEsperado(tarifa!.costo!, tarifa!.moneda, 1)! * reserva.cantidadPax;
    await adjuntarTexto('Costo y venta esperados', [
      `Tarifa: ${tarifa!.vigencia} | ${tarifa!.modalidad} | ${tarifa!.moneda} ${tarifa!.costo} por persona | ${reserva.cantidadPax} pax`,
      `Costo esperado: ${tarifa!.moneda} ${costo} / en el file: ${item.costo.moneda} ${item.costo.valor}`,
      `Venta esperada: USD ${venta} / en el file: ${item.venta.moneda} ${item.venta.valor}`,
    ].join(String.fromCharCode(10)));
    expect(item.costo.moneda, 'El costo del item tiene que estar en la moneda de la tarifa').toBe(tarifa!.moneda);
    expect(item.costo.valor, 'El costo del item tiene que ser el costo por persona de la tarifa por los pasajeros').toBe(costo);
    expect(item.venta.moneda, 'La venta del item tiene que estar en USD').toBe('USD');
    // Con idioma la venta se reparte entre el servicio y su Adicional Idioma, y la US no dice como: se exige la suma (abajo).
    if (!opciones.conIdioma) expect(item.venta.valor, 'La venta del item tiene que ser techo(costo / cotizacion) por pasajero, por los pasajeros').toBe(venta);
    const adicional = adicionalDelIdioma;
    if (adicional) {
      const recargo = tarifa!.recargos.find((r) => /^(English|Ingl[eé]s)$/i.test(r.idioma));
      expect(recargo, `La tarifa ${SERVICIO_DE_REGRESION.modalidad} del servicio ${SERVICIO_REGRESION_ID} tiene que tener recargo para English`).toBeDefined();
      const recargoPax = recargo!.tipo === 'porcentaje' ? tarifa!.costo! * recargo!.valor / 100 : recargo!.tipo === 'porPasajero' ? recargo!.valor : recargo!.valor / reserva.cantidadPax;
      const costoDelRecargo = Number((recargoPax * reserva.cantidadPax).toFixed(2));
      const ventaConRecargo = precioEsperado(tarifa!.costo! + recargoPax, tarifa!.moneda, 1)! * reserva.cantidadPax;
      const ventaDeLasDos = Number(((item.venta.valor ?? 0) + (adicional.venta.valor ?? 0)).toFixed(2));
      await adjuntarTexto('Adicional Idioma esperado', [
        `Recargo English: ${JSON.stringify(recargo)} -> ${tarifa!.moneda} ${recargoPax} por persona`,
        `Costo del adicional esperado: ${tarifa!.moneda} ${costoDelRecargo} / en el file: ${adicional.costo.moneda} ${adicional.costo.valor}`,
        `Venta del servicio + adicional esperada: techo((${tarifa!.costo} + ${recargoPax}) / cotizacion) x ${reserva.cantidadPax} = USD ${ventaConRecargo} / en el file: ${item.venta.valor} + ${adicional.venta.valor} = ${ventaDeLasDos}`,
      ].join(String.fromCharCode(10)));
      expect(adicional.costo.valor, 'El file tiene que traer el recargo de English como item de costo propio ("Adicional Idioma")').toBe(costoDelRecargo);
      expect(ventaDeLasDos, 'La venta del servicio mas su Adicional Idioma tiene que ser techo((costo + recargo) / cotizacion / markup) x pasajeros (US 4739)').toBe(ventaConRecargo);
    }
  });

  // TypeScript no ve la asignacion dentro del paso: se tipa a mano.
  const ad = adicionalDelIdioma as { venta: { valor: number | null } } | null;
  const ventaDelFile = { moneda: item.venta.moneda, valor: ad ? Number(((item.venta.valor ?? 0) + (ad.venta.valor ?? 0)).toFixed(2)) : item.venta.valor } as ImporteNuevo;
  return { ...reserva, ...file, cliente, costoDelItem: item.costo, ventaDelItem: item.venta, adicionalDelIdioma, ventaDelFile, itemsDelFile };
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
    await page.goto('/finance/invoicing?state=issued&type=2100');
    await page.getByRole('button', { name: 'Nuevo', exact: true }).or(page.getByRole('link', { name: 'Nuevo', exact: true })).click();
    await page.locator('#inv-type').selectOption({ label: 'Carta de Cobranza' });
    await page.getByRole('button', { name: 'Elegir destinatario' }).click();
    const destinatarios = page.getByRole('dialog', { name: 'Destinatarios' });
    await destinatarios.getByRole('searchbox').fill(file.cliente);
    await destinatarios.locator('tbody tr').filter({ hasText: file.cliente }).first().click();
    await page.getByRole('button', { name: 'Seleccionar file', exact: true }).click();
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

    await page.goto(`/finance/invoicing?state=issued&type=2100&q=${digitos}`);
    const fila = page.locator('tbody tr').filter({ hasText: digitos }).first();
    await expect(fila, `La precondicion necesita la carta del file ${file.fileCode} en Cartas emitidas`).toBeVisible({ timeout: 60_000 });
    comprobante = (await fila.innerText()).match(/[A-Z]{2}\d{5}-\d{8}/)?.[0] ?? '';
    expect(comprobante, 'No se pudo leer el numero de la carta en Cartas emitidas').not.toBe('');
    await adjuntarTexto('Carta de cobranza de la precondicion', `${comprobante} · ${file.cliente} · ${moneda} ${total}`);
  });

  return { fileCode: file.fileCode, cliente: file.cliente, comprobante, total, moneda };
}

export type FacturaAprobada = { fileCode: string; numeroDeFactura: string; puntoDeVenta: string; total: number; moneda: string };

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
    await expect(page.getByRole('dialog').or(page.locator('main')).last().getByText('Aprobada', { exact: true }).filter({ visible: true }).first(), 'La precondicion necesita la factura aprobada').toBeVisible({ timeout: 60_000 });
    await adjuntarTexto('Factura de proveedor de la precondicion', `${puntoDeVenta}-${numero} (id ${id}) · ${file.costoDelItem.moneda} ${totalComoTexto}`);
  });

  return { fileCode: file.fileCode, numeroDeFactura: numero, puntoDeVenta, total, moneda: file.costoDelItem.moneda };
}

/**
 * Precondicion de la caja diaria: la orden de pago de la factura, desde la caja AUTO-QA de su
 * moneda, imputada y aprobada con recibo de hoy. Devuelve su codigo (OP...).
 */
export async function armarOrdenDePagoAprobada(page: Page, sello: string, fechaDeHoy: string, factura: FacturaAprobada): Promise<string> {
  const orden = new OrdenDePagoNuevaPage(page);
  const monto = factura.total.toFixed(2).replace('.', ',');
  let codigo = '';
  await paso(page, 'Pagar la factura del proveedor con una orden de pago aprobada', async () => {
    await orden.abrirNueva();
    if (!(await orden.opcionElegida('branch')).includes('Argentina')) await orden.campo('branch').selectOption({ label: 'Argentina' });
    await orden.elegirProveedor(PROVEEDOR_DE_REGRESION.termino, PROVEEDOR_DE_REGRESION.razonSocial);
    await orden.campo('currency').selectOption({ label: factura.moneda });
    await orden.elegir('cf-0', cajaDeRegresion(factura.moneda));
    await orden.campo('amount-0').fill(monto);
    await orden.campo('amount-0').press('Tab');
    await orden.campo('detail').fill(`Orden de pago de regresion automatica ${sello}. No operar.`);
    await orden.guardar();
    codigo = (await orden.campo('code').inputValue()).trim();
    const fila = orden.filaPendiente(factura.numeroDeFactura);
    await expect(fila, `La precondicion necesita la factura ${factura.numeroDeFactura} entre las pendientes de la orden`).toBeVisible({ timeout: 60_000 });
    await orden.asignar(await orden.abrirAsignacion(fila), monto, `AUTO-QA ${sello.slice(-8)}`);
    await expect(orden.filaAsignada(factura.numeroDeFactura), 'La precondicion necesita la factura asignada a la orden').toBeVisible({ timeout: 60_000 });
    await orden.aprobar(fechaDeHoy, `AUTOQA${sello.slice(-8)}`);
    await expect(page.getByRole('dialog').or(page.locator('main')).last().getByText('Pago', { exact: true }).filter({ visible: true }).first(), 'La precondicion necesita la orden de pago aprobada').toBeVisible({ timeout: 60_000 });
    await adjuntarTexto('Orden de pago de la precondicion', `${codigo} · ${factura.moneda} ${monto}`);
  });
  return codigo;
}

/** Precondicion de la caja diaria: la orden de cobro de la carta, imputada y aprobada con recibo de hoy. Devuelve su codigo (OC...). */
export async function armarOrdenDeCobroAprobada(page: Page, sello: string, fechaDeHoy: string, carta: ComprobanteAlCliente): Promise<string> {
  const orden = new OrdenDeCobroNuevaPage(page);
  const monto = carta.total.toFixed(2).replace('.', ',');
  const numeroDeFile = carta.fileCode.match(/\d+$/)?.[0] ?? '';
  let codigo = '';
  await paso(page, 'Cobrar la carta del cliente con una orden de cobro aprobada', async () => {
    await orden.abrirNueva();
    await orden.elegirCliente(carta.cliente, carta.cliente);
    await orden.campo('currency').selectOption({ label: carta.moneda });
    await orden.elegir('cf-0', cajaDeRegresion(carta.moneda));
    await orden.campo('amount-0').fill(monto);
    await orden.campo('amount-0').press('Tab');
    await orden.campo('detail').fill(`Orden de cobro de regresion automatica ${sello}. No operar.`);
    await orden.guardar();
    codigo = (await orden.campo('code').inputValue()).trim();
    const fila = orden.filaPendiente(numeroDeFile);
    await expect(fila, `La precondicion necesita la carta del file ${carta.fileCode} entre los pendientes de la orden`).toBeVisible({ timeout: 60_000 });
    await orden.asignar(await orden.abrirAsignacion(fila), monto, `AUTO-QA ${sello.slice(-8)}`);
    await expect(orden.filaAsignada(numeroDeFile), 'La precondicion necesita la carta asignada a la orden').toBeVisible({ timeout: 60_000 });
    await orden.aprobar(fechaDeHoy, `AUTOQA${sello.slice(-8)}`);
    await expect(page.getByRole('dialog').or(page.locator('main')).last().getByText('Pago', { exact: true }).filter({ visible: true }).first(), 'La precondicion necesita la orden de cobro aprobada').toBeVisible({ timeout: 60_000 });
    await adjuntarTexto('Orden de cobro de la precondicion', `${codigo} · ${carta.moneda} ${monto}`);
  });
  return codigo;
}
