import { test, expect } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import {
  AltaManualDeServicioPage, FilaDelBuscador, FilaDeLaGrilla, DatosDeItemDelFile, TotalesDelFile,
  RespuestasDelAgregado, numeroDelBO, fechaDelBO, importeDelBO,
} from '../../pages/alta-manual-servicio.page';
import {
  paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado,
} from '../../utils/pasos';
import { reservarServicioYGenerarFile } from './cobranzas-comun';
import { conBackofficeNuevo, costosDelServicio, tarifaVigente, mismoIdioma, precioEsperado } from '../../utils/markups';
import candidatos from '../../data/candidatos.json';

/**
 * Recargo por idioma en el alta manual (US 4739): el servicio AUTO-QA 7967 (copia de Tigre y Delta) tiene la
 * tarifa Regular en pesos y English ARS 15.000 fijos por pasajero, leidos en el BackOffice nuevo. La US pide:
 * "Al elegir un idioma en esa columna, el costo de la fila tiene que recalcularse como costo de tarifa + recargo
 * de idioma [...] generando ese recargo como un item de costo adicional propio" y "Al vender el item, el valor
 * final tiene que calcularse aplicando el markup de la agencia sobre costo + recargo en conjunto". Con la misma
 * regla que la venta del item reservado (precondicion del file): techo((costo + recargo) por persona / cotizacion /
 * markup de la agencia) x pasajeros. La agencia de pablo1 (1) tiene markup 1: con este file se verifica la
 * conversion y el redondeo del recargo, pero no se distingue si el markup se aplica tambien al recargo (los
 * tests del portal con otros markups si lo distinguen).
 */
const RP = candidatos.recargoFijoEnPesos;
/** La venta es un entero (techo por persona x pasajeros): se exige exacta. */
const TOLERANCIA_RELACION = 0.011;
/** Markup de servicios de la agencia del file (agencia 1, la de pablo1). */
const MARKUP_DE_LA_AGENCIA = 1;


/**
 * BLOQUE C — Alta manual de un servicio en el file.
 *
 * Despues de generar el file, el BackOffice deja sumar servicios a mano desde la pantalla
 * de destino (`booking/files/destination/{file}/{destino}`, boton "Agregar Servicio"): el
 * modal cotiza con `searchservices`, "Agregar" arma la fila, "Guardar y Volver" la graba
 * (`ManageFileDestination.aspx.cs`, `SaveData`) y la ficha del file la muestra.
 *
 * Es donde se juntan los cambios recientes de plata del BO:
 * - d25a90c0 (12/10): las monedas de la grilla salen de BO_Currency (`window.ALL_CURRENCIES`);
 *   antes el identificador 20 siempre decia "ARS", fuera quien fuera el cliente.
 * - serie 4803/4848: el buscador cotiza con el markup actual de la agencia del file.
 * - 4739: recargo por idioma (el buscador ofrece un combo de idioma solo si la tarifa lo tiene).
 * - 1f39131b / 5a8d6a41 (4342) y d39944b2 (4347): decimales y separadores al pasar los
 *   importes del buscador a la grilla y de la grilla al servidor.
 *
 * Sobre un file nuevo (`reservarServicioYGenerarFile`: Tigre y Delta, 2 pasajeros), se le
 * agrega **el mismo servicio** en la misma fecha y con el mismo rooming. Asi el costo y la
 * venta que tiene que tener el item nuevo tienen dos fuentes que no dependen del item:
 *   - lo que cotizo el propio buscador en el modal (es lo que la persona ve antes de agregar);
 *   - el item que ya trajo la reserva del portal (mismo servicio, fecha y pasajeros).
 *
 * Se mira lo mismo en cada eslabon: modal -> fila de la grilla -> ficha del file -> totales
 * del file -> panel "Comprobantes y saldos" -> grilla reabierta. Costo y venta son numeros,
 * no cadenas: el mismo importe se escribe distinto en cada pantalla.
 *
 * El file es de la corrida y no lo usa nadie mas: no hay nada que limpiar.
 * No se prueba el recargo por idioma (depende de que la tarifa tenga idiomas cargados) ni
 * el alta de hoteles.
 */
