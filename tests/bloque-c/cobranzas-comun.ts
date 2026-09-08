import { expect, Page, Locator } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage, Pasajero } from '../../pages/carrito.page';
import { BackOfficePage } from '../../pages/backoffice.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, fechaDeBusqueda, formatearFecha,
  importeANumero, selloEnLetras,
} from '../../utils/pasos';

/**
 * Lo que comparten los tests del Bloque C.
 *
 * Vivia dentro de `cobranzas.spec.ts`, que ya pasaba las dos mil lineas. Se
 * saco aca el 2026-09-08 para poder sumarle archivos al bloque sin seguir
 * engordando el mismo: lo primero que lo necesito fue la liquidacion del file.
 *
 * **No es un archivo de test**: no termina en `.spec.ts`, asi que Playwright no
 * lo levanta como suite.
 *
 * Lo que hay aca es la precondicion base —reservar, emitir y generar el file— y
 * los formateadores que el BO obliga a usar: la coma decimal al escribir, el
 * nombre del mes en mayuscula, la fecha dd/mm/aaaa.
 */


export const SALTO = String.fromCharCode(10);

/**
 * La caja propia del Bloque C, creada el 2026-09-04 (id 187, categoria 18).
 * Ninguna caja preexistente de QA se toca: tienen saldos reales.
 */
export const CAJA_DE_REGRESION = 'AUTO-QA NO TOCAR - CAJA USD';

/**
 * Separa un texto de importe ("USD 1.234,50") en moneda y numero.
 *
 * Se compara el numero y no la cadena: el mismo importe se escribe distinto
 * segun la pantalla. `ToMoneyN3()` del BO usa la coma como decimal y escribe
 * "USD 6,000" para 6.
 */
export const importe = (texto: string): { moneda: string; valor: number | null } => {
  const limpio = (texto || '').replace(/\s+/g, ' ').trim();
  const moneda = limpio.match(/[A-Z]{3}/)?.[0] ?? '';
  return { moneda, valor: importeANumero(limpio) };
};

/** Numero en el formato que espera el BO al escribir: coma decimal. */
export const aFormatoBO = (valor: number) => valor.toFixed(2).replace('.', ',');

/** Nombre del mes de una fecha dd/mm/aaaa, como lo escribe el BO. */
export const nombreDelMes = (fecha: string): string => {
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
    'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  return meses[Number(fecha.split('/')[1]) - 1] ?? '';
};

/** Fecha sumando dias, en el formato dd/mm/aaaa que usa el BO. */
export const masDias = (fecha: string, dias: number): string => {
  const [d, m, a] = fecha.split('/').map(Number);
  const resultado = new Date(a, m - 1, d);
  resultado.setDate(resultado.getDate() + dias);
  return formatearFecha(resultado);
};

/** Celdas de una fila, normalizadas y sin vacias. */
export const celdasDe = async (fila: Locator): Promise<string[]> =>
  (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());

/** Lo que deja la precondicion base: la reserva emitida y su file. */
export type Precondicion = Awaited<ReturnType<typeof reservarServicioYGenerarFile>>;

/**
 * Precondicion: reserva un servicio en el portal, lo emite y genera su file.
 *
 * Es lo que un usuario ya tendria hecho antes de sentarse a cargar la factura
 * del proveedor. No se verifica aca — de eso se ocupa el Bloque B —, pero si
 * se corta con un motivo claro cuando algo no esta, para que un problema de
 * precondicion no se lea como un fallo de la factura.
 */
