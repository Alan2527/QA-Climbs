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

  test('Orden de pago: cancela la factura del proveedor desde la caja de regresion', async ({ page }) => {
    test.setTimeout(900_000);

    const orden = new OrdenDePagoPage(page);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');

    const datos = {
      sucursal: 'Argentina',
      proveedor: 'GRUPO SUMMA',
      razonSocial: 'GRUPO SUMMA SRL',
      // La caja propia del Bloque C: la 187, en USD y con saldo inicial en cero.
      // Ninguna caja preexistente se usa, para no mover los saldos reales de QA.
      caja: CAJA_DE_REGRESION,
      detalle: `Orden de pago de regresion automatica ${sello}. No operar.`,
      comentarioDeLaImputacion: `AUTO-QA ${sello.slice(-8)}`,
      numeroDeRecibo: `AUTOQA${sello.slice(-8)}`,
      // El estado 30 se describe como "Pago" (PayOrderStatusEnum), no "Pagada".
      estadoAprobada: 'PAGO',
    };

    const precondicion = await armarFacturaAprobada(
      page, sello, ahora, await reservarServicioYGenerarFile(page, sello));
    const totalDeLaOrden = precondicion.total;
    const fechaDeHoy = formatearFecha(ahora);

    let idDeLaOrden = '';

    await paso(page, 'Entrar a la bandeja de ordenes de pago y abrir una nueva', async () => {
      await orden.irABandejaDeOrdenes();
      await orden.nuevaOrden();
      await expect(page.locator(orden.campoImporteDeLaCaja)).toBeVisible();

      // La orden nace con la fecha de hoy y el vencimiento de la forma de pago
      // tambien: el guardado rechaza un vencimiento anterior a la fecha de la
      // orden (Detail.aspx.cs:634).
      const fecha = (await page.locator(orden.campoFecha).inputValue()).trim();
      await conResaltado(page, page.locator(orden.campoFecha), 'Fecha de la orden', () => {
        expect(fecha, 'La orden tiene que nacer con la fecha de hoy').toBe(fechaDeHoy);
      });
    });

    await paso(page, 'Verificar la sucursal y elegir el proveedor y la moneda', async () => {
      // La sucursal **no se toca**: el combo de esta pantalla no trae
      // "Seleccione..." y ya viene en Argentina, asi que una persona no tiene
      // nada que elegir. Reelegir el valor que ya esta puesto tampoco seria lo
      // que hace una persona, y ademas rompe la pantalla: el navegador no
      // dispara `change` al reelegir lo mismo, pero `selectOption` si, y ese
      // postback repinta el UpdatePanel sin reenganchar los handlers.
      const sucursal = await orden.opcionElegida(orden.comboSucursal);
      await conResaltado(page, page.locator(orden.comboSucursal), 'Sucursal de la orden', () => {
        expect(sucursal, 'La orden tiene que nacer en la misma sucursal que el file y la factura')
          .toContain(datos.sucursal);
      });

      await orden.elegirProveedor(datos.proveedor, datos.razonSocial);

      const razonSocial = (await page.locator(orden.campoProveedor).inputValue()).trim();
      await conResaltado(page, page.locator(orden.campoProveedor), 'Proveedor de la orden', () => {
        expect(razonSocial, 'La orden tiene que quedar a nombre del proveedor de la factura')
          .toBe(datos.razonSocial);
      });

      // La moneda tiene que ser la de la factura: la lista de cajas se arma por
      // moneda y sucursal (CashFlowSvc.LoadPublishedByBranch), asi que cambiarla
      // cambia que cajas se ofrecen.
      await orden.elegirEnCombo(orden.comboMoneda, precondicion.moneda);
    });

    await paso(page, 'Verificar que la caja de regresion se ofrezca y elegirla', async () => {
      const cajas = await orden.opcionesDe(orden.comboCaja);
      await adjuntarTexto('Cajas ofrecidas para la moneda de la orden', cajas.join(SALTO));

      // Es la verificacion de que la caja creada para el Bloque C quedo bien
      // configurada: publicada, en la moneda correcta y en una categoria
      // publicada de la sucursal. Si desaparece, la cadena entera se queda sin
      // donde pagar.
      await conResaltado(page, page.locator(orden.comboCaja), 'Caja de regresion disponible', () => {
        expect(cajas.join(' | '),
          `La orden tiene que ofrecer la caja ${datos.caja} para ${precondicion.moneda}. ` +
          'Si no aparece, revisar que siga publicada y que su categoria pertenezca a la sucursal.')
          .toContain(datos.caja);
      });

      await orden.elegirEnCombo(orden.comboCaja, datos.caja);
    });

    await paso(page, 'Cargar el importe y verificar el total que calcula el BO', async () => {
      await orden.cargarImporte(aFormatoBO(totalDeLaOrden));
      await page.locator(orden.campoDetalle).fill(datos.detalle);

      // El Monto Total no se escribe: lo suma el BO a partir de las formas de
      // pago (payment.js:274). Con una sola caja tiene que dar ese importe.
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

      // El codigo lo arma el BO al guardar: OP + el ID en diez digitos
      // (CodeHelper.SetPayOrderCode).
      const codigo = (await page.locator(orden.campoCodigo).inputValue()).trim();
      await adjuntarTexto('Orden de pago generada', `${codigo} (id ${idDeLaOrden})`);
      await conResaltado(page, page.locator(orden.campoCodigo), 'Codigo de la orden', () => {
        expect(codigo, 'El BO tiene que numerar la orden con el formato OP y diez digitos')
          .toBe(`OP${idDeLaOrden.padStart(10, '0')}`);
      });

      const total = importe(await page.locator(orden.campoTotal).inputValue());
      await conResaltado(page, page.locator(orden.campoTotal), 'Total de la orden guardada', () => {
        expect(total.valor, 'La orden tiene que conservar el importe cargado').toBe(totalDeLaOrden);
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
      await conResaltado(page, page.locator(orden.pendienteDeAsignacion), 'Pendiente inicial', () => {
        expect(pendiente.valor, 'Sin nada imputado, el pendiente tiene que ser el total de la orden')
          .toBe(totalDeLaOrden);
      });
    });

    await paso(page, 'Ubicar la factura entre las pendientes y comparar la fila', async () => {
      const fila = orden.filaPendiente(precondicion.numeroDeFactura);
      await expect(
        fila,
        `La factura ${precondicion.puntoDeVenta}-${precondicion.numeroDeFactura} tiene que ` +
        `figurar entre las pendientes de pago de ${datos.razonSocial}. Si no aparece, revisar ` +
        'que este aprobada y que la sucursal y la moneda coincidan con las de la orden.',
      ).toBeVisible({ timeout: 60_000 });

      const celdas = await orden.celdas(fila);
      await adjuntarTexto('Fila de la factura pendiente de pago', celdas.join(' | '));

      const texto = celdas.join(' | ');
      const soloImporte = /^([A-Z]{3}\s*)?\d[\d.,]*$/;
      const importesDeLaFila = celdas.filter((c) => soloImporte.test(c)).map(importe);

      await conResaltado(page, fila, 'Saldo de la factura pendiente', () => {
        expect(importesDeLaFila.at(-1)?.valor,
          'La factura no tiene nada pagado, asi que su saldo tiene que ser el total entero')
          .toBe(totalDeLaOrden);
      });
      await conResaltado(page, fila, 'Importes de la factura pendiente', () => {
        expect(texto,
          'La fila tiene que mostrar el total de la factura, sus retenciones y el importe pagable')
          .toContain('Pagable');
      });
    });

    await paso(page, 'Abrir la asignacion y comparar los importes del modal', async () => {
      await orden.abrirAsignacion(orden.filaPendiente(precondicion.numeroDeFactura));
      const modal = page.locator(orden.modalDeAsignacion);
      const importes = await orden.importesDelModal();
      await adjuntarTexto('Importes del modal de asignacion', JSON.stringify(importes, null, 2));

      await conResaltado(page, modal, 'Moneda del modal', () => {
        expect(importes.moneda, 'El modal tiene que mostrar la moneda de la orden')
          .toContain(precondicion.moneda);
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
      await conResaltado(page, modal, 'Total de la factura en el modal', () => {
        expect(importe(importes.facturaTotal).valor,
          'El modal tiene que mostrar el total de la factura del proveedor')
          .toBe(totalDeLaOrden);
      });
      await conResaltado(page, modal, 'Pendiente de la factura en el modal', () => {
        expect(importe(importes.facturaPendiente).valor,
          'La factura no tiene nada pagado, asi que su pendiente tiene que ser su total entero')
          .toBe(totalDeLaOrden);
      });
    });

    await paso(page, 'Imputar la factura y verificar que el pendiente baje a cero', async () => {
      await orden.imputar(aFormatoBO(totalDeLaOrden), datos.comentarioDeLaImputacion);

      const pendiente = importe(await orden.pendiente());
      await adjuntarTexto('Pendiente despues de imputar', await orden.pendiente());
      await conResaltado(page, page.locator(orden.pendienteDeAsignacion), 'Pendiente final', () => {
        expect(pendiente.valor,
          'Imputada la orden entera, no tiene que quedar nada pendiente de asignacion')
          .toBe(0);
      });

      // Pagada la factura, deja de figurar entre las pendientes de la orden. Es
      // la prueba de que la imputacion se escribio sobre el comprobante y no
      // solo sobre la orden.
      await expect(
        orden.filaPendiente(precondicion.numeroDeFactura),
        'Imputado el total, la factura no tiene que seguir apareciendo entre las pendientes',
      ).toBeHidden({ timeout: 60_000 });
    });

    await paso(page, 'Aprobar la orden aplicando el recibo y verificar el estado', async () => {
      await orden.aprobar(fechaDeHoy, datos.numeroDeRecibo);

      const estado = await orden.estado();
      await adjuntarTexto('Estado de la orden', estado);
      await conResaltado(page, page.locator(orden.btnAprobar), 'Estado de la orden aprobada', () => {
        expect(estado.toUpperCase(),
          'Aprobada y con el recibo aplicado, la orden tiene que quedar en estado pago')
          .toContain(datos.estadoAprobada);
      });

      const numero = (await page.locator(orden.campoNumeroDelRecibo).inputValue()).trim();
      await conResaltado(page, page.locator(orden.campoNumeroDelRecibo), 'Numero del recibo', () => {
        expect(numero, 'El recibo tiene que conservar su numero, que el BO guarda en mayuscula')
          .toBe(datos.numeroDeRecibo.toUpperCase());
      });

      const fechaDelRecibo = (await page.locator(orden.campoFechaDelRecibo).inputValue()).trim();
      await conResaltado(page, page.locator(orden.campoFechaDelRecibo), 'Fecha del recibo', () => {
        expect(fechaDelRecibo, 'El recibo tiene que conservar la fecha con la que se aplico')
          .toBe(fechaDeHoy);
      });

      await adjuntarTexto('Cadena generada', [
        `File: ${precondicion.fileCode}`,
        `Factura de proveedor: ${precondicion.puntoDeVenta}-${precondicion.numeroDeFactura}`,
        `Orden de pago: OP${idDeLaOrden.padStart(10, '0')} (id ${idDeLaOrden})`,
        `Caja: ${datos.caja}`,
        `Pagado: ${precondicion.moneda} ${aFormatoBO(totalDeLaOrden)}`,
      ].join(SALTO));
    });

    await paso(page, 'Verificar la orden en la bandeja de ordenes de pago', async () => {
      // Columnas: C, (c), Fecha, Referencia, Observ., Fecha de Aplicacion,
      // Proveedor, Monto, Estado.
      const codigo = `OP${idDeLaOrden.padStart(10, '0')}`;
      await orden.irABandejaDeOrdenes();
      await orden.buscarEnLaBandeja(codigo);

      const fila = orden.filaEnLaBandeja(codigo);
      await expect(
        fila,
        `La orden ${codigo} tiene que aparecer en la bandeja de ordenes de pago`,
      ).toBeVisible({ timeout: 60_000 });

      const celdas = await orden.celdasDeLaBandeja(codigo);
      await adjuntarTexto('Fila de la orden en la bandeja', celdas.join(' | '));
      const texto = celdas.join(' | ');

      await conResaltado(page, fila, 'Proveedor en la bandeja', () => {
        expect(texto.toUpperCase(), 'La bandeja tiene que mostrar el proveedor de la orden')
          .toContain(datos.razonSocial.toUpperCase());
      });
      // La bandeja **trunca** el detalle con puntos suspensivos, asi que se
      // compara el arranque y no la cadena entera.
      await conResaltado(page, fila, 'Observaciones en la bandeja', () => {
        expect(texto, 'La bandeja tiene que mostrar el detalle cargado en la orden')
          .toContain(datos.detalle.slice(0, 40));
      });
      await conResaltado(page, fila, 'Estado en la bandeja', () => {
        expect(texto.toUpperCase(),
          'Aprobada, la orden tiene que figurar como pagada tambien en la bandeja')
          .toContain(datos.estadoAprobada);
      });

      const soloImporte = /^-?([A-Z]{3}\s*)?\d[\d.,]*$/;
      const importesDeLaFila = celdas.filter((c) => soloImporte.test(c)).map(importe);
      await conResaltado(page, fila, 'Monto en la bandeja', () => {
        expect(importesDeLaFila.map((i) => i.valor),
          'La bandeja tiene que mostrar el monto con el que se pago la orden')
          .toContain(totalDeLaOrden);
      });
    });
  });

});
