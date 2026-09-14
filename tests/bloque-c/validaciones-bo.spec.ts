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

  test('Validaciones: el BO rechaza lo que no debe permitir', async ({ page }) => {
    test.setTimeout(600_000);

    const factura = new FacturaProveedorPage(page);
    const orden = new OrdenDePagoPage(page);
    const bo = new BackOfficePage(page);

    const ahora = new Date();
    const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fechaDeHoy = formatearFecha(ahora);

    const datos = {
      proveedor: 'GRUPO SUMMA',
      razonSocial: 'GRUPO SUMMA SRL',
      tipo: 'Factura A',
      sucursal: 'Argentina',
      moneda: 'USD',
      puntoDeVenta: '0001',
      numero: [
        String(ahora.getDate()).padStart(2, '0'),
        String(ahora.getHours()).padStart(2, '0'),
        String(ahora.getMinutes()).padStart(2, '0'),
        String(ahora.getSeconds()).padStart(2, '0'),
      ].join(''),
      importe: '10,00',
    };

    /** Espera el aviso de error del BO, que aparece y se desvanece solo. */
    const esperarAviso = async (mensaje: string, etiqueta: string) => {
      const aviso = page.locator('.noty_text, .noty_body, .noty_message').filter({ hasText: mensaje }).first();
      await conResaltado(page, page.locator('body'), etiqueta, async () => {
        await expect(
          aviso,
          `El BO tiene que avisar "${mensaje}"`,
        ).toBeVisible({ timeout: 30_000 });
      });
      await adjuntarTexto(etiqueta, mensaje);
    };

    // Este test no reserva ni genera file: ninguna de estas validaciones lo
    // necesita. Deja un solo comprobante y una sola orden sin aprobar en QA.
    await paso(page, 'Entrar al BackOffice y abrir una factura de proveedor nueva', async () => {
      await bo.ingresar(process.env.BO_USER!, process.env.BO_PASS!);
      await factura.irABandejaDeFacturas();
      await factura.nuevaFactura();
      await verificarFormularioBloqueado(page, factura, 'Al abrir el alta');
    });

    // Hasta la US 4722 este paso clickeaba Guardar sin proveedor y esperaba el
    // aviso "Debe seleccionar un Proveedor" (supplier.js:361). Con el formulario
    // progresivo el rechazo llega antes: sin proveedor los botones de guardar estan
    // deshabilitados. Task 4725: "Elegir sólo la sucursal, sin proveedor → el aviso
    // sigue visible y el formulario sigue oculto."
    await paso(page, 'Sin proveedor no se puede guardar la factura', async () => {
      await factura.elegirSucursal(datos.sucursal);
      await verificarFormularioBloqueado(page, factura, 'Con la sucursal elegida y sin proveedor');
      await expect(page, 'La pantalla no tiene que navegar si falta el proveedor')
        .toHaveURL(/supplierinvoice\/0/i);
    });

    await paso(page, 'Intentar guardar la factura con importe en cero', async () => {
      await factura.elegirSucursal(datos.sucursal);
      await factura.elegirProveedor(datos.proveedor, datos.razonSocial);
      await page.locator(factura.comboTipo).selectOption({ label: datos.tipo });
      await esperarFinDeCarga(page);
      await page.locator(factura.campoPuntoDeVenta).fill(datos.puntoDeVenta);
      await page.locator(factura.campoNumero).fill(datos.numero);
      await page.locator(factura.comboMoneda).selectOption({ label: datos.moneda });
      await esperarFinDeCarga(page);

      // El total sigue en cero porque no se cargo ningun importe.
      await page.locator(factura.btnGuardar).click();
      await esperarAviso('El monto total no puede ser igual a 0', 'Factura con total cero');
      await expect(page, 'La pantalla no tiene que navegar si el total es cero')
        .toHaveURL(/supplierinvoice\/0/i);
    });

    let idDeLaFactura = '';
    await paso(page, 'Cargar el importe y guardar la factura', async () => {
      await factura.cargarImporte(datos.importe);
      idDeLaFactura = await factura.guardar();
      expect(idDeLaFactura, 'Con el importe cargado, la factura tiene que poder guardarse')
        .toMatch(/^\d+$/);
    });

    await paso(page, 'Intentar cargar otra factura con el mismo numero y proveedor', async () => {
      // Detail.aspx.cs:987. Es la validacion que hace que el numero del test
      // tenga que derivarse del sello de tiempo.
      await factura.irABandejaDeFacturas();
      await factura.nuevaFactura();
      await factura.elegirSucursal(datos.sucursal);
      await factura.elegirProveedor(datos.proveedor, datos.razonSocial);
      await page.locator(factura.comboTipo).selectOption({ label: datos.tipo });
      await esperarFinDeCarga(page);
      await page.locator(factura.campoPuntoDeVenta).fill(datos.puntoDeVenta);
      await page.locator(factura.campoNumero).fill(datos.numero);
      await page.locator(factura.comboMoneda).selectOption({ label: datos.moneda });
      await esperarFinDeCarga(page);
      await factura.cargarImporte(datos.importe);

      await page.locator(factura.btnGuardar).click();
      await esperarAviso(
        'Ya existe un comprobante con el mismo número y el mismo proveedor',
        'Factura con numero repetido',
      );
      await expect(page, 'El comprobante repetido no tiene que crearse')
        .toHaveURL(/supplierinvoice\/0/i);
    });

    let idDeLaOrden = '';
    await paso(page, 'Intentar guardar una orden de pago sin forma de pago', async () => {
      // Detail.aspx.cs:567: sin caja elegida el guardado corta.
      await orden.irABandejaDeOrdenes();
      await orden.nuevaOrden();
      await orden.elegirProveedor(datos.proveedor, datos.razonSocial);
      await orden.elegirEnCombo(orden.comboMoneda, datos.moneda);
      await orden.cargarImporte('10,00');

      await page.locator(orden.btnGuardar).click();
      await esperarAviso('Debe seleccionar Medios de Pago', 'Orden sin forma de pago');
      await expect(page, 'La orden no tiene que crearse sin forma de pago')
        .toHaveURL(/payorder\/0/i);
    });

    await paso(page, 'Guardar la orden e intentar aprobarla con fechas invalidas', async () => {
      await orden.elegirEnCombo(orden.comboCaja, CAJA_DE_REGRESION);
      await orden.cargarImporte('10,00');
      idDeLaOrden = await orden.guardar();
      expect(idDeLaOrden, 'Con la caja elegida, la orden tiene que poder guardarse')
        .toMatch(/^\d+$/);

      // Detail.aspx.cs:1150: el recibo no puede ser posterior a hoy.
      //
      // Se usan **tres dias** y no uno: el servidor puede estar en otro huso que
      // la maquina que corre el test, y cerca de la medianoche "manana" para el
      // test todavia es "hoy" para el BO. Con un dia de diferencia la orden se
      // aprobaba y el caso negativo no probaba nada.
      const fechaFutura = masDias(fechaDeHoy, 3);
      await orden.elegirFechaDelRecibo(fechaFutura);
      await page.locator(orden.campoNumeroDelRecibo).fill(`AUTOQA${sello.slice(-8)}`);
      await page.locator(orden.campoNumeroDelRecibo).blur();
      await page.locator(orden.btnAprobar).click();
      await esperarAviso(
        'La fecha del Recibo no puede ser mayor a la fecha de hoy',
        'Recibo con fecha futura',
      );

      await conResaltado(page, page.locator(orden.btnAprobar), 'Orden sin aprobar', async () => {
        expect(await orden.estado(),
          'Rechazada la aprobacion, la orden tiene que seguir pendiente')
          .toContain('PENDIENTE');
      });

      await adjuntarTexto('Datos que deja este test en QA', [
        `Factura de proveedor: ${datos.puntoDeVenta}-${datos.numero} (id ${idDeLaFactura}), sin imputar`,
        `Orden de pago: id ${idDeLaOrden}, sin aprobar`,
      ].join(SALTO));
    });
  });

});