export async function reservarServicioYGenerarFile(page: Page, sello: string): Promise<{
  codigo: string;
  fileId: string;
  fileCode: string;
  costoDelItem: { moneda: string; valor: number | null };
  ventaDelItem: { moneda: string; valor: number | null };
  apellidoDelPax: string;
  servicio: string;
  cliente: string;
  fechaDelServicio: string;
  cantidadPax: number;
}> {
  const inicio = new InicioPage(page);
  const servicio = new ServicioPage(page);
  const carrito = new CarritoPage(page);
  const bo = new BackOfficePage(page);

  const fecha = fechaDeBusqueda();
  const datos = {
    servicio: 'AUTO-QA NO TOCAR - Tigre y Delta',
    terminoDeBusqueda: 'Tigre y Delta',
    modalidad: 'Regular',
    fecha: formatearFecha(fecha),
    referencia: `AUTO-QA ${sello}`,
    observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
    detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
    apellido: `Regresion${selloEnLetras(sello.slice(-6))}`,
    cantidadPax: 0,
    pasajeros: [] as Pasajero[],
  };

  await paso(page, 'Reservar un servicio en el portal y emitir la reserva', async () => {
    await carrito.vaciar();
    await inicio.abrir();
    const panel = await inicio.abrirSolapa('servicios');
    await servicio.buscar({
      panel, pais: 'Argentina', ciudad: 'Buenos Aires', tipo: 'Excursión', fecha,
    });
    await servicio.buscarPorNombre(datos.terminoDeBusqueda, datos.servicio);
    await servicio.abrirFicha(datos.servicio.slice(0, 24));

    const fila = servicio.bloqueDeModalidad(datos.modalidad);
    await expect(
      fila,
      `La ficha tiene que ofrecer la modalidad ${datos.modalidad} para el ${datos.fecha}. ` +
      'Si no la ofrece, revisar la operatividad del servicio y la vigencia de sus tarifas.',
    ).toBeVisible({ timeout: 30_000 });

    const texto = (await fila.innerText()).replace(/\s+/g, ' ');
    datos.cantidadPax = Number(texto.match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
    await fila.locator(servicio.comboPax).selectOption(String(datos.cantidadPax));
    await esperarFinDeCarga(page);
    await page.locator("[id$='lnkBookService']").first().click();
    await esperarFinDeCarga(page);
    // El contador del encabezado cuenta **items** del carrito, no pasajeros: lo
    // confirmo el PM tras el rediseno del 2026-09-05. Aca se agrega una sola
    // excursion, asi que tiene que mostrar 1 aunque lleve dos pasajeros.
    await expect.poll(() => carrito.paxEnElCarrito(), { timeout: 30_000 })
      .toBe(1);

    datos.pasajeros = Array.from({ length: datos.cantidadPax }, (_, i) => ({
      nombre: `Pasajero${['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho'][i] ?? 'Extra'}`,
      apellido: datos.apellido,
      pasaporte: `QA${sello.slice(-8)}${i + 1}`,
      nacimiento: `0${i + 1}/03/1990`,
      nacionalidad: 'Argentina',
    }));

    await carrito.irAlCarrito();
    await carrito.crearReserva(datos.referencia, datos.observaciones);
    await carrito.asegurarPasajeros(datos.cantidadPax);
    for (const [i, pax] of datos.pasajeros.entries()) await carrito.completarPasajero(i, pax);
    await page.locator("[id$='ctrlBookingServiceDetailControl_txtDetail']").first()
      .fill(datos.detalleDelItem);
    await carrito.completarDatosDeLaReserva(
      datos.cantidadPax, datos.referencia, datos.observaciones,
    );
    await carrito.aceptarTerminos();
  });

  let codigo = '';
  let fileId = '';
  let fileCode = '';
  let costoDelItem = { moneda: '', valor: null as number | null };
  let ventaDelItem = { moneda: '', valor: null as number | null };
  let cliente = '';

  await paso(page, 'Confirmar la reserva y generar su file en el BackOffice', async () => {
    codigo = await carrito.confirmarReserva();
    expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
      .toMatch(/^BO\d{8}$/);

    await bo.ingresar(process.env.BO_USER!, process.env.BO_PASS!);
    await bo.irABandejaDeReservas();
    await bo.filtrar({ emitidas: 'NO' });
    await expect(
      bo.fila(codigo),
      `La reserva ${codigo} tiene que aparecer en la bandeja del BO`,
    ).toBeVisible({ timeout: 60_000 });

    await bo.abrirDetalle(codigo);
    await bo.elegirSucursal('Argentina');
    fileId = await bo.generarFile();
    expect(fileId, 'La generacion del file tiene que devolver su ID').toMatch(/^\d+$/);

    // El codigo del file se escribe en un asp:Literal, que no deja id en el
    // HTML: se lee del h4 que lo contiene (ManageFile.aspx:75).
    fileCode = (await page.locator('h4.title').first().innerText()).replace(/\s+/g, ' ').trim();

    // El cliente del file: lo precarga la agencia al generarlo y es el que
    // despues hay que elegir como destinatario de la factura. Se lee del h5
    // que lo contiene, porque `litCustomerName` es un asp:Literal
    // (ManageFile.aspx:98-100).
    cliente = (await page.locator('#h5Customer').first().innerText()).replace(/\s+/g, ' ').trim();

    // Costo y Venta son las dos ultimas celdas con importe de la fila del
    // servicio. Venta se escribe sin codigo de moneda, asi que no sirve
    // buscar el patron "USD 999".
    const filaDelServicio = page.locator(bo.filaServicioDelFile).first();
    const celdas = await celdasDe(filaDelServicio);
    const soloImporte = /^([A-Z]{3}\s*)?\d[\d.,]*$/;
    const conImporte = celdas.filter((c) => soloImporte.test(c));
    costoDelItem = importe(conImporte.at(-2) ?? '');
    ventaDelItem = importe(conImporte.at(-1) ?? '');

    await adjuntarTexto('Precondicion generada', [
      `Reserva: ${codigo}`,
      `File: ${fileCode} (id ${fileId})`,
      `Servicio: ${datos.servicio}`,
      `Pasajero: ${datos.pasajeros[0]?.nombre} ${datos.apellido}`,
      `Cliente: ${cliente}`,
      `Costo del item: ${conImporte.at(-2) ?? '?'}`,
      `Venta del item: ${conImporte.at(-1) ?? '?'}`,
    ].join(SALTO));

    // Sin costo no hay nada que facturar: el item ni siquiera se listaria
    // entre los pendientes, porque el endpoint descarta los saldos menores a 1.
    expect(
      costoDelItem.valor,
      'El item del file tiene que tener costo cargado. Si viene en cero, revisar ' +
      'las tarifas de costo del servicio (BO_ServiceCostBySupplier) y su vigencia.',
    ).toBeGreaterThan(0);
  });

  return {
    codigo, fileId, fileCode, costoDelItem, ventaDelItem,
    apellidoDelPax: datos.apellido, servicio: datos.servicio,
    cliente, fechaDelServicio: datos.fecha, cantidadPax: datos.cantidadPax,
  };
}
