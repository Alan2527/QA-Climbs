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

    // Totales que muestra la pantalla, para exigir que el pre-cierre diga lo mismo.
    let totalesDeLaCaja: Awaited<ReturnType<CajaDiariaPage['totales']>> = null;

    await paso(page, 'Abrir la caja del dia de la sucursal', async () => {
      await caja.irABandejaDeCajas();
      const { id, creada } = await caja.abrirCajaDelDia(fechaDeHoy, datos.sucursal, datos.detalleDeLaCaja);
      await adjuntarTexto('Caja del dia',
        `id ${id} — ${creada ? 'abierta por el test' : 'ya existia'} — ${fechaDeHoy}`);
      expect(id, 'Tiene que haber una caja diaria para hoy en la sucursal').toMatch(/^\d+$/);
    });

    await paso(page, 'Filtrar por la caja de regresion y verificar que este disponible', async () => {
      const cajas = await caja.cajasOfrecidas();
      await adjuntarTexto('Cajas ofrecidas en la caja diaria', cajas.join(SALTO));

      await conResaltado(page, page.locator(caja.comboCajaDeTotales).first(), 'Caja de regresion en la caja diaria', () => {
        expect(cajas.join(' | '),
          `La caja diaria tiene que ofrecer ${CAJA_DE_REGRESION} para filtrar sus movimientos`)
          .toContain(CAJA_DE_REGRESION);
      });

      await caja.filtrarPorCaja(CAJA_DE_REGRESION);
      await adjuntarTexto('Movimientos de la caja de regresion',
        (await caja.movimientos()).join(SALTO));
    });

    await paso(page, 'Verificar que el pago y el cobro cayeron solos en la caja', async () => {
      // Ninguno de los dos se cargo aca: las ordenes aprobadas aparecen solas en
      // la caja de su fecha y sucursal. Si alguna faltara, o quedo sin aprobar o
      // su fecha de recibo no es la de la caja.
      const filaDelPago = caja.filaDelMovimiento(ordenDePago);
      await expect(
        filaDelPago,
        `La orden de pago ${ordenDePago} tiene que aparecer sola en la caja del dia. Si no esta, ` +
        'revisar que este aprobada, que su fecha de recibo sea la de la caja y que la sucursal coincida.',
      ).toBeVisible({ timeout: 60_000 });

      const filaDelCobro = caja.filaDelMovimiento(ordenDeCobro);
      await expect(
        filaDelCobro,
        `La orden de cobro ${ordenDeCobro} tiene que aparecer sola en la caja del dia`,
      ).toBeVisible({ timeout: 60_000 });

      const celdasDelPago = await caja.celdas(filaDelPago);
      const celdasDelCobro = await caja.celdas(filaDelCobro);
      await adjuntarTexto('Movimiento del pago', celdasDelPago.join(' | '));
      await adjuntarTexto('Movimiento del cobro', celdasDelCobro.join(' | '));

      await conResaltado(page, filaDelPago, 'Caja del movimiento de pago', () => {
        expect(celdasDelPago.join(' | ').toUpperCase(),
          'El pago tiene que quedar registrado en la caja de regresion')
          .toContain(CAJA_DE_REGRESION.toUpperCase());
      });
      await conResaltado(page, filaDelCobro, 'Caja del movimiento de cobro', () => {
        expect(celdasDelCobro.join(' | ').toUpperCase(),
          'El cobro tiene que quedar registrado en la caja de regresion')
          .toContain(CAJA_DE_REGRESION.toUpperCase());
      });

      const soloImporte = /^-?([A-Z]{3}\s*)?\d[\d.,]*$/;
      const importeDelPago = celdasDelPago.filter((c) => soloImporte.test(c)).map(importe);
      const importeDelCobro = celdasDelCobro.filter((c) => soloImporte.test(c)).map(importe);

      await conResaltado(page, filaDelPago, 'Importe del pago en la caja', () => {
        expect(importeDelPago.map((i) => Math.abs(i.valor ?? 0)),
          'El movimiento de pago tiene que ser por el costo del item del file')
          .toContain(costo);
      });
      await conResaltado(page, filaDelCobro, 'Importe del cobro en la caja', () => {
        expect(importeDelCobro.map((i) => Math.abs(i.valor ?? 0)),
          'El movimiento de cobro tiene que ser por la venta del item del file')
          .toContain(venta);
      });

      // Columnas del movimiento: C, (c), Fecha, T, M, M, C, Medio, Referencia,
      // Cliente / Prov., Comentario. Cada movimiento tiene que decir con quien
      // fue: el pago con el proveedor y el cobro con el cliente.
      const textoDelPago = celdasDelPago.join(' | ').toUpperCase();
      const textoDelCobro = celdasDelCobro.join(' | ').toUpperCase();

      await conResaltado(page, filaDelPago, 'Fecha del movimiento de pago', () => {
        expect(celdasDelPago.join(' | '),
          'El movimiento de pago tiene que llevar la fecha de la caja')
          .toContain(fechaDeHoy);
      });
      await conResaltado(page, filaDelCobro, 'Fecha del movimiento de cobro', () => {
        expect(celdasDelCobro.join(' | '),
          'El movimiento de cobro tiene que llevar la fecha de la caja')
          .toContain(fechaDeHoy);
      });
      await conResaltado(page, filaDelPago, 'Proveedor del movimiento de pago', () => {
        expect(textoDelPago, 'El movimiento de pago tiene que identificar al proveedor')
          .toContain('GRUPO SUMMA');
      });
      await conResaltado(page, filaDelCobro, 'Cliente del movimiento de cobro', () => {
        expect(textoDelCobro, 'El movimiento de cobro tiene que identificar al cliente')
          .toContain(base.cliente.toUpperCase());
      });
      await conResaltado(page, filaDelPago, 'Moneda del movimiento de pago', () => {
        expect(textoDelPago, 'El movimiento tiene que estar en la moneda de la caja')
          .toContain(datos.moneda);
      });
    });

    await paso(page, 'Verificar el cuadre de la caja', async () => {
      const totales = await caja.totales(datos.moneda);
      totalesDeLaCaja = totales;
      await adjuntarTexto('Totales de la caja de regresion', JSON.stringify(totales, null, 2));
      expect(totales, `La caja tiene que mostrar sus totales en ${datos.moneda}`).not.toBeNull();

      const inicial = importe(totales!.inicial).valor ?? 0;
      const ingreso = importe(totales!.ingreso).valor ?? 0;
      const salida = importe(totales!.salida).valor ?? 0;
      const balance = importe(totales!.balance).valor ?? 0;
      const final = importe(totales!.final).valor ?? 0;

      // No se exige un importe fijo: la caja acumula lo de todas las corridas del
      // dia. Lo que si tiene que cerrar siempre es su propia aritmetica, que es
      // donde aparecerian los errores de cuadre.
      // La Salida se muestra **negativa**, asi que el balance es ingreso mas
      // salida, no ingreso menos salida.
      await conResaltado(page, page.locator(caja.grillaDeTotales).first(), 'Balance de la caja', () => {
        expect(Number((ingreso + salida).toFixed(2)),
          'El balance tiene que ser el ingreso mas la salida, que viene con signo negativo')
          .toBe(Number(balance.toFixed(2)));
      });
      await conResaltado(page, page.locator(caja.grillaDeTotales).first(), 'Saldo final de la caja', () => {
        expect(Number((inicial + balance).toFixed(2)),
          'El saldo final tiene que ser el saldo inicial mas el balance')
          .toBe(Number(final.toFixed(2)));
      });

      // Y lo nuestro tiene que estar adentro: el ingreso contiene la venta y la
      // salida contiene el costo.
      await conResaltado(page, page.locator(caja.grillaDeTotales).first(), 'Ingreso de la caja', () => {
        expect(ingreso, 'El ingreso de la caja tiene que incluir la venta cobrada')
          .toBeGreaterThanOrEqual(venta);
      });
      await conResaltado(page, page.locator(caja.grillaDeTotales).first(), 'Salida de la caja', () => {
        expect(Math.abs(salida), 'La salida de la caja tiene que incluir el costo pagado')
          .toBeGreaterThanOrEqual(costo);
      });
    });

    await paso(page, 'Abrir el pre-cierre y verificar que muestre el cuadre', async () => {
      // El pre-cierre es de solo lectura: no cambia el estado de la caja. El
      // cierre definitivo no se automatiza a proposito — ver la nota del ESTADO.
      const modal = await caja.abrirPreCierre();
      const fila = await caja.filaDelPreCierre(CAJA_DE_REGRESION);
      await adjuntarTexto('Fila de la caja en el pre-cierre', fila.join(' | '));

      await conResaltado(page, modal, 'Pre-cierre con la caja de regresion', () => {
        expect(fila.length,
          `El pre-cierre tiene que listar ${CAJA_DE_REGRESION} con su cuadre`)
          .toBeGreaterThan(0);
      });

      // Columnas: (c), Nombre, M, Inicial, Ingreso, Salida, Balance dia, Final.
      // El cuadre del pre-cierre tiene que dar lo mismo que el de la pantalla.
      const numeros = fila.map(importe).map((i) => i.valor);
      await conResaltado(page, modal, 'Cuadre del pre-cierre', () => {
        expect(numeros,
          'El balance del dia en el pre-cierre tiene que coincidir con el de la pantalla')
          .toContain(importe(totalesDeLaCaja?.balance ?? '').valor);
      });

      await adjuntarTexto('Cadena completa generada', [
        `File: ${base.fileCode}`,
        `Factura de proveedor: ${facturaProveedor.puntoDeVenta}-${facturaProveedor.numeroDeFactura}`,
        `Orden de pago: ${ordenDePago} (costo ${costo})`,
        `Comprobante al cliente: ${facturaCliente.comprobante}`,
        `Orden de cobro: ${ordenDeCobro} (venta ${venta})`,
        `Utilidad: ${venta - costo}`,
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
