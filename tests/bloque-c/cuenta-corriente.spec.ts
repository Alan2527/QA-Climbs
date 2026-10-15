import { test, expect } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { OrdenDePagoPage } from '../../pages/orden-de-pago.page';
import { CuentaCorrientePage } from '../../pages/cuenta-corriente.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, formatearFecha, reiniciarNumeracionDePasos, conResaltado,
  importeANumero, numeroDelFile,
} from '../../utils/pasos';
import { reservarServicioYGenerarFile, masDias, celdasDe } from './cobranzas-comun';
import {
  armarFacturaAprobada, armarFacturaAlCliente, armarOrdenDePagoAprobada, armarOrdenDeCobroAprobada,
} from './cobranzas-armado';

/**
 * BLOQUE C — Cuenta corriente del cliente y del proveedor.
 *
 * Es el saldo que mira Administracion para cobrar y para pagar. Si la cuenta no
 * refleja los comprobantes, se cobra de mas o de menos y se paga mal. Los otros
 * eslabones miran cada comprobante en su pantalla y el cierre del file mira el panel
 * del file; esta es la tercera vista del mismo dinero: la cuenta de quien debe y de a
 * quien se le debe, que se arma con otras consultas (`AccountingHelper`) y por eso
 * puede desviarse aunque las otras dos esten bien.
 *
 * Con la cadena completa sobre un file nuevo (factura de proveedor, orden de pago,
 * carta de cobranza, orden de cobro):
 *
 *  - Agenda de pendientes del cliente (US 4839 / 4894, `Customers/Summary.aspx`, solapa
 *    Pendientes): antes de emitir la carta el file figura para facturar, con la venta
 *    entera por facturar; con la carta emitida y sin cobro pasa a cobrar, con lo
 *    facturado y lo que falta cobrar; con el cobro aprobado deja de figurar.
 *  - Cuenta del cliente (`administration/accounting/inv/customer/{id}`): lista la carta
 *    con su importe y saldada, y la orden de cobro aplicada a ella con lo cobrado.
 *  - Cuenta del proveedor (`administration/accounting/supplier/{id}`): lista la factura
 *    con su importe, saldada y toda imputada al file, y la orden de pago aplicada.
 *  - En las dos cuentas, los totales de arriba suman las filas de la grilla.
 *
 * Las cuentas de MULTIVIAJES ARGENTINA SRL y de GRUPO SUMMA tienen cientos de
 * movimientos de otras corridas: nada se compara contra el saldo de la cuenta. Cada
 * fila se ubica por el numero del comprobante de la cadena y se compara contra los
 * importes de la cadena.
 *
 * Queda afuera, a proposito: los resumenes `administration/accounting/summary`
 * (solapa Resumen) y `supplier-summary`. Muestran el saldo de TODA la cuenta, que se
 * mueve con cada corrida, y salen de una tabla de saldos que no se recalcula al
 * instante: no hay una cifra de la cadena contra la cual compararlos.
 *
 * Solo lee lo que la cadena dejo: no escribe nada propio.
 */
