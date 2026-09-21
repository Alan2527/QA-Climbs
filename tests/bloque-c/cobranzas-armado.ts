import { test, expect, Page, Locator } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage, Pasajero } from '../../pages/carrito.page';
import { BackOfficePage } from '../../pages/backoffice.page';
import { FacturaProveedorPage } from '../../pages/factura-proveedor.page';
import { OrdenDePagoPage } from '../../pages/orden-de-pago.page';
import { FacturaClientePage } from '../../pages/factura-cliente.page';
import { OrdenDeCobroPage } from '../../pages/orden-de-cobro.page';
import { CajaDiariaPage } from '../../pages/caja-diaria.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, formatearFecha,
  reiniciarNumeracionDePasos, conResaltado, importeANumero,
} from '../../utils/pasos';
import {
  SALTO, CAJA_DE_REGRESION, importe, aFormatoBO, nombreDelMes, masDias, celdasDe,
  Precondicion, reservarServicioYGenerarFile,
} from './cobranzas-comun';

/**
 * Armados compartidos del Bloque C: los tramos que un eslabon necesita tener hechos
 * antes de probar lo suyo (la factura aprobada para pagarla, el comprobante para
 * cobrarlo) y las verificaciones del formulario de la US 4722.
 *
 * Salieron de cobranzas.spec.ts el 2026-09-14, cuando se partio por eslabon.
 */

/**
 * Formulario bloqueado mientras falta la sucursal o el proveedor.
 *
 * US 4722, task 4725: "Mientras falte elegir la sucursal o el proveedor, ningún
 * otro campo del formulario tiene que estar visible, y los botones de guardar
 * tienen que estar deshabilitados. En su lugar tiene que verse un aviso con el
 * texto «Seleccione una sucursal y un proveedor para continuar con la carga del
 * comprobante»".
 */
export async function verificarFormularioBloqueado(page: Page, factura: FacturaProveedorPage, momento: string) {
  const aviso = page.locator(factura.avisoSeleccion);
  await conResaltado(page, aviso, `Aviso de seleccion ${momento}`, async () => {
    await expect(aviso, `${momento}, tiene que verse el aviso de la US 4722`).toBeVisible({ timeout: 30_000 });
    expect((await aviso.innerText()).replace(/\s+/g, ' ').trim(), 'El aviso tiene que decir el texto de la task 4725')
      .toContain(FacturaProveedorPage.TEXTO_AVISO);
  });
  for (const campo of factura.camposDelFormulario) {
    await expect(page.locator(campo), `${momento}, ${campo} no tiene que estar visible`).toBeHidden();
  }
  for (const boton of [factura.btnGuardar, factura.btnGuardarYVolver]) {
    await expect(page.locator(boton), `${momento}, ${boton} tiene que estar deshabilitado`).toBeDisabled();
  }
}

/**
 * Formulario completo con sucursal y proveedor elegidos. Task 4725: "Elegir
 * sucursal y después proveedor → el aviso desaparece, aparecen Documento, Medio
 * de Pago, fechas, moneda e importes, y los botones de guardar quedan habilitados."
 */
export async function verificarFormularioHabilitado(page: Page, factura: FacturaProveedorPage) {
  await conResaltado(page, page.locator('body'), 'Formulario completo', async () => {
    await expect(page.locator(factura.avisoSeleccion),
      'Elegidas sucursal y proveedor, el aviso tiene que desaparecer').toBeHidden({ timeout: 30_000 });
    for (const campo of factura.camposDelFormulario) {
      await expect(page.locator(campo), `Elegidas sucursal y proveedor, tiene que verse ${campo}`).toBeVisible();
    }
    for (const boton of [factura.btnGuardar, factura.btnGuardarYVolver]) {
      await expect(page.locator(boton), `Elegidas sucursal y proveedor, ${boton} tiene que quedar habilitado`)
        .toBeEnabled();
    }
  });
}

/**
 * Precondicion del eslabon 2: una factura de proveedor imputada y aprobada.
 *
 * Repite mecanicamente lo que el test del eslabon 1 verifica paso por paso.
 * No comparte codigo con el porque alla cada paso lleva su comparacion
 * intercalada: extraer una funcion comun obligaria a parametrizar que se
 * verifica y que no, y el test del eslabon 1 dejaria de leerse. Aca solo se
 * corta con un motivo claro si algo no esta, para que un problema de
 * precondicion no se lea como un fallo de la orden de pago.
 */
