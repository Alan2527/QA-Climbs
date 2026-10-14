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
  SALTO, CAJA_DE_REGRESION, cajaDeRegresion, importe, aFormatoBO, nombreDelMes, masDias, celdasDe,
  Precondicion, reservarServicioYGenerarFile,
} from './cobranzas-comun';
import {
  verificarFormularioBloqueado, verificarFormularioHabilitado, armarFacturaAprobada,
  armarFacturaAlCliente, armarOrdenDePagoAprobada, armarOrdenDeCobroAprobada,
} from './cobranzas-armado';

/**
 * BLOQUE C — Cobranzas.
 *
 * La cadena administrativa que arranca donde termina el Bloque B: el file de
 * una reserva emitida se factura, se paga, se le factura al cliente, se cobra y
 * el movimiento cae en la caja diaria.
 *
 * Cada test **genera su propia precondicion**. Depender de un file que ya exista
 * es lo que hace fallar hoy a la suite vieja de Selenium: el dato cambia y el
 * test se cae por un motivo que no es el que estaba probando. Y ademas un item
 * de file solo se puede imputar una vez, asi que cada corrida necesita uno nuevo.
 *
 * Los helpers de comparacion estan repetidos a proposito, igual que hizo el
 * Bloque B con los del A: cada bloque es autocontenido y no se toca el codigo de
 * uno terminado para escribir el siguiente.
 *
 * El BO no tiene selector de idioma ni tema oscuro: no aplican las
 * consideraciones transversales de multiidioma ni modo oscuro.
 */