test.describe('Cobranzas — cuenta corriente del cliente y del proveedor', () => {
  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  const baseBO = () => process.env.AMV_BO_URL || 'https://qa.bo.amv.travel';

  /**
   * Proveedor de la cadena: GRUPO SUMMA SRL (BO_Supplier 1047, ver ESTADO.md,
   * "Auditoria del ambiente"). Se usa solo si la pantalla de la orden de pago no
   * entrega el id; el titulo de la cuenta confirma que es el proveedor correcto.
   */
  const PROVEEDOR_DE_LA_CADENA = '1047';

  /** Importe de una celda: vacia o con guion es cero; el formato es el del BO (coma decimal). */
  const numero = (texto: string): number => {
    const limpio = (texto || '').trim();
    if (limpio === '' || /^[-—–]+$/.test(limpio)) return 0;
    return importeANumero(limpio) ?? Number.NaN;
  };

  /** Codigo de comprobante como lo escribe la cuenta del cliente: sin los ceros de cada tramo. */
  const sinCeros = (codigo: string) => codigo.replace(/0*(\d+)/g, '$1');

  /** Lo que la agenda tiene que mostrar de un file en una de sus dos gestiones. */
  interface Cifras {
    venta: number;
    facturado: number;
    cobrado: number;
    faltaFacturar: number;
    faltaCobrar: number;
  }

  const GESTIONES = [
    { clave: 'facturar' as const, tipo: 10, nombre: 'Facturar items', texto: /Facturar [ií]tems/i },
    { clave: 'cobrar' as const, tipo: 20, nombre: 'Cobrar facturas', texto: /Cobrar facturas/i },
  ];

  test('Cuenta corriente: con la cadena completa, el cliente y el proveedor listan sus comprobantes con importes y saldos coherentes', async ({ page }) => {
    test.setTimeout(2_400_000);

    const cuenta = new CuentaCorrientePage(page);
    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);

    // --- El file nuevo, con la rama del proveedor entera ---
    const base = await reservarServicioYGenerarFile(page, sello);
    const venta = base.ventaDelItem.valor as number;
    expect(venta, 'La precondicion necesita la venta del item del file').toBeGreaterThan(0);

    const facturaProveedor = await armarFacturaAprobada(page, sello, ahora, base);
    const ordenDePago = await armarOrdenDePagoAprobada(page, sello, fechaDeHoy, facturaProveedor);

    // La pantalla de la orden de pago ya aprobada trae el id del proveedor en su campo oculto.
    let proveedorId = PROVEEDOR_DE_LA_CADENA;
    await paso(page, 'Registrar el proveedor de la orden de pago', async () => {
      const leido = await page.locator(new OrdenDePagoPage(page).hiddenProveedor).inputValue().catch(() => '');
      const delCampo = /^[1-9]\d*$/.test(leido);
      if (delCampo) proveedorId = leido;
      await adjuntarTexto('Proveedor de la cadena', `Id: ${proveedorId} (${delCampo ? 'leido de la orden de pago' : 'valor fijo de ESTADO.md'})`);
    });

    /**
     * Consulta la agenda por el numero del file y compara las dos gestiones posibles
     * contra lo esperado: una fila con esas cifras, o ninguna si viene `null`.
     * Devuelve el vencimiento de la primera carta del file, si la agenda lo trae.
     *
     * Si la agenda no responde se registra como fallo blando y se sigue: no tiene que
     * tapar las dos cuentas, que son lo que este test mira.
     */
    const verificarAgenda = async (
      momento: string, esperado: { facturar: Cifras | null; cobrar: Cifras | null },
    ): Promise<string | null> => {
      let respuesta;
      try {
        respuesta = await cuenta.buscarEnLaAgenda(numeroDelFile(base.fileCode));
      } catch (error) {
        expect.soft(false, `La agenda no se pudo consultar ${momento}: ${(error as Error).message}`).toBe(true);
        return null;
      }
      const propias = respuesta.filas.filter((f) => String(f.FileID) === base.fileId);
      await adjuntarTexto(`Agenda ${momento}: filas del file ${base.fileCode}`, JSON.stringify(
        propias.map((f) => ({
          gestion: f.Task, venta: f.FileSaleTotal, facturado: f.FileInvoicedTotal, cobrado: f.FileCollectedTotal,
          faltaFacturar: f.FilePendingInvoice, faltaCobrar: f.FilePendingCollection, moneda: f.FileTotalsCurrency,
        })), null, 1,
      ));

      for (const g of GESTIONES) {
        const delTipo = propias.filter((f) => f.TargetType === g.tipo);
        const cifras = esperado[g.clave];

        if (!cifras) {
          await conResaltado(page, cuenta.filasDeLaAgendaDelFile(base.fileId).first(), `Agenda ${momento}: ${g.nombre} de mas`, async () => {
            expect(delTipo.length, `${momento}, el file ${base.fileCode} no tiene que figurar en la agenda como "${g.nombre}"`)
              .toBe(0);
          });
          continue;
        }

        await conResaltado(page, page.locator(cuenta.agendaGrilla), `Agenda ${momento}: ${g.nombre}`, async () => {
          expect(delTipo.length, `${momento}, el file ${base.fileCode} tiene que figurar una vez en la agenda como "${g.nombre}"`)
            .toBe(1);
        });
        if (delTipo.length !== 1) continue;

        const fila = cuenta.filasDeLaAgendaDelFile(base.fileId).filter({ hasText: g.texto }).first();
        await conResaltado(page, fila, `Agenda ${momento}: importes de ${g.nombre}`, async () => {
          const c = await celdasDe(fila);
          await adjuntarTexto(`Agenda ${momento}: fila ${g.nombre}`, c.join(' | '));
          expect(numero(c[5]), `${momento}, la Venta total de "${g.nombre}" es la venta del file`).toBeCloseTo(cifras.venta, 1);
          expect(numero(c[6]), `${momento}, el Total facturado de "${g.nombre}"`).toBeCloseTo(cifras.facturado, 1);
          expect(numero(c[7]), `${momento}, el Total cobrado de "${g.nombre}"`).toBeCloseTo(cifras.cobrado, 1);
          expect(numero(c[8]), `${momento}, lo que Falta facturar en "${g.nombre}"`).toBeCloseTo(cifras.faltaFacturar, 1);
          expect(numero(c[9]), `${momento}, lo que Falta cobrar en "${g.nombre}"`).toBeCloseTo(cifras.faltaCobrar, 1);
        });
      }

      return propias.find((f) => f.TargetType === 20)?.Items?.[0]?.DueDate ?? null;
    };

    // --- 1. Antes de la carta: el file figura para facturar, con toda la venta por facturar ---
    await paso(page, 'Agenda de pendientes: antes de emitir la carta, el file figura para facturar', async () => {
      await verificarAgenda('antes de la carta', {
        facturar: { venta, facturado: 0, cobrado: 0, faltaFacturar: venta, faltaCobrar: venta },
        cobrar: null,
      });
    });

    const facturaCliente = await armarFacturaAlCliente(page, sello, base);

    // --- 2. Con la carta emitida y sin cobro: el file pasa a cobrar ---
    let vencimientoDeLaCarta: string | null = null;
    await paso(page, 'Agenda de pendientes: con la carta emitida y sin cobro, el file figura para cobrar', async () => {
      // Si la carta no cubre toda la venta (descuento por reserva online), el file sigue
      // figurando tambien para facturar por la diferencia.
      const sinFacturar = Math.max(0, venta - facturaCliente.total);
      vencimientoDeLaCarta = await verificarAgenda('con la carta emitida', {
        facturar: sinFacturar > 0.01
          ? { venta, facturado: facturaCliente.total, cobrado: 0, faltaFacturar: sinFacturar, faltaCobrar: venta }
          : null,
        cobrar: { venta, facturado: facturaCliente.total, cobrado: 0, faltaFacturar: sinFacturar, faltaCobrar: venta },
      });
    });

    const ordenDeCobro = await armarOrdenDeCobroAprobada(page, sello, fechaDeHoy, facturaCliente);

    // --- 3. Con el cobro aprobado: el file deja de figurar ---
    await paso(page, 'Agenda de pendientes: con el cobro aprobado, el file deja de figurar', async () => {
      await verificarAgenda('con el cobro aprobado', { facturar: null, cobrar: null });
    });

    // --- 4. Cuenta corriente del cliente ---
    const codigoDeLaCarta = sinCeros(facturaCliente.comprobante);
    const codigoDeLaOrdenDeCobro = sinCeros(ordenDeCobro);

    await paso(page, `Abrir la cuenta corriente del cliente ${base.cliente} en la vista Todos`, async () => {
      // El id del cliente esta en el campo oculto de la pantalla del file.
      await page.goto(`${baseBO()}/booking/files/managefile/${base.fileId}`);
      await esperarFinDeCarga(page);
      const clienteId = await page.locator('#hiddenCustomer').inputValue();
      expect(clienteId, 'El file tiene que traer el id de su cliente').toMatch(/^[1-9]\d*$/);

      // La vista Todos filtra por vencimiento: se pide desde 3 dias antes del vencimiento de
      // la carta (el que mostro la agenda). Sin ese dato, desde 120 dias atras.
      const v = vencimientoDeLaCarta as string | null;
      const desde = v
        ? masDias(`${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`, -3)
        : masDias(fechaDeHoy, -120);

      await cuenta.abrirCuentaDelCliente(clienteId, desde);
      // La carta y la orden de cobro son en dolares: se mira la cuenta en esa moneda.
      await cuenta.elegirMoneda('USD');
      const hay = await cuenta.esperarMovimientos(cuenta.filasDeLaCuentaDelCliente());

      await adjuntarTexto('Cuenta del cliente', [
        `Cliente: ${base.cliente} (id ${clienteId})`,
        `Titulo de la pantalla: ${await cuenta.titulo()}`,
        `Vencimiento desde: ${desde}${v ? ` (vencimiento de la carta: ${v.slice(0, 10)})` : ' (la agenda no trajo el vencimiento)'}`,
        `Movimientos en pantalla: ${hay}`,
      ].join('\n'));

      await conResaltado(page, page.locator('.page-title').first(), 'Titulo de la cuenta del cliente', async () => {
        expect((await cuenta.titulo()).toLowerCase(), `La cuenta tiene que ser la del cliente del file, ${base.cliente}`)
          .toContain(base.cliente.toLowerCase());
      });
      expect(hay, `La cuenta del cliente tiene que listar movimientos con vencimiento desde ${desde}`).toBeGreaterThan(0);
    });

    await paso(page, `La carta de cobranza ${facturaCliente.comprobante} figura en la cuenta del cliente, con su importe y saldada`, async () => {
      const carta = cuenta.filaDelClientePorComprobante(codigoDeLaCarta);
      await conResaltado(page, cuenta.filasDeLaCuentaDelCliente().first(), `Carta ${codigoDeLaCarta} en la cuenta`, async () => {
        await expect(carta, `La cuenta del cliente tiene que listar la carta ${codigoDeLaCarta} una sola vez`).toHaveCount(1);
      });
      if ((await carta.count()) !== 1) return;

      const c = await celdasDe(carta);
      await adjuntarTexto('Fila de la carta en la cuenta del cliente', c.join(' | '));

      await conResaltado(page, carta, 'Importes de la carta en la cuenta', async () => {
        expect(numero(c[5]), 'El Debe de la carta es su total').toBeCloseTo(facturaCliente.total, 1);
        expect(numero(c[6]), 'Una carta de cobranza no tiene Haber').toBeCloseTo(0, 1);
        expect(numero(c[7]), 'Con la orden de cobro aplicada por el total, el saldo de la carta es cero').toBeCloseTo(0, 1);
      });
      await conResaltado(page, carta, 'Carta saldada', async () => {
        await expect(carta, 'La carta cobrada por completo tiene que verse como saldada').toHaveClass(/success/);
      });
      await conResaltado(page, carta, 'File de la carta', async () => {
        await expect(carta.locator('td:nth-child(3) a'), 'La carta tiene que enlazar a la pantalla de su file')
          .toHaveAttribute('href', new RegExp(`/managefile/${base.fileId}$`));
      });
      // La columna File arma el numero partiendo el codigo por los guiones (`RenderFileCell`,
      // Customers/AccountingDetail.aspx.cs:266): con el codigo de sucursal ("AMV-AR-30168")
      // muestra "AR". Medido el 15/10. Ninguna US lo define: queda como observacion (consulta
      // al PM), no como fallo.
      if (c[2] !== numeroDelFile(base.fileCode)) {
        test.info().annotations.push({ type: 'observacion',
          description: `La columna File de la cuenta del cliente muestra "${c[2]}" en vez del numero del file ${numeroDelFile(base.fileCode)}` });
        await adjuntarTexto('Observacion: columna File', `Muestra "${c[2]}"; el file es ${base.fileCode}`);
      }
    });

    await paso(page, `La orden de cobro ${ordenDeCobro} figura en la cuenta del cliente, aplicada a la carta`, async () => {
      const orden = cuenta.filaDelClientePorComprobante(codigoDeLaOrdenDeCobro);
      await conResaltado(page, cuenta.filasDeLaCuentaDelCliente().first(), `Orden de cobro ${codigoDeLaOrdenDeCobro} en la cuenta`, async () => {
        await expect(
          orden,
          `La cuenta del cliente tiene que listar la orden de cobro ${codigoDeLaOrdenDeCobro} una sola vez, aplicada a la carta y no ademas suelta`,
        ).toHaveCount(1);
      });
      if ((await orden.count()) !== 1) return;

      const o = await celdasDe(orden);
      await adjuntarTexto('Fila de la orden de cobro en la cuenta del cliente', o.join(' | '));

      await conResaltado(page, orden, 'Importes de la orden de cobro en la cuenta', async () => {
        expect(numero(o[6]), 'El Haber de la orden de cobro es lo que se cobro').toBeCloseTo(facturaCliente.total, 1);
        expect(numero(o[5]), 'Una orden de cobro no tiene Debe').toBeCloseTo(0, 1);
        expect(o[7], 'Una orden aplicada a una carta no muestra saldo propio: el saldo queda en la carta').toBe('');
        expect(o[10], 'La orden de cobro aprobada tiene que figurar como Pago').toBe('Pago');
      });
      await conResaltado(page, orden, 'Orden aplicada a la carta', async () => {
        await expect(orden, 'La orden de cobro aplicada tiene que verse como hija de la carta').toHaveClass(/acc-child/);
        await expect(
          cuenta.filaDelClientePorComprobante(codigoDeLaCarta).locator('xpath=following-sibling::tr[1]'),
          'La orden de cobro tiene que quedar justo debajo de la carta a la que se aplico',
        ).toContainText(codigoDeLaOrdenDeCobro);
      });
    });

    await paso(page, 'Los totales de la cuenta del cliente suman los movimientos de la grilla', async () => {
      const filas = await cuenta.matrizDeFilas(cuenta.filasDeLaCuentaDelCliente());
      let debe = 0;
      let haber = 0;
      for (const f of filas) {
        debe += numero(f[5] ?? '');
        // Los totales no cuentan las ordenes de cobro en estado Pendiente.
        if (!/^pendiente$/i.test(f[10] ?? '')) haber += numero(f[6] ?? '');
      }
      const t = await cuenta.totalesDelCliente();
      await adjuntarTexto('Totales de la cuenta del cliente', [
        `Movimientos sumados: ${filas.length}`, `Debe sumado: ${debe}`, `Haber sumado: ${haber}`,
        `Totales de la pantalla: ${t.join(' | ')}`,
      ].join('\n'));

      // Cada celda se muestra con 3 decimales: la tolerancia crece con la cantidad de filas.
      const tolerancia = 0.001 * filas.length + 0.05;
      await conResaltado(page, page.locator(cuenta.totales), 'Totales de la cuenta del cliente', async () => {
        expect(t.length, 'El resumen de totales tiene que traer sus siete cifras').toBe(7);
        expect(Math.abs(numero(t[0]) - debe), 'El Debe total es la suma del Debe de los movimientos').toBeLessThanOrEqual(tolerancia);
        expect(Math.abs(numero(t[1]) - haber), 'El Haber total es la suma del Haber de los movimientos').toBeLessThanOrEqual(tolerancia);
        expect(Math.abs(numero(t[2]) - (debe - haber)), 'El Saldo total es el Debe menos el Haber').toBeLessThanOrEqual(tolerancia);
      });
    });

    // --- 5. Cuenta corriente del proveedor ---
    await paso(page, 'Abrir la cuenta corriente del proveedor en la vista Completa', async () => {
      await cuenta.abrirCuentaDelProveedor(proveedorId);
      // La vista Parcial solo trae lo pendiente de pago: la factura ya esta pagada.
      await cuenta.elegirVistaCompleta();
      await cuenta.elegirMoneda(facturaProveedor.moneda);
      const hay = await cuenta.esperarMovimientos(cuenta.filasDeLaCuentaDelProveedor());

      await adjuntarTexto('Cuenta del proveedor', [
        `Proveedor id ${proveedorId}`,
        `Titulo de la pantalla: ${await cuenta.titulo()}`,
        `Moneda de la cuenta: ${await cuenta.opcionElegida(cuenta.comboMoneda)}`,
        `Desde: ${await page.locator(cuenta.campoDesde).inputValue()} hasta: ${await page.locator(cuenta.campoHasta).inputValue()}`,
        `Movimientos en pantalla: ${hay}`,
      ].join('\n'));

      await conResaltado(page, page.locator('.page-title').first(), 'Titulo de la cuenta del proveedor', async () => {
        expect((await cuenta.titulo()).toLowerCase(), 'La cuenta tiene que ser la del proveedor de la factura, GRUPO SUMMA')
          .toContain('grupo summa');
      });
      expect(hay, 'La cuenta del proveedor tiene que listar movimientos en los ultimos 30 dias').toBeGreaterThan(0);
    });

    await paso(page, `La factura ${facturaProveedor.numeroDeFactura} figura en la cuenta del proveedor, con su importe, saldada e imputada al file`, async () => {
      const factura = cuenta.filaDelProveedorPorNumero(facturaProveedor.numeroDeFactura);
      await conResaltado(page, cuenta.filasDeLaCuentaDelProveedor().first(), `Factura ${facturaProveedor.numeroDeFactura} en la cuenta`, async () => {
        await expect(factura, `La cuenta del proveedor tiene que listar la factura ${facturaProveedor.numeroDeFactura} una sola vez`)
          .toHaveCount(1);
      });
      if ((await factura.count()) !== 1) return;

      const f = await celdasDe(factura);
      await adjuntarTexto('Fila de la factura en la cuenta del proveedor', f.join(' | '));

      await conResaltado(page, factura, 'Importes de la factura en la cuenta', async () => {
        expect(numero(f[2]), 'El Total factura es el total cargado en la cadena').toBeCloseTo(facturaProveedor.total, 1);
        expect(numero(f[4]), 'Lo Pagable es el total menos las retenciones').toBeCloseTo(numero(f[2]) - numero(f[3]), 1);
        expect(numero(f[5]), 'El Debe de la factura es lo Pagable').toBeCloseTo(numero(f[4]), 1);
        expect(numero(f[7]), 'Con la orden de pago aplicada por el total, el saldo de la factura es cero').toBeCloseTo(0, 1);
        expect(numero(f[8]), 'Imputada por el total al file, no queda nada Pendiente de imputar').toBeCloseTo(0, 1);
      });
      await conResaltado(page, factura, 'Factura saldada', async () => {
        await expect(factura, 'La factura pagada por completo tiene que verse como saldada').toHaveClass(/success/);
      });
    });

    await paso(page, `La orden de pago ${ordenDePago} figura en la cuenta del proveedor, aplicada a la factura`, async () => {
      const orden = cuenta.filaDelProveedorPorCodigo(ordenDePago);
      await conResaltado(page, cuenta.filasDeLaCuentaDelProveedor().first(), `Orden de pago ${ordenDePago} en la cuenta`, async () => {
        await expect(
          orden,
          `La cuenta del proveedor tiene que listar la orden de pago ${ordenDePago} una sola vez, aplicada a la factura y no ademas suelta`,
        ).toHaveCount(1);
      });
      if ((await orden.count()) !== 1) return;

      const p = await celdasDe(orden);
      await adjuntarTexto('Fila de la orden de pago en la cuenta del proveedor', p.join(' | '));

      await conResaltado(page, orden, 'Importes de la orden de pago en la cuenta', async () => {
        expect(numero(p[6]), 'El Haber de la orden de pago es lo que se pago').toBeCloseTo(facturaProveedor.total, 1);
        expect(numero(p[5]), 'Una orden de pago no tiene Debe').toBeCloseTo(0, 1);
      });
      // El numero de recibo que se escribio al aprobar la orden tiene que llegar a la cuenta.
      const recibo = `AUTOQAP${sello.slice(-7)}`;
      await conResaltado(page, orden, 'Recibo de la orden de pago', async () => {
        expect(p[10], 'La cuenta tiene que mostrar el numero de recibo con el que se aprobo la orden de pago').toContain(recibo);
      });
      await conResaltado(page, orden, 'Orden aplicada a la factura', async () => {
        await expect(
          cuenta.filaDelProveedorPorNumero(facturaProveedor.numeroDeFactura).locator('xpath=following-sibling::tr[1]'),
          'La orden de pago tiene que quedar justo debajo de la factura a la que se aplico',
        ).toContainText(ordenDePago);
      });
    });

    await paso(page, 'Los totales de la cuenta del proveedor suman los movimientos de la grilla', async () => {
      const filas = await cuenta.matrizDeFilas(cuenta.filasDeLaCuentaDelProveedor());
      let debe = 0;
      let haber = 0;
      for (const f of filas) {
        debe += numero(f[5] ?? '');
        haber += numero(f[6] ?? '');
      }
      const t = await cuenta.totalesDelProveedor();
      await adjuntarTexto('Totales de la cuenta del proveedor', [
        `Movimientos sumados: ${filas.length}`, `Debe sumado: ${debe}`, `Haber sumado: ${haber}`,
        `Totales de la pantalla: ${t.join(' | ')}`,
      ].join('\n'));

      const tolerancia = 0.001 * filas.length + 0.05;
      await conResaltado(page, page.locator(cuenta.totales), 'Totales de la cuenta del proveedor', async () => {
        expect(t.length, 'El resumen de totales tiene que traer sus siete cifras').toBe(7);
        expect(Math.abs(numero(t[0]) - debe), 'El Debe total es la suma del Debe de los movimientos').toBeLessThanOrEqual(tolerancia);
        expect(Math.abs(numero(t[1]) - haber), 'El Haber total es la suma del Haber de los movimientos').toBeLessThanOrEqual(tolerancia);
        expect(Math.abs(numero(t[2]) - (debe - haber)), 'El Saldo total es el Debe menos el Haber').toBeLessThanOrEqual(tolerancia);
      });
    });
  });
});