export async function armarFacturaAprobada(
  page: Page, sello: string, ahora: Date, precondicion: Precondicion,
): Promise<{
  fileCode: string;
  numeroDeFactura: string;
  puntoDeVenta: string;
  total: number;
  moneda: string;
}> {
  const factura = new FacturaProveedorPage(page);
  const total = precondicion.costoDelItem.valor as number;

  const puntoDeVenta = '0001';
  const numero = [
    String(ahora.getDate()).padStart(2, '0'),
    String(ahora.getHours()).padStart(2, '0'),
    String(ahora.getMinutes()).padStart(2, '0'),
    String(ahora.getSeconds()).padStart(2, '0'),
  ].join('');

  await paso(page, 'Cargar la factura del proveedor, imputarla al file y aprobarla', async () => {
    await factura.irABandejaDeFacturas();
    await factura.nuevaFactura();
    await factura.elegirSucursal('Argentina');
    await factura.elegirProveedor('GRUPO SUMMA', 'GRUPO SUMMA SRL');

    await page.locator(factura.comboTipo).selectOption({ label: 'Factura A' });
    await esperarFinDeCarga(page);
    await page.locator(factura.campoPuntoDeVenta).fill(puntoDeVenta);
    await page.locator(factura.campoNumero).fill(numero);
    await page.locator(factura.comboMoneda).selectOption({ label: precondicion.costoDelItem.moneda });
    await esperarFinDeCarga(page);
    await factura.cargarImporte(aFormatoBO(total));
    await page.locator(factura.campoComentario)
      .fill(`Factura de regresion automatica ${sello}. No operar.`);

    const id = await factura.guardar();
    expect(
      id,
      `La precondicion tiene que poder crear la factura del proveedor. El BO dijo: ` +
      `"${await factura.mensajeDeError()}"`,
    ).toMatch(/^\d+$/);

    await factura.buscarPendiente(precondicion.fileCode);
    const fila = factura.filaPendiente(precondicion.fileCode);
    await expect(
      fila,
      `La precondicion necesita que el item del file ${precondicion.fileCode} figure entre ` +
      'los pendientes de imputar de la factura',
    ).toBeVisible({ timeout: 60_000 });

    await factura.abrirAsignacion(fila);
    await factura.imputar(aFormatoBO(total), `AUTO-QA ${sello.slice(-8)}`);
    await factura.aprobar();

    expect(
      await factura.estaAprobada(),
      'La precondicion necesita la factura aprobada para poder pagarla',
    ).toBe(true);

    await adjuntarTexto('Factura de proveedor de la precondicion', [
      `File: ${precondicion.fileCode}`,
      `Comprobante: ${puntoDeVenta}-${numero} (id ${id})`,
      `Total: ${precondicion.costoDelItem.moneda} ${aFormatoBO(total)}`,
    ].join(SALTO));
  });

  return {
    fileCode: precondicion.fileCode,
    numeroDeFactura: numero,
    puntoDeVenta,
    total,
    moneda: precondicion.costoDelItem.moneda,
  };
}

/**
 * Precondicion del eslabon 4: un comprobante emitido al cliente, pendiente de cobro.
 *
 * Repite mecanicamente lo que el test del eslabon 3 verifica paso por paso, por
 * el mismo motivo que `armarFacturaAprobada`: alla las comparaciones van
 * intercaladas con los pasos y extraer una funcion comun obligaria a
 * parametrizar que se verifica.
 */
export async function armarFacturaAlCliente(
  page: Page, sello: string, precondicion: Precondicion,
): Promise<{
  fileCode: string;
  cliente: string;
  comprobante: string;
  total: number;
}> {
  const factura = new FacturaClientePage(page);
  const digitosDelFile = precondicion.fileCode.match(/\d{6,}/)?.[0] ?? '';

  let comprobante = '';
  let total = 0;

  await paso(page, 'Emitir la factura al cliente sobre el file', async () => {
    await factura.irANuevoComprobante();
    await factura.elegirDestinatario(precondicion.cliente);
    await factura.elegirFile(digitosDelFile);

    total = importe(await page.locator(factura.campoTotal).inputValue()).valor as number;
    expect(
      total,
      'La precondicion necesita un comprobante con importe: el file tiene que traer sus conceptos',
    ).toBeGreaterThan(0);

    await page.locator(factura.campoDetalle)
      .fill(`Factura de regresion automatica ${sello}. No operar.`);
    const cotizacion = (await page.locator(factura.campoCotizacion).inputValue()).trim();
    if (!cotizacion || Number(cotizacion.replace(',', '.')) <= 0) {
      await page.locator(factura.campoCotizacion).fill('1');
    }
    await factura.guardar();

    const fila = factura.filaPendiente(digitosDelFile);
    await expect(
      fila,
      `La precondicion necesita el comprobante del file ${precondicion.fileCode} en la bandeja ` +
      `de pendientes. El BO dijo: "${await factura.mensajeDeError()}"`,
    ).toBeVisible({ timeout: 60_000 });

    // El numero del comprobante es lo que despues hay que ubicar entre los
    // pendientes de cobro: se lee de la bandeja, no se arma.
    const celdas = await factura.celdas(fila);
    comprobante = celdas.find((c) => /^[A-Z]{2}\d/.test(c)) ?? '';
    expect(
      comprobante,
      `No se pudo leer el numero del comprobante de la bandeja: ${celdas.join(' | ')}`,
    ).not.toBe('');

    await adjuntarTexto('Comprobante de la precondicion', [
      `File: ${precondicion.fileCode}`,
      `Cliente: ${precondicion.cliente}`,
      `Comprobante: ${comprobante}`,
      `Total: ${total}`,
    ].join(SALTO));
  });

  return { fileCode: precondicion.fileCode, cliente: precondicion.cliente, comprobante, total };
}

