import { expect, Page, Locator } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage, Pasajero } from '../../pages/carrito.page';
import { BackOfficePage } from '../../pages/backoffice.page';
import { conBackofficeNuevo, costosDelServicio, tarifaVigente, precioEsperado } from '../../utils/markups';
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
 * La caja AUTO-QA de la moneda pedida: 187 en USD y 188 en ARS, las dos en la
 * categoria 18. La orden de pago solo ofrece cajas de su misma moneda.
 *
 * Desde el 12/10/2026 (hotfix `4b60e763` del BO, InboxDetail.aspx.cs) el costo de un
 * servicio del portal sale de la tarifa web, en la moneda del servicio: el Tigre y
 * Delta queda con costo en ARS, asi que la factura del proveedor y su orden de pago
 * salen en pesos. Antes salia de BO_ServiceCostBySupplier, en USD.
 */
export function cajaDeRegresion(moneda: string): string {
  const cajas: Record<string, string> = {
    USD: 'AUTO-QA NO TOCAR - CAJA USD',
    ARS: 'AUTO-QA NO TOCAR - CAJA ARS',
  };
  const caja = cajas[moneda.trim().toUpperCase()];
  if (!caja) throw new Error(`No hay caja de regresion para la moneda "${moneda}"`);
  return caja;
}

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
/** Tigre y Delta (AUTO-QA), el servicio de la precondicion: su costo se lee en el Backoffice nuevo. */
const SERVICIO_REGRESION_ID = 5;

/**
 * Con `conIdioma` la reserva se hace en English (US 4739): Tigre y Delta tiene un recargo del 10% para English en
 * su tarifa Regular. El file suma la fila "Adicional Idioma" del servicio y la venta de las dos filas tiene que ser
 * techo((costo + recargo) por persona / cotizacion / markup de la agencia) x pasajeros: la US pide que "el valor
 * final tiene que calcularse aplicando el markup de la agencia sobre costo + recargo en conjunto, nunca sobre el
 * costo solo", y que el idioma y el recargo "tienen que llegar completos hasta el item de la reserva".
 */
