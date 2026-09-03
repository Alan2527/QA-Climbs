import { test, expect, Page, Locator } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage, Pasajero } from '../../pages/carrito.page';
import { BackOfficePage } from '../../pages/backoffice.page';
import { HotelPage } from '../../pages/hotel.page';
import { CustomToursPage } from '../../pages/customtours.page';
import { CarritoCustomToursPage } from '../../pages/carrito-customtours.page';
import {
  paso, adjuntarTexto, resaltarYCapturar, reiniciarNumeracionDePasos,
  fechaDeBusqueda, formatearFecha, esperarFinDeCarga, importeANumero,
} from '../../utils/pasos';

/**
 * Bloque B — Reservas.
 *
 * Cada test emite una reserva desde el portal y verifica que el BackOffice la
 * reciba con los mismos datos. A diferencia del Bloque A, que solo lee, aca el
 * dato esperado lo genera el propio test: es lo que carga en el formulario.
 *
 * Los cuatro flujos entran por INICIO, que es la unica puerta del sistema, y
 * cada uno por la solapa de su buscador.
 *
 * Van todos en un mismo archivo a proposito: el carrito es del lado del
 * servidor y esta atado a la cookie de sesion, que se comparte por el
 * storageState. Dos flujos en paralelo se pisarian el carrito entre si.
 * Por eso tambien la suite corre con un solo worker (npm run test:bloque-b).
 */