/** Precondicion: una orden de pago aprobada sobre la factura del proveedor. */
export async function armarOrdenDePagoAprobada(
  page: Page, sello: string, fecha: string,
  factura: { total: number; moneda: string; numeroDeFactura: string },
): Promise<string> {
  const orden = new OrdenDePagoPage(page);
  let codigo = '';

  await paso(page, 'Pagar la factura del proveedor desde la caja de regresion', async () => {
    await orden.irABandejaDeOrdenes();
    await orden.nuevaOrden();
    // La pantalla recuerda la ultima sucursal usada: se fija, no se supone.
    await orden.asegurarSucursal('Argentina');
    await orden.elegirProveedor('GRUPO SUMMA', 'GRUPO SUMMA SRL');
    await orden.elegirEnCombo(orden.comboMoneda, factura.moneda);
    await orden.elegirEnCombo(orden.comboCaja, CAJA_DE_REGRESION);
    await orden.cargarImporte(aFormatoBO(factura.total));
    await page.locator(orden.campoDetalle)
      .fill(`Orden de pago de regresion automatica ${sello}. No operar.`);

    const id = await orden.guardar();
    expect(
      id,
      `La precondicion tiene que poder crear la orden de pago. El BO dijo: ` +
      `"${await orden.mensajeDeError()}"`,
    ).toMatch(/^\d+$/);

    await orden.abrirAsignacion(orden.filaPendiente(factura.numeroDeFactura));
    await orden.imputar(aFormatoBO(factura.total), `AUTO-QA ${sello.slice(-8)}`);
    await orden.aprobar(fecha, `AUTOQAP${sello.slice(-7)}`);

    codigo = (await page.locator(orden.campoCodigo).inputValue()).trim();
    expect(
      await orden.estado(),
      'La precondicion necesita la orden de pago aprobada para que caiga en la caja del dia',
    ).toContain('PAGO');
    await adjuntarTexto('Orden de pago de la precondicion', codigo);
  });

  return codigo;
}

/** Precondicion: una orden de cobro aprobada sobre el comprobante del cliente. */
export async function armarOrdenDeCobroAprobada(
  page: Page, sello: string, fecha: string,
  comprobante: { total: number; cliente: string; fileCode: string },
): Promise<string> {
  const orden = new OrdenDeCobroPage(page);
  let codigo = '';

  await paso(page, 'Cobrar el comprobante del cliente en la caja de regresion', async () => {
    await orden.irABandejaDeOrdenes();
    await orden.nuevaOrden();
    await orden.elegirCliente(comprobante.cliente, comprobante.cliente);
    await orden.elegirEnCombo(orden.comboMoneda, 'USD');
    await orden.elegirEnCombo(orden.comboCaja, CAJA_DE_REGRESION);
    await orden.cargarImporte(aFormatoBO(comprobante.total));
    await page.locator(orden.campoDetalle)
      .fill(`Orden de cobro de regresion automatica ${sello}. No operar.`);

    const id = await orden.guardar();
    expect(
      id,
      `La precondicion tiene que poder crear la orden de cobro. El BO dijo: ` +
      `"${await orden.mensajeDeError()}"`,
    ).toMatch(/^\d+$/);

    await orden.abrirAsignacion(orden.filaPendiente(comprobante.fileCode));
    await orden.imputar(aFormatoBO(comprobante.total), `AUTO-QA ${sello.slice(-8)}`);
    await orden.aprobar(fecha, `AUTOQAC${sello.slice(-7)}`);

    codigo = (await page.locator(orden.campoCodigo).inputValue()).trim();
    expect(
      await orden.estado(),
      'La precondicion necesita la orden de cobro aprobada para que caiga en la caja del dia',
    ).toContain('PAGO');
    await adjuntarTexto('Orden de cobro de la precondicion', codigo);
  });

  return codigo;
}
