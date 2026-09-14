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

  test('Orden de cobro: cobra el comprobante del cliente en la caja de regresion', async ({ page }) => {
    test.setTimeout(900_000);

    const orden = new OrdenDeCobroPage(page);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');

    const datos = {
      // La misma caja propia que usa la orden de pago. Ninguna caja preexistente
      // se toca, para no mover los saldos reales de QA.
      caja: CAJA_DE_REGRESION,
      moneda: 'USD',
      detalle: `Orden de cobro de regresion automatica ${sello}. No operar.`,
      comentarioDeLaImputacion: `AUTO-QA ${sello.slice(-8)}`,
      numeroDeRecibo: `AUTOQA${sello.slice(-8)}`,
      estadoAprobada: 'PAGO',
    };

    const precondicion = await armarFacturaAlCliente(
      page, sello, await reservarServicioYGenerarFile(page, sello));
    const totalDeLaOrden = precondicion.total;
    const fechaDeHoy = formatearFecha(ahora);

    let idDeLaOrden = '';

    await paso(page, 'Entrar a la bandeja de ordenes de cobro y abrir una nueva', async () => {
      await orden.irABandejaDeOrdenes();
      await orden.nuevaOrden();
      await expect(page.locator(orden.campoImporteDeLaCaja)).toBeVisible();

      const fecha = (await page.locator(orden.campoFecha).inputValue()).trim();
      await conResaltado(page, page.locator(orden.campoFecha), 'Fecha de la orden', () => {
        expect(fecha, 'La orden tiene que nacer con la fecha de hoy').toBe(fechaDeHoy);
      });
    });

    await paso(page, 'Elegir el cliente y la moneda del cobro', async () => {
      const filaDelBuscador = await orden.elegirCliente(precondicion.cliente, precondicion.cliente);
      await adjuntarTexto('Cliente elegido en el buscador', filaDelBuscador.join(' | '));

      // El documento no se fija en el test: se exige que el que quedo cargado sea
      // el mismo que mostraba el buscador al elegirlo.
      const documento = (await page.locator(orden.campoDocumento).inputValue()).trim();
      await conResaltado(page, page.locator(orden.campoDocumento), 'Documento del cliente', () => {
        expect(filaDelBuscador.join(' | '),
          'El documento cargado tiene que ser el que mostraba el buscador de clientes')
          .toContain(documento);
      });

      const cliente = (await page.locator(orden.campoCliente).inputValue()).trim();
      await conResaltado(page, page.locator(orden.campoCliente), 'Cliente de la orden', () => {
        expect(cliente.toUpperCase(),
          'La orden tiene que quedar a nombre del mismo cliente al que se le facturo')
          .toContain(precondicion.cliente.toUpperCase());
      });

      // La moneda decide que cajas se ofrecen (CashFlowSvc.LoadPublished).
      await orden.elegirEnCombo(orden.comboMoneda, datos.moneda);
    });

    await paso(page, 'Verificar que la caja de regresion se ofrezca y elegirla', async () => {
      const cajas = await orden.opcionesDe(orden.comboCaja);
      await adjuntarTexto('Cajas ofrecidas para la moneda de la orden', cajas.join(SALTO));

      await conResaltado(page, page.locator(orden.comboCaja), 'Caja de regresion disponible', () => {
        expect(cajas.join(' | '),
          `La orden tiene que ofrecer la caja ${datos.caja} para ${datos.moneda}. Si no aparece, ` +
          'revisar que siga publicada y que su categoria siga publicada y con sucursal.')
          .toContain(datos.caja);
      });

      await orden.elegirEnCombo(orden.comboCaja, datos.caja);
    });

    await paso(page, 'Cargar el importe y verificar el total que calcula el BO', async () => {
      await orden.cargarImporte(aFormatoBO(totalDeLaOrden));
      await page.locator(orden.campoDetalle).fill(datos.detalle);

      const total = importe(await page.locator(orden.campoTotal).inputValue());
      await conResaltado(page, page.locator(orden.campoTotal), 'Total calculado de la orden', () => {
        expect(total.valor,
          'Con una sola forma de pago, el total que calcula el BO tiene que ser ese importe')
          .toBe(totalDeLaOrden);
      });
    });

    await paso(page, 'Guardar la orden y verificar que conserve los datos cargados', async () => {
      idDeLaOrden = await orden.guardar();
      expect(
        idDeLaOrden,
        `El guardado tiene que devolver el ID de la orden. El BO dijo: ` +
        `"${await orden.mensajeDeError()}"`,
      ).toMatch(/^\d+$/);

      // El codigo lo arma el BO al guardar: OC + el ID en diez digitos
      // (CodeHelper.SetChargeOrderCode).
      const codigo = (await page.locator(orden.campoCodigo).inputValue()).trim();
      await adjuntarTexto('Orden de cobro generada', `${codigo} (id ${idDeLaOrden})`);
      await conResaltado(page, page.locator(orden.campoCodigo), 'Codigo de la orden', () => {
        expect(codigo, 'El BO tiene que numerar la orden con el formato OC y diez digitos')
          .toBe(`OC${idDeLaOrden.padStart(10, '0')}`);
      });

      const caja = await orden.opcionElegida(orden.comboCaja);
      await conResaltado(page, page.locator(orden.comboCaja), 'Caja de la orden guardada', () => {
        expect(caja, 'La orden tiene que conservar la caja elegida').toContain(datos.caja);
      });

      const importeDeLaCaja = importe(await page.locator(orden.campoImporteDeLaCaja).inputValue());
      await conResaltado(page, page.locator(orden.campoImporteDeLaCaja), 'Importe de la forma de pago', () => {
        expect(importeDeLaCaja.valor, 'La forma de pago tiene que conservar su importe')
          .toBe(totalDeLaOrden);
      });

      const detalle = (await page.locator(orden.campoDetalle).inputValue()).trim();
      await conResaltado(page, page.locator(orden.campoDetalle), 'Detalle de la orden', () => {
        expect(detalle, 'La orden tiene que conservar su detalle').toBe(datos.detalle);
      });

      // El vencimiento de la forma de pago nace con la fecha de hoy y no puede
      // quedar antes de la fecha de la orden (Detail.aspx.cs:634).
      const vencimiento = (await page.locator(orden.campoVencimientoDeLaCaja).inputValue()).trim();
      await conResaltado(page, page.locator(orden.campoVencimientoDeLaCaja), 'Vencimiento de la forma de pago', () => {
        expect(vencimiento, 'La forma de pago tiene que conservar su fecha de vencimiento')
          .toBe(fechaDeHoy);
      });

      // El mes de aplicacion define en que periodo impacta la orden.
      const mesDeAplicacion = await orden.opcionElegida(orden.comboMesDeAplicacion);
      await adjuntarTexto('Mes de aplicacion de la orden', mesDeAplicacion);
      // El combo escribe el mes con su nombre, no con el numero.
      await conResaltado(page, page.locator(orden.comboMesDeAplicacion), 'Mes de aplicacion', () => {
        expect(mesDeAplicacion.toUpperCase(),
          'El mes de aplicacion tiene que ser el de la fecha de la orden')
          .toContain(nombreDelMes(fechaDeHoy));
      });

      const cotizacion = importe(await page.locator(orden.campoCotizacion).inputValue());
      await conResaltado(page, page.locator(orden.campoCotizacion), 'Cotizacion de la orden', () => {
        expect(cotizacion.valor as number, 'La cotizacion de la orden nunca puede quedar en cero')
          .toBeGreaterThan(0);
      });
    });

    await paso(page, 'Verificar el pendiente de asignacion contra el total de la orden', async () => {
      const pendiente = importe(await orden.pendiente());
      await adjuntarTexto('Pendiente de asignacion de la orden', await orden.pendiente());
      await conResaltado(page, page.locator(orden.pendienteDeAsignacion).first(), 'Pendiente inicial', () => {
        expect(pendiente.valor, 'Sin nada imputado, el pendiente tiene que ser el total de la orden')
          .toBe(totalDeLaOrden);
      });
    });

    await paso(page, 'Ubicar el comprobante entre los pendientes y comparar la fila', async () => {
      // Se ubica por el **file**, no por el numero de comprobante: todos los
      // comprobantes salen con el mismo numero (CC00010-00000000), asi que
      // filtrar por el se queda con el de cualquier corrida anterior del mismo
      // cliente. El codigo del file si es unico por corrida.
      const fila = orden.filaPendiente(precondicion.fileCode);
      await expect(
        fila,
        `El comprobante del file ${precondicion.fileCode} tiene que figurar entre los pendientes ` +
        `de cobro de ${precondicion.cliente}. Si no aparece, revisar que tenga saldo y que la ` +
        'moneda coincida con la de la orden.',
      ).toBeVisible({ timeout: 60_000 });

      const celdas = await orden.celdas(fila);
      await adjuntarTexto('Fila del comprobante pendiente de cobro', celdas.join(' | '));

      // Por nombre de columna y no por posicion: la grilla trae los importes en
      // dos monedas y el saldo de la otra viene con punto decimal.
      const totalUSD = importe(await orden.valorDeColumna(fila, 'Total USD'));
      const saldoUSD = importe(await orden.valorDeColumna(fila, 'Saldo USD'));
      await adjuntarTexto('Importes en USD de la fila',
        `Total: ${totalUSD.valor} | Saldo: ${saldoUSD.valor}`);

      await conResaltado(page, fila, 'Total del comprobante pendiente', () => {
        expect(totalUSD.valor, 'La grilla tiene que mostrar el total del comprobante emitido')
          .toBe(totalDeLaOrden);
      });
      await conResaltado(page, fila, 'Saldo del comprobante pendiente', () => {
        expect(saldoUSD.valor,
          'El comprobante no tiene nada cobrado, asi que su saldo tiene que ser el total entero')
          .toBe(totalDeLaOrden);
      });
    });

    await paso(page, 'Abrir la asignacion y comparar los importes del modal', async () => {
      await orden.abrirAsignacion(orden.filaPendiente(precondicion.fileCode));
      const modal = page.locator(orden.modalDeAsignacion);
      const importes = await orden.importesDelModal();
      await adjuntarTexto('Importes del modal de asignacion', JSON.stringify(importes, null, 2));

      await conResaltado(page, modal, 'Moneda del modal', () => {
        expect(importes.moneda, 'El modal tiene que mostrar la moneda de la orden')
          .toContain(datos.moneda);
      });
      await conResaltado(page, modal, 'Total de la orden en el modal', () => {
        expect(importe(importes.ordenTotal).valor, 'El modal tiene que mostrar el total de la orden')
          .toBe(totalDeLaOrden);
      });
      await conResaltado(page, modal, 'Pendiente de la orden en el modal', () => {
        expect(importe(importes.ordenPendiente).valor,
          'Sin nada imputado, el pendiente de la orden tiene que ser su total entero')
          .toBe(totalDeLaOrden);
      });
      await conResaltado(page, modal, 'Total del comprobante en el modal', () => {
        expect(importe(importes.comprobanteTotal).valor,
          'El modal tiene que mostrar el total del comprobante emitido al cliente')
          .toBe(totalDeLaOrden);
      });
      await conResaltado(page, modal, 'Pendiente del comprobante en el modal', () => {
        expect(importe(importes.comprobantePendiente).valor,
          'El comprobante no tiene nada cobrado, asi que su pendiente tiene que ser su total entero')
          .toBe(totalDeLaOrden);
      });
    });

    await paso(page, 'Imputar el comprobante y verificar que el pendiente baje a cero', async () => {
      await orden.imputar(aFormatoBO(totalDeLaOrden), datos.comentarioDeLaImputacion);

      const pendiente = importe(await orden.pendiente());
      await adjuntarTexto('Pendiente despues de imputar', await orden.pendiente());
      await conResaltado(page, page.locator(orden.pendienteDeAsignacion).first(), 'Pendiente final', () => {
        expect(pendiente.valor,
          'Imputada la orden entera, no tiene que quedar nada pendiente de asignacion')
          .toBe(0);
      });

    });

    await paso(page, 'Aprobar la orden aplicando el recibo y verificar el estado', async () => {
      await orden.aprobar(fechaDeHoy, datos.numeroDeRecibo);

      const estado = await orden.estado();
      await adjuntarTexto('Estado de la orden', estado);
      await conResaltado(page, page.locator(orden.btnAprobar), 'Estado de la orden aprobada', () => {
        expect(estado.toUpperCase(),
          'Aprobada y con el recibo aplicado, la orden tiene que quedar en estado pago. Si dijera ' +
          'que no encuentra sucursal, revisar que la categoria de la caja siga teniendo BranchID')
          .toContain(datos.estadoAprobada);
      });

      const numero = (await page.locator(orden.campoNumeroDelRecibo).inputValue()).trim();
      await conResaltado(page, page.locator(orden.campoNumeroDelRecibo), 'Numero del recibo', () => {
        expect(numero, 'El recibo tiene que conservar su numero').toBe(datos.numeroDeRecibo);
      });

      const fechaDelRecibo = (await page.locator(orden.campoFechaDelRecibo).inputValue()).trim();
      await conResaltado(page, page.locator(orden.campoFechaDelRecibo), 'Fecha del recibo', () => {
        expect(fechaDelRecibo, 'El recibo tiene que conservar la fecha con la que se aplico')
          .toBe(fechaDeHoy);
      });

      // Recien cobrada la orden el comprobante deja de figurar entre los
      // pendientes: es lo que prueba que la imputacion llego al comprobante y no
      // se quedo en la orden.
      await expect(
        orden.filaPendiente(precondicion.fileCode),
        'Cobrado y aprobado, el comprobante no tiene que seguir apareciendo entre los pendientes',
      ).toBeHidden({ timeout: 60_000 });

      await adjuntarTexto('Cadena generada', [
        `File: ${precondicion.fileCode}`,
        `Cliente: ${precondicion.cliente}`,
        `Comprobante: ${precondicion.comprobante}`,
        `Orden de cobro: OC${idDeLaOrden.padStart(10, '0')} (id ${idDeLaOrden})`,
        `Caja: ${datos.caja}`,
        `Cobrado: ${datos.moneda} ${aFormatoBO(totalDeLaOrden)}`,
      ].join(SALTO));
    });

    await paso(page, 'Verificar la orden en la bandeja de ordenes de cobro', async () => {
      // Columnas: C, (c), Fecha, Referencia, Observ., Files, Fecha de Venc.,
      // Cliente, Monto, Estado.
      const codigo = `OC${idDeLaOrden.padStart(10, '0')}`;
      await orden.irABandejaDeOrdenes();
      await orden.buscarEnLaBandeja(codigo);

      const fila = orden.filaEnLaBandeja(codigo);
      await expect(
        fila,
        `La orden ${codigo} tiene que aparecer en la bandeja de ordenes de cobro`,
      ).toBeVisible({ timeout: 60_000 });

      const celdas = await orden.celdasDeLaBandeja(codigo);
      await adjuntarTexto('Fila de la orden en la bandeja', celdas.join(' | '));
      const texto = celdas.join(' | ');

      await conResaltado(page, fila, 'Cliente en la bandeja', () => {
        expect(texto.toUpperCase(), 'La bandeja tiene que mostrar el cliente de la orden')
          .toContain(precondicion.cliente.toUpperCase());
      });
      await conResaltado(page, fila, 'Observaciones en la bandeja', () => {
        expect(texto, 'La bandeja tiene que mostrar el detalle cargado en la orden')
          .toContain(datos.detalle.slice(0, 40));
      });
      await conResaltado(page, fila, 'Estado en la bandeja', () => {
        expect(texto.toUpperCase(),
          'Aprobada, la orden tiene que figurar como pagada tambien en la bandeja')
          .toContain(datos.estadoAprobada);
      });
      // La bandeja escribe el file en forma corta ("AM-29746"), sin los ceros a la
      // izquierda ni el sufijo que lleva el codigo del file. Se compara el numero.
      const fileEnLaBandeja = texto.match(/[A-Z]{2}-(\d+)/)?.[1] ?? '';
      await conResaltado(page, fila, 'File en la bandeja', () => {
        expect(Number(fileEnLaBandeja),
          `La bandeja tiene que mostrar el file del comprobante que se cobro ` +
          `(${precondicion.fileCode}). Muestra: ${texto}`)
          .toBe(Number(precondicion.fileCode.match(/\d{6,}/)?.[0] ?? -1));
      });

      const soloImporte = /^-?([A-Z]{3}\s*)?\d[\d.,]*$/;
      const importesDeLaFila = celdas.filter((c) => soloImporte.test(c)).map(importe);
      await conResaltado(page, fila, 'Monto en la bandeja', () => {
        expect(importesDeLaFila.map((i) => i.valor),
          'La bandeja tiene que mostrar el monto con el que se cobro la orden')
          .toContain(totalDeLaOrden);
      });
    });
  });

});
