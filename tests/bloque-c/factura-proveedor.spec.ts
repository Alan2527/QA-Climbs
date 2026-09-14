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

  test('Factura de proveedor: se carga sobre el file y se imputa al item', async ({ page }) => {
    // El recorrido cruza las dos aplicaciones, arma su propia precondicion y
    // sigue con la factura: el timeout de la suite no alcanza ni de cerca.
    test.setTimeout(900_000);

    const bo = new BackOfficePage(page);
    const factura = new FacturaProveedorPage(page);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');

    /**
     * Datos con los que se carga el comprobante. Es el resultado esperado: lo
     * que se escribe aca es lo que despues tiene que mostrar la pantalla.
     */
    const comprobante = {
      // El proveedor tiene que ser el mismo que carga el costo del item del
      // file, porque la grilla de pendientes lista por proveedor
      // (PaymentWebService.cs:329, LoadBySupplier).
      proveedor: 'GRUPO SUMMA',
      razonSocial: 'GRUPO SUMMA SRL',
      documento: '30-71422246-1',
      // Efectivo: no se elige, lo precarga el propio proveedor
      // (supplier.js, applySupplierInvoiceSupplier).
      medioDePago: 'Efectivo',
      tipo: 'Factura A',
      sucursal: 'Argentina',
      moneda: 'USD',
      monedaPorDefecto: 'ARS',
      puntoDeVenta: '0001',
      // El numero tiene que ser unico por corrida: el BO rechaza el comprobante
      // si coinciden tipo, punto de venta, numero y proveedor
      // (Detail.aspx.cs:987). El campo exige exactamente 8 digitos.
      numero: [
        String(ahora.getDate()).padStart(2, '0'),
        String(ahora.getHours()).padStart(2, '0'),
        String(ahora.getMinutes()).padStart(2, '0'),
        String(ahora.getSeconds()).padStart(2, '0'),
      ].join(''),
      // Plazo de pago del proveedor 1047. El BO calcula el vencimiento solo:
      // fecha de factura + PaymentDeadline (Detail.aspx.cs:1022).
      plazoDePago: 30,
      comentario: `Factura de regresion automatica ${sello}. No operar.`,
      comentarioDeLaImputacion: `AUTO-QA ${sello.slice(-8)}`,
    };

    const precondicion = await reservarServicioYGenerarFile(page, sello);
    // La factura se emite por el costo del item: es lo que el proveedor cobra.
    const totalDeLaFactura = precondicion.costoDelItem.valor as number;

    let idDeLaFactura = '';
    let fechaDeLaFactura = '';

    await paso(page, 'Entrar a la bandeja de facturas de proveedor y abrir una nueva', async () => {
      await factura.irABandejaDeFacturas();
      await factura.nuevaFactura();
      await verificarFormularioBloqueado(page, factura, 'Al abrir el alta');
    });

    await paso(page, 'Elegir la sucursal: sin proveedor el formulario sigue bloqueado', async () => {
      // La sucursal hay que elegirla: el combo trae "Seleccione..." porque el
      // usuario del BO ve mas de una. Tiene que ser la misma que la del file, o
      // la factura no listaria su item entre los pendientes.
      const sucursal = await factura.elegirSucursal(comprobante.sucursal);
      await conResaltado(page, page.locator(factura.comboSucursal), 'Sucursal del comprobante', () => {
        expect(sucursal, 'El comprobante tiene que quedar en la misma sucursal que el file')
          .toContain(comprobante.sucursal);
      });
      // Task 4725: "Elegir sólo la sucursal, sin proveedor → el aviso sigue
      // visible y el formulario sigue oculto."
      await verificarFormularioBloqueado(page, factura, 'Con la sucursal elegida y sin proveedor');
    });

    await paso(page, 'Elegir el proveedor: aparece el formulario con sus valores iniciales', async () => {
      await factura.elegirProveedor(comprobante.proveedor, comprobante.razonSocial);
      await verificarFormularioHabilitado(page, factura);


      // Con sucursal Argentina la moneda sigue proponiendo ARS. US 4722, task 4726:
      // "Con sucursal de Argentina nada tiene que cambiar: la moneda tiene que
      // seguir siendo pesos". Se verifica para
      // dejar constancia de que el paso siguiente la cambia a proposito: la
      // grilla de pendientes convierte los importes a la moneda del comprobante.
      const moneda = await factura.opcionElegida(factura.comboMoneda);
      await conResaltado(page, page.locator(factura.comboMoneda), 'Moneda por defecto', () => {
        expect(moneda, 'El comprobante tiene que nacer en la moneda por defecto del BO')
          .toContain(comprobante.monedaPorDefecto);
      });

      // La fecha de factura viene con la del dia y no puede ser futura.
      fechaDeLaFactura = (await page.locator(factura.campoFecha).inputValue()).trim();
      await conResaltado(page, page.locator(factura.campoFecha), 'Fecha del comprobante', () => {
        expect(fechaDeLaFactura, 'El comprobante tiene que nacer con la fecha de hoy')
          .toBe(formatearFecha(ahora));
      });
    });

    await paso(page, 'Verificar lo que completa solo el proveedor', async () => {
      const datos = await factura.datosDelProveedor();
      await adjuntarTexto('Datos que precarga el proveedor', JSON.stringify(datos, null, 2));

      const bloque = page.locator(factura.campoProveedor);
      await conResaltado(page, bloque, 'Razon social del proveedor', () => {
        expect(datos.razonSocial, 'El comprobante tiene que tomar la razon social del proveedor')
          .toBe(comprobante.razonSocial);
      });
      await conResaltado(page, page.locator(factura.campoDocumento), 'Documento del proveedor', () => {
        expect(datos.documento, 'El comprobante tiene que tomar el documento del proveedor')
          .toBe(comprobante.documento);
      });
      // El medio de pago no lo elige la persona: lo trae el proveedor.
      await conResaltado(page, page.locator(factura.comboMedioDePago), 'Medio de pago', () => {
        expect(datos.medioDePago, 'El medio de pago tiene que venir del proveedor')
          .toContain(comprobante.medioDePago);
      });
    });

    await paso(page, 'Cargar el tipo, el numero, la moneda y el total del comprobante', async () => {
      await page.locator(factura.comboTipo).selectOption({ label: comprobante.tipo });
      await esperarFinDeCarga(page);
      await page.locator(factura.campoPuntoDeVenta).fill(comprobante.puntoDeVenta);
      await page.locator(factura.campoNumero).fill(comprobante.numero);

      await page.locator(factura.comboMoneda).selectOption({ label: comprobante.moneda });
      await esperarFinDeCarga(page);
      await conResaltado(page, page.locator(factura.comboMoneda), 'Moneda del comprobante', async () => {
        expect(await factura.opcionElegida(factura.comboMoneda),
          'La moneda del comprobante tiene que ser la del costo del item del file')
          .toContain(precondicion.costoDelItem.moneda);
      });

      // El importe va a Exento y el total lo calcula el BO al salir del campo:
      // Total esta deshabilitado por diseno (Detail.aspx:543).
      await factura.cargarImporte(aFormatoBO(totalDeLaFactura));
      await page.locator(factura.campoComentario).fill(comprobante.comentario);

      const totalCalculado = importe(await page.locator(factura.campoTotal).inputValue());
      await conResaltado(page, page.locator(factura.campoTotal), 'Total calculado por el BO', () => {
        expect(totalCalculado.valor,
          'Cargado el importe como Exento y sin impuestos, el total que calcula el BO ' +
          'tiene que ser ese mismo importe')
          .toBe(totalDeLaFactura);
      });

      // El vencimiento se deja vacio a proposito: lo calcula el BO.
      await adjuntarTexto('Comprobante a cargar', JSON.stringify({
        ...comprobante,
        total: aFormatoBO(totalDeLaFactura),
        fecha: fechaDeLaFactura,
        file: precondicion.fileCode,
      }, null, 2));
    });

    await paso(page, 'Guardar el comprobante y verificar que quedo con los datos cargados', async () => {
      idDeLaFactura = await factura.guardar();
      expect(
        idDeLaFactura,
        `El guardado tiene que devolver el ID del comprobante. El BO dijo: ` +
        `"${await factura.mensajeDeError()}"`,
      ).toMatch(/^\d+$/);

      const numeroGuardado = (await page.locator(factura.campoNumero).inputValue()).trim();
      await conResaltado(page, page.locator(factura.campoNumero), 'Numero del comprobante', () => {
        expect(numeroGuardado, 'El comprobante tiene que conservar el numero cargado')
          .toBe(comprobante.numero);
      });

      const totalGuardado = importe(await page.locator(factura.campoTotal).inputValue());
      await conResaltado(page, page.locator(factura.campoTotal), 'Total del comprobante', () => {
        expect(totalGuardado.valor, 'El total tiene que ser el costo del item del file')
          .toBe(totalDeLaFactura);
      });

      // El vencimiento no se cargo: tiene que salir del plazo del proveedor.
      const vencimiento = (await page.locator(factura.campoVencimiento).inputValue()).trim();
      await conResaltado(page, page.locator(factura.campoVencimiento), 'Vencimiento calculado', () => {
        expect(vencimiento,
          `El vencimiento tiene que calcularse a ${comprobante.plazoDePago} dias de la fecha ` +
          'de factura, que es el plazo de pago del proveedor')
          .toBe(masDias(fechaDeLaFactura, comprobante.plazoDePago));
      });

      // El resto de lo que se cargo, releido de la pantalla: si algo no se
      // guarda, el comprobante queda distinto del que se quiso emitir.
      const puntoDeVenta = (await page.locator(factura.campoPuntoDeVenta).inputValue()).trim();
      await conResaltado(page, page.locator(factura.campoPuntoDeVenta), 'Punto de venta', () => {
        expect(Number(puntoDeVenta), 'El comprobante tiene que conservar su punto de venta')
          .toBe(Number(comprobante.puntoDeVenta));
      });

      await conResaltado(page, page.locator(factura.comboTipo), 'Tipo de comprobante', async () => {
        expect(await factura.opcionElegida(factura.comboTipo),
          'El comprobante tiene que conservar el tipo elegido')
          .toContain(comprobante.tipo);
      });

      const comentario = (await page.locator(factura.campoComentario).inputValue()).trim();
      await conResaltado(page, page.locator(factura.campoComentario), 'Comentario del comprobante', () => {
        expect(comentario, 'El comprobante tiene que conservar su comentario')
          .toBe(comprobante.comentario);
      });

      // La cotizacion no se carga: si queda en cero o menos, el BO la fuerza a 1
      // (Detail.aspx.cs:1035). Nunca puede quedar en cero.
      const cotizacion = importe(await page.locator(factura.campoCotizacion).inputValue());
      await adjuntarTexto('Cotizacion del comprobante', String(cotizacion.valor));
      await conResaltado(page, page.locator(factura.campoCotizacion), 'Cotizacion del comprobante', () => {
        expect(cotizacion.valor as number, 'La cotizacion del comprobante nunca puede quedar en cero')
          .toBeGreaterThan(0);
      });

      // La fecha contable por defecto es el mes de la fecha de factura.
      const mesContable = await factura.opcionElegida('#ddAccountingDate');
      const mesEsperado = fechaDeLaFactura.slice(3);
      await conResaltado(page, page.locator('#ddAccountingDate'), 'Fecha contable', () => {
        expect(mesContable.replace(/\s/g, ''),
          'La fecha contable tiene que caer en el mes de la fecha de factura')
          .toContain(mesEsperado.split('/')[1]);
      });
    });

    await paso(page, 'Verificar el pendiente de asignacion contra el total cargado', async () => {
      // El pendiente se calcula sobre BaseRate, que es el total menos IIBB y
      // percepcion (Detail.aspx.cs:1044). Sin retenciones tienen que coincidir:
      // si no coinciden, o se cargo una retencion o el calculo cambio.
      const pendiente = importe(await factura.pendiente());
      await adjuntarTexto('Pendiente de asignacion', await factura.pendiente());

      await conResaltado(page, page.locator(factura.pendienteDeAsignacion), 'Pendiente inicial', () => {
        expect(pendiente.valor, 'Sin retenciones, el pendiente tiene que ser el total del comprobante')
          .toBe(totalDeLaFactura);
        expect(pendiente.moneda, 'El pendiente tiene que estar en la moneda del comprobante')
          .toBe(comprobante.moneda);
      });
    });

    await paso(page, 'Buscar el file entre los items pendientes y comparar la fila', async () => {
      await factura.buscarPendiente(precondicion.fileCode);
      const fila = factura.filaPendiente(precondicion.fileCode);
      await expect(
        fila,
        `El file ${precondicion.fileCode} tiene que aparecer entre los items pendientes de ` +
        `imputar del proveedor ${comprobante.razonSocial}. Si no aparece, revisar que el ` +
        'costo del item lo cargue ese proveedor y que la sucursal sea la misma.',
      ).toBeVisible({ timeout: 60_000 });

      const celdas = await celdasDe(fila);
      await adjuntarTexto('Fila del item pendiente', celdas.join(' | '));

      // La grilla escribe el pasajero en mayuscula y como APELLIDO/NOMBRE.
      await conResaltado(page, fila, 'Pasajero del item pendiente', () => {
        expect(celdas.join(' | ').toUpperCase(), 'La fila tiene que mostrar el pasajero de la reserva')
          .toContain(precondicion.apellidoDelPax.toUpperCase());
      });

      // Costo File, Total, Asignado y Saldo. Costo File viene en la moneda del
      // costo; los otros tres, convertidos a la moneda del comprobante.
      const soloImporte = /^([A-Z]{3}\s*)?\d[\d.,]*$/;
      const importesDeLaFila = celdas.filter((c) => soloImporte.test(c)).map(importe);
      await adjuntarTexto('Importes de la fila pendiente',
        importesDeLaFila.map((i) => `${i.moneda} ${i.valor}`).join(' | '));

      await conResaltado(page, fila, 'Costo del item en la grilla de pendientes', () => {
        expect(importesDeLaFila.map((i) => i.valor),
          'La grilla tiene que mostrar el costo del item tal como quedo en el file')
          .toContain(precondicion.costoDelItem.valor);
      });
      await conResaltado(page, fila, 'Saldo del item pendiente', () => {
        expect(importesDeLaFila.at(-1)?.valor,
          'El item todavia no tiene nada imputado, asi que su saldo tiene que ser el costo entero')
          .toBe(precondicion.costoDelItem.valor);
      });
    });

    await paso(page, 'Abrir la asignacion y comparar los cuatro importes del modal', async () => {
      await factura.abrirAsignacion(factura.filaPendiente(precondicion.fileCode));
      const modal = page.locator(factura.modalDeAsignacion);
      const importes = await factura.importesDelModal();
      await adjuntarTexto('Importes del modal de asignacion', JSON.stringify(importes, null, 2));

      await conResaltado(page, modal, 'Moneda del modal', () => {
        expect(importes.moneda, 'El modal tiene que mostrar la moneda del comprobante')
          .toContain(comprobante.moneda);
      });
      await conResaltado(page, modal, 'Total de la factura en el modal', () => {
        expect(importe(importes.facturaTotal).valor,
          'El modal tiene que mostrar el total del comprobante')
          .toBe(totalDeLaFactura);
      });
      await conResaltado(page, modal, 'Pendiente de la factura en el modal', () => {
        expect(importe(importes.facturaPendiente).valor,
          'Sin nada imputado, el pendiente del comprobante tiene que ser su total entero')
          .toBe(totalDeLaFactura);
      });
      await conResaltado(page, modal, 'Total del servicio en el modal', () => {
        expect(importe(importes.servicioTotal).valor,
          'El modal tiene que mostrar el costo del item del file')
          .toBe(precondicion.costoDelItem.valor);
      });
      await conResaltado(page, modal, 'Pendiente del servicio en el modal', () => {
        expect(importe(importes.servicioPendiente).valor,
          'Sin nada imputado, el pendiente del item tiene que ser su costo entero')
          .toBe(precondicion.costoDelItem.valor);
      });
    });

    await paso(page, 'Imputar el comprobante al item y verificar que el pendiente baje a cero', async () => {
      await factura.imputar(aFormatoBO(totalDeLaFactura), comprobante.comentarioDeLaImputacion);

      const pendiente = importe(await factura.pendiente());
      await adjuntarTexto('Pendiente despues de imputar', await factura.pendiente());
      await conResaltado(page, page.locator(factura.pendienteDeAsignacion), 'Pendiente final', () => {
        expect(pendiente.valor,
          'Imputado el comprobante entero, no tiene que quedar nada pendiente de asignacion')
          .toBe(0);
      });
    });

    await paso(page, 'Verificar que el item paso a la grilla de asignados', async () => {
      const asignada = factura.filaAsignada(precondicion.fileCode);
      await expect(
        asignada,
        `El item del file ${precondicion.fileCode} tiene que quedar listado entre los asignados`,
      ).toBeVisible({ timeout: 60_000 });

      const celdas = await celdasDe(asignada);
      await adjuntarTexto('Fila del item asignado', celdas.join(' | '));

      await conResaltado(page, asignada, 'Comentario de la imputacion', () => {
        expect(celdas.join(' | '), 'La fila asignada tiene que conservar el comentario cargado')
          .toContain(comprobante.comentarioDeLaImputacion);
      });

      const soloImporte = /^([A-Z]{3}\s*)?\d[\d.,]*$/;
      const importesDeLaFila = celdas.filter((c) => soloImporte.test(c)).map(importe);
      await conResaltado(page, asignada, 'Importe asignado', () => {
        expect(importesDeLaFila.map((i) => i.valor),
          'La fila asignada tiene que mostrar el importe imputado')
          .toContain(totalDeLaFactura);
      });

      // El item ya no tiene saldo, asi que el endpoint deja de listarlo entre
      // los pendientes: descarta los saldos menores a 1 (PaymentWebService.cs:414).
      // Es la prueba de que la imputacion se escribio sobre el item del file y
      // no solo sobre el comprobante.
      await factura.buscarPendiente(precondicion.fileCode);
      await expect(
        factura.filaPendiente(precondicion.fileCode),
        'Imputado el costo entero, el item no tiene que seguir apareciendo entre los pendientes',
      ).toBeHidden({ timeout: 60_000 });
    });

    await paso(page, 'Aprobar el comprobante y verificar que quede aprobado', async () => {
      await factura.aprobar();
      await conResaltado(page, page.locator(factura.btnAprobar), 'Comprobante aprobado', async () => {
        expect(await factura.estaAprobada(),
          'Aprobado el comprobante, el BO tiene que dejar de permitir modificarlo')
          .toBe(true);
      });

      await adjuntarTexto('Cadena generada', [
        `Reserva: ${precondicion.codigo}`,
        `File: ${precondicion.fileCode} (id ${precondicion.fileId})`,
        `Factura de proveedor: ${comprobante.puntoDeVenta}-${comprobante.numero} (id ${idDeLaFactura})`,
        `Proveedor: ${comprobante.razonSocial}`,
        `Total imputado: ${comprobante.moneda} ${aFormatoBO(totalDeLaFactura)}`,
      ].join(SALTO));
    });

    await paso(page, 'Verificar el comprobante en la bandeja de facturas', async () => {
      // El detalle puede estar bien y la bandeja mostrar otra cosa: son dos
      // consultas distintas. Columnas: C, Factura, Proveedor, Razon Social, Doc,
      // Fecha, Fecha Vto., Monto, Asignado.
      await factura.irABandejaDeFacturas();
      await factura.buscarEnLaBandeja(comprobante.numero);

      const fila = factura.filaEnLaBandeja(comprobante.numero);
      await expect(
        fila,
        `El comprobante ${comprobante.puntoDeVenta}-${comprobante.numero} tiene que aparecer en ` +
        'la bandeja de facturas de proveedor',
      ).toBeVisible({ timeout: 60_000 });

      const celdas = await factura.celdasDeLaBandeja(comprobante.numero);
      await adjuntarTexto('Fila del comprobante en la bandeja', celdas.join(' | '));
      const texto = celdas.join(' | ');

      await conResaltado(page, fila, 'Proveedor en la bandeja', () => {
        expect(texto.toUpperCase(), 'La bandeja tiene que mostrar la razon social del proveedor')
          .toContain(comprobante.razonSocial.toUpperCase());
      });
      await conResaltado(page, fila, 'Documento en la bandeja', () => {
        expect(texto, 'La bandeja tiene que mostrar el documento del proveedor')
          .toContain(comprobante.documento);
      });
      await conResaltado(page, fila, 'Fechas en la bandeja', () => {
        expect(texto, 'La bandeja tiene que mostrar la fecha del comprobante')
          .toContain(fechaDeLaFactura);
        expect(texto,
          'La bandeja tiene que mostrar el vencimiento calculado por el plazo del proveedor')
          .toContain(masDias(fechaDeLaFactura, comprobante.plazoDePago));
      });

      const soloImporte = /^-?([A-Z]{3}\s*)?\d[\d.,]*$/;
      const importesDeLaFila = celdas.filter((c) => soloImporte.test(c)).map(importe);
      await conResaltado(page, fila, 'Monto y asignado en la bandeja', () => {
        expect(importesDeLaFila.map((i) => i.valor),
          'La bandeja tiene que mostrar el monto del comprobante y lo que quedo asignado, ' +
          'que despues de imputarlo entero es el mismo importe')
          .toContain(totalDeLaFactura);
      });
    });
  });

});
