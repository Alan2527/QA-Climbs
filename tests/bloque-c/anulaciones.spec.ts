import { test, expect, Page, Locator } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { OrdenDePagoPage } from '../../pages/orden-de-pago.page';
import { CartasEmitidasPage, AnulacionDeOrdenesPage, estadoDeLaOrden } from '../../pages/anulaciones.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, formatearFecha, numeroDelFile,
  reiniciarNumeracionDePasos, conResaltado,
} from '../../utils/pasos';
import { aFormatoBO, cajaDeRegresion, importe, reservarServicioYGenerarFile } from './cobranzas-comun';
import { armarFacturaAprobada, armarFacturaAlCliente } from './cobranzas-armado';

/**
 * BLOQUE C — Anulaciones.
 *
 * Hasta ahora la suite paga y cobra todo, pero no prueba nada de deshacer. Anular es
 * el circuito mas delicado de Cobranzas: si una carta de cobranza se borra y el file
 * sigue "Facturado", o si una orden de pago ya imputada se deja anular, la factura del
 * proveedor y la caja quedan descuadradas sin que nadie lo vea. Cada test arma su
 * propia cadena sobre un file nuevo y prueba una anulacion:
 *
 * 1. Anular la Carta de Cobranza (Cartas emitidas, `IssuedLetters.aspx.cs:46-68`):
 *    sale de Cartas emitidas, el panel "Comprobantes y saldos" del file la deja de
 *    listar y vuelve a faltar cobrar toda la venta, el file pasa de Facturado a
 *    A Facturar (`InvoicingSvc.Save` llama a `SynchronizeState`) y se puede volver a
 *    facturar.
 * 2. Anular una orden de pago (`PayOrders/Default.aspx.cs:208`): una orden sin imputar
 *    se anula; una orden ya imputada a la factura del proveedor sigue vigente. El BO
 *    la protege de dos formas: no dibuja el boton Anular de la fila (`CheckVisible`) y,
 *    si el click llega igual desde una bandeja que quedo desactualizada, el guard
 *    `CheckByPayOrder` no anula y redirige **en silencio**. Por eso el test no busca
 *    un mensaje: mira que la orden siga vigente e imputada.
 * 3. Ordenes de pago parciales (fix 4880, aviso al superar el pendiente): imputar
 *    parcial baja el pendiente de la factura exactamente ese monto, y no se puede
 *    imputar mas que el pendiente ni de la orden ni de la factura.
 *
 * El BO no tiene selector de idioma ni tema oscuro: no aplican esas consideraciones.
 */