export async function reservarServicioYGenerarFile(page: Page, sello: string, opciones: { conIdioma?: boolean } = {}): Promise<{
  codigo: string;
  fileId: string;
  fileCode: string;
  costoDelItem: { moneda: string; valor: number | null };
  ventaDelItem: { moneda: string; valor: number | null };
  /** Con `conIdioma`: la fila "Adicional Idioma" del file. */
  adicionalDelIdioma: { costo: { moneda: string; valor: number | null }; venta: { moneda: string; valor: number | null } } | null;
  /** La venta de todo el file (el servicio y, si hay, su Adicional Idioma) y cuantos items tiene. */
  ventaDelFile: { moneda: string; valor: number | null };
  itemsDelFile: number;
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
    if (opciones.conIdioma) {
      const idiomas = await page.locator('#sdLangSelect option').evaluateAll(
        (os) => os.map((o) => ({ valor: (o as HTMLOptionElement).value, texto: (o.textContent ?? '').trim() })));
      const ingles = idiomas.find((o) => /^(English|Ingl[eé]s)$/i.test(o.texto));
      expect(ingles, `La ficha tiene que ofrecer el idioma English. Ofrece: ${idiomas.map((o) => o.texto).join(', ')}`).toBeDefined();
      await page.locator('#sdLangSelect').selectOption(ingles!.valor);
      await esperarFinDeCarga(page);
    }

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
    await servicio.agregarAlCarrito();
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
  let adicionalDelIdioma: { costo: { moneda: string; valor: number | null }; venta: { moneda: string; valor: number | null } } | null = null;
  let itemsDelFile = 0;
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
    // Desde la US 4648 los dos importes viven en `td.fi-money` con la moneda pegada
    // al numero, asi que los lee el page object.
    const filaDelServicio = page.locator(bo.filaServicioDelFile).first();
    const montos = await bo.montosDelItemDelFile(filaDelServicio);
    costoDelItem = importe(montos.costo);
    ventaDelItem = importe(montos.venta);
    itemsDelFile = await page.locator(bo.filaServicioDelFile).count();
    if (opciones.conIdioma) {
      const filaDelAdicional = page.locator(bo.filaServicioDelFile).filter({ hasText: /Adicional Idioma/i }).first();
      await expect(filaDelAdicional, 'Reservado en English, el file tiene que traer la fila "Adicional Idioma" del servicio (US 4739)').toBeVisible();
      const m = await bo.montosDelItemDelFile(filaDelAdicional);
      adicionalDelIdioma = { costo: importe(m.costo), venta: importe(m.venta) };
    }

    await adjuntarTexto('Precondicion generada', [
      `Reserva: ${codigo}`,
      `File: ${fileCode} (id ${fileId})`,
      `Servicio: ${datos.servicio}`,
      `Pasajero: ${datos.pasajeros[0]?.nombre} ${datos.apellido}`,
      `Cliente: ${cliente}`,
      `Costo del item: ${montos.costo || '?'}`,
      `Venta del item: ${montos.venta || '?'}`,
      ...(adicionalDelIdioma ? [`Adicional Idioma: costo ${adicionalDelIdioma.costo.valor} / venta ${adicionalDelIdioma.venta.valor}`] : []),
      `Items del file: ${itemsDelFile}`,
    ].join(SALTO));

    // Sin costo no hay nada que facturar: el item ni siquiera se listaria
    // entre los pendientes, porque el endpoint descarta los saldos menores a 1.
    expect(
      costoDelItem.valor,
      'El item del file tiene que tener costo cargado. Si viene en cero, revisar ' +
      'las tarifas de costo del servicio (BO_ServiceCostBySupplier) y su vigencia.',
    ).toBeGreaterThan(0);
  });

  await paso(page, 'El item del file tiene el costo y la venta de la tarifa del servicio', async () => {
    // Costo = costo por persona de la tarifa Regular vigente x pasajeros, en su moneda.
    // Venta = lo que AMV le cobra a la agencia: techo(costo por persona / cotizacion / markup de la
    // agencia) x pasajeros. La agencia de pablo1 (1) no tiene markup de mercado (1); el CustomMarkup
    // de pablo1 es el que la agencia muestra en el sitio y no entra en la venta de AMV.
    const costos = await conBackofficeNuevo(page.context().browser()!, (b) => costosDelServicio(b, SERVICIO_REGRESION_ID));
    const tarifa = tarifaVigente(costos, datos.modalidad, fecha, datos.cantidadPax);
    expect(tarifa, `El servicio ${SERVICIO_REGRESION_ID} tiene que tener una tarifa ${datos.modalidad} vigente el ${datos.fecha}`).toBeDefined();
    const costo = Number((tarifa!.costo! * datos.cantidadPax).toFixed(2));
    const venta = precioEsperado(tarifa!.costo!, tarifa!.moneda, 1)! * datos.cantidadPax;
    await adjuntarTexto('Costo y venta esperados', [
      `Tarifa: ${tarifa!.vigencia} | ${tarifa!.modalidad} | ${tarifa!.moneda} ${tarifa!.costo} por persona | ${datos.cantidadPax} pax`,
      `Costo esperado: ${tarifa!.moneda} ${costo} / en el file: ${costoDelItem.moneda} ${costoDelItem.valor}`,
      `Venta esperada: USD ${venta} / en el file: ${ventaDelItem.moneda} ${ventaDelItem.valor}`,
    ].join(SALTO));
    expect(costoDelItem.moneda, 'El costo del item tiene que estar en la moneda de la tarifa').toBe(tarifa!.moneda);
    expect(costoDelItem.valor, 'El costo del item tiene que ser el costo por persona de la tarifa por los pasajeros').toBe(costo);
    expect(ventaDelItem.moneda, 'La venta del item tiene que estar en USD').toBe('USD');
    // Con idioma la venta se reparte entre el servicio y su Adicional Idioma, y la US no dice como: se exige la suma (abajo).
    if (!opciones.conIdioma) expect(ventaDelItem.valor, 'La venta del item tiene que ser techo(costo / cotizacion) por pasajero, por los pasajeros').toBe(venta);
    const adicional = adicionalDelIdioma;
    if (adicional) {
      const recargo = tarifa!.recargos.find((r) => /^(English|Ingl[eé]s)$/i.test(r.idioma));
      expect(recargo, `La tarifa ${datos.modalidad} del servicio ${SERVICIO_REGRESION_ID} tiene que tener recargo para English`).toBeDefined();
      const recargoPax = recargo!.tipo === 'porcentaje' ? tarifa!.costo! * recargo!.valor / 100 : recargo!.tipo === 'porPasajero' ? recargo!.valor : recargo!.valor / datos.cantidadPax;
      const costoDelRecargo = Number((recargoPax * datos.cantidadPax).toFixed(2));
      const ventaConRecargo = precioEsperado(tarifa!.costo! + recargoPax, tarifa!.moneda, 1)! * datos.cantidadPax;
      const ventaDeLasDos = Number(((ventaDelItem.valor ?? 0) + (adicional.venta.valor ?? 0)).toFixed(2));
      await adjuntarTexto('Adicional Idioma esperado', [
        `Recargo English: ${JSON.stringify(recargo)} -> ${tarifa!.moneda} ${recargoPax} por persona`,
        `Costo del adicional esperado: ${tarifa!.moneda} ${costoDelRecargo} / en el file: ${adicional.costo.moneda} ${adicional.costo.valor}`,
        `Venta del servicio + adicional esperada: techo((${tarifa!.costo} + ${recargoPax}) / cotizacion) x ${datos.cantidadPax} = USD ${ventaConRecargo} / en el file: ${ventaDelItem.valor} + ${adicional.venta.valor} = ${ventaDeLasDos}`,
      ].join(String.fromCharCode(10)));
      expect(adicional.costo.valor, 'El file tiene que traer el recargo de English como item de costo propio ("Adicional Idioma")').toBe(costoDelRecargo);
      expect(ventaDeLasDos, 'La venta del servicio mas su Adicional Idioma tiene que ser techo((costo + recargo) / cotizacion / markup) x pasajeros (US 4739)').toBe(ventaConRecargo);
    }
  });

  // TypeScript no ve la asignacion dentro del paso: se tipa a mano.
  const ad = adicionalDelIdioma as { venta: { valor: number | null } } | null;
  const ventaDelFile = { moneda: ventaDelItem.moneda, valor: ad ? Number(((ventaDelItem.valor ?? 0) + (ad.venta.valor ?? 0)).toFixed(2)) : ventaDelItem.valor };
  return {
    codigo, fileId, fileCode, costoDelItem, ventaDelItem, adicionalDelIdioma, ventaDelFile, itemsDelFile,
    apellidoDelPax: datos.apellido, servicio: datos.servicio,
    cliente, fechaDelServicio: datos.fecha, cantidadPax: datos.cantidadPax,
  };
}