test.describe('Reservas', () => {

  /**
   * Corre una comparacion y, si falla, marca en rojo la zona que la origino y
   * la registra como fallo blando, para que el test siga validando el resto.
   *
   * Es el mismo patron que usa el Bloque A. Se define aca y no se comparte
   * para no tocar nada de aquel bloque, que esta terminado.
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

  /** Fecha sin ceros a la izquierda: el BO la arma como dia/mes/anio pelado. */
  const sinCeros = (fecha: string) => fecha.split('/').map((p) => String(Number(p))).join('/');

  /**
   * Separa un texto de importe ("USD 1.234,50") en moneda y numero.
   *
   * Se compara el numero, no la cadena: el portal escribe "USD 19" y el BO
   * "USD 19,000" con el formato de tres decimales de ToMoneyN3(). Comparar el
   * texto daria rojo por el formato y no por el importe.
   */
  const importe = (texto: string): { moneda: string; valor: number | null } => {
    const limpio = (texto || '').replace(/\s+/g, ' ').trim();
    const moneda = limpio.match(/[A-Z]{3}/)?.[0] ?? '';
    return { moneda, valor: importeANumero(limpio) };
  };

  /**
   * Importe tal como lo escribe el portal, que usa el formato **inverso** al del BO.
   *
   * `ToMoney()` del portal escribe la coma como separador de **miles**: la tabla
   * de totales de la oferta lo demuestra sola, porque 2,024 + 558 = 2,582.
   * `ToMoneyN3()` del BO la usa como **decimal**: escribe "USD 19,000" para 19.
   *
   * Con un solo parser, "USD 2,024" se leeria como 2,024 en vez de 2024. No se
   * habia notado en los flujos de servicio y hotel porque ahi los importes son
   * de tres cifras y no llevan separador.
   */
  const importeDelPortal = (texto: string): { moneda: string; valor: number | null } => {
    const limpio = (texto || '').replace(/\s+/g, ' ').trim();
    const moneda = limpio.match(/[A-Z]{3}/)?.[0] ?? '';
    const numero = limpio.replace(/[^\d.,-]/g, '').replace(/,/g, '');
    const valor = Number(numero);
    return { moneda, valor: numero !== '' && Number.isFinite(valor) ? valor : null };
  };

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  /**
   * Checkout y emision del riel de servicios y hoteles.
   *
   * Solo sirve para ese riel: el de CustomTours tiene el carrito y el
   * checkout en una sola pantalla, con otros ids y sin campo de cantidad de
   * pasajeros. Devuelve el codigo BOxxxxxxxx de la reserva emitida.
   */
  async function completarCheckoutYEmitir(opciones: {
    page: Page;
    carrito: CarritoPage;
    reserva: {
      referencia: string; observaciones: string; detalleDelItem: string;
      cantidadPax: number; pasajeros: Pasajero[];
    };
    capturar: (donde: string, texto: string) => { moneda: string; valor: number | null };
    selectorDetalleDelItem: string;
  }): Promise<string> {
    const { page, carrito, reserva, capturar, selectorDetalleDelItem } = opciones;
    let codigo = '';
    await paso(page, 'Cargar los pasajeros y los datos de la reserva en el checkout', async () => {
      // El checkout arranca con un solo bloque de pasajero aunque la reserva sea
      // de dos: se agregan los que falten, como haria una persona.
      await carrito.asegurarPasajeros(reserva.cantidadPax);
      for (const [i, pax] of reserva.pasajeros.entries()) await carrito.completarPasajero(i, pax);

      await page.locator(selectorDetalleDelItem).first()
        .fill(reserva.detalleDelItem);
      await carrito.completarDatosDeLaReserva(
        reserva.cantidadPax, reserva.referencia, reserva.observaciones,
      );
      await carrito.aceptarTerminos();
    });

    await paso(page, 'Confirmar la reserva y tomar su codigo del historial', async () => {
      codigo = await carrito.confirmarReserva();
      await adjuntarTexto('Codigo de la reserva emitida', codigo);
      expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
        .toMatch(/^BO\d{8}$/);

      // Total con el que quedo registrada la reserva, en la fila del historial.
      const filaHistorial = page.locator('#tabBooking tr').filter({ hasText: codigo }).first();
      const importesDeLaFila = ((await filaHistorial.innerText()).match(/[A-Z]{3}\s*\d[\d.,]*/g) ?? []);
      capturar('historial (total)', importesDeLaFila.at(-1) ?? '');
      await adjuntarTexto('Importes de la fila del historial', importesDeLaFila.join(' | '));
    });

    return codigo;
  }

  /**
   * Tramo comun a los cuatro flujos: del historial de la reserva al file.
   *
   * Desde que la reserva quedo emitida, el recorrido es identico se haya
   * reservado un servicio, un hotel, una oferta o un multidestino: cambia lo
   * que se reservo, no lo que hay que verificar despues.
   */
  async function verificarEnElBackOffice(opciones: {
    page: Page;
    bo: BackOfficePage;
    codigo: string;
    reserva: {
      item: string; textoEnElBO: string; modalidad: string; fecha: string;
      fechaDeSalida?: string;
      referencia: string; observaciones: string; detalleDelItem: string;
      cantidadPax: number; pasajeros: Pasajero[];
    };
    contexto: Record<string, string>;
    importes: Record<string, { moneda: string; valor: number | null }>;
    capturar: (donde: string, texto: string) => { moneda: string; valor: number | null };
    // Que importe del portal se toma como referencia de la cadena. En servicios
    // y hoteles es el de la ficha; en ofertas y multidestinos, el del itinerario.
    claveDeReferencia?: string;
    // Donde se muestra el comentario del item en el detalle de la reserva. En
    // servicios y hoteles va a WholesalerBookItemDetail y se imprime en
    // p.pdiscl; en circuitos va a CT_Service.Comment, que se muestra en otro
    // lugar de la misma pantalla.
    selectorDelComentario?: string;
    // El file escribe la habitacion como 1 X DOBLE y la bandeja como 1 DBL:
    // el mismo dato con dos formatos.
    modalidadEnElFile?: string;
    // Con varios items reservados la comparacion de importes por item no aplica:
    // se concilia el total del viaje.
    itemUnico?: boolean;
    // Todos los items que la reserva tiene que traer. Con uno solo alcanza el
    // del propio item; una oferta o un multidestino traen varios y hay que
    // exigirlos a todos.
    itemsEsperados?: string[];
    // Importe que el portal mostro para cada item, por fragmento de su nombre.
    // Sin esto solo se conciliaria el total, y un item que cambia compensado
    // por otro pasaria desapercibido.
    importePorItemDelPortal?: Record<string, string>;
  }) {
    const { page, bo, codigo, reserva, contexto, importes, capturar } = opciones;
    const claveDeReferencia = opciones.claveDeReferencia ?? 'ficha (total)';
    const selectorDelComentario = opciones.selectorDelComentario ?? 'p.pdiscl';
    const modalidadEnElFile = opciones.modalidadEnElFile ?? reserva.modalidad;
    const itemUnico = opciones.itemUnico ?? true;
    const itemsEsperados = opciones.itemsEsperados ?? [reserva.textoEnElBO];
    const importePorItemDelPortal = opciones.importePorItemDelPortal ?? {};
    let sumaDeLosItems = 0;
    await paso(page, 'Abrir el detalle de la reserva en el portal y verificar los comentarios', async () => {
      // Se ubica la reserva por su codigo y no por la solapa: las de servicios
      // y hoteles viven en "Reservas" y las de circuitos en "Reservas
      // circuitos", asi que buscar en una sola no serviria para los cuatro.
      await page.locator(`a[href*='BookingHistoryDetail.aspx?book=']`)
        .filter({ hasText: codigo }).first().click();
      await page.waitForURL(/bookinghistorydetail/i, { timeout: 60_000 });
      await esperarFinDeCarga(page);

      // El comentario por item se verifica aca y no en el BO porque el BO no lo
      // lee en ninguna pantalla: se guarda en WholesalerBookItemDetail y sus
      // unicos consumidores son esta pantalla y las plantillas de mail. Es
      // ademas lo que hace una persona: entrar a la reserva recien emitida a
      // confirmar que quedo como la cargo.
      const comentarioDelItem = page.locator(selectorDelComentario);
      await conResaltado(page, comentarioDelItem, 'Comentario del item en el detalle', async () => {
        expect(
          (await comentarioDelItem.allInnerTexts()).join(' | ').replace(/\s+/g, ' '),
          'El detalle de la reserva tiene que mostrar el comentario cargado en el item',
        ).toContain(reserva.detalleDelItem);
      });

      const filaComentario = page.locator('tr')
        .filter({ has: page.locator('h6', { hasText: 'Comentario' }) }).first();
      await conResaltado(page, filaComentario, 'Observaciones en el detalle de la reserva', async () => {
        expect(
          (await filaComentario.innerText()).replace(/\s+/g, ' '),
          'El detalle de la reserva tiene que mostrar las observaciones cargadas',
        ).toContain(reserva.observaciones);
      });
    });

    await paso(page, 'Entrar al BackOffice y abrir la bandeja de Reservas', async () => {
      await bo.ingresar(process.env.BO_USER!, process.env.BO_PASS!);
      await bo.irABandejaDeReservas();
      await bo.filtrar({ emitidas: 'NO' });
    });

    await paso(page, 'Ubicar la reserva en la bandeja y comparar la fila', async () => {
      const fila = bo.fila(codigo);
      await expect(fila, `La reserva ${codigo} tiene que estar en la bandeja Online`).toBeVisible();

      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      await conResaltado(page, fila, 'Referencia en la bandeja', () => {
        expect(texto, 'La bandeja tiene que mostrar la referencia cargada en el portal')
          .toContain(reserva.referencia);
      });
      await conResaltado(page, fila, 'Pasajero principal en la bandeja', () => {
        const principal = `${reserva.pasajeros[0].nombre} ${reserva.pasajeros[0].apellido}`.toUpperCase();
        expect(texto, 'La bandeja tiene que mostrar el pasajero principal').toContain(principal);
      });

      // La fila lleva ademas la agencia, el usuario, su mail, la ciudad y el
      // pais. No los carga el test, pero si el BO mostrara otros, la reserva
      // habria llegado con el contexto equivocado.
      // Se exige que los cuatro esperados existan antes de compararlos: un
      // esperado vacio haria que `toContain` pasara sin comparar nada.
      for (const [campo, esperado] of Object.entries(contexto)) {
        expect(esperado, `Falta el valor esperado de ${campo} para comparar la bandeja`).toBeTruthy();
        await conResaltado(page, fila, `Campo ${campo} en la bandeja`, () => {
          expect(texto.toLowerCase(), `La bandeja tiene que mostrar ${campo} de la reserva`)
            .toContain(esperado.toLowerCase());
        });
      }

      // Columna V, moneda mas total: es la anteultima celda, antes de la del
      // lapiz. Se toma por posicion y no por patron, por el mismo motivo que en
      // la grilla de items.
      const celdasDeLaFila = (await fila.locator('td').allInnerTexts())
        .map((c) => c.replace(/\s+/g, ' ').trim());
      capturar('bandeja (columna V)', celdasDeLaFila.at(-2) ?? '');
    });

    /**
     * Lo que tienen que mostrar los campos del BO a partir de lo cargado en el
     * portal. Sirve para las dos pantallas: la bandeja y el file usan los mismos
     * ids estaticos, asi que la misma exigencia se aplica en los dos lugares.
     *
     * El BO pasa a mayuscula nombre, apellido y nacionalidad en este bloque
     * (InboxDetail.aspx.cs:870), no en la grilla de pasajeros. Y "Nom. File" es
     * un campo compuesto, no un dato cargado: NOMBRE/APELLIDO x cantidad.
     */
    const camposEsperados = (enMayuscula: boolean): Record<string, string> => {
      const p = reserva.pasajeros[0];
      const caso = (t: string) => (enMayuscula ? t.toUpperCase() : t);
      return {
        txtQuantity: String(reserva.cantidadPax),
        txtCustomerReference: reserva.referencia,
        txtComment: reserva.observaciones,
        txtPaxName: caso(p.nombre),
        txtPaxLastName: caso(p.apellido),
        txtPaxNationality: caso(p.nacionalidad),
        // "Nom. File" siempre va en mayuscula: el detalle lo compone asi y lo
        // guarda asi, de modo que llega al file con ese formato aunque el file
        // no pase a mayuscula el resto de sus campos.
        txtMainName: `${p.nombre.toUpperCase()}/${p.apellido.toUpperCase()} x ${reserva.cantidadPax}`,
      };
    };

    const compararCampos = async (donde: string, enMayuscula: boolean) => {
      for (const [id, esperado] of Object.entries(camposEsperados(enMayuscula))) {
        const campo = page.locator(`#${id}`).first();
        await conResaltado(page, campo, `Campo ${id} en ${donde}`, async () => {
          expect(
            await campo.inputValue(),
            `El campo ${id} tiene que conservar en ${donde} lo cargado en el portal`,
          ).toBe(esperado);
        });
      }
    };

    await paso(page, 'Abrir el detalle y comparar los datos de la reserva', async () => {
      await bo.abrirDetalle(codigo);
      // El detalle pasa a mayuscula nombre, apellido y nacionalidad
      // (InboxDetail.aspx.cs:870); el file los muestra como se cargaron.
      await compararCampos('el detalle de la bandeja', true);
    });

    await paso(page, 'Comparar la grilla de pasajeros y el item reservado', async () => {
      for (const [i, pax] of reserva.pasajeros.entries()) {
        const fila = page.locator('#tblPassenger tbody tr').nth(i);
        const celdas = (await fila.locator('td').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
        const unaLinea = celdas.join(' | ');
        await conResaltado(page, fila, `Pasajero ${i + 1} en el detalle`, () => {
          expect(unaLinea, `El pasajero ${i + 1} tiene que conservar su nombre`).toContain(pax.nombre);
          expect(unaLinea, `El pasajero ${i + 1} tiene que conservar su apellido`).toContain(pax.apellido);
          expect(unaLinea, `El pasajero ${i + 1} tiene que conservar su pasaporte`).toContain(pax.pasaporte);
          expect(unaLinea, `El pasajero ${i + 1} tiene que conservar su nacionalidad`)
            .toContain(pax.nacionalidad);
          // El BO arma la fecha como dia/mes/anio sin ceros a la izquierda,
          // asi que se normalizan los dos lados: 05/03/1990 se muestra 5/3/1990.
          expect(celdas.map(sinCeros).join(' | '), `El pasajero ${i + 1} tiene que conservar su fecha de nacimiento`)
            .toContain(sinCeros(pax.nacimiento));
        });
      }

      const item = page.locator('#tblInboxDetail tbody tr').filter({ hasText: reserva.textoEnElBO }).first();
      const texto = (await item.innerText()).replace(/\s+/g, ' ');
      await conResaltado(page, item, 'Item reservado en el detalle', () => {
        expect(texto, 'El detalle tiene que mostrar el servicio reservado').toContain(reserva.textoEnElBO);
        expect(texto, 'El detalle tiene que mostrar la fecha de la reserva').toContain(reserva.fecha);
        // La grilla del BO escribe la modalidad en mayuscula ("REGULAR").
        expect(texto.toUpperCase(), 'El detalle tiene que mostrar la modalidad reservada')
          .toContain(reserva.modalidad.toUpperCase());
      });

      // Los importes se leen por celda y no con una expresion sobre el texto de
      // la fila: en una reserva de circuito la columna de tipo de tarifa dice
      // "1 DBL" y el patron de moneda la tomaba como si DBL fuera un importe.
      // Columnas: (c), Destino, Detalle, Tipo, Fecha IN, Fecha OUT,
      //           Tipo de tarifa, Venta, V. Markup, Integracion.
      const celdasDelItem = (await item.locator('td').allInnerTexts())
        .map((c) => c.replace(/\s+/g, ' ').trim());
      capturar('detalle (Venta del item)', celdasDelItem[7] ?? '');
      capturar('detalle (V. Markup del item)', celdasDelItem[8] ?? '');
      await adjuntarTexto('Celdas del item en el detalle', celdasDelItem.join(' | '));

      // La fecha de salida: en un servicio suelto la grilla la deja en "-", y en
      // un alojamiento o un circuito trae la de egreso.
      if (reserva.fechaDeSalida) {
        await conResaltado(page, item, 'Fecha de salida del item en el detalle', () => {
          expect(celdasDelItem[5] ?? '', 'El detalle tiene que mostrar la fecha de salida')
            .toContain(reserva.fechaDeSalida!);
        });
      }

      // Una reserva de circuito trae varios items y hay que exigirlos a todos:
      // verificar solo uno dejaria pasar que se pierda cualquiera de los otros.
      const grilla = page.locator('#tblInboxDetail tbody tr');
      const todas = (await grilla.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      await adjuntarTexto('Items del detalle de la reserva', todas.join(SALTO));
      for (const esperado of itemsEsperados) {
        await conResaltado(page, grilla.first(), `Item ${esperado} en el detalle`, () => {
          expect(todas.join(' || ').toUpperCase(),
            `El detalle tiene que traer el item ${esperado} de la reserva`)
            .toContain(esperado.toUpperCase());
        });
      }

      // Y cada item con su propio importe, no solo el total: si uno cambia y
      // otro compensa, la suma cierra igual y no se veria.
      for (const [esperado, delPortal] of Object.entries(importePorItemDelPortal)) {
        const filaDelItem = grilla.filter({ hasText: new RegExp(esperado, 'i') }).first();
        const celdasDeEse = (await filaDelItem.locator('td').allInnerTexts())
          .map((c) => c.replace(/\s+/g, ' ').trim());
        await conResaltado(page, filaDelItem, `Importe del item ${esperado} en el detalle`, () => {
          expect(importe(celdasDeEse[7] ?? '').valor,
            `El detalle tiene que conservar el importe de ${esperado}`)
            .toBe(importeDelPortal(delPortal).valor);
        });
      }
    });

    let file = '';
    await paso(page, 'Elegir la sucursal y generar el file desde el detalle', async () => {
      // La sucursal es obligatoria y es lo primero que valida el boton: sin
      // elegirla, "Generar file" corta con "Se debe seleccionar una sucursal".
      const sucursal = await bo.elegirSucursal();
      await adjuntarTexto('Sucursal elegida para el file', sucursal);

      file = await bo.generarFile();
      await adjuntarTexto('File generado', `Reserva ${codigo} -> file ${file}`);
      // Si la agencia no tuviera un cliente asociado, el boton no hace nada y no
      // muestra ningun error: la unica senal es que no redirige.
      await expect(page, 'Generar file tiene que abrir el file recien creado')
        .toHaveURL(/managefile/i);
    });

    await paso(page, 'Comparar los datos del file contra los cargados en el portal', async () => {
      // El file usa los mismos ids estaticos que el detalle de la bandeja, asi
      // que se le exige lo mismo: el dato tiene que sobrevivir a la generacion.
      await compararCampos('el file', false);
    });

    await paso(page, 'Abrir el Rooming del file y comparar los pasajeros', async () => {
      await bo.abrirRooming();
      const filas = await bo.filasDelRooming();
      await adjuntarTexto('Rooming del file', filas.join('\n'));

      const rooming = page.locator('#modalRooming');
      await conResaltado(page, rooming, 'Cantidad de pasajeros en el rooming', () => {
        expect(filas.length, 'El rooming tiene que tener un pasajero por cada uno cargado en el portal')
          .toBe(reserva.pasajeros.length);
      });

      for (const [i, pax] of reserva.pasajeros.entries()) {
        const fila = page.locator('#tblRooming tbody tr').nth(i);
        const linea = filas[i] ?? '';
        await conResaltado(page, fila, `Pasajero ${i + 1} en el rooming`, () => {
          expect(linea, `El rooming tiene que conservar el nombre del pasajero ${i + 1}`).toContain(pax.nombre);
          expect(linea, `El rooming tiene que conservar el apellido del pasajero ${i + 1}`).toContain(pax.apellido);
          expect(linea, `El rooming tiene que conservar el documento del pasajero ${i + 1}`).toContain(pax.pasaporte);
          expect(linea, `El rooming tiene que conservar la nacionalidad del pasajero ${i + 1}`).toContain(pax.nacionalidad);
          expect(linea.split(' | ').map(sinCeros).join(' | '),
            `El rooming tiene que conservar la fecha de nacimiento del pasajero ${i + 1}`)
            .toContain(sinCeros(pax.nacimiento));
        });
      }

      await bo.cerrarRooming();
    });

    await paso(page, 'Comparar el servicio en Destinos & Servicios del file', async () => {
      const fila = page.locator(bo.filaServicioDelFile).filter({ hasText: reserva.textoEnElBO }).first();
      const celdas = (await fila.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
      const texto = celdas.join(' | ');
      await adjuntarTexto('Fila del servicio en el file', texto);

      await conResaltado(page, fila, 'Servicio reservado en el file', () => {
        expect(texto, 'El file tiene que mostrar el servicio reservado').toContain(reserva.textoEnElBO);
        expect(texto, 'El file tiene que mostrar la fecha de la reserva').toContain(reserva.fecha);
        expect(texto.toUpperCase(), 'El file tiene que mostrar la modalidad reservada')
          .toContain(modalidadEnElFile.toUpperCase());
      });

      // Costo y Venta son las dos ultimas celdas que contienen un importe. No se
      // toman por posicion desde el final: la fila termina con varias celdas
      // vacias. Y Venta se escribe con ToMoneyN3() pelado, sin codigo de moneda,
      // asi que tampoco sirve buscar el patron "USD 999".
      const soloImporte = /^([A-Z]{3}\s*)?\d[\d.,]*$/;
      const importesDeLaFila = celdas.filter((c) => soloImporte.test(c));
      capturar('file (Venta del item)', importesDeLaFila.at(-1) ?? '');
      await adjuntarTexto('Costo y Venta del item en el file',
        `Costo: ${importesDeLaFila.at(-2) ?? '?'} | Venta: ${importesDeLaFila.at(-1) ?? '?'}`);

      // Todos los items del viaje, no solo el que se mira en detalle.
      const filasDelFile = page.locator(bo.filaServicioDelFile);
      const todasLasFilas = await filasDelFile.evaluateAll((trs) =>
        trs.map((tr) => Array.from(tr.querySelectorAll('td'))
          .map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean).join(' | ')));
      await adjuntarTexto('Items del file', todasLasFilas.join(SALTO));

      for (const esperado of itemsEsperados) {
        await conResaltado(page, filasDelFile.first(), `Item ${esperado} en el file`, () => {
          expect(todasLasFilas.join(' || ').toUpperCase(),
            `El file tiene que traer el item ${esperado} de la reserva`)
            .toContain(esperado.toUpperCase());
        });
      }

      // La suma de las ventas de los items tiene que dar el total del file. Es
      // lo que detecta que un item llegue con otro importe sin que el total se
      // mueva: conciliar solo el total no lo veria.
      const ventaDeCadaItem = await filasDelFile.evaluateAll((trs) =>
        trs.map((tr) => {
          const celdasDeLaFila = Array.from(tr.querySelectorAll('td'))
            .map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim());
          const conNumero = celdasDeLaFila.filter((c) => /^([A-Z]{3}\s*)?\d[\d.,]*$/.test(c));
          return conNumero.at(-1) ?? '';
        }));
      sumaDeLosItems = ventaDeCadaItem
        .map((c) => importe(c).valor ?? 0)
        .reduce((a, b) => a + b, 0);
      await adjuntarTexto('Venta de cada item del file',
        `${ventaDeCadaItem.join(' | ')}   =>  suma ${sumaDeLosItems}`);

      // El importe de cada item del file contra el que mostro el portal.
      for (const [esperado, delPortal] of Object.entries(importePorItemDelPortal)) {
        const filaDelItem = filasDelFile.filter({ hasText: new RegExp(esperado, 'i') }).first();
        const celdasDeEse = (await filaDelItem.locator('td').allInnerTexts())
          .map((c) => c.replace(/\s+/g, ' ').trim());
        const venta = celdasDeEse.filter((c) => soloImporte.test(c)).at(-1) ?? '';
        await conResaltado(page, filaDelItem, `Importe del item ${esperado} en el file`, () => {
          expect(importe(venta).valor,
            `El file tiene que conservar el importe de ${esperado}`)
            .toBe(importeDelPortal(delPortal).valor);
        });
      }

      // Totales del file, que es el numero que despues usa toda la operacion.
      const totales = page.locator('#updFileTotals table')
        .filter({ has: page.locator('th', { hasText: 'USD' }) }).first();
      const celdasTotales = (await totales.locator('tbody tr').first().locator('td')
        .allInnerTexts()).map((c) => c.trim());
      capturar('file (Venta en Totales)', celdasTotales[1] ?? '');
      await adjuntarTexto('Totales USD del file',
        `Costo | Venta | Over | Utilidad => ${celdasTotales.join(' | ')}`);
    });

    await paso(page, 'Conciliar los importes de punta a punta', async () => {
      const cadena = Object.entries(importes)
        .map(([donde, i]) => `${donde.padEnd(28)} ${i.moneda || '(sin moneda)'} ${i.valor ?? '(no se pudo leer)'}`)
        .join('\n');
      await adjuntarTexto('Cadena de importes', cadena);

      const referencia = importes[claveDeReferencia];
      expect(
        referencia?.valor,
        `Tiene que haber un importe de referencia en ${claveDeReferencia}`,
      ).not.toBeNull();

      // La moneda tiene que ser la misma en todo el recorrido: un cruce de
      // monedas entre el portal y el BO no se ve mirando el numero.
      for (const [donde, i] of Object.entries(importes)) {
        if (!i.moneda) continue;
        await conResaltado(page, page.locator('body'), `Moneda en ${donde}`, () => {
          expect(i.moneda, `La moneda tiene que ser la misma en ${donde} que en la ficha`)
            .toBe(referencia.moneda);
        });
      }

      const exigir = async (claves: string[], esperado: number | null | undefined, porque: string) => {
        for (const donde of claves) {
          const i = importes[donde];
          await conResaltado(page, page.locator('body'), `Importe en ${donde}`, () => {
            expect(i?.valor, `El importe en ${donde} tiene que ser ${porque}`).toBe(esperado);
          });
        }
      };

      if (itemUnico) {
        // Con un solo item reservado la cadena se parte en dos, porque el
        // sistema maneja dos numeros distintos y los dos tienen que conservarse.
        //
        // A) El total de venta que vio la persona.
        await exigir(['carrito (total del item)', 'detalle (V. Markup del item)'],
          referencia.valor, 'el total que mostro el portal');

        // B) El historial, la bandeja y el file no llevan ese total sino el
        //    costo neto. No es una transformacion: son dos campos distintos de
        //    la reserva. WholesalerBookItem.TotalRate es el precio de venta (19)
        //    y NetTotalCost el neto (9,50 -> 10). Para las reservas posteriores
        //    al 20/10/2025 LoadWholesalerData se queda con NetTotalCost — el
        //    codigo lo firma como "HU 2839" — y ese llega al BO_FileItem.
        //    Se exige que coincidan con la columna Venta del detalle, que es ese
        //    mismo neto: asi se detecta una regresion sin dar por buena una
        //    regla de negocio que no esta escrita en ninguna historia.
        const neto = importes['detalle (Venta del item)'];
        await exigir(['historial (total)', 'bandeja (columna V)',
                      'file (Venta del item)', 'file (Venta en Totales)'],
          neto?.valor, 'el neto que muestra el detalle');

        await adjuntarTexto('Nota sobre el neto y el total de venta',
          [`Total de venta que vio la persona: ${referencia.moneda} ${referencia.valor}`,
           '  (WholesalerBookItem.TotalRate, y la columna V. Markup del detalle)',
           `Neto que llevan el historial, la bandeja y el file: ${neto?.moneda} ${neto?.valor}`,
           '  (WholesalerBookItem.NetTotalCost redondeado hacia arriba)',
           '',
           'El precio de venta no queda guardado en el file: se calcula al vuelo solo',
           'para mostrarlo en el detalle. Y el file toma su markup del Market de la',
           'agencia, no de la reserva, asi que tampoco se puede recomponer desde ahi.',
           'Queda como consulta para producto: es una decision de negocio.'].join(SALTO));
      } else {
        // Con varios items reservados —una oferta o un multidestino— la
        // comparacion por item no significa nada: la columna Venta de una fila
        // es la de ese producto, no la del viaje. Lo que tiene que conservarse
        // es el total, y ahi la cadena es una sola: el numero que mostro el
        // itinerario llega igual al historial, a la bandeja y a los totales del
        // file. Los importes por item se adjuntan al reporte igual.
        await exigir(['historial (total)', 'bandeja (columna V)', 'file (Venta en Totales)'],
          referencia.valor, 'el total que mostro el itinerario');

        await conResaltado(page, page.locator('body'), 'Suma de los items del file', () => {
          expect(sumaDeLosItems,
            'La suma de las ventas de los items tiene que dar el total del file')
            .toBe(importes['file (Venta en Totales)']?.valor);
        });
      }
    });
  }

  test('Solo servicio: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    // El recorrido cruza dos aplicaciones y 16 pasos con PostBacks lentos: el
    // timeout de la suite, pensado para el tarifario, no alcanza.
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const servicio = new ServicioPage(page);
    const carrito = new CarritoPage(page);
    const bo = new BackOfficePage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda();

    // El dato esperado es este objeto: lo que el test carga es lo que despues
    // tiene que aparecer, identico, en el BO.
    const reserva = {
      servicio: 'AUTO-QA NO TOCAR - Tigre y Delta',
      terminoDeBusqueda: 'Tigre y Delta',
      modalidad: 'Regular',
      fecha: formatearFecha(fecha),
      referencia: `AUTO-QA ${sello}`,
      observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
      detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
      cantidadPax: 0,                        // se toma del minimo que declara la ficha
      pasajeros: [] as Pasajero[],
    };

    /**
     * Importes capturados en cada pantalla del recorrido.
     *
     * No se recalculan: el total no es cantidad por precio unitario. Con 2 pax a
     * USD 10 el portal muestra USD 19, porque el redondeo hacia arriba se aplica
     * sobre el total y no sobre el unitario. Lo que se exige es que el numero
     * que mostro el portal sea el mismo que muestran la reserva, la bandeja y
     * el file: si en algun eslabon cambia, ahi esta el problema.
     */
    // Datos del usuario con el que se reserva. No los carga el test, los pone el
    // sistema a partir de la sesion, pero son parte del contenido de la reserva:
    // si el BO mostrara otra agencia u otro usuario, la reserva llego mal.
    const contexto = {
      agencia: 'AMV. TRAVEL',
      email: (process.env.AMV_USER ?? '').toLowerCase(),
      ciudad: 'Buenos Aires',
      pais: 'Argentina',
    };

    const importes: Record<string, { moneda: string; valor: number | null }> = {};
    const capturar = (donde: string, texto: string) => {
      importes[donde] = importe(texto);
      return importes[donde];
    };
    // Los importes del portal se leen con el otro parser: alla la coma es de miles.
    const capturarDelPortal = (donde: string, texto: string) => {
      importes[donde] = importeDelPortal(texto);
      return importes[donde];
    };

    await paso(page, 'Vaciar el carrito y abrir la solapa SERVICIOS de INICIO', async () => {
      await carrito.vaciar();
      await inicio.abrir();
      const panel = await inicio.abrirSolapa('servicios');
      await expect(panel).toBeVisible();
    });

    await paso(page, 'Buscar excursiones en Buenos Aires para la fecha elegida', async () => {
      const panel = await inicio.abrirSolapa('servicios');
      await servicio.buscar({
        panel, pais: 'Argentina', ciudad: 'Buenos Aires', tipo: 'Excursión', fecha,
      });
      // La fecha viaja en la URL: si el calendario no la tomo, la busqueda sale
      // con la del dia y la reserva quedaria para otro dia sin que se note.
      await expect(page).toHaveURL(new RegExp(`checkin=${reserva.fecha.replace(/\//g, '\\/')}`));
    });

    await paso(page, 'Ubicar el servicio por nombre y entrar a su ficha', async () => {
      // El listado pagina de a 10 con scroll infinito, asi que se usa el
      // buscador por nombre de la propia pantalla. Se exige el nombre completo:
      // buscando solo "Tigre y Delta" el listado ofrece otra excursion.
      await servicio.buscarPorNombre(reserva.terminoDeBusqueda, reserva.servicio);
      await servicio.abrirFicha(reserva.servicio.slice(0, 24));
      await expect(page).toHaveURL(/servicedetail/i);

      // La ficha de reserva no muestra la operatividad — ese calendario vive en
      // la ficha del tarifario (ServiceSheetCalendarHtml), no aca —, asi que el
      // test no puede elegir un dia operable: la persona tampoco lo ve. Lo que
      // si se hace es cortar con el motivo si la fecha no tiene tarifas, en vez
      // de morir mas adelante en un timeout que parece un defecto.
      const filasDeTarifa = page.locator('tr').filter({ has: page.locator("select[id*='ddPax']") });
      await expect(
        filasDeTarifa.first(),
        `La ficha tiene que ofrecer tarifas para el ${reserva.fecha}. Si no las ofrece, ` +
        'revisar la operatividad del servicio y la vigencia de sus tarifas de venta.',
      ).toBeVisible({ timeout: 30_000 });
    });

    await paso(page, 'Elegir la modalidad Regular con la cantidad minima de pax y reservar', async () => {
      const fila = page.locator('tr')
        .filter({ has: page.locator("select[id*='ddPax']") })
        .filter({ hasText: reserva.modalidad }).first();

      // El minimo se lee de la pantalla, no se fija en el test: es lo que ve la
      // persona ("Minimo 2 pasajeros") y lo que la ficha manda a la API.
      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      reserva.cantidadPax = Number(texto.match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
      expect(reserva.cantidadPax, 'La ficha tiene que declarar la cantidad de pax').toBeGreaterThan(0);

      // Precio unitario de la modalidad, tal como lo ve la persona en la fila.
      capturarDelPortal('ficha (precio unitario)', texto.match(/[A-Z]{3}\s*\d[\d.,]*/)?.[0] ?? '');

      await fila.locator("select[id*='ddPax']").selectOption(String(reserva.cantidadPax));
      await esperarFinDeCarga(page);

      // Total que arma la ficha al elegir la cantidad: es el primer importe de
      // la cadena y el que despues tiene que reaparecer en el BO.
      capturarDelPortal('ficha (total)', await page.locator('.sd-total-amount').first().innerText());

      await page.locator("[id$='lnkBookService']").first().click();
      await esperarFinDeCarga(page);

      await expect
        .poll(() => carrito.paxEnElCarrito(), { timeout: 30_000 })
        .toBe(reserva.cantidadPax);

      reserva.pasajeros = Array.from({ length: reserva.cantidadPax }, (_, i) => ({
        nombre: `Pasajero${i + 1}`,
        apellido: `Regresion${sello.slice(-6)}`,
        pasaporte: `QA${sello.slice(-8)}${i + 1}`,
        nacimiento: `0${i + 1}/03/1990`,
        nacionalidad: 'Argentina',
      }));
      await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
    });

    await paso(page, 'Revisar la fila del carrito y pasar a los datos de la reserva', async () => {
      await carrito.irAlCarrito();
      const fila = carrito.filaDelCarrito(reserva.servicio);
      await expect(fila).toBeVisible();

      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      await conResaltado(page, fila, 'Cantidad y modalidad en el carrito', () => {
        expect(texto, 'El carrito tiene que mostrar la cantidad y la modalidad reservadas')
          .toContain(`${reserva.cantidadPax} ${reserva.modalidad}`);
      });
      await conResaltado(page, fila, 'Fecha en el carrito', () => {
        expect(texto, 'El carrito tiene que mostrar la fecha elegida').toContain(reserva.fecha);
      });

      // Ultima celda de la fila: el total del item.
      const celdas = await fila.locator('td').allInnerTexts();
      const conImporte = celdas.filter((c) => /[A-Z]{3}\s*\d[\d.,]*/.test(c));
      capturarDelPortal('carrito (total del item)', conImporte.at(-1) ?? '');
      await conResaltado(page, fila, 'Total del carrito', () => {
        expect(importes['carrito (total del item)'].valor,
          'El total del carrito tiene que ser el que armo la ficha')
          .toBe(importes['ficha (total)'].valor);
      });

      await carrito.crearReserva(reserva.referencia, reserva.observaciones);
    });

    const codigo = await completarCheckoutYEmitir({
      page, carrito, capturar: capturarDelPortal,
      reserva: {
        referencia: reserva.referencia,
        observaciones: reserva.observaciones,
        detalleDelItem: reserva.detalleDelItem,
        cantidadPax: reserva.cantidadPax,
        pasajeros: reserva.pasajeros,
      },
      selectorDetalleDelItem: "[id$='ctrlBookingServiceDetailControl_txtDetail']",
    });

    await verificarEnElBackOffice({
      page, bo, codigo, contexto, importes, capturar,
      reserva: {
        item: reserva.servicio,
        textoEnElBO: 'Tigre y Delta',
        modalidad: reserva.modalidad,
        fecha: reserva.fecha,
        referencia: reserva.referencia,
        observaciones: reserva.observaciones,
        detalleDelItem: reserva.detalleDelItem,
        cantidadPax: reserva.cantidadPax,
        pasajeros: reserva.pasajeros,
      },
    });
  });

  test('Solo hotel: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const hotel = new HotelPage(page);
    const carrito = new CarritoPage(page);
    const bo = new BackOfficePage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const entrada = fechaDeBusqueda();
    const salida = new Date(entrada);
    salida.setDate(salida.getDate() + 1);

    const reserva = {
      hotel: 'AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau',
      hotelId: 5003,
      // Una de las siete habitaciones que tienen tarifa cargada. Las otras tres
      // del hotel (13803, 16832, 17771) no tienen y no se pueden reservar.
      habitacion: 9193,
      modalidad: 'Doble',
      fecha: formatearFecha(entrada),
      fechaDeSalida: formatearFecha(salida),
      referencia: `AUTO-QA ${sello}`,
      observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
      detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
      habitaciones: 1,
      adultos: 2,
      pasajeros: [] as Pasajero[],
    };

    const contexto = {
      agencia: 'AMV. TRAVEL',
      email: (process.env.AMV_USER ?? '').toLowerCase(),
      ciudad: 'Buenos Aires',
      pais: 'Argentina',
    };

    const importes: Record<string, { moneda: string; valor: number | null }> = {};
    const capturar = (donde: string, texto: string) => {
      importes[donde] = importe(texto);
      return importes[donde];
    };
    // Los importes del portal se leen con el otro parser: alla la coma es de miles.
    const capturarDelPortal = (donde: string, texto: string) => {
      importes[donde] = importeDelPortal(texto);
      return importes[donde];
    };

    await paso(page, 'Vaciar el carrito y abrir la solapa HOTELES de INICIO', async () => {
      await carrito.vaciar();
      await inicio.abrir();
      const panel = await inicio.abrirSolapa('hoteles');
      await expect(panel).toBeVisible();
    });

    await paso(page, 'Cargar el hotel, los viajeros y las fechas, y buscar', async () => {
      // El hotel de prueba esta publicado solo para no residentes: si la
      // busqueda saliera como residente no aparece, y el rojo pareceria un
      // defecto. El combo no es visible, asi que se exige su valor por defecto.
      await hotel.verificarResidente();

      // El buscador acepta destinos y hoteles: se elige el hotel directo, que es
      // lo que hace quien ya sabe cual quiere.
      await hotel.elegirHotel(reserva.hotelId, 'Park Hyatt');
      await hotel.cargarViajeros(reserva.habitaciones, reserva.adultos);
      await hotel.elegirFechas(entrada, salida);

      // Las fechas viajan en el campo, no en la URL como en servicios: si el
      // widget no las tomo, la reserva saldria para otro dia sin que se note.
      await expect(
        page.locator(hotel.campoFechas),
        'El calendario tiene que quedar con las fechas elegidas',
      ).toHaveValue(`${reserva.fecha} - ${reserva.fechaDeSalida}`);

      await hotel.buscar();
    });

    await paso(page, 'Entrar a la ficha del hotel y tomar el precio de la habitacion', async () => {
      await hotel.abrirFicha(reserva.hotelId);

      // El tipo de tarifa lo decide el sitio segun la cantidad de adultos: con 2
      // corresponde Doble. Se lee de la ficha en vez de fijarlo en el test.
      const tipo = await hotel.tipoDeTarifa(reserva.habitacion);
      await adjuntarTexto('Tipo de tarifa que eligio la ficha', tipo);

      capturarDelPortal('ficha (total)', `USD ${await hotel.precioDeLaHabitacion(reserva.habitacion)}`);
      expect(
        importes['ficha (total)'].valor,
        'La ficha tiene que mostrar un precio para la habitacion elegida',
      ).not.toBeNull();
    });

    await paso(page, 'Elegir la habitacion y confirmar', async () => {
      await hotel.reservarHabitacion(reserva.habitacion, reserva.habitaciones);

      // El contador del encabezado cuenta habitaciones, no pasajeros: en el
      // flujo de servicio contaba pax.
      await expect
        .poll(() => carrito.paxEnElCarrito(), { timeout: 30_000 })
        .toBe(reserva.habitaciones);

      reserva.pasajeros = Array.from({ length: reserva.adultos }, (_, i) => ({
        nombre: `Pasajero${i + 1}`,
        apellido: `Regresion${sello.slice(-6)}`,
        pasaporte: `QA${sello.slice(-8)}${i + 1}`,
        nacimiento: `0${i + 1}/03/1990`,
        nacionalidad: 'Argentina',
      }));
      await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
    });

    await paso(page, 'Revisar la fila del carrito y pasar a los datos de la reserva', async () => {
      await carrito.irAlCarrito();
      const fila = carrito.filaDelCarrito(reserva.hotel);
      await expect(fila).toBeVisible();

      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      await conResaltado(page, fila, 'Cantidad y tipo de habitacion en el carrito', () => {
        expect(texto, 'El carrito tiene que mostrar la cantidad y el tipo de habitacion reservados')
          .toContain(`${reserva.habitaciones} ${reserva.modalidad}`);
      });
      await conResaltado(page, fila, 'Fechas en el carrito', () => {
        expect(texto, 'El carrito tiene que mostrar la fecha de entrada').toContain(reserva.fecha);
        expect(texto, 'El carrito tiene que mostrar la fecha de salida').toContain(reserva.fechaDeSalida);
      });

      const celdas = await fila.locator('td').allInnerTexts();
      const conImporte = celdas.filter((c) => /[A-Z]{3}\s*\d[\d.,]*/.test(c));
      capturarDelPortal('carrito (total del item)', conImporte.at(-1) ?? '');
      await conResaltado(page, fila, 'Total del carrito', () => {
        expect(importes['carrito (total del item)'].valor,
          'El total del carrito tiene que ser el que mostro la ficha')
          .toBe(importes['ficha (total)'].valor);
      });

      await carrito.crearReserva(reserva.referencia, reserva.observaciones);
    });

    const codigo = await completarCheckoutYEmitir({
      page, carrito, capturar: capturarDelPortal,
      reserva: {
        referencia: reserva.referencia,
        observaciones: reserva.observaciones,
        detalleDelItem: reserva.detalleDelItem,
        cantidadPax: reserva.adultos,
        pasajeros: reserva.pasajeros,
      },
      selectorDetalleDelItem: "[id$='ctrlBookingHotelDetailControl_txtDetail']",
    });

    await verificarEnElBackOffice({
      page, bo, codigo, contexto, importes, capturar,
      reserva: {
        item: reserva.hotel,
        textoEnElBO: 'Park Hyatt',
        modalidad: reserva.modalidad,
        fecha: reserva.fecha,
        fechaDeSalida: reserva.fechaDeSalida,
        referencia: reserva.referencia,
        observaciones: reserva.observaciones,
        detalleDelItem: reserva.detalleDelItem,
        cantidadPax: reserva.adultos,
        pasajeros: reserva.pasajeros,
      },
    });
  });


  test('Solo oferta: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const ct = new CustomToursPage(page);
    const carrito = new CarritoCustomToursPage(page);
    const bo = new BackOfficePage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda();

    const reserva = {
      oferta: 'AUTO-QA NO TOCAR - Oferta Buenos Aires y Ushuaia (6 días / 5 noches)',
      ofertaId: '5060',
      // El ESTADO.md lo avisa: cruceros y ofertas se listan bajo Ushuaia.
      ciudad: 'Ushuaia',
      hotelDelPaquete: 'AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau',
      // El BO escribe la habitacion abreviada: la grilla muestra "1 DBL".
      modalidad: 'DBL',
      fecha: formatearFecha(fecha),
      referencia: `AUTO-QA ${sello}`,
      observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
      detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
      cantidadPax: 2,
      dobles: 1,
      fechaDeSalida: '',
      // Los cuatro items que compone la oferta, todos candidatos AUTO-QA. Si se
      // pierde cualquiera en el camino al file, el test lo marca.
      items: ['Park Hyatt', 'Tigre y Delta', 'Angelitos', 'Arakur'],
      importePorItem: {} as Record<string, string>,
      pasajeros: [] as Pasajero[],
    };

    const contexto = {
      agencia: 'AMV. TRAVEL',
      email: (process.env.AMV_USER ?? '').toLowerCase(),
      ciudad: 'Buenos Aires',
      pais: 'Argentina',
    };

    const importes: Record<string, { moneda: string; valor: number | null }> = {};
    const capturar = (donde: string, texto: string) => {
      importes[donde] = importe(texto);
      return importes[donde];
    };
    const capturarDelPortal = (donde: string, texto: string) => {
      importes[donde] = importeDelPortal(texto);
      return importes[donde];
    };

    await paso(page, 'Abrir la solapa OFERTAS de INICIO y elegir la oferta', async () => {
      const panel = await inicio.abrirSolapa('ofertas');
      await expect(panel).toBeVisible();
      await ct.buscarOferta(panel, {
        pais: 'Argentina', ciudad: reserva.ciudad, ofertaId: reserva.ofertaId,
      });
      // Eligiendo una oferta concreta se entra directo al armado; con "Todos"
      // se iria al listado.
      await expect(page).toHaveURL(new RegExp(`tour=${reserva.ofertaId}`));
    });

    await paso(page, 'Cargar la fecha de inicio, los pax y las habitaciones', async () => {
      await ct.configurarViaje(fecha, reserva.cantidadPax, reserva.dobles);

      // El calendario de esta pantalla es otro widget que el de los demas
      // flujos: si no tomo la fecha, el viaje se arma para otro dia.
      await expect(
        page.locator(ct.campoFecha),
        'El armado tiene que quedar con la fecha de inicio elegida',
      ).toHaveValue(reserva.fecha);
      await expect(page.locator(ct.comboPax)).toHaveValue(String(reserva.cantidadPax));

      // La salida del primer destino sale de las noches que define la oferta, no
      // de un numero fijo en el test.
      const noches = await ct.nochesDelDestino(0);
      const salida = new Date(fecha);
      salida.setDate(salida.getDate() + noches);
      reserva.fechaDeSalida = formatearFecha(salida);
      await adjuntarTexto('Noches del primer destino y fecha de salida',
        noches + ' noches -> ' + reserva.fechaDeSalida);
    });

    await paso(page, 'Revisar el itinerario y tomar su total', async () => {
      await ct.irAlItinerario();

      const celdas = await ct.filaDeTotales();
      await adjuntarTexto('Fila de totales del itinerario',
        `Hotel | SGL | DBL | TPL | Servicios | Total => ${celdas.join(' | ')}`);

      const fila = ct.tablaDeTotales();
      await conResaltado(page, fila, 'Hotel del paquete en el itinerario', () => {
        expect(celdas.join(' | '), 'El itinerario tiene que armarse con el hotel del paquete')
          .toContain('Park Hyatt');
      });

      // El total es la ultima celda con importe. Se verifica ademas que sea la
      // suma de la habitacion mas los servicios, que es lo que la propia fila
      // muestra: asi no se reimplementa ningun calculo, se comprueba el de ella.
      const conImporte = celdas.filter((c) => /[A-Z]{3}\s*\d[\d.,]*/.test(c));
      capturarDelPortal('itinerario (total)', conImporte.at(-1) ?? '');
      const habitacion = importeDelPortal(conImporte.at(-3) ?? '').valor;
      const servicios = importeDelPortal(conImporte.at(-2) ?? '').valor;

      await conResaltado(page, fila, 'Total del itinerario', () => {
        expect(importes['itinerario (total)'].valor,
          'El total del itinerario tiene que ser la habitacion mas los servicios')
          .toBe((habitacion ?? 0) + (servicios ?? 0));
      });
    });

    await paso(page, 'Continuar al carrito y revisar que conserve el total', async () => {
      await ct.continuarAlCarrito();

      const delCarrito = await carrito.importes();
      await adjuntarTexto('Importes del carrito de circuitos', delCarrito.join(' | '));

      // Importe de cada item, para exigirselo despues al BO uno por uno.
      reserva.importePorItem = await carrito.importePorItem(reserva.items);
      await adjuntarTexto('Importe de cada item en el carrito',
        Object.entries(reserva.importePorItem).map(([k, v]) => k + ": " + v).join(SALTO));
      for (const [item, valor] of Object.entries(reserva.importePorItem)) {
        expect(valor, "El carrito tiene que mostrar el importe del item " + item).not.toBe("");
      }
      capturarDelPortal('carrito (total del item)', delCarrito.at(-1) ?? '');

      await conResaltado(page, page.locator('body'), 'Total del carrito', () => {
        expect(importes['carrito (total del item)'].valor,
          'El carrito tiene que conservar el total que mostro el itinerario')
          .toBe(importes['itinerario (total)'].valor);
      });

      reserva.pasajeros = Array.from({ length: reserva.cantidadPax }, (_, i) => ({
        nombre: `Pasajero${i + 1}`,
        apellido: `Regresion${sello.slice(-6)}`,
        pasaporte: `QA${sello.slice(-8)}${i + 1}`,
        nacimiento: `0${i + 1}/03/1990`,
        nacionalidad: 'Argentina',
      }));
      await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
    });

    let codigo = '';
    await paso(page, 'Cargar los pasajeros y emitir la reserva', async () => {
      await carrito.asegurarPasajeros(reserva.cantidadPax);
      for (const [i, pax] of reserva.pasajeros.entries()) await carrito.completarPasajero(i, pax);
      await carrito.completarComentarioDelItem(reserva.detalleDelItem);
      await carrito.completarDatosDeLaReserva(reserva.referencia, reserva.observaciones);
      await carrito.aceptarTerminos();

      codigo = await carrito.confirmarReserva();
      await adjuntarTexto('Codigo de la reserva emitida', codigo);
      expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
        .toMatch(/^BO\d{8}$/);

      const filaHistorial = page.locator('tr').filter({ hasText: codigo }).first();
      const deLaFila = ((await filaHistorial.innerText()).match(/[A-Z]{3}\s*\d[\d.,]*/g) ?? []);
      capturarDelPortal('historial (total)', deLaFila.at(-1) ?? '');
      await adjuntarTexto('Importes de la fila del historial', deLaFila.join(' | '));
    });

    await verificarEnElBackOffice({
      page, bo, codigo, contexto, importes, capturar,
      claveDeReferencia: 'itinerario (total)',
      // En circuitos el comentario del item va a CT_Service.Comment, que se
      // imprime junto al nombre del alojamiento y no en el p.pdiscl del otro riel.
      selectorDelComentario: 'td:has(h6:has-text("Park Hyatt")) p strong',
      modalidadEnElFile: 'DOBLE',
      itemUnico: false,
      itemsEsperados: reserva.items,
      importePorItemDelPortal: reserva.importePorItem,
      reserva: {
        item: reserva.oferta,
        textoEnElBO: 'Park Hyatt',
        modalidad: reserva.modalidad,
        fecha: reserva.fecha,
        fechaDeSalida: reserva.fechaDeSalida,
        referencia: reserva.referencia,
        observaciones: reserva.observaciones,
        detalleDelItem: reserva.detalleDelItem,
        cantidadPax: reserva.cantidadPax,
        pasajeros: reserva.pasajeros,
      },
    });
  });

});
