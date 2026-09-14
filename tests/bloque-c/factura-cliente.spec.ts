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

  test('Factura al cliente: se emite sobre el file y toma sus conceptos', async ({ page }) => {
    test.setTimeout(900_000);

    const factura = new FacturaClientePage(page);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');

    // La factura al cliente **no necesita** la factura del proveedor ni la orden
    // de pago: entra por el file. Por eso su precondicion es la mas corta de la
    // cadena, apenas la reserva y su file.
    const precondicion = await reservarServicioYGenerarFile(page, sello);

    // El buscador de files filtra por el cliente elegido, y la grilla muestra el
    // numero sin el prefijo ni el sufijo del codigo que se ve en el file. Se
    // busca por el grupo de digitos, que es lo unico comun a las dos formas.
    const digitosDelFile = precondicion.fileCode.match(/\d{6,}/)?.[0] ?? '';
    expect(
      digitosDelFile,
      `No se pudo extraer el numero del file de su codigo (${precondicion.fileCode})`,
    ).not.toBe('');

    const datos = {
      detalle: `Factura de regresion automatica ${sello}. No operar.`,
    };

    // Total con el que queda armado el comprobante: se captura en la pantalla y
    // despues se exige identico en la bandeja de pendientes.
    let totalDelComprobante: { moneda: string; valor: number | null } = { moneda: '', valor: null };

    await paso(page, 'Entrar a Facturacion y abrir un comprobante nuevo', async () => {
      await factura.irANuevoComprobante();
      await expect(page.locator(factura.btnDestinatario)).toBeVisible();
    });

    await paso(page, 'Elegir el destinatario y verificar sus datos', async () => {
      await factura.elegirDestinatario(precondicion.cliente);
      const destinatario = await factura.datosDelDestinatario();
      await adjuntarTexto('Destinatario del comprobante', JSON.stringify(destinatario, null, 2));

      await conResaltado(page, page.locator(factura.nombreDelCliente), 'Destinatario elegido', () => {
        expect(destinatario.nombre.toUpperCase(),
          'El comprobante tiene que emitirse al mismo cliente que tiene el file')
          .toContain(precondicion.cliente.toUpperCase());
      });
      // El documento y la condicion fiscal quedan como evidencia, sin exigirlos:
      // este cliente los trae vacios y no hay historia que defina que deberian
      // venir cargados. Convertir eso en resultado esperado seria inventarlo.
      await adjuntarTexto('Documento y condicion fiscal del destinatario',
        `Documento: "${destinatario.documento}" | Condicion: "${destinatario.condicion}"`);
    });

    await paso(page, 'Elegir el file y verificar lo que completa solo', async () => {
      await factura.elegirFile(digitosDelFile);

      // El campo trae el numero **con el sufijo del file** ("29720-01"), asi que
      // se compara el primer grupo de digitos y no todos juntos.
      const numeroCargado = (await page.locator(factura.campoNumeroDeFile).inputValue()).trim();
      await conResaltado(page, page.locator(factura.campoNumeroDeFile), 'Numero de file', () => {
        expect(Number(numeroCargado.match(/\d+/)?.[0] ?? -1),
          `El comprobante tiene que quedar atado al file de la reserva. El campo trae ` +
          `"${numeroCargado}" y el file es ${precondicion.fileCode}`)
          .toBe(Number(digitosDelFile));
      });

      // El pasajero y las fechas los trae el file: no se cargan a mano.
      const pasajero = (await page.locator(factura.campoPasajero).inputValue()).trim();
      await conResaltado(page, page.locator(factura.campoPasajero), 'Pasajero del comprobante', () => {
        expect(pasajero.toUpperCase(), 'El comprobante tiene que tomar el pasajero del file')
          .toContain(precondicion.apellidoDelPax.toUpperCase());
      });

      const fechas = (await page.locator(factura.campoFechasDelServicio).inputValue()).trim();
      await adjuntarTexto('Fechas de los servicios', fechas);
      await conResaltado(page, page.locator(factura.campoFechasDelServicio), 'Fechas del servicio', () => {
        expect(fechas, 'Las fechas de los servicios tienen que venir del file')
          .toContain(precondicion.fechaDelServicio);
      });

      // La moneda tambien la fija el file.
      const moneda = await factura.opcionElegida(factura.comboMoneda);
      await conResaltado(page, page.locator(factura.comboMoneda), 'Moneda del comprobante', () => {
        expect(moneda, 'La moneda del comprobante tiene que ser la del file')
          .toContain(precondicion.ventaDelItem.moneda || precondicion.costoDelItem.moneda);
      });

      // El vencimiento lo calcula el servidor a partir del file y del cliente
      // (invoicing.js, loadDueDate): no se escribe.
      const vencimiento = (await page.locator(factura.campoVencimiento).inputValue()).trim();
      await adjuntarTexto('Vencimiento calculado', vencimiento);
      await conResaltado(page, page.locator(factura.campoVencimiento), 'Vencimiento del comprobante', () => {
        expect(vencimiento,
          'El vencimiento lo calcula el BO a partir del file y del cliente, y sin el no deja guardar')
          .not.toBe('');
      });
    });

    await paso(page, 'Comparar los conceptos y el total contra el file', async () => {
      const conceptos = await factura.conceptos();
      await adjuntarTexto('Conceptos traidos del file',
        conceptos.map((c) => c.filter(Boolean).join(' | ')).join(SALTO));

      await conResaltado(page, page.locator(factura.grillaDeConceptos), 'Servicio en los conceptos', () => {
        expect(conceptos.flat().join(' | ').toUpperCase(),
          'Los conceptos tienen que traer el servicio reservado')
          .toContain('TIGRE Y DELTA');
      });

      // Un unico concepto, el del servicio reservado.
      await conResaltado(page, page.locator(factura.grillaDeConceptos), 'Cantidad de conceptos', () => {
        expect(conceptos.length, 'El file tiene que traer un concepto por item reservado')
          .toBe(1);
      });

      // Columnas del concepto: tipo, codigo, nombre, ciudad, fecha, cantidad,
      // unitario y total. La cantidad tiene que ser la de pasajeros reservados y
      // el total tiene que cerrar contra el unitario.
      const concepto = conceptos[0] ?? [];
      const numeros = concepto.map((c) => importeANumero(c));
      const cantidad = numeros[5];
      const unitario = numeros[6];
      const totalDelConcepto = numeros[7];
      await adjuntarTexto('Concepto del file',
        `cantidad ${cantidad} | unitario ${unitario} | total ${totalDelConcepto}`);

      await conResaltado(page, page.locator(factura.grillaDeConceptos), 'Cantidad del concepto', () => {
        expect(cantidad, 'La cantidad del concepto tiene que ser la de pasajeros reservados')
          .toBe(precondicion.cantidadPax);
      });
      await conResaltado(page, page.locator(factura.grillaDeConceptos), 'Precio unitario del concepto', () => {
        expect(Number(((unitario ?? 0) * (cantidad ?? 0)).toFixed(2)),
          'El total del concepto tiene que ser su precio unitario por la cantidad')
          .toBe(Number((totalDelConcepto ?? 0).toFixed(2)));
      });

      // El tipo por defecto del BO es Carta de Cobranza (NewInvoice.aspx.cs:50).
      const tipo = await factura.opcionElegida(factura.comboTipo);
      await adjuntarTexto('Tipo de comprobante', tipo);
      await conResaltado(page, page.locator(factura.comboTipo), 'Tipo de comprobante', () => {
        expect(tipo, 'El comprobante tiene que emitirse con el tipo que el BO deja por defecto')
          .not.toBe('');
      });

      const aviso = await factura.descuento();
      if (aviso) await adjuntarTexto('Aviso de descuento', aviso);

      totalDelComprobante = importe(await page.locator(factura.campoTotal).inputValue());
      const total = totalDelComprobante;
      await adjuntarTexto('Total del comprobante',
        `${total.valor} (venta del item en el file: ${precondicion.ventaDelItem.valor})`);

      await conResaltado(page, page.locator(factura.campoTotal), 'Total del comprobante', () => {
        if (aviso) {
          // El file viene de una reserva online y puede traer descuento: en ese
          // caso el total es menor que la venta, y el aviso lo explica.
          expect(total.valor as number,
            `El comprobante aplica un descuento (${aviso}), asi que su total tiene que ser ` +
            'menor que la venta del item del file')
            .toBeLessThan(precondicion.ventaDelItem.valor as number);
        } else {
          expect(total.valor,
            'Sin descuento, el total del comprobante tiene que ser la venta del item del file')
            .toBe(precondicion.ventaDelItem.valor);
        }
      });
    });

    await paso(page, 'Guardar el comprobante y verificarlo en la bandeja de pendientes', async () => {
      await page.locator(factura.campoDetalle).fill(datos.detalle);

      // La cotizacion tiene que ser mayor a cero o el guardado corta
      // (NewInvoice.aspx.cs:314). Con la moneda del comprobante igual a la
      // relacionada, el BO no propone ninguna y hay que ponerla.
      const cotizacion = (await page.locator(factura.campoCotizacion).inputValue()).trim();
      if (!cotizacion || Number(cotizacion.replace(',', '.')) <= 0) {
        await page.locator(factura.campoCotizacion).fill('1');
      }

      await factura.guardar();

      const fila = factura.filaPendiente(digitosDelFile);
      await expect(
        fila,
        `El comprobante del file ${precondicion.fileCode} tiene que quedar en la bandeja de ` +
        `pendientes de emision. El BO dijo: "${await factura.mensajeDeError()}"`,
      ).toBeVisible({ timeout: 60_000 });

      const celdas = await factura.celdas(fila);
      await adjuntarTexto('Fila del comprobante pendiente', celdas.join(' | '));

      const soloImporte = /^([A-Z]{3}\s*)?\d[\d.,]*$/;
      const importesDeLaFila = celdas.filter((c) => soloImporte.test(c)).map(importe);

      await conResaltado(page, fila, 'Total del comprobante en la bandeja', () => {
        expect(importesDeLaFila.map((i) => i.valor),
          'La bandeja tiene que mostrar el mismo total con el que se guardo el comprobante')
          .toContain(totalDelComprobante.valor);
      });

      // Columnas: chk, Comprobante, File, Pax, Fecha, Total, Emitir.
      const texto = celdas.join(' | ');
      await conResaltado(page, fila, 'Pasajero en la bandeja', () => {
        expect(texto.toUpperCase(), 'La bandeja tiene que mostrar el pasajero del file')
          .toContain(precondicion.apellidoDelPax.toUpperCase());
      });
      await conResaltado(page, fila, 'Numero de comprobante en la bandeja', () => {
        expect(celdas.some((c) => /^[A-Z]{2}\d/.test(c)),
          'La bandeja tiene que mostrar el numero del comprobante')
          .toBe(true);
      });
      await conResaltado(page, fila, 'Fecha en la bandeja', () => {
        expect(texto, 'La bandeja tiene que mostrar la fecha de emision del comprobante')
          .toContain(formatearFecha(ahora));
      });

      await adjuntarTexto('Cadena generada', [
        `File: ${precondicion.fileCode}`,
        `Cliente: ${precondicion.cliente}`,
        `Comprobante: ${celdas[1] ?? '?'}`,
        `Total: ${totalDelComprobante.moneda} ${totalDelComprobante.valor}`,
      ].join(SALTO));
    });
  });

});
