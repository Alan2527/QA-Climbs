import { test, expect, Page, Locator } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage, Pasajero } from '../../pages/carrito.page';
import { BackOfficePage } from '../../pages/backoffice.page';
import { FacturaProveedorPage } from '../../pages/factura-proveedor.page';
import { OrdenDePagoPage } from '../../pages/orden-de-pago.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, fechaDeBusqueda, formatearFecha,
  importeANumero, resaltarYCapturar, reiniciarNumeracionDePasos,
} from '../../utils/pasos';

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

  /**
   * Corre una comparacion y, si falla, marca en rojo la zona que la origino y
   * la registra como fallo blando, para que el test siga validando el resto.
   */
  async function conResaltado(
    page: Page, locator: Locator, etiqueta: string, fn: () => void | Promise<void>,
  ) {
    try {
      await fn();
    } catch (error) {
      await resaltarYCapturar(page, locator, `FALLA: ${etiqueta}`);
      expect.soft(false, (error as Error).message).toBe(true);
    }
  }

  const SALTO = String.fromCharCode(10);

  /**
   * Separa un texto de importe ("USD 1.234,50") en moneda y numero.
   *
   * Se compara el numero y no la cadena: el mismo importe se escribe distinto
   * segun la pantalla. `ToMoneyN3()` del BO usa la coma como decimal y escribe
   * "USD 6,000" para 6.
   */
  const importe = (texto: string): { moneda: string; valor: number | null } => {
    const limpio = (texto || '').replace(/\s+/g, ' ').trim();
    const moneda = limpio.match(/[A-Z]{3}/)?.[0] ?? '';
    return { moneda, valor: importeANumero(limpio) };
  };

  /** Numero en el formato que espera el BO al escribir: coma decimal. */
  const aFormatoBO = (valor: number) => valor.toFixed(2).replace('.', ',');

  /** Fecha sumando dias, en el formato dd/mm/aaaa que usa el BO. */
  const masDias = (fecha: string, dias: number): string => {
    const [d, m, a] = fecha.split('/').map(Number);
    const resultado = new Date(a, m - 1, d);
    resultado.setDate(resultado.getDate() + dias);
    return formatearFecha(resultado);
  };

  /** Celdas de una fila, normalizadas y sin vacias. */
  const celdasDe = async (fila: Locator): Promise<string[]> =>
    (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());

  /**
   * Precondicion: reserva un servicio en el portal, lo emite y genera su file.
   *
   * Es lo que un usuario ya tendria hecho antes de sentarse a cargar la factura
   * del proveedor. No se verifica aca — de eso se ocupa el Bloque B —, pero si
   * se corta con un motivo claro cuando algo no esta, para que un problema de
   * precondicion no se lea como un fallo de la factura.
   */
  async function reservarServicioYGenerarFile(page: Page, sello: string): Promise<{
    codigo: string;
    fileId: string;
    fileCode: string;
    costoDelItem: { moneda: string; valor: number | null };
    ventaDelItem: { moneda: string; valor: number | null };
    apellidoDelPax: string;
    servicio: string;
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
      apellido: `Regresion${sello.slice(-6)}`,
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

      const fila = page.locator('tr')
        .filter({ has: page.locator("select[id*='ddPax']") })
        .filter({ hasText: datos.modalidad }).first();
      await expect(
        fila,
        `La ficha tiene que ofrecer la modalidad ${datos.modalidad} para el ${datos.fecha}. ` +
        'Si no la ofrece, revisar la operatividad del servicio y la vigencia de sus tarifas.',
      ).toBeVisible({ timeout: 30_000 });

      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      datos.cantidadPax = Number(texto.match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
      await fila.locator("select[id*='ddPax']").selectOption(String(datos.cantidadPax));
      await esperarFinDeCarga(page);
      await page.locator("[id$='lnkBookService']").first().click();
      await esperarFinDeCarga(page);
      await expect.poll(() => carrito.paxEnElCarrito(), { timeout: 30_000 })
        .toBe(datos.cantidadPax);

      datos.pasajeros = Array.from({ length: datos.cantidadPax }, (_, i) => ({
        nombre: `Pasajero${i + 1}`,
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

      // Costo y Venta son las dos ultimas celdas con importe de la fila del
      // servicio. Venta se escribe sin codigo de moneda, asi que no sirve
      // buscar el patron "USD 999".
      const filaDelServicio = page.locator(bo.filaServicioDelFile).first();
      const celdas = await celdasDe(filaDelServicio);
      const soloImporte = /^([A-Z]{3}\s*)?\d[\d.,]*$/;
      const conImporte = celdas.filter((c) => soloImporte.test(c));
      costoDelItem = importe(conImporte.at(-2) ?? '');
      ventaDelItem = importe(conImporte.at(-1) ?? '');

      await adjuntarTexto('Precondicion generada', [
        `Reserva: ${codigo}`,
        `File: ${fileCode} (id ${fileId})`,
        `Servicio: ${datos.servicio}`,
        `Pasajero: ${datos.pasajeros[0]?.nombre} ${datos.apellido}`,
        `Costo del item: ${conImporte.at(-2) ?? '?'}`,
        `Venta del item: ${conImporte.at(-1) ?? '?'}`,
      ].join(SALTO));

      // Sin costo no hay nada que facturar: el item ni siquiera se listaria
      // entre los pendientes, porque el endpoint descarta los saldos menores a 1.
      expect(
        costoDelItem.valor,
        'El item del file tiene que tener costo cargado. Si viene en cero, revisar ' +
        'las tarifas de costo del servicio (BO_ServiceCostBySupplier) y su vigencia.',
      ).toBeGreaterThan(0);
    });

    return {
      codigo, fileId, fileCode, costoDelItem, ventaDelItem,
      apellidoDelPax: datos.apellido, servicio: datos.servicio,
    };
  }

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
      await expect(page.locator(factura.campoTotal)).toBeVisible();
    });

    await paso(page, 'Elegir la sucursal y verificar los valores con los que nace el comprobante', async () => {
      // La sucursal hay que elegirla: el combo trae "Seleccione..." porque el
      // usuario del BO ve mas de una. Tiene que ser la misma que la del file, o
      // la factura no listaria su item entre los pendientes.
      const sucursal = await factura.elegirSucursal(comprobante.sucursal);
      await conResaltado(page, page.locator(factura.comboSucursal), 'Sucursal del comprobante', () => {
        expect(sucursal, 'El comprobante tiene que quedar en la misma sucursal que el file')
          .toContain(comprobante.sucursal);
      });

      // La moneda arranca siempre en ARS (Detail.aspx.cs:452). Se verifica para
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

    await paso(page, 'Elegir el proveedor y verificar lo que completa solo', async () => {
      await factura.elegirProveedor(comprobante.proveedor, comprobante.razonSocial);
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
  });

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
  async function armarFacturaAprobada(page: Page, sello: string, ahora: Date): Promise<{
    fileCode: string;
    numeroDeFactura: string;
    puntoDeVenta: string;
    total: number;
    moneda: string;
  }> {
    const factura = new FacturaProveedorPage(page);
    const precondicion = await reservarServicioYGenerarFile(page, sello);
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
      caja: 'AUTO-QA NO TOCAR - CAJA USD',
      detalle: `Orden de pago de regresion automatica ${sello}. No operar.`,
      comentarioDeLaImputacion: `AUTO-QA ${sello.slice(-8)}`,
      numeroDeRecibo: `AUTOQA${sello.slice(-8)}`,
      // El estado 30 se describe como "Pago" (PayOrderStatusEnum), no "Pagada".
      estadoAprobada: 'PAGO',
    };

    const precondicion = await armarFacturaAprobada(page, sello, ahora);
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
      // "Seleccione..." y ya viene en Argentina. Ademas, cambiarla deja el
      // buscador de proveedores sin su handler de clic hasta recargar la
      // pantalla (ver la observacion en el ESTADO), asi que tocarla ni siquiera
      // seria lo que hace una persona: no necesita hacerlo.
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

      await adjuntarTexto('Cadena generada', [
        `File: ${precondicion.fileCode}`,
        `Factura de proveedor: ${precondicion.puntoDeVenta}-${precondicion.numeroDeFactura}`,
        `Orden de pago: OP${idDeLaOrden.padStart(10, '0')} (id ${idDeLaOrden})`,
        `Caja: ${datos.caja}`,
        `Pagado: ${precondicion.moneda} ${aFormatoBO(totalDeLaOrden)}`,
      ].join(SALTO));
    });
  });
});