test.describe('Files — alta manual de servicio', () => {
  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  /** La ficha del file redondea a 2 decimales. */
  const REDONDEO_DE_LA_FICHA = 0.006;
  /** Dos importes redondeados a 2 decimales pueden diferir hasta 0,01 de la suma exacta. */
  const SUMA_DE_DOS = 0.011;

  /** Compara dos importes con tolerancia (NaN falla). */
  const igual = (real: number, esperado: number, mensaje: string, tolerancia = REDONDEO_DE_LA_FICHA) =>
    expect(Math.abs(real - esperado), `${mensaje} (real ${real}, esperado ${esperado})`).toBeLessThanOrEqual(tolerancia);

  /** Tarifa Regular (RateTypeEnum.Regular = 6): la misma modalidad que reserva el portal. */
  const TARIFA_REGULAR = 6;

  /** Cantidad de pasajeros de un rooming: numeros o rangos "a-b" separados por punto ("1-2.4" = 3). */
  const contarPax = (rooming: string) =>
    rooming.split('.').filter(Boolean).reduce((total, tramo) => {
      const [desde, hasta] = tramo.split('-').map(Number);
      return total + (Number.isFinite(hasta) ? Math.abs(hasta - desde) + 1 : 1);
    }, 0);

  const enFormatoDelBO = (n: number) => String(n).replace('.', ',');

  test('Alta manual: el servicio agregado a un file queda con el costo, la venta y la moneda esperados, y los totales lo reflejan', async ({ page }) => {
    test.setTimeout(1_800_000);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const alta = new AltaManualDeServicioPage(page);

    // --- Un file nuevo con un servicio reservado desde el portal ---
    const base = await reservarServicioYGenerarFile(page, sello);

    // Lo que se va guardando de un paso al siguiente.
    let idsAntes: string[] = [];
    let item1Antes!: DatosDeItemDelFile;
    let totalesAntes!: TotalesDelFile;
    let clienteAntes: Record<string, string> = {};
    let monedaDelFile = '';
    let rooming = '';
    let fechaDelBuscador = '';
    let elegida!: FilaDelBuscador;
    let costoMoneda = '';
    let respuestas!: RespuestasDelAgregado;
    let grillaNueva!: FilaDeLaGrilla;
    let nuevo!: DatosDeItemDelFile;
    let item1Despues!: DatosDeItemDelFile;

    await paso(page, `Abrir el file ${base.fileCode} y tomar su estado de partida`, async () => {
      await alta.abrirFile(base.fileId);
      idsAntes = await alta.idsDeItems();
      expect(idsAntes, 'El file recien generado tiene que traer solo el servicio reservado desde el portal')
        .toHaveLength(1);
      item1Antes = await alta.datosDeItem(idsAntes[0]);
      totalesAntes = await alta.totalesDelFile();
      clienteAntes = await alta.cifrasDelPanel('boCompCliente');
      monedaDelFile = item1Antes.venta.moneda;
      rooming = item1Antes.rooming || `1-${base.cantidadPax}`;

      await adjuntarTexto('Item reservado desde el portal', JSON.stringify(item1Antes, null, 1));
      await adjuntarTexto('Moneda y markup del file', JSON.stringify(await alta.monedaYMarkupDelFile(), null, 1));
      await adjuntarTexto('Totales del file antes', JSON.stringify(totalesAntes, null, 1));
      await adjuntarTexto('Panel del cliente antes', JSON.stringify(clienteAntes, null, 1));

      await conResaltado(page, alta.lado('boCompCliente'), 'Linea de partida', () => {
        expect(item1Antes.costo.valor, 'El item reservado tiene que traer costo').toBeGreaterThan(0);
        igual(totalesAntes.venta.valor, item1Antes.venta.valor, 'La venta de los totales del file es la del unico item');
        igual(numeroDelBO(clienteAntes['Venta del file']), item1Antes.venta.valor, 'La venta del panel es la del unico item');
      });
    });

    await paso(page, 'Entrar a los servicios del destino y abrir el buscador', async () => {
      const url = await alta.abrirServiciosDelDestino();
      await alta.esperarGrilla(1);
      await alta.vigilarAvisos();

      const monedas = await alta.monedasInyectadas();
      await adjuntarTexto('Monedas de la pantalla (ALL_CURRENCIES)', JSON.stringify(monedas));
      await conResaltado(page, page.locator('#linkAddService'), 'Monedas de la pantalla', () => {
        expect(monedas, 'La pantalla tiene que traer las monedas de BO_Currency en window.ALL_CURRENCIES (hotfix d25a90c0)')
          .not.toBeNull();
      });

      await alta.abrirBuscador();
      const veniaMarcado = await alta.traerCostoDeServicios();
      const fechas = await alta.fechasDelBuscador();
      fechaDelBuscador = fechas.desde;
      await adjuntarTexto('Destino y buscador', [
        `URL: ${url}`,
        `"Traer costo de servicios" venia marcado: ${veniaMarcado ? 'si' : 'no'}`,
        `Destino: ${fechas.destinoDesde} a ${fechas.destinoHasta}`,
        `Buscador: Desde ${fechas.desde} / Hasta ${fechas.hasta}`,
        `Fecha del servicio reservado: ${base.fechaDelServicio}`,
      ].join('\n'));
    });

    await paso(page, 'Buscar el servicio por nombre y elegir su tarifa Regular', async () => {
      await alta.fijarRooming(rooming);
      await alta.buscarSoloServicios();
      // El buscador ofrece tambien "Tigre y Delta en Yate": se elige el servicio AUTO-QA (5).
      await alta.elegirNombre('Tigre y Delta', /AUTO-QA NO TOCAR - Tigre y Delta(?!\s*en\b)/i);
      const filas = await alta.buscar();

      await adjuntarTexto('Resultados del buscador', filas.map((f) =>
        `${f.indice}. ${f.celdas.join(' | ')}  [RateTypeID ${f.datos.RateTypeID}, RateID ${f.datos.RateID}, ` +
        `idiomas ${Array.isArray(f.datos.Languages) ? f.datos.Languages.length : 0}]`).join('\n'));

      const candidatas = filas.filter((f) =>
        /tigre y delta/i.test(f.datos.Name) && !f.datos.Name.startsWith('*') && f.datos.RateTypeID === TARIFA_REGULAR);
      expect(
        candidatas.length,
        'El buscador tiene que ofrecer la tarifa Regular de Tigre y Delta para la fecha del destino. ' +
        'Si no la ofrece, revisar la tarifa de costo vigente a esa fecha y que el proveedor este disponible.',
      ).toBeGreaterThan(0);

      // Con mas de una tarifa Regular se prefiere la del proveedor que ya tiene el item reservado:
      // asi los totales se pueden comparar contra el costo del item sin cambiar de tipo de cambio.
      elegida = candidatas.find((f) =>
        (f.datos.SupplierName ?? '').trim().toLowerCase() === item1Antes.proveedor.trim().toLowerCase()) ?? candidatas[0];
      costoMoneda = elegida.datos.CostAmountDetail.trim().split(' ')[0];

      await adjuntarTexto('Tarifa elegida', JSON.stringify(elegida.datos, null, 1));
      const filaDom = page.locator('#tblFileService tbody tr').nth(elegida.indice);

      // La tarifa se compara con el item que trajo la reserva solo si es la misma fecha: con otra
      // fecha la tarifa puede ser otra y la diferencia no seria un defecto.
      if (fechaDelBuscador !== fechaDelBO(base.fechaDelServicio)) {
        await adjuntarTexto('Sin comparacion con el item reservado',
          `El buscador cotiza el ${fechaDelBuscador} y el item reservado es del ${base.fechaDelServicio}.`);
        return;
      }
      await conResaltado(page, filaDom, 'Costo del buscador', () => {
        expect(costoMoneda, 'Mismo servicio y fecha: el costo tiene que estar en la moneda del item reservado')
          .toBe(item1Antes.costo.moneda);
        igual(elegida.datos.TotalCostAmount, item1Antes.costo.valor,
          'Mismo servicio, fecha y pasajeros: el buscador tiene que cotizar el mismo costo que el item reservado');
      });
      await conResaltado(page, filaDom, 'Venta del buscador', () => {
        expect(elegida.datos.CurrencyCode, 'La venta se cotiza en la moneda del file').toBe(monedaDelFile);
        // Un peso de margen: la reserva del portal y el buscador redondean la venta por caminos distintos.
        expect(Math.abs(elegida.datos.TotalAmount - item1Antes.venta.valor),
          `Mismo servicio, fecha y markup: el buscador tiene que cotizar la venta del item reservado ` +
          `(${item1Antes.venta.valor}) y cotizo ${elegida.datos.TotalAmount}`).toBeLessThanOrEqual(1);
      });
    });

    await paso(page, 'Agregar la tarifa: la fila de la grilla trae el costo, la venta y las monedas del buscador', async () => {
      respuestas = await alta.agregar(elegida);
      await adjuntarTexto('Respuestas al agregar', JSON.stringify(respuestas, null, 1));
      expect(
        respuestas.checkrooming?.HasError,
        `El BO rechazo el rooming ${rooming}: ${respuestas.checkrooming?.ErrorMessage ?? '(sin mensaje)'}`,
      ).toBeFalsy();
      await adjuntarTexto('Avisos del BO', (await alta.avisos()).join('\n') || '(ninguno)');

      await alta.cerrarBuscador();
      const fila = alta.filaDeLaGrilla(-1);
      grillaNueva = await alta.leerFila(fila);
      await adjuntarTexto('Fila agregada en la grilla', JSON.stringify(grillaNueva, null, 1));
      const datos = elegida.datos;

      await conResaltado(page, fila, 'Detalle y fechas de la fila', () => {
        expect(grillaNueva.detalle.trim(), 'El detalle tiene que ser el del servicio elegido').toBe(datos.FullDetail.trim());
        expect(grillaNueva.tarifa, 'La tarifa tiene que ser Regular').toMatch(/^REGULAR/i);
        expect(fechaDelBO(grillaNueva.checkin), 'El check-in tiene que ser la fecha Desde del buscador').toBe(fechaDelBuscador);
        expect(grillaNueva.rooming, 'El rooming tiene que ser el que se cargo en el buscador').toBe(rooming);
        expect(grillaNueva.pax, 'Los pasajeros salen del rooming').toBe(String(contarPax(rooming)));
      });
      await conResaltado(page, fila, 'Costo de la fila', () => {
        expect(numeroDelBO(grillaNueva.costo), `El costo de la fila (${grillaNueva.costo}) tiene que ser el del buscador (${datos.TotalCostAmount})`)
          .toBeCloseTo(datos.TotalCostAmount, 5);
      });
      await conResaltado(page, fila, 'Venta de la fila', () => {
        expect(numeroDelBO(grillaNueva.venta), `La venta de la fila (${grillaNueva.venta}) tiene que ser la del buscador (${datos.TotalAmount})`)
          .toBeCloseTo(datos.TotalAmount, 5);
      });
      await conResaltado(page, fila, 'Monedas de la fila', () => {
        expect(grillaNueva.monedaDeCostoTexto, 'La moneda del costo tiene que ser la que cotizo el buscador').toBe(costoMoneda);
        expect(grillaNueva.monedaDeCostoValor, 'El combo de costo tiene que quedar con la moneda del servicio')
          .toBe(String(datos.CostCurrency));
        expect(grillaNueva.monedaDeVenta, 'La venta tiene que estar en la moneda del file').toBe(monedaDelFile);
        expect(grillaNueva.opcionesDeMoneda.join(', '), 'El combo de monedas tiene que ofrecer la del costo')
          .toContain(`${datos.CostCurrency}=${costoMoneda}`);
      });
      await adjuntarTexto('Pedido a priceservice al agregar', respuestas.priceservicePedido ?? 'La grilla no llamo a priceservice');
      await conResaltado(page, fila, 'Re-cotizacion al agregar', () => {
        expect(respuestas.priceserviceStatus, 'Al agregar, la grilla re-cotiza el item con priceservice: tiene que responder 200')
          .toBe(200);
      });
    });

    await paso(page, 'Guardar y volver al file', async () => {
      await alta.guardarYVolver();
      await alta.esperarFicha();
    });

    await paso(page, 'La ficha del file lista el item nuevo con el costo, la venta y la moneda esperados', async () => {
      const idsDespues = await alta.idsDeItems();
      await adjuntarTexto('Items del file', `Antes: ${idsAntes.join(', ')}\nDespues: ${idsDespues.join(', ')}`);
      expect(idsDespues, 'Despues de guardar el file tiene que listar los dos servicios').toHaveLength(2);
      const idNuevo = idsDespues.find((id) => !idsAntes.includes(id));
      expect(idNuevo, 'Tiene que aparecer un item que antes no estaba').toBeTruthy();

      nuevo = await alta.datosDeItem(idNuevo!);
      item1Despues = await alta.datosDeItem(idsAntes[0]);
      await adjuntarTexto('Item nuevo', JSON.stringify(nuevo, null, 1));
      const datos = elegida.datos;
      const fila = alta.filaDeItem(idNuevo!);

      await conResaltado(page, fila, 'Datos del item nuevo', () => {
        expect(nuevo.detalle, 'El item tiene que ser el servicio elegido').toContain('Tigre y Delta');
        expect(nuevo.tarifa, 'La tarifa tiene que ser Regular').toMatch(/^REGULAR/i);
        expect(nuevo.checkin, 'El check-in tiene que ser el del buscador').toBe(fechaDelBuscador);
        expect(nuevo.rooming, 'El rooming tiene que ser el cargado').toBe(rooming);
        // La ficha muestra el nombre corto del proveedor ("Expediciones") y el buscador la
        // razon social ("SPS EXPEDICIONES SRL"): se compara por inclusion.
        const proveedorDelItem = nuevo.proveedor.trim().toLowerCase();
        expect(proveedorDelItem.length > 0 && (datos.SupplierName ?? '').toLowerCase().includes(proveedorDelItem),
          `El proveedor del item ("${nuevo.proveedor}") tiene que ser el de la tarifa elegida ("${datos.SupplierName}")`).toBe(true);
      });
      await conResaltado(page, fila, 'Costo del item nuevo', () => {
        expect(nuevo.costo.moneda, 'El costo tiene que quedar en la moneda del servicio, no en otra').toBe(costoMoneda);
        igual(nuevo.costo.valor, datos.TotalCostAmount, 'El costo guardado tiene que ser el cotizado');
      });
      await conResaltado(page, fila, 'Venta del item nuevo', () => {
        expect(nuevo.venta.moneda, 'La venta tiene que quedar en la moneda del file').toBe(monedaDelFile);
        expect(Math.abs(nuevo.venta.valor - datos.TotalAmount),
          `Venta guardada ${nuevo.venta.valor} contra la cotizada ${datos.TotalAmount}`).toBeLessThanOrEqual(REDONDEO_DE_LA_FICHA);
      });
      await conResaltado(page, alta.filaDeItem(idsAntes[0]), 'Item existente sin cambios', () => {
        // Guardar vuelve a grabar **todas** las filas de la grilla, no solo la nueva.
        expect(item1Despues.costo, 'Agregar un servicio no puede cambiar el costo del que ya estaba').toEqual(item1Antes.costo);
        expect(item1Despues.venta, 'Agregar un servicio no puede cambiar la venta del que ya estaba').toEqual(item1Antes.venta);
        expect(item1Despues.rooming).toBe(item1Antes.rooming);
        expect(item1Despues.checkin).toBe(item1Antes.checkin);
        expect(item1Despues.proveedor).toBe(item1Antes.proveedor);
      });
    });

    await paso(page, 'Los totales del file, la cabecera del destino y el panel "Comprobantes y saldos" suman el item nuevo', async () => {
      const totales = await alta.totalesDelFile();
      const cliente = await alta.cifrasDelPanel('boCompCliente');
      const proveedores = await alta.cifrasDelPanel('boCompProveedores');
      const cabecera = await alta.cabeceraDelDestino();
      await adjuntarTexto('Totales del file despues', JSON.stringify(totales, null, 1));
      await adjuntarTexto('Cifras del cliente', JSON.stringify(cliente, null, 1));
      await adjuntarTexto('Cifras del proveedor', JSON.stringify(proveedores, null, 1));
      await adjuntarTexto('Cabecera del destino', JSON.stringify(cabecera, null, 1));

      const ventaDeLosItems = item1Despues.venta.valor + nuevo.venta.valor;
      const tarjetas = page.locator('#updFileTotals');

      await conResaltado(page, tarjetas, 'Venta del file', () => {
        expect(totales.venta.moneda, 'Los totales del file tienen que estar en la moneda del file').toBe(monedaDelFile);
        igual(totales.venta.valor, ventaDeLosItems, 'La venta del file tiene que ser la suma de los dos items', SUMA_DE_DOS);
        igual(totales.venta.valor - totalesAntes.venta.valor, nuevo.venta.valor,
          'La venta del file tiene que subir lo que vale el item nuevo', SUMA_DE_DOS);
      });
      await conResaltado(page, tarjetas, 'Costo del file', () => {
        expect(totales.costo.valor, 'El costo del file tiene que subir al sumar el item').toBeGreaterThan(totalesAntes.costo.valor);
        const mismoCosto = nuevo.costo.moneda === item1Despues.costo.moneda
          && nuevo.proveedor === item1Despues.proveedor && item1Despues.costo.valor > 0;
        if (!mismoCosto) return;
        // Mismo proveedor y misma moneda: el costo del file, que el BO pasa a la moneda del file con el
        // tipo de cambio del proveedor, crece en la misma proporcion que el costo en la moneda original.
        const esperado = totalesAntes.costo.valor * (item1Despues.costo.valor + nuevo.costo.valor) / item1Despues.costo.valor;
        expect(Math.abs(totales.costo.valor - esperado),
          `Costo del file ${totales.costo.valor} contra el esperado ${esperado.toFixed(3)}`).toBeLessThanOrEqual(0.05);
      });

      await conResaltado(page, alta.lado('boCompCliente'), 'Panel del cliente', () => {
        const venta = numeroDelBO(cliente['Venta del file']);
        expect(venta, 'La venta del panel tiene que ser la de los totales del file').toBeCloseTo(totales.venta.valor, 2);
        expect(numeroDelBO(cliente['Facturado']), 'No se facturo nada').toBe(0);
        expect(numeroDelBO(cliente['Cobrado']), 'No se cobro nada').toBe(0);
        expect(numeroDelBO(cliente['Falta cobrar']), 'Sin cobros, falta cobrar toda la venta').toBeCloseTo(venta, 2);
      });
      await conResaltado(page, alta.lado('boCompProveedores'), 'Panel de proveedores', () => {
        const costo = numeroDelBO(proveedores['Costo del file']);
        expect(costo, 'El costo del panel tiene que ser el de los totales del file').toBeCloseTo(totales.costo.valor, 2);
        expect(numeroDelBO(proveedores['Facturado']), 'No se facturo nada').toBe(0);
        expect(numeroDelBO(proveedores['Pagado']), 'No se pago nada').toBe(0);
        expect(numeroDelBO(proveedores['Falta pagar']), 'Sin pagos, falta pagar todo el costo').toBeCloseTo(costo, 2);
      });
      await conResaltado(page, alta.lado('boCompCliente'), 'Deuda marcada en el panel', async () => {
        await expect(alta.lado('boCompCliente').locator('.bo-comp__cifra--debe'), 'Falta cobrar tiene que quedar marcado como deuda').toHaveCount(1);
        await expect(alta.lado('boCompProveedores').locator('.bo-comp__cifra--debe'), 'Falta pagar tiene que quedar marcado como deuda').toHaveCount(1);
      });

      await conResaltado(page, page.locator('.fi-card').first(), 'Cabecera del destino', () => {
        expect(cabecera.servicios, 'La tarjeta del destino tiene que contar los dos servicios').toBe(2);
        if (cabecera.venta.moneda === monedaDelFile) {
          igual(cabecera.venta.valor, ventaDeLosItems, 'La venta de la cabecera del destino tiene que ser la suma de los dos items', SUMA_DE_DOS);
        }
      });
    });

    await paso(page, 'Reabrir los servicios del destino: las dos filas conservan costo, venta y monedas', async () => {
      await alta.abrirServiciosDelDestino();
      await alta.esperarGrilla(2);
      const filas = [await alta.leerFila(alta.filaDeLaGrilla(0)), await alta.leerFila(alta.filaDeLaGrilla(1))];
      await adjuntarTexto('Filas de la grilla reabierta', JSON.stringify(filas, null, 1));

      const datos = elegida.datos;
      const guardada = filas.find((f) => f.orden === String(numeroDelBO(item1Antes.orden) + 1)) ?? filas[1];
      const original = filas.find((f) => f !== guardada)!;
      const fila = alta.filaDeLaGrilla(filas.indexOf(guardada));

      await conResaltado(page, fila, 'Fila guardada', () => {
        igual(numeroDelBO(guardada.costo), datos.TotalCostAmount, 'El costo reabierto tiene que ser el cotizado');
        igual(numeroDelBO(guardada.venta), datos.TotalAmount, 'La venta reabierta tiene que ser la cotizada');
        expect(guardada.monedaDeCostoTexto, 'La moneda del costo se conserva').toBe(costoMoneda);
        expect(guardada.monedaDeVenta, 'La moneda de la venta se conserva').toBe(monedaDelFile);
        expect(guardada.rooming).toBe(rooming);
      });
      await conResaltado(page, alta.filaDeLaGrilla(filas.indexOf(original)), 'Fila existente', () => {
        igual(numeroDelBO(original.costo), item1Antes.costo.valor, 'El costo del item existente se conserva');
        igual(numeroDelBO(original.venta), item1Antes.venta.valor, 'La venta del item existente se conserva');
        expect(original.monedaDeCostoTexto, 'La moneda del costo del item existente se conserva').toBe(item1Antes.costo.moneda);
        expect(original.monedaDeVenta).toBe(monedaDelFile);
      });

      await adjuntarTexto('Resumen', [
        `File: ${base.fileCode} (id ${base.fileId})`,
        `Servicio agregado: ${datos.FullDetail.trim()} | tarifa ${datos.RateType} | proveedor ${datos.SupplierName}`,
        `Cotizado por el buscador: costo ${costoMoneda} ${enFormatoDelBO(datos.TotalCostAmount)}, venta ${datos.CurrencyCode} ${enFormatoDelBO(datos.TotalAmount)}`,
        `Guardado en la ficha: costo ${nuevo.costo.moneda} ${enFormatoDelBO(nuevo.costo.valor)}, venta ${nuevo.venta.moneda} ${enFormatoDelBO(nuevo.venta.valor)}`,
        `Item reservado: costo ${item1Antes.costo.moneda} ${enFormatoDelBO(item1Antes.costo.valor)}, venta ${item1Antes.venta.moneda} ${enFormatoDelBO(item1Antes.venta.valor)}`,
      ].join('\n'));
    });

    await paso(page, 'Alta con idioma: English suma el recargo al costo, lo agrega como item adicional y la venta lleva el markup sobre costo + recargo', async () => {
      const pax = contarPax(rooming);
      const FECHA = fechaDelBuscador;
      const [dd, mm, aa] = FECHA.split('/').map(Number);
      const tarifas = await conBackofficeNuevo(page.context().browser()!, (bo) => costosDelServicio(bo, RP.id));
      const tarifa = tarifaVigente(tarifas, 'Regular', new Date(aa, mm - 1, dd), pax);
      const recargo = tarifa?.recargos.find((r) => mismoIdioma(r.idioma, 'English'));
      expect(recargo, `${RP.nombre} tiene que tener recargo English en su tarifa Regular del ${FECHA}`).toBeDefined();
      expect(recargo!.tipo, 'El recargo de English del servicio AUTO-QA es por pasajero').toBe('porPasajero');
      const recargoTotal = recargo!.valor * pax;

      await alta.abrirBuscador();
      await alta.fijarRooming(rooming);
      await alta.buscarSoloServicios();
      await alta.elegirNombre(RP.terminoBusqueda, new RegExp(RP.nombre, 'i'));
      const filas = await alta.buscar();
      const f = filas.find((x) => new RegExp(RP.terminoBusqueda, 'i').test(x.datos.Name) && x.datos.RateTypeID === TARIFA_REGULAR);
      expect(f, `El buscador tiene que ofrecer la tarifa Regular de ${RP.nombre}`).toBeDefined();
      const sin = f!.datos;
      const relacion = sin.TotalAmount / sin.TotalCostAmount;
      const filaDom = page.locator('#tblFileService tbody tr').nth(f!.indice);
      const combo = filaDom.locator('select.js-fs-language');
      await expect(combo, 'Con idiomas configurados, el listado tiene que mostrar el combo de la columna Idioma').toBeVisible();
      await combo.selectOption({ label: 'English' });
      const celdas = (await filaDom.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
      const costoCon = importeDelBO(celdas[4]);
      const ventaCon = importeDelBO(celdas[5]);
      const costoEsperado = sin.TotalCostAmount + recargoTotal;
      const ventaEsperada = precioEsperado(tarifa!.costo! + recargo!.valor, tarifa!.moneda, MARKUP_DE_LA_AGENCIA)! * pax;
      const ventaSinEsperada = precioEsperado(tarifa!.costo!, tarifa!.moneda, MARKUP_DE_LA_AGENCIA)! * pax;
      await adjuntarTexto('Alta con idioma: buscador', [
        `Tarifa del BackOffice: ${tarifa!.vigencia} | ${tarifa!.moneda} ${tarifa!.costo} | recargo ${JSON.stringify(recargo)} x ${pax} pax = ${recargoTotal}`,
        `Sin recargo: costo ${sin.TotalCostAmount}, venta ${sin.CurrencyCode} ${sin.TotalAmount} (venta/costo ${relacion})`,
        `Con English: costo ${celdas[4]}, venta ${celdas[5]}`,
        `Esperado: costo ${costoEsperado}, venta techo((${tarifa!.costo} + ${recargo!.valor}) / cotizacion / ${MARKUP_DE_LA_AGENCIA}) x ${pax} = ${ventaEsperada} (sin idioma ${ventaSinEsperada})`,
      ].join('\n'));
      await conResaltado(page, filaDom, 'Fila con English', () => {
        expect(sin.TotalAmount, `Sin idioma, la venta del buscador tiene que ser techo(costo / cotizacion / ${MARKUP_DE_LA_AGENCIA}) x ${pax}`).toBe(ventaSinEsperada);
        expect.soft(Math.abs(costoCon.valor - costoEsperado), `Con English el costo de la fila tiene que ser costo de tarifa + recargo (${costoEsperado}) y es ${costoCon.valor} (US 4739)`).toBeLessThanOrEqual(0.011);
        expect.soft(Math.abs(ventaCon.valor - ventaEsperada), `Con English la venta tiene que llevar el markup sobre costo + recargo (${ventaEsperada.toFixed(2)}) y es ${ventaCon.valor} (US 4739)`).toBeLessThanOrEqual(TOLERANCIA_RELACION);
      });

      const filasAntes = await page.locator(alta.filasDeLaGrilla).count();
      await alta.agregar(f!);
      await alta.cerrarBuscador();
      await alta.esperarGrilla(filasAntes + 2);
      const servicio = await alta.leerFila(alta.filaDeLaGrilla(filasAntes));
      const adicional = await alta.leerFila(alta.filaDeLaGrilla(filasAntes + 1));
      await adjuntarTexto('Alta con idioma: filas agregadas', JSON.stringify({ servicio, adicional }, null, 1));
      const ventaDeLasDos = numeroDelBO(servicio.venta) + numeroDelBO(adicional.venta);
      await conResaltado(page, alta.filaDeLaGrilla(filasAntes + 1), 'Item adicional del recargo', () => {
        expect.soft(Math.abs(numeroDelBO(adicional.costo) - recargoTotal), `El recargo tiene que agregarse como item de costo adicional de ${recargoTotal} (US 4739)`).toBeLessThanOrEqual(0.011);
        expect.soft(Math.abs(numeroDelBO(servicio.costo) + numeroDelBO(adicional.costo) - costoEsperado), 'El costo de las dos filas tiene que sumar costo de tarifa + recargo').toBeLessThanOrEqual(0.011);
        expect.soft(Math.abs(ventaDeLasDos - ventaEsperada), `La venta de las dos filas tiene que ser (costo + recargo) con el markup (${ventaEsperada.toFixed(2)}) y suma ${ventaDeLasDos.toFixed(2)} (US 4739)`).toBeLessThanOrEqual(TOLERANCIA_RELACION);
      });

      await alta.guardarYVolver();
      await alta.esperarFicha();
      const ids = await alta.idsDeItems();
      await adjuntarTexto('Alta con idioma: items del file', ids.join(', '));
      expect(ids, 'Despues de guardar, el file tiene que listar los dos servicios anteriores, el nuevo y su item adicional de idioma').toHaveLength(4);
      const items = await Promise.all(ids.slice(2).map((id) => alta.datosDeItem(id)));
      await adjuntarTexto('Alta con idioma: items guardados', JSON.stringify(items, null, 1));
      const ventaGuardada = items.reduce((t, i) => t + i.venta.valor, 0);
      expect.soft(Math.abs(ventaGuardada - ventaEsperada), `En la ficha, la venta del servicio y su recargo tiene que ser ${ventaEsperada.toFixed(2)} y suma ${ventaGuardada.toFixed(2)} (US 4739)`).toBeLessThanOrEqual(TOLERANCIA_RELACION);
    });
  });
});