test.describe('Cobranzas — anulaciones', () => {
  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  const baseBO = () => process.env.AMV_BO_URL || 'https://qa.bo.amv.travel';
  const ESTADO_A_FACTURAR = '70';
  const ESTADO_FACTURADO = '80';

  // --- Panel "Comprobantes y saldos" del file (mismos selectores que cierre-del-file.spec.ts) ---

  /** Un lado del panel (Cliente o Proveedores), por el titulo que lo nombra. */
  const lado = (page: Page, id: 'boCompCliente' | 'boCompProveedores') =>
    page.locator(`section.bo-comp__lado[aria-labelledby="${id}"]`);

  /** Las cifras de un lado: "Venta del file", "Facturado", "Cobrado"/"Pagado", "Falta ...". */
  async function cifras(seccion: Locator): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const cifra of await seccion.locator('.bo-comp__cifra').all()) {
      const dt = (await cifra.locator('dt').innerText()).trim();
      out[dt] = (await cifra.locator('dd').innerText()).replace(/\s+/g, ' ').trim();
    }
    return out;
  }

  /** Formato del BO: punto de miles y coma decimal ("63,067", "94.600,00"). */
  const numero = (t: string) => Number(t.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));

  /** La lista "Facturas" del lado Cliente: su cabecera, sus filas y el cartel de vacia. */
  const listaDeFacturas = (page: Page) =>
    lado(page, 'boCompCliente').locator('.bo-comp__lista')
      .filter({ has: page.locator('.bo-comp__lista-titulo', { hasText: /^Facturas$/ }) })
      .first();

  async function abrirFile(page: Page, fileId: string) {
    await page.goto(`${baseBO()}/booking/files/managefile/${fileId}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await esperarFinDeCarga(page);
    await expect(page.locator('#btnSave'), 'El file tiene que abrir con el boton Guardar').toBeVisible({ timeout: 60_000 });
    const panel = page.locator('section.bo-ficha__grupo').filter({ hasText: 'Comprobantes y saldos' });
    await expect(panel, 'El file tiene que mostrar el panel "Comprobantes y saldos"').toBeVisible({ timeout: 60_000 });
  }

  async function estadoDelFile(page: Page) {
    return {
      estado: await page.locator('#ddFileStatus').inputValue(),
      estadoTexto: (await page.locator('#ddFileStatus option:checked').innerText()).trim(),
    };
  }

  // --- Ordenes de pago ---

  /**
   * Guarda una orden de pago a GRUPO SUMMA desde la caja de regresion, **sin imputarla**.
   * Es el mismo tramo de `armarOrdenDePagoAprobada`, cortado antes de la imputacion.
   */
  async function guardarOrdenSinImputar(page: Page, moneda: string, monto: number, detalle: string) {
    const orden = new OrdenDePagoPage(page);
    await orden.irABandejaDeOrdenes();
    await orden.nuevaOrden();
    // La pantalla recuerda la ultima sucursal usada: se fija, no se supone.
    await orden.asegurarSucursal('Argentina');
    await orden.elegirProveedor('GRUPO SUMMA', 'GRUPO SUMMA SRL');
    await orden.elegirEnCombo(orden.comboMoneda, moneda);
    await orden.elegirEnCombo(orden.comboCaja, cajaDeRegresion(moneda));
    await orden.cargarImporte(aFormatoBO(monto));
    await page.locator(orden.campoDetalle).fill(detalle);

    const id = await orden.guardar();
    expect(
      id,
      `La precondicion tiene que poder crear la orden de pago. El BO dijo: "${await orden.mensajeDeError()}"`,
    ).toMatch(/^\d+$/);
    const codigo = (await page.locator(orden.campoCodigo).inputValue()).trim();
    await adjuntarTexto(`Orden de pago guardada sin imputar (${detalle})`, `${codigo} (id ${id}) por ${moneda} ${aFormatoBO(monto)}`);
    return { id, codigo };
  }

  /** Ubica una orden en la bandeja con el buscador de la propia grilla. */
  async function buscarOrdenEnLaBandeja(page: Page, orden: OrdenDePagoPage, codigo: string) {
    await orden.irABandejaDeOrdenes();
    await esperarFinDeCarga(page);
    await orden.buscarEnLaBandeja(codigo);
    return orden.filaEnLaBandeja(codigo);
  }

  /** Saldo de la factura en la grilla de pendientes de una orden: el ultimo importe de la fila. */
  async function saldoDeLaFactura(orden: OrdenDePagoPage, fila: Locator): Promise<number> {
    const celdas = await orden.celdas(fila);
    const soloImporte = /^([A-Z]{3}\s*)?\d[\d.,]*$/;
    const importes = celdas.filter((c) => soloImporte.test(c)).map(importe);
    await adjuntarTexto('Fila de la factura pendiente de pago', celdas.join(' | '));
    return importes.at(-1)?.valor as number;
  }

  /**
   * Intenta imputar un monto que el BO tiene que rechazar y espera el aviso. El aviso
   * aparece y se desvanece solo, asi que se espera apenas llega.
   */
  async function imputarYEsperarAviso(page: Page, monto: number, aviso: RegExp, etiqueta: string) {
    await page.locator('#txtInvoiceAllocationAmount').fill(aFormatoBO(monto));
    await page.locator('#txtInvoiceAllocationComment').fill('AUTO-QA monto excedido');
    await page.locator("[id$='lnkConfirmAllocate']").first().click();
    const noty = page.locator('.noty_text, .noty_body, .noty_message').filter({ hasText: aviso }).first();
    await conResaltado(page, page.locator('body'), etiqueta, async () => {
      await expect(noty, `Al superar el pendiente, el BO tiene que avisar ${aviso}`).toBeVisible({ timeout: 30_000 });
    });
    await adjuntarTexto(etiqueta, (await noty.innerText().catch(() => '')) || '(el aviso se fue antes de leerlo)');
  }

  // =====================================================================================
  // 1. Anular la carta de cobranza
  // =====================================================================================
  test('Anular la carta de cobranza: sale de Cartas emitidas, el file vuelve a A Facturar y se puede volver a facturar', async ({ page }) => {
    test.setTimeout(1_800_000);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const cartas = new CartasEmitidasPage(page);

    // --- Un file nuevo con su carta de cobranza emitida y sin cobrar ---
    const base = await reservarServicioYGenerarFile(page, sello);
    const carta = await armarFacturaAlCliente(page, sello, base);
    const digitosDelFile = numeroDelFile(base.fileCode);

    let estadoAntes = { estado: '', estadoTexto: '' };

    await paso(page, `Abrir el file ${base.fileCode} y leer su estado y el panel con la carta emitida`, async () => {
      await abrirFile(page, base.fileId);
      estadoAntes = await estadoDelFile(page);
      const cliente = await cifras(lado(page, 'boCompCliente'));
      await adjuntarTexto('Estado del file con la carta emitida', JSON.stringify(estadoAntes, null, 1));
      await adjuntarTexto('Cifras del cliente con la carta emitida', JSON.stringify(cliente, null, 1));

      const filas = listaDeFacturas(page).locator('.bo-comp__fila');
      await conResaltado(page, listaDeFacturas(page), 'Carta en la lista de facturas', async () => {
        await expect(filas, 'Con la carta emitida, la lista "Facturas" del cliente tiene que tener una sola fila').toHaveCount(1);
        await expect(filas.first(), `La fila tiene que ser la de la carta ${carta.comprobante}`).toContainText(carta.comprobante);
      });
      await conResaltado(page, lado(page, 'boCompCliente'), 'Facturado del cliente', async () => {
        expect(numero(cliente['Facturado']), 'La carta factura toda la venta del file').toBe(base.ventaDelItem.valor);
      });

      // `SynchronizeState` pasa el file a Facturado cuando lo facturado cubre su venta
      // (CustomerInvoiceWorkflowSvc.cs:131). Si no lo hizo, el paso de abajo que mira la
      // vuelta a A Facturar no tiene punto de partida y se avisa en vez de exigirlo.
      if (estadoAntes.estado !== ESTADO_FACTURADO) {
        test.info().annotations.push({
          type: 'aviso',
          description: `Con la carta emitida el file quedo en "${estadoAntes.estadoTexto}" (${estadoAntes.estado}) y no en Facturado (80): no se exige la vuelta a A Facturar.`,
        });
      }
    });

    await paso(page, 'Anular la carta desde Cartas emitidas del file', async () => {
      await cartas.abrirDelFile(base.fileId);
      const fila = cartas.fila(carta.comprobante);
      await expect(fila, `Cartas emitidas tiene que listar la carta ${carta.comprobante} del file`).toBeVisible({ timeout: 60_000 });
      await adjuntarTexto('Fila de la carta antes de anularla', (await cartas.celdas(fila)).join(' | '));

      await cartas.anular(fila);

      // El BO recarga la pagina solo; el resultado es la grilla vacia para ese file.
      await conResaltado(page, page.locator(cartas.grilla), 'Cartas emitidas despues de anular', async () => {
        await expect(page.locator(cartas.filaVacia),
          'Anulada la unica carta del file, Cartas emitidas no tiene que listar ninguna').toBeVisible({ timeout: 120_000 });
        await expect(cartas.fila(digitosDelFile), `La carta ${carta.comprobante} no tiene que seguir en Cartas emitidas`).toHaveCount(0);
      });
    });

    await paso(page, 'El panel Comprobantes y saldos deja de listar la carta y vuelve a faltar cobrar la venta', async () => {
      await abrirFile(page, base.fileId);
      const cliente = await cifras(lado(page, 'boCompCliente'));
      await adjuntarTexto('Cifras del cliente con la carta anulada', JSON.stringify(cliente, null, 1));

      await conResaltado(page, listaDeFacturas(page), 'Lista de facturas sin la carta', async () => {
        await expect(listaDeFacturas(page).locator('.bo-comp__fila'),
          'Anulada la carta, la lista "Facturas" del cliente no tiene que listar ningun comprobante').toHaveCount(0);
        await expect(listaDeFacturas(page).locator('.bo-comp__vacio'),
          'Sin comprobantes, la lista tiene que mostrar el cartel de vacia').toBeVisible();
      });
      await conResaltado(page, lado(page, 'boCompCliente'), 'Saldo del cliente sin la carta', async () => {
        expect(numero(cliente['Venta del file']), 'La anulacion no toca la venta del file').toBe(base.ventaDelItem.valor);
        expect(numero(cliente['Facturado']), 'Sin la carta, no queda nada facturado').toBe(0);
        expect(numero(cliente['Cobrado']), 'No se cobro nada').toBe(0);
        expect(numero(cliente['Falta cobrar']), 'Sin la carta, vuelve a faltar cobrar toda la venta').toBe(base.ventaDelItem.valor);
      });
      await expect(lado(page, 'boCompCliente').locator('.bo-comp__cifra--debe'),
        'La cifra "Falta cobrar" tiene que volver a marcarse como deuda').toHaveCount(1);

      // El estado vuelve a A Facturar (70): `InvoicingSvc.Save` retira la carta y llama a
      // `SynchronizeState`, que baja de Facturado a A Facturar (CustomerInvoiceWorkflowSvc.cs:132).
      const estado = await estadoDelFile(page);
      await adjuntarTexto('Estado del file con la carta anulada', JSON.stringify(estado, null, 1));
      if (estadoAntes.estado === ESTADO_FACTURADO) {
        await conResaltado(page, page.locator('#ddFileStatus'), 'Estado del file', async () => {
          expect(estado.estado,
            `Anulada la unica carta, el file Facturado tiene que volver a A Facturar (era "${estadoAntes.estadoTexto}")`)
            .toBe(ESTADO_A_FACTURAR);
        });
      }
    });

    let nuevaCarta = { comprobante: '', total: 0 };
    await paso(page, 'Volver a facturar el file: la venta quedo libre y la carta nueva lleva otro numero', async () => {
      // Si la anulacion hubiera dejado los items del file atados a la carta borrada, o el
      // saldo facturado sin liberar, el BO rechazaria esta emision (ValidateSale).
      const emitida = await armarFacturaAlCliente(page, sello, base);
      nuevaCarta = { comprobante: emitida.comprobante, total: emitida.total };
      await adjuntarTexto('Carta nueva', `${emitida.comprobante} por ${emitida.total} (la anulada era ${carta.comprobante} por ${carta.total})`);

      await conResaltado(page, page.locator('body'), 'Carta nueva', async () => {
        expect(emitida.comprobante, 'La carta nueva no puede reusar el numero de la anulada').not.toBe(carta.comprobante);
        expect(emitida.total, 'La carta nueva tiene que facturar la misma venta').toBe(carta.total);
      });

      await abrirFile(page, base.fileId);
      const filas = listaDeFacturas(page).locator('.bo-comp__fila');
      await conResaltado(page, listaDeFacturas(page), 'Carta nueva en el panel', async () => {
        await expect(filas, 'El panel tiene que listar solo la carta nueva').toHaveCount(1);
        await expect(filas.first(), `La fila tiene que ser la carta nueva ${nuevaCarta.comprobante}`).toContainText(nuevaCarta.comprobante);
        await expect(filas.first(), 'La carta anulada no puede volver a aparecer').not.toContainText(carta.comprobante);
      });
      if (estadoAntes.estado === ESTADO_FACTURADO) {
        const estado = await estadoDelFile(page);
        await conResaltado(page, page.locator('#ddFileStatus'), 'Estado del file refacturado', async () => {
          expect(estado.estado, 'Facturada de nuevo toda la venta, el file tiene que volver a Facturado').toBe(ESTADO_FACTURADO);
        });
      }
    });
  });

  // =====================================================================================
  // 2. Anular ordenes de pago
  // =====================================================================================
  test('Anular ordenes de pago: la que no tiene imputacion se anula y la imputada sigue vigente', async ({ page }) => {
    test.setTimeout(1_800_000);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);
    const orden = new OrdenDePagoPage(page);
    const anulaciones = new AnulacionDeOrdenesPage(page);

    // --- Un file nuevo con una factura de proveedor aprobada y sin pagar ---
    const base = await reservarServicioYGenerarFile(page, sello);
    const factura = await armarFacturaAprobada(page, sello, ahora, base);

    // La orden de prueba 1 es chica y no se imputa nunca; la 2 cubre la factura entera.
    const MONTO_DE_LA_PRIMERA = 100;

    await paso(page, 'Una orden de pago sin imputar se puede anular desde la bandeja', async () => {
      const primera = await guardarOrdenSinImputar(page, factura.moneda, MONTO_DE_LA_PRIMERA,
        `Orden de pago de regresion automatica ${sello} para anular. No operar.`);

      let fila = await buscarOrdenEnLaBandeja(page, orden, primera.codigo);
      await expect(fila, `La orden ${primera.codigo} tiene que figurar en la bandeja`).toBeVisible({ timeout: 60_000 });
      await conResaltado(page, fila, 'Boton Anular de la orden sin imputar', async () => {
        await expect(anulaciones.botonAnular(fila),
          'Sin imputaciones, la bandeja tiene que ofrecer el boton Anular de la orden').toHaveCount(1);
      });

      await anulaciones.anular(fila);

      // Anulada, deja de listarse (la bandeja oculta las anuladas salvo "Incluir anuladas").
      fila = await buscarOrdenEnLaBandeja(page, orden, primera.codigo);
      await conResaltado(page, page.locator('#tblPayOrders'), 'Orden anulada fuera de la bandeja', async () => {
        await expect(fila, `La orden anulada ${primera.codigo} no tiene que seguir en la bandeja`).toHaveCount(0);
      });

      await anulaciones.abrirDetalle(page, primera.id);
      const estado = await estadoDeLaOrden(page);
      await adjuntarTexto('Estado de la orden anulada', JSON.stringify(estado));
      await conResaltado(page, page.locator('h5.text-uppercase').first(), 'Estado de la orden anulada', async () => {
        expect(estado.anulada, 'El detalle tiene que mostrar la orden como anulada').toBe(true);
        expect(estado.estado.toUpperCase(), 'El estado tiene que decir Anulado').toContain('ANULADO');
      });
    });

    const segunda = { id: '', codigo: '' };

    await paso(page, 'Guardar una orden por el total de la factura, todavia sin imputar, y ver que la bandeja ofrece Anular', async () => {
      Object.assign(segunda, await guardarOrdenSinImputar(page, factura.moneda, factura.total,
        `Orden de pago de regresion automatica ${sello} imputada. No operar.`));

      const fila = await buscarOrdenEnLaBandeja(page, orden, segunda.codigo);
      await expect(fila, `La orden ${segunda.codigo} tiene que figurar en la bandeja`).toBeVisible({ timeout: 60_000 });
      await conResaltado(page, fila, 'Boton Anular antes de imputar', async () => {
        await expect(anulaciones.botonAnular(fila),
          'Mientras no tenga imputaciones, la bandeja ofrece Anular').toHaveCount(1);
      });
    });

    await paso(page, 'Imputar la orden a la factura desde otra pestana, sin recargar la bandeja', async () => {
      // La bandeja de la pestana principal queda abierta tal cual: sigue dibujando el
      // boton Anular de una orden que, de aca en adelante, ya esta imputada.
      const otra = await page.context().newPage();
      try {
        const ordenEnOtra = new OrdenDePagoPage(otra);
        await new AnulacionDeOrdenesPage(otra).abrirDetalle(otra, segunda.id);
        await ordenEnOtra.abrirAsignacion(ordenEnOtra.filaPendiente(factura.numeroDeFactura));
        await ordenEnOtra.imputar(aFormatoBO(factura.total), `AUTO-QA ${sello.slice(-8)}`);

        const pendiente = importe(await ordenEnOtra.pendiente());
        await adjuntarTexto('Pendiente de la orden despues de imputar (otra pestana)', await ordenEnOtra.pendiente());
        expect(pendiente.valor, 'Imputada la factura entera, la orden no tiene que tener pendiente').toBe(0);
      } finally {
        await otra.close();
      }
    });

    await paso(page, 'Intentar anular la orden imputada desde la bandeja desactualizada: la orden sigue vigente', async () => {
      const fila = orden.filaEnLaBandeja(segunda.codigo);
      await expect(anulaciones.botonAnular(fila),
        'La bandeja desactualizada todavia dibuja el boton Anular (es el intento que se quiere hacer)').toHaveCount(1);

      // `lnkDelete_Command` consulta `CheckByPayOrder`: con la orden imputada no anula y
      // redirige a la bandeja sin ningun mensaje (Default.aspx.cs:216-225).
      await anulaciones.anular(fila);

      // Lo que se verifica es el resultado, no un mensaje: el detalle de la orden.
      await anulaciones.abrirDetalle(page, segunda.id);
      const estado = await estadoDeLaOrden(page);
      const pendiente = await orden.pendiente();
      await adjuntarTexto('Orden despues del intento de anulacion', JSON.stringify({ ...estado, pendiente }));
      await conResaltado(page, page.locator('h5.text-uppercase').first(), 'Estado de la orden imputada', async () => {
        expect(estado.anulada, 'La orden imputada a una factura no se puede anular: no tiene que quedar anulada').toBe(false);
        expect(estado.estado.toUpperCase(), 'La orden tiene que seguir pendiente de aprobar').toContain('PENDIENTE');
      });
      await conResaltado(page, page.locator(orden.pendienteDeAsignacion), 'Imputacion de la orden', async () => {
        expect(importe(pendiente).valor, 'La imputacion a la factura tiene que seguir en pie: sin pendiente de asignacion').toBe(0);
      });

      // Y sigue en la bandeja.
      const enLaBandeja = await buscarOrdenEnLaBandeja(page, orden, segunda.codigo);
      await expect(enLaBandeja, 'La orden tiene que seguir listada en la bandeja').toBeVisible({ timeout: 60_000 });
      await adjuntarTexto('Fila en la bandeja', (await orden.celdasDeLaBandeja(segunda.codigo)).join(' | '));
    });

    await paso(page, 'Aprobada la orden, la bandeja deja de ofrecer Anular', async () => {
      await anulaciones.abrirDetalle(page, segunda.id);
      await orden.aprobar(fechaDeHoy, `AUTOQAN${sello.slice(-7)}`);
      expect((await orden.estado()).toUpperCase(), 'Aprobada, la orden tiene que quedar en estado pago').toContain('PAGO');

      const fila = await buscarOrdenEnLaBandeja(page, orden, segunda.codigo);
      await expect(fila, `La orden ${segunda.codigo} tiene que seguir en la bandeja`).toBeVisible({ timeout: 60_000 });
      await conResaltado(page, fila, 'Sin boton Anular en la orden aprobada', async () => {
        await expect(anulaciones.botonAnular(fila),
          'Una orden aprobada e imputada no tiene que ofrecer el boton Anular').toHaveCount(0);
      });
    });
  });

  // =====================================================================================
  // 3. Ordenes de pago parciales
  // =====================================================================================
  test('Orden de pago parcial: el pendiente de la factura baja el monto imputado y no se puede imputar de mas', async ({ page }) => {
    test.setTimeout(1_800_000);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const orden = new OrdenDePagoPage(page);
    const anulaciones = new AnulacionDeOrdenesPage(page);

    // --- Un file nuevo con una factura de proveedor aprobada y sin pagar ---
    const base = await reservarServicioYGenerarFile(page, sello);
    const factura = await armarFacturaAprobada(page, sello, ahora, base);

    const total = factura.total;
    const parcial = Math.round(total * 0.4 * 100) / 100;     // lo que paga la primera orden
    const resto = Math.round((total - parcial) * 100) / 100; // lo que le queda a la factura
    const sobrante = Math.max(10, Math.round(parcial * 0.1)); // cuanto se pasa el intento rechazado
    await adjuntarTexto('Montos de la prueba', [
      `Factura ${factura.puntoDeVenta}-${factura.numeroDeFactura}: ${factura.moneda} ${aFormatoBO(total)}`,
      `Primera orden (parcial): ${aFormatoBO(parcial)}`,
      `Resto de la factura: ${aFormatoBO(resto)}`,
    ].join('\n'));

    const ordenA = { id: '', codigo: '' };
    const ordenB = { id: '', codigo: '' };

    await paso(page, 'Orden parcial: imputar mas que el pendiente de la orden se rechaza con aviso y no escribe nada', async () => {
      Object.assign(ordenA, await guardarOrdenSinImputar(page, factura.moneda, parcial,
        `Orden de pago parcial de regresion automatica ${sello}. No operar.`));

      await orden.abrirAsignacion(orden.filaPendiente(factura.numeroDeFactura));
      const modal = await orden.importesDelModal();
      await adjuntarTexto('Importes del modal (orden parcial)', JSON.stringify(modal, null, 2));
      await conResaltado(page, page.locator(orden.modalDeAsignacion), 'Importes iniciales del modal', async () => {
        expect(importe(modal.ordenPendiente).valor, 'La orden parcial arranca con todo su monto pendiente').toBe(parcial);
        expect(importe(modal.facturaPendiente).valor, 'La factura arranca con todo su total pendiente').toBe(total);
      });

      await imputarYEsperarAviso(page, parcial + sobrante,
        /supera el monto pendiente de asignaci.n de la OP/i, 'Aviso al superar el pendiente de la OP');

      // Recargada la orden, no quedo nada imputado: ni en la orden ni en la factura.
      await anulaciones.abrirDetalle(page, ordenA.id);
      await conResaltado(page, page.locator(orden.pendienteDeAsignacion), 'Pendiente de la orden tras el rechazo', async () => {
        expect(importe(await orden.pendiente()).valor, 'El intento rechazado no tiene que haber imputado nada').toBe(parcial);
      });
      expect(await saldoDeLaFactura(orden, orden.filaPendiente(factura.numeroDeFactura)),
        'El intento rechazado no tiene que haber tocado el saldo de la factura').toBeCloseTo(total, 2);
    });

    await paso(page, 'Imputar el monto de la orden parcial: el pendiente de la factura baja exactamente ese monto', async () => {
      await orden.abrirAsignacion(orden.filaPendiente(factura.numeroDeFactura));
      await orden.imputar(aFormatoBO(parcial), `AUTO-QA ${sello.slice(-8)}`);

      await adjuntarTexto('Pendiente de la orden parcial despues de imputar', await orden.pendiente());
      await conResaltado(page, page.locator(orden.pendienteDeAsignacion), 'Pendiente de la orden parcial', async () => {
        expect(importe(await orden.pendiente()).valor, 'Imputado todo su monto, la orden no tiene que tener pendiente').toBe(0);
      });

      // La factura sigue entre las pendientes, ahora por el resto.
      const fila = orden.filaPendiente(factura.numeroDeFactura);
      await expect(fila, 'Pagada solo en parte, la factura tiene que seguir entre las pendientes').toBeVisible({ timeout: 60_000 });
      await conResaltado(page, fila, 'Saldo de la factura tras el pago parcial', async () => {
        expect(await saldoDeLaFactura(orden, fila),
          `El saldo de la factura tiene que bajar exactamente ${aFormatoBO(parcial)}: de ${aFormatoBO(total)} a ${aFormatoBO(resto)}`)
          .toBeCloseTo(resto, 2);
      });
    });

    await paso(page, 'Segunda orden por el total de la factura: el modal muestra el resto como pendiente de la factura', async () => {
      Object.assign(ordenB, await guardarOrdenSinImputar(page, factura.moneda, total,
        `Orden de pago de regresion automatica ${sello} por el total. No operar.`));

      await orden.abrirAsignacion(orden.filaPendiente(factura.numeroDeFactura));
      const modal = await orden.importesDelModal();
      await adjuntarTexto('Importes del modal (segunda orden)', JSON.stringify(modal, null, 2));
      await conResaltado(page, page.locator(orden.modalDeAsignacion), 'Pendiente de la factura en la segunda orden', async () => {
        expect(importe(modal.facturaTotal).valor, 'El total de la factura no cambia con el pago parcial').toBe(total);
        expect(importe(modal.facturaPendiente).valor, 'La segunda orden tiene que ver el pendiente que dejo la primera').toBeCloseTo(resto, 2);
        expect(importe(modal.ordenPendiente).valor, 'La segunda orden arranca con todo su monto pendiente').toBe(total);
      });
    });

    await paso(page, 'Imputar mas que el pendiente de la factura se rechaza con aviso y no escribe nada', async () => {
      // La orden B cubre el total, asi que el unico tope que se supera es el de la factura.
      await imputarYEsperarAviso(page, total,
        /supera el monto pendiente de la factura/i, 'Aviso al superar el pendiente de la factura');

      await anulaciones.abrirDetalle(page, ordenB.id);
      await conResaltado(page, page.locator(orden.pendienteDeAsignacion), 'Pendiente de la segunda orden tras el rechazo', async () => {
        expect(importe(await orden.pendiente()).valor, 'El intento rechazado no tiene que haber imputado nada').toBe(total);
      });
      const fila = orden.filaPendiente(factura.numeroDeFactura);
      await expect(fila, 'La factura tiene que seguir entre las pendientes').toBeVisible({ timeout: 60_000 });
      expect(await saldoDeLaFactura(orden, fila),
        'El intento rechazado no tiene que haber tocado el saldo de la factura').toBeCloseTo(resto, 2);
    });

    await paso(page, 'Imputar el pendiente exacto de la factura la deja saldada', async () => {
      await orden.abrirAsignacion(orden.filaPendiente(factura.numeroDeFactura));
      await orden.imputar(aFormatoBO(resto), `AUTO-QA ${sello.slice(-8)}`);

      await adjuntarTexto('Pendiente de la segunda orden despues de imputar', await orden.pendiente());
      await conResaltado(page, page.locator(orden.pendienteDeAsignacion), 'Pendiente de la segunda orden', async () => {
        expect(importe(await orden.pendiente()).valor,
          'La segunda orden pago solo el resto: le tiene que quedar pendiente lo que la primera ya habia pagado')
          .toBeCloseTo(parcial, 2);
      });
      await expect(
        orden.filaPendiente(factura.numeroDeFactura),
        'Imputado el resto, la factura esta saldada y no tiene que seguir entre las pendientes',
      ).toBeHidden({ timeout: 60_000 });
    });
  });
});