test.describe('Cobranzas', () => {

  // El carrito se vacia mirando el contador del encabezado, que solo existe
  // dentro del portal: sin entrar primero, el paso 1 muere esperando el icono.
  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  test('Caja diaria: recibe el pago y el cobro del mismo file y cuadra', async ({ page }) => {
    // Es el test mas largo de la suite: arma la cadena entera, las dos ramas,
    // porque la caja diaria es el unico punto donde vuelven a juntarse.
    test.setTimeout(1_800_000);

    const caja = new CajaDiariaPage(page);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);

    const datos = {
      sucursal: 'Argentina',
      moneda: 'USD',
      detalleDeLaCaja: `Caja de regresion automatica ${sello}. No operar.`,
    };

    // --- La cadena entera, las dos ramas del mismo file ---
    const base = await reservarServicioYGenerarFile(page, sello);
    const facturaProveedor = await armarFacturaAprobada(page, sello, ahora, base);
    const ordenDePago = await armarOrdenDePagoAprobada(page, sello, fechaDeHoy, facturaProveedor);
    const facturaCliente = await armarFacturaAlCliente(page, sello, base);
    const ordenDeCobro = await armarOrdenDeCobroAprobada(page, sello, fechaDeHoy, facturaCliente);

    const costo = base.costoDelItem.valor as number;
    const venta = facturaCliente.total;

    /**
     * Cada rama cae en la caja AUTO-QA de su moneda. Desde el 12/10/2026 (hotfix
     * `4b60e763` del BO) el costo del servicio sale de la tarifa web en la moneda del
     * servicio, asi que el pago al proveedor va en pesos (caja 188) y el cobro al
     * cliente sigue en dolares (caja 187): ya no cuadran en una misma caja, cada una
     * se verifica con su propio cuadre.
     */
    const ramas = [
      {
        que: 'pago', codigo: ordenDePago, moneda: facturaProveedor.moneda,
        caja: cajaDeRegresion(facturaProveedor.moneda), importe: costo,
        contraparte: 'GRUPO SUMMA', queImporte: 'el costo del item del file',
      },
      {
        que: 'cobro', codigo: ordenDeCobro, moneda: 'USD',
        caja: cajaDeRegresion('USD'), importe: venta,
        contraparte: base.cliente.toUpperCase(), queImporte: 'la venta del item del file',
      },
    ];
    const balances: Record<string, number | null> = {};

    await paso(page, 'Abrir la caja del dia de la sucursal', async () => {
      await caja.irABandejaDeCajas();
      const { id, creada } = await caja.abrirCajaDelDia(fechaDeHoy, datos.sucursal, datos.detalleDeLaCaja);
      await adjuntarTexto('Caja del dia',
        `id ${id} — ${creada ? 'abierta por el test' : 'ya existia'} — ${fechaDeHoy}`);
      expect(id, 'Tiene que haber una caja diaria para hoy en la sucursal').toMatch(/^\d+$/);
      await adjuntarTexto('Cajas de cada rama',
        ramas.map((r) => `${r.que}: ${r.codigo} en ${r.caja} (${r.moneda} ${r.importe})`).join(SALTO));
    });

    for (const r of ramas) {
      await paso(page, `Filtrar por ${r.caja} y verificar que el ${r.que} cayo solo en la caja`, async () => {
        const cajas = await caja.cajasOfrecidas();
        await conResaltado(page, page.locator(caja.comboCajaDeTotales).first(), `Caja del ${r.que} en la caja diaria`, () => {
          expect(cajas.join(' | '), `La caja diaria tiene que ofrecer ${r.caja} para filtrar sus movimientos`)
            .toContain(r.caja);
        });
        await caja.filtrarPorCaja(r.caja);
        await adjuntarTexto(`Movimientos de ${r.caja}`, (await caja.movimientos()).join(SALTO));

        const fila = caja.filaDelMovimiento(r.codigo);
        await expect(
          fila,
          `La orden ${r.codigo} tiene que aparecer sola en ${r.caja}. Si no esta, revisar que este ` +
          'aprobada, que su fecha de recibo sea la de la caja y que la sucursal coincida.',
        ).toBeVisible({ timeout: 60_000 });
        const celdas = await caja.celdas(fila);
        const texto = celdas.join(' | ').toUpperCase();
        await adjuntarTexto(`Movimiento del ${r.que}`, celdas.join(' | '));

        const soloImporte = /^-?([A-Z]{3}\s*)?\d[\d.,]*$/;
        const importes = celdas.filter((c) => soloImporte.test(c)).map(importe);
        await conResaltado(page, fila, `Caja del movimiento de ${r.que}`, () => {
          expect(texto, `El ${r.que} tiene que quedar registrado en ${r.caja}`).toContain(r.caja.toUpperCase());
        });
        await conResaltado(page, fila, `Importe del ${r.que} en la caja`, () => {
          expect(importes.map((x) => Math.abs(x.valor ?? 0)), `El movimiento de ${r.que} tiene que ser por ${r.queImporte}`)
            .toContain(r.importe);
        });
        await conResaltado(page, fila, `Fecha del movimiento de ${r.que}`, () => {
          expect(celdas.join(' | '), `El movimiento de ${r.que} tiene que llevar la fecha de la caja`).toContain(fechaDeHoy);
        });
        await conResaltado(page, fila, `Contraparte del movimiento de ${r.que}`, () => {
          expect(texto, `El movimiento de ${r.que} tiene que identificar a ${r.contraparte}`).toContain(r.contraparte);
        });
        await conResaltado(page, fila, `Moneda del movimiento de ${r.que}`, () => {
          expect(texto, 'El movimiento tiene que estar en la moneda de su caja').toContain(r.moneda);
        });
      });

      await paso(page, `Verificar el cuadre de ${r.caja}`, async () => {
        const totales = await caja.totales(r.moneda);
        await adjuntarTexto(`Totales de ${r.caja}`, JSON.stringify(totales, null, 2));
        expect(totales, `La caja tiene que mostrar sus totales en ${r.moneda}`).not.toBeNull();

        const inicial = importe(totales!.inicial).valor ?? 0;
        const ingreso = importe(totales!.ingreso).valor ?? 0;
        const salida = importe(totales!.salida).valor ?? 0;
        const balance = importe(totales!.balance).valor ?? 0;
        const final = importe(totales!.final).valor ?? 0;
        balances[r.caja] = importe(totales!.balance).valor;

        const grilla = page.locator(caja.grillaDeTotales).first();
        await conResaltado(page, grilla, `Balance de ${r.caja}`, () => {
          expect(Number((ingreso + salida).toFixed(2)),
            'El balance tiene que ser el ingreso mas la salida, que viene con signo negativo')
            .toBe(Number(balance.toFixed(2)));
        });
        await conResaltado(page, grilla, `Saldo final de ${r.caja}`, () => {
          expect(Number((inicial + balance).toFixed(2)), 'El saldo final tiene que ser el saldo inicial mas el balance')
            .toBe(Number(final.toFixed(2)));
        });
        if (r.que === 'cobro') {
          await conResaltado(page, grilla, `Ingreso de ${r.caja}`, () => {
            expect(ingreso, 'El ingreso de la caja tiene que incluir la venta cobrada').toBeGreaterThanOrEqual(r.importe);
          });
        } else {
          await conResaltado(page, grilla, `Salida de ${r.caja}`, () => {
            expect(Math.abs(salida), 'La salida de la caja tiene que incluir el costo pagado').toBeGreaterThanOrEqual(r.importe);
          });
        }
      });
    }

    await paso(page, 'Abrir el pre-cierre y verificar que muestre el cuadre de las dos cajas', async () => {
      const modal = await caja.abrirPreCierre();
      for (const r of ramas) {
        const fila = await caja.filaDelPreCierre(r.caja);
        await adjuntarTexto(`Fila de ${r.caja} en el pre-cierre`, fila.join(' | '));
        await conResaltado(page, modal, `Pre-cierre con ${r.caja}`, () => {
          expect(fila.length, `El pre-cierre tiene que listar ${r.caja} con su cuadre`).toBeGreaterThan(0);
        });
        const numeros = fila.map(importe).map((x) => x.valor);
        await conResaltado(page, modal, `Cuadre de ${r.caja} en el pre-cierre`, () => {
          expect(numeros, `El balance del dia de ${r.caja} en el pre-cierre tiene que coincidir con el de la pantalla`)
            .toContain(balances[r.caja]);
        });
      }

      await adjuntarTexto('Cadena completa generada', [
        `File: ${base.fileCode}`,
        `Factura de proveedor: ${facturaProveedor.puntoDeVenta}-${facturaProveedor.numeroDeFactura}`,
        `Orden de pago: ${ordenDePago} (costo ${facturaProveedor.moneda} ${costo})`,
        `Comprobante al cliente: ${facturaCliente.comprobante}`,
        `Orden de cobro: ${ordenDeCobro} (venta USD ${venta})`,
      ].join(SALTO));
    });

    await paso(page, 'Verificar la caja en la bandeja y que quede abierta', async () => {
      await caja.cerrarPreCierre();

      // El test **no cierra la caja** a proposito: cerrarla bloquea los aprobados
      // de las ordenes de pago y de cobro de esa sucursal por el resto del dia, y
      // no se puede reabrir desde la pantalla. Que siga abierta es parte del
      // resultado esperado.
      await caja.irABandejaDeCajas();
      const fila = caja.filaDeLaFecha(fechaDeHoy);
      await expect(
        fila,
        `La caja del ${fechaDeHoy} tiene que aparecer en la bandeja de gastos y movimientos`,
      ).toBeVisible({ timeout: 60_000 });

      const celdas = await caja.celdas(fila);
      await adjuntarTexto('Fila de la caja en la bandeja', celdas.join(' | '));

      await conResaltado(page, fila, 'Caja abierta al terminar', () => {
        expect(celdas.join(' | ').toUpperCase(),
          'La caja tiene que quedar abierta: el test no la cierra, y cerrarla dejaria sin poder ' +
          'aprobar las ordenes del resto del dia')
          .not.toContain('CERRAD');
      });
    });
  });

});
