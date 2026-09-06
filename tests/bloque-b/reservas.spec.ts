import { test, expect, Page, Locator } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage, Pasajero } from '../../pages/carrito.page';
import { BackOfficePage } from '../../pages/backoffice.page';
import { HotelPage } from '../../pages/hotel.page';
import { CustomToursPage } from '../../pages/customtours.page';
import { CarritoCustomToursPage } from '../../pages/carrito-customtours.page';
import { SeriePage } from '../../pages/serie.page';
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
    // La reserva de una serie no tiene donde cargar referencia, observaciones ni
    // comentario por item: el asistente no ofrece esos campos y el codigo guarda
    // la reserva con Reference y Comment en blanco. Exigirlos ahi seria exigir un
    // dato que nadie pudo cargar.
    sinReferenciaNiComentario?: boolean;
  }) {
    const { page, bo, codigo, reserva, contexto, importes, capturar } = opciones;
    const claveDeReferencia = opciones.claveDeReferencia ?? 'ficha (total)';
    const selectorDelComentario = opciones.selectorDelComentario ?? 'p.pdiscl';
    const modalidadEnElFile = opciones.modalidadEnElFile ?? reserva.modalidad;
    const itemUnico = opciones.itemUnico ?? true;
    const itemsEsperados = opciones.itemsEsperados ?? [reserva.textoEnElBO];
    const importePorItemDelPortal = opciones.importePorItemDelPortal ?? {};
    const sinReferenciaNiComentario = opciones.sinReferenciaNiComentario ?? false;
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
      if (sinReferenciaNiComentario) return;

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
      if (!sinReferenciaNiComentario) {
        await conResaltado(page, fila, 'Referencia en la bandeja', () => {
          expect(texto, 'La bandeja tiene que mostrar la referencia cargada en el portal')
            .toContain(reserva.referencia);
        });
      }
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
        ...(sinReferenciaNiComentario ? {} : {
          txtCustomerReference: reserva.referencia,
          txtComment: reserva.observaciones,
        }),
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

      // El ojito de cada item de servicio tiene que venir habilitado: es lo que
      // deja el item visible en SIX. Si viniera tachado seria en rojo —oculto—
      // o en gris —la agencia sin SIX habilitado—, y las dos cosas importan.
      const ojitos = await bo.estadoDelOjito();
      await adjuntarTexto('Estado del ojito por item',
        ojitos.map((o) => `${o.estado.padEnd(18)} ${o.detalle}`).join(SALTO));
      for (const { detalle, estado } of ojitos) {
        await conResaltado(page, filasDelFile.filter({ hasText: detalle }).first(),
          `Ojito del item ${detalle}`, () => {
            expect(estado, `El item ${detalle} tiene que venir habilitado para SIX`)
              .toBe('habilitado');
          });
      }

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

  /**
   * Recorrido del portal por el riel de CustomTours, del buscador a la emision.
   *
   * Lo comparten la oferta y el multidestino: cambia la solapa de INICIO, la
   * ciudad y el combo donde se elige el viaje, no lo que hay que hacer despues.
   * Devuelve el codigo BOxxxxxxxx de la reserva emitida.
   */
  async function armarCircuitoYEmitir(opciones: {
    page: Page; inicio: InicioPage; ct: CustomToursPage; carrito: CarritoCustomToursPage;
    viaje: { solapa: 'ofertas' | 'multidestino'; ciudad: string; id: string; combo: string };
    reserva: {
      cantidadPax: number; dobles: number; fecha: string; fechaDeSalida: string;
      referencia: string; observaciones: string; detalleDelItem: string;
      items: string[]; importePorItem: Record<string, string>; pasajeros: Pasajero[];
    };
    fecha: Date;
    sello: string;
    importes: Record<string, { moneda: string; valor: number | null }>;
    capturarDelPortal: (donde: string, texto: string) => { moneda: string; valor: number | null };
  }): Promise<string> {
    const { page, inicio, ct, carrito, viaje, reserva, fecha, sello, importes, capturarDelPortal } = opciones;
    let codigo = '';
    await paso(page, `Abrir la solapa ${viaje.solapa.toUpperCase()} de INICIO y elegir el viaje`, async () => {
      const panel = await inicio.abrirSolapa(viaje.solapa);
      await expect(panel).toBeVisible();
      await ct.buscarViaje(panel, {
        pais: 'Argentina', ciudad: viaje.ciudad, id: viaje.id, combo: viaje.combo,
      });
      // Eligiendo una oferta concreta se entra directo al armado; con "Todos"
      // se iria al listado.
      await expect(page).toHaveURL(new RegExp(`tour=${viaje.id}`));
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
    return codigo;
  }

  test('Servicio: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
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

  test('Hotel: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
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


  test('Oferta: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
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

    const codigo = await armarCircuitoYEmitir({
      page, inicio, ct, carrito, reserva, fecha, sello, importes, capturarDelPortal,
      viaje: { solapa: 'ofertas', ciudad: reserva.ciudad, id: reserva.ofertaId, combo: 'ddSelectedOpportunity' },
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


  test('Multidestino: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const ct = new CustomToursPage(page);
    const carrito = new CarritoCustomToursPage(page);
    const bo = new BackOfficePage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda();

    const reserva = {
      paquete: 'AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)',
      paqueteId: '5059',
      // El paquete se lista bajo Buenos Aires; la oferta, bajo Ushuaia.
      ciudad: 'Buenos Aires',
      modalidad: 'DBL',
      fecha: formatearFecha(fecha),
      fechaDeSalida: '',
      referencia: `AUTO-QA ${sello}`,
      observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
      detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
      cantidadPax: 2,
      dobles: 1,
      // El paquete se compone de los mismos cuatro candidatos AUTO-QA que la
      // oferta, con otras tarifas: aca Tigre y Delta entra a USD 42 y en la
      // oferta a USD 418, porque cambia la modalidad.
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

    const codigo = await armarCircuitoYEmitir({
      page, inicio, ct, carrito, reserva, fecha, sello, importes, capturarDelPortal,
      viaje: {
        solapa: 'multidestino',
        ciudad: reserva.ciudad,
        id: reserva.paqueteId,
        combo: 'ddSelectedTour',
      },
    });

    await verificarEnElBackOffice({
      page, bo, codigo, contexto, importes, capturar,
      claveDeReferencia: 'itinerario (total)',
      selectorDelComentario: 'td:has(h6:has-text("Park Hyatt")) p strong',
      modalidadEnElFile: 'DOBLE',
      itemUnico: false,
      itemsEsperados: reserva.items,
      importePorItemDelPortal: reserva.importePorItem,
      reserva: {
        item: reserva.paquete,
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

  /**
   * Datos AUTO-QA de la serie, creados por SQL para este test.
   *
   *   Serie 19          AUTO-QA NO TOCAR - Serie de regresion
   *   Circuito 5061     Buenos Aires, 2 noches, 52 salidas semanales desde el
   *                     05/10/2026, cupo 200 por salida y grupo
   *   Categorias        Superior, Primera, Lujo y Estandar
   *   Items propios     dos servicios y cuatro habitaciones marcadas IsSerie
   *
   * Se armo aparte y no sobre una serie de QA por lo mismo que el resto de los
   * datos del bloque: reservar consume cupo (`SerieQuotaManager.UseQuota` resta
   * una unidad por habitacion), asi que correr la regresion contra una serie real
   * le sacaria lugar a la operacion.
   */
  const SERIE = {
    nombre: 'AUTO-QA NO TOCAR - Serie de regresion',
    circuito: 'AUTO-QA NO TOCAR - Serie: Buenos Aires (3 dias / 2 noches)',
    categoria: 'Primera',
    // La que usa el caso de cambio de categoria: tiene que ser otra de la lista.
    otraCategoria: 'Lujo',
    categoriasEsperadas: ['Superior', 'Primera', 'Lujo', 'Estandar'],
    noches: 2,
    /**
     * Dos salidas del final del calendario, preparadas por SQL con el cupo bajo.
     *
     * Estan en 2027 a proposito: el flujo que emite toma siempre la primera salida
     * del calendario (05/10/2026), asi que nunca las toca. Las cuatro categorias
     * tienen el mismo cupo en esas fechas, para que el caso no dependa de cual se
     * elija.
     *
     *   20/09/2027  cupo 3  -> aviso de pocos cupos, y la cuarta habitacion choca
     *                          contra el cupo agotado
     *   27/09/2027  cupo 0  -> la salida se dibuja sin tarifa y elegirla muestra el
     *                          cartel de consultar por email
     */
    salidaConCupoBajo: '2027-09-20',
    cupoBajo: 3,
    salidaSinCupo: '2027-09-27',
    // Lo que la reserva tiene que generar: el alojamiento de la categoria elegida
    // y los dos servicios propios de la serie, uno por dia.
    items: [
      'Park Hyatt',
      'Serie: traslado de llegada',
      'Serie: city tour',
    ],
  };

  test('Serie: la reserva emitida conserva los datos en el BackOffice', async ({ page }) => {
    test.setTimeout(900_000);

    const serie = new SeriePage(page);
    const bo = new BackOfficePage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

    /**
     * Dos habitaciones, y una de ellas **con un menor**.
     *
     * Con una sola habitacion de adultos no se ejercitaria ni el agrupamiento por
     * habitacion —la reserva arma un grupo por cada una— ni el recargo del menor.
     * Las dos son dobles a proposito: asi las dos filas del file dicen DOBLE y la
     * comparacion de la modalidad no depende de cual fila se mire primero.
     */
    const reserva = {
      fecha: '',
      fechaDeSalida: '',
      cantidadPax: 5,          // 4 adultos + 1 menor
      habitaciones: 2,
      edadDelMenor: 8,
      tarifaDeLaSalida: 0,
      cupoAntes: 0,
      urlDelAsistente: '',
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
    // El asistente escribe los importes con `toLocaleString('es-AR')` —punto de
    // miles—, pero el historial los escribe con `ToMoney()`, que usa la coma para
    // los miles. Es el mismo formato invertido que ya tienen la oferta y el
    // multidestino, y necesita el otro parser.
    const capturarDelPortal = (donde: string, texto: string) => {
      importes[donde] = importeDelPortal(texto);
      return importes[donde];
    };

    await paso(page, 'Abrir el listado de series y entrar a la serie de regresion', async () => {
      // Al listado se entra por URL: INICIO no tiene solapa de series y el menu
      // del encabezado no lo enlaza. Los otros cuatro flujos entran por INICIO
      // porque ahi si hay puerta.
      await serie.abrirListado();
      const series = await serie.seriesDelListado();
      await adjuntarTexto('Series del listado', series.join(SALTO));

      await conResaltado(page, page.locator('.serie-grid'), 'Serie en el listado', () => {
        expect(series.join(' | '), 'El listado tiene que ofrecer la serie de regresion')
          .toContain(SERIE.nombre);
      });

      await serie.abrirSerie(SERIE.nombre);
      const circuitos = await serie.circuitosDeLaSerie();
      await adjuntarTexto('Circuitos de la serie', circuitos.join(SALTO));
      await conResaltado(page, page.locator('body'), 'Circuito de la serie', () => {
        expect(circuitos.join(' | '), 'La serie tiene que ofrecer su circuito')
          .toContain(SERIE.circuito);
      });

      // El "Desde" de la card es lo primero que ve la persona: si sale en cero o
      // vacio, la serie parece sin tarifa aunque tenga salidas cargadas.
      const desde = await serie.precioDesde(SERIE.circuito);
      await adjuntarTexto('Precio "Desde" de la card', desde);
      await conResaltado(page, page.locator('.sd-tour-card').first(), 'Precio desde', () => {
        expect(importe(desde).valor, 'La card del circuito tiene que mostrar un precio "Desde"')
          .toBeGreaterThan(0);
      });
    });

    await paso(page, 'Abrir el asistente y verificar las categorias de hoteleria', async () => {
      await serie.abrirCircuito(SERIE.circuito);
      reserva.urlDelAsistente = page.url();

      await conResaltado(page, page.locator('body'), 'Circuito con disponibilidad', async () => {
        await expect(
          page.locator(serie.sinDisponibilidad),
          'El circuito tiene salidas, tarifas y cupo cargados: no puede abrir sin disponibilidad',
        ).toBeHidden({ timeout: 15_000 });
      });

      await conResaltado(page, page.locator('.wizard-steps'), 'Paso inicial del asistente', async () => {
        expect(await serie.pasoActual(), 'El asistente tiene que abrir en el paso de disponibilidad')
          .toBe('Disponibilidad');
      });

      const categorias = await serie.categorias();
      await adjuntarTexto('Categorias de hoteleria', categorias.join(' | '));
      await conResaltado(page, page.locator('.cat-card'), 'Categorias ofrecidas', () => {
        for (const esperada of SERIE.categoriasEsperadas) {
          expect(categorias, `El asistente tiene que ofrecer la categoria ${esperada}`)
            .toContain(esperada);
        }
      });
    });

    await paso(page, 'Elegir la categoria y una salida del calendario', async () => {
      await serie.elegirCategoria(SERIE.categoria);
      await conResaltado(page, page.locator('.cat-card'), 'Categoria elegida', async () => {
        expect(await serie.categoriaElegida(), 'El combo tiene que quedar con la categoria elegida')
          .toContain(SERIE.categoria);
      });

      const mes = await serie.mesDelCalendario();
      const salidas = await serie.salidasDelMes();
      await adjuntarTexto('Salidas del mes que abre el calendario',
        `${mes}: ${salidas.map((s) => `${s.clave} = ${s.tarifa}`).join(' | ')}`);

      const elegida = await serie.elegirPrimeraSalida();
      reserva.fecha = elegida.fecha;
      reserva.tarifaDeLaSalida = elegida.tarifa;

      // La fecha de regreso sale de las noches que declara el circuito, no de un
      // numero fijo en el test.
      const [dd, mm, anio] = elegida.fecha.split('/').map(Number);
      const salida = new Date(anio, mm - 1, dd + SERIE.noches);
      reserva.fechaDeSalida = formatearFecha(salida);
      await adjuntarTexto('Salida elegida',
        `${elegida.fecha} (${elegida.clave}) en ${elegida.mes}, tarifa ${elegida.tarifa}, ` +
        `regreso ${reserva.fechaDeSalida}`);

      // El asistente escribe la fecha **sin ceros a la izquierda** ("5/10/2026"):
      // `serieTourFormatDate` la arma con parseInt. El resumen de confirmacion del
      // ultimo paso, en cambio, la arma en el servidor con dd/MM/yyyy y si los
      // lleva. Son dos formatos de la misma fecha, y hay que exigir cada uno donde
      // corresponde.
      await conResaltado(page, page.locator('#divSelectedInfo'), 'Fecha seleccionada', async () => {
        expect(
          (await page.locator(serie.fechaElegida).innerText()).replace(/\s+/g, ' ').trim(),
          'El asistente tiene que mostrar la salida elegida como fecha seleccionada',
        ).toBe(sinCeros(elegida.fecha));
      });

      capturar('asistente (tarifa de la habitacion)',
        (await page.locator(serie.tarifaElegida).innerText()).trim());

      // Cupo de esa salida antes de reservar. Al final se vuelve a leer: tiene que
      // haber bajado una unidad por habitacion reservada.
      const { cupos } = await serie.datosDelCalendario();
      reserva.cupoAntes = cupos[elegida.clave] ?? 0;
      await adjuntarTexto('Cupo de la salida antes de reservar',
        `${elegida.clave}: ${reserva.cupoAntes}`);
      await conResaltado(page, page.locator('.scal-card'), 'Cupo disponible', () => {
        expect(reserva.cupoAntes,
          'La salida elegida tiene que tener cupo suficiente para las habitaciones a reservar')
          .toBeGreaterThanOrEqual(reserva.habitaciones);
      });
    });

    await paso(page, 'Agregar las dos habitaciones y verificar el resumen', async () => {
      await serie.configurarOcupacion({ adultos: 2 });
      await serie.agregarHabitacion();
      await serie.configurarOcupacion({ adultos: 2, menores: 1, edades: [reserva.edadDelMenor] });
      await serie.agregarHabitacion();

      const habitaciones = await serie.habitacionesDelResumen();
      await adjuntarTexto('Habitaciones agregadas', habitaciones.join(SALTO));
      await conResaltado(page, page.locator('#summaryFilled'), 'Habitaciones agregadas', () => {
        expect(habitaciones.length, 'El resumen tiene que mostrar las dos habitaciones agregadas')
          .toBe(reserva.habitaciones);
        for (const [i, linea] of habitaciones.entries()) {
          expect(linea.toUpperCase(),
            `Con dos adultos, la habitacion ${i + 1} tiene que quedar como doble`)
            .toContain('DOBLE');
        }
        expect(habitaciones[1],
          'La segunda habitacion tiene que mostrar que lleva un menor')
          .toMatch(/menor|1\s*ni/i);
      });

      // El recargo del menor: las dos habitaciones tienen la misma ocupacion de
      // adultos, asi que la diferencia entre sus totales tiene que ser exactamente
      // la tarifa de menor de esa salida por los menores con cargo. Con
      // `freeMaxAge` en cero no hay gratuidad: el menor paga si hay tarifa
      // cargada, y si no hay tarifa de menor la diferencia tiene que ser cero.
      const { tarifasDeMenor, politicaDeMenores } = await serie.datosDelCalendario();
      const tarifaDeMenor = tarifasDeMenor[reserva.fecha.split('/').reverse().join('-')] ?? 0;
      const conCargo = politicaDeMenores.freeMaxAge > 0
        && reserva.edadDelMenor <= politicaDeMenores.freeMaxAge ? 0 : 1;
      const totales = (await serie.totalesPorHabitacion()).map((t) => importe(t).valor ?? 0);
      await adjuntarTexto('Totales por habitacion y tarifa de menor',
        [`totales: ${totales.join(' | ')}`,
         `tarifa de menor de la salida: ${tarifaDeMenor}`,
         `politica de menores: ${JSON.stringify(politicaDeMenores)}`,
         `menores con cargo: ${conCargo}`].join(SALTO));

      await conResaltado(page, page.locator('#summaryFilled'), 'Recargo del menor', () => {
        expect(totales.length, 'Tiene que haber un total por habitacion')
          .toBe(reserva.habitaciones);
        expect(totales[1] - totales[0],
          'Con la misma ocupacion de adultos, la diferencia entre las dos habitaciones ' +
          'tiene que ser la tarifa de menor de esa salida por los menores con cargo')
          .toBe(conCargo * tarifaDeMenor);
      });

      const resumen = await serie.resumen();
      await adjuntarTexto('Resumen del paso 1',
        Object.entries(resumen).map(([k, v]) => `${k}: ${v}`).join(SALTO));

      await conResaltado(page, page.locator('#summaryCard'), 'Datos del resumen', () => {
        expect(resumen.categoria, 'El resumen tiene que mostrar la categoria elegida')
          .toContain(SERIE.categoria);
        expect(resumen.fecha, 'El resumen tiene que mostrar la fecha de salida elegida')
          .toContain(sinCeros(reserva.fecha));
        // El resumen no escribe el total de pasajeros sino su composicion:
        // "4 adultos . 1 menor". Se exigen las dos partes.
        expect(resumen.pasajeros, 'El resumen tiene que mostrar la cantidad de adultos')
          .toContain('4 adulto');
        expect(resumen.pasajeros, 'El resumen tiene que mostrar el menor de la segunda habitacion')
          .toContain('1 menor');
      });

      capturar('asistente (total)', `USD ${resumen.total}`);
      const sumaDeLasHabitaciones = (await serie.totalesPorHabitacion())
        .map((t) => importe(t).valor ?? 0).reduce((a, b) => a + b, 0);
      await conResaltado(page, page.locator('#summaryCard'), 'Total del resumen', () => {
        expect(importes['asistente (total)'].valor,
          'El total tiene que ser la suma de los totales de cada habitacion')
          .toBe(sumaDeLasHabitaciones);
      });
    });

    await paso(page, 'Avanzar al paso de pasajeros y cargarlos', async () => {
      await serie.siguiente();
      await conResaltado(page, page.locator('.wizard-steps'), 'Paso de pasajeros', async () => {
        expect(await serie.errorDelPasoActual(),
          'Con fecha y habitacion cargadas el asistente no tiene que rechazar el paso').toBe('');
        expect(await serie.pasoActual(), 'El asistente tiene que avanzar al paso de pasajeros')
          .toBe('Pasajeros');
      });

      const titulos = await serie.titulosDeLasHabitaciones();
      const ocupantesPorHabitacion = [
        await serie.ocupantesDeLaHabitacion(0),
        await serie.ocupantesDeLaHabitacion(1),
      ];
      await adjuntarTexto('Bloques de pasajeros',
        `${titulos.join(' | ')}${SALTO}` +
        ocupantesPorHabitacion.map((o, i) => `Habitacion ${i + 1}: ${o.join(' | ')}`).join(SALTO));

      await conResaltado(page, page.locator(serie.bloqueDePasajeros).first(), 'Formularios de pasajeros', () => {
        expect(titulos.length, 'Tiene que haber un bloque por habitacion agregada')
          .toBe(reserva.habitaciones);
        expect(ocupantesPorHabitacion[0].length,
          'La primera habitacion tiene que pedir los datos de sus dos adultos').toBe(2);
        expect(ocupantesPorHabitacion[1].length,
          'La segunda habitacion tiene que pedir los datos de sus dos adultos y el menor').toBe(3);
        // El menor va **despues** de los adultos y la pantalla lo distingue: si se
        // mezclara el orden, la validacion de la edad compararia contra otro pasajero.
        expect(ocupantesPorHabitacion[1].at(-1)!.toUpperCase(),
          'El ultimo ocupante de la segunda habitacion tiene que ser el menor')
          .toContain('MENOR');
      });

      /**
       * La fecha de nacimiento del menor se calcula **contra la fecha de salida**,
       * que es lo que hace el asistente al validar. Poner un anio fijo dejaria el
       * test dependiendo del dia en que se corre.
       */
      const [dd, mm, anio] = reserva.fecha.split('/').map(Number);
      const nacimientoDelMenor = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/` +
        `${anio - reserva.edadDelMenor}`;

      reserva.pasajeros = Array.from({ length: reserva.cantidadPax }, (_, i) => ({
        nombre: `Pasajero${i + 1}`,
        apellido: `Regresion${sello.slice(-6)}`,
        pasaporte: `QA${sello.slice(-8)}${i + 1}`,
        nacimiento: i === reserva.cantidadPax - 1 ? nacimientoDelMenor : `0${i + 1}/03/1990`,
        nacionalidad: 'Argentina',
      }));

      // Los pasajeros se reparten por habitacion en el mismo orden en que se
      // cargaron las habitaciones: dos en la primera y tres en la segunda.
      const porHabitacion = [reserva.pasajeros.slice(0, 2), reserva.pasajeros.slice(2)];
      for (const [h, lista] of porHabitacion.entries()) {
        for (const [i, pax] of lista.entries()) await serie.completarPasajero(h, i, pax);
      }
      await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
    });

    await paso(page, 'Avanzar al resumen y verificar lo que se va a confirmar', async () => {
      await serie.siguiente();
      await conResaltado(page, page.locator('.wizard-steps'), 'Paso de resumen', async () => {
        expect(await serie.errorDelPasoActual(),
          'Con los pasajeros completos el asistente no tiene que rechazar el paso').toBe('');
        expect(await serie.pasoActual(), 'El asistente tiene que avanzar al resumen').toBe('Resumen');
      });

      const resumenFinal = await serie.textoDelResumenFinal();
      await adjuntarTexto('Resumen de confirmacion', resumenFinal);

      await conResaltado(page, page.locator('.step4-section').first(), 'Resumen de confirmacion', () => {
        expect(resumenFinal, 'El resumen tiene que nombrar el circuito reservado')
          .toContain(SERIE.circuito);
        expect(resumenFinal, 'El resumen tiene que mostrar la fecha de salida elegida')
          .toContain(reserva.fecha);
        expect(resumenFinal, 'El resumen tiene que mostrar la categoria elegida')
          .toContain(SERIE.categoria);
        for (const pax of reserva.pasajeros) {
          expect(resumenFinal, `El resumen tiene que mostrar al pasajero ${pax.nombre}`)
            .toContain(`${pax.nombre} ${pax.apellido}`);
          expect(resumenFinal, `El resumen tiene que mostrar el pasaporte de ${pax.nombre}`)
            .toContain(pax.pasaporte);
          expect(resumenFinal, `El resumen tiene que mostrar la fecha de nacimiento de ${pax.nombre}`)
            .toContain(pax.nacimiento);
        }
      });

      // El total no puede cambiar entre el paso 1 y la confirmacion: es el
      // numero con el que la persona decide.
      const resumen = await serie.resumen();
      capturar('resumen final (total)', `USD ${resumen.total}`);
      await conResaltado(page, page.locator('#summaryCard'), 'Total en el resumen final', () => {
        expect(importes['resumen final (total)'].valor,
          'El total del resumen tiene que ser el mismo que mostro el paso de disponibilidad')
          .toBe(importes['asistente (total)'].valor);
      });
    });

    let codigo = '';
    await paso(page, 'Aceptar los terminos, confirmar y tomar el codigo del historial', async () => {
      // Sin tildar los terminos el boton de finalizar esta deshabilitado: es la
      // unica barrera antes de emitir.
      await conResaltado(page, page.locator('.terms-panel'), 'Finalizar deshabilitado sin terminos', async () => {
        await expect(
          page.locator(serie.botonSiguiente).first(),
          'Sin aceptar los terminos, el boton de finalizar tiene que estar deshabilitado',
        ).toBeDisabled();
      });

      await serie.aceptarTerminos();
      codigo = await serie.confirmarReserva();
      await adjuntarTexto('Codigo de la reserva emitida', codigo);
      expect(codigo, 'El historial tiene que mostrar el codigo de la reserva emitida')
        .toMatch(/^BO\d{8}$/);

      const filaHistorial = page.locator('#tabCustomTour tr').filter({ hasText: codigo }).first();
      const deLaFila = ((await filaHistorial.innerText()).match(/[A-Z]{3}\s*\d[\d.,]*/g) ?? []);
      capturarDelPortal('historial (total)', deLaFila.at(-1) ?? '');
      await adjuntarTexto('Importes de la fila del historial', deLaFila.join(' | '));
    });


    await paso(page, 'Verificar que la reserva consumio el cupo de la salida', async () => {
      // `SerieQuotaManager.UseQuota` resta una unidad por habitacion. El asistente
      // publica el cupo disponible por fecha en `liveCupos`, asi que se comprueba
      // desde la misma pantalla, sin mirar la base. El cupo es por categoria, asi
      // que hay que volver a elegir la misma.
      await page.goto(reserva.urlDelAsistente);
      await esperarFinDeCarga(page);
      await page.waitForTimeout(2_000);
      await serie.elegirCategoria(SERIE.categoria);

      const { cupos } = await serie.datosDelCalendario();
      const clave = reserva.fecha.split('/').reverse().join('-');
      const cupoDespues = cupos[clave] ?? 0;
      await adjuntarTexto('Cupo de la salida despues de reservar',
        `${clave}: antes ${reserva.cupoAntes} -> despues ${cupoDespues}`);

      await conResaltado(page, page.locator('.scal-card'), 'Consumo de cupo', () => {
        expect(cupoDespues,
          `La reserva de ${reserva.habitaciones} habitaciones tiene que descontar ` +
          `${reserva.habitaciones} unidades del cupo de la salida`)
          .toBe(reserva.cupoAntes - reserva.habitaciones);
      });

      // El tramo del BackOffice arranca desde el historial: hay que volver ahi.
      await serie.abrirHistorialDeCircuitos();
    });

    await verificarEnElBackOffice({
      page, bo, codigo, contexto, importes, capturar,
      claveDeReferencia: 'asistente (total)',
      modalidadEnElFile: 'DOBLE',
      itemUnico: false,
      sinReferenciaNiComentario: true,
      itemsEsperados: SERIE.items,
      reserva: {
        item: SERIE.circuito,
        textoEnElBO: 'Park Hyatt',
        modalidad: 'DBL',
        fecha: reserva.fecha,
        fechaDeSalida: reserva.fechaDeSalida,
        referencia: '',
        observaciones: '',
        detalleDelItem: '',
        cantidadPax: reserva.cantidadPax,
        pasajeros: reserva.pasajeros,
      },
    });
  });

  /**
   * Rechazos del asistente de series.
   *
   * Es el companiero negativo del test de arriba, con el mismo criterio que
   * `validaciones.spec.ts` tiene para el checkout: **no emite ninguna reserva**,
   * asi que no deja nada vivo en QA ni consume cupo de la serie.
   *
   * Va en dos arranques porque el asistente no tiene marcha atras para todo: el
   * primero cubre los rechazos del paso de disponibilidad y el segundo los del
   * paso de pasajeros, entrando de nuevo al circuito.
   */
  test('Serie: el asistente no deja avanzar con datos incompletos', async ({ page }) => {
    test.setTimeout(900_000);

    const serie = new SeriePage(page);

    const errores = {
      sinFecha: 'Debés seleccionar una fecha de salida en el calendario.',
      sinHabitaciones: 'Debés agregar al menos una habitación.',
      pasajeros: 'Completá el nombre, apellido y fecha de nacimiento de todos los pasajeros.',
      edadDelMenor: 'la fecha de nacimiento ingresada corresponde a',
    };

    await paso(page, 'Abrir el asistente del circuito de regresion', async () => {
      await serie.abrirListado();
      await serie.abrirSerie(SERIE.nombre);
      await serie.abrirCircuito(SERIE.circuito);
      expect(await serie.pasoActual(), 'El asistente tiene que abrir en el paso de disponibilidad')
        .toBe('Disponibilidad');
    });

    await paso(page, 'Intentar avanzar sin elegir una fecha de salida', async () => {
      await serie.siguiente();
      const error = await serie.errorDelPasoActual();
      await adjuntarTexto('Error sin fecha', error);

      await conResaltado(page, page.locator('.wizard-nav'), 'Rechazo sin fecha', async () => {
        expect(error, 'Sin fecha de salida el asistente tiene que rechazar el paso')
          .toContain(errores.sinFecha);
        expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar')
          .toBe('Disponibilidad');
      });
    });

    await paso(page, 'Verificar que el calendario no ofrezca salidas vencidas', async () => {
      // Una salida pasada se dibuja igual pero sin `data-key`: no es clickeable.
      // Es la unica forma de llegar al rechazo por fecha vencida, asi que lo que
      // se exige es que el calendario no la ofrezca.
      const hoy = new Date();
      const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-` +
        `${String(hoy.getDate()).padStart(2, '0')}`;

      const ofrecidas: string[] = [];
      for (let i = 0; i < 3; i++) {
        const salidas = await serie.salidasDelMes();
        ofrecidas.push(...salidas.map((s) => s.clave));
        await page.locator(serie.mesSiguiente).first().click();
        await page.waitForTimeout(400);
      }
      await adjuntarTexto('Salidas ofrecidas en los tres primeros meses', ofrecidas.join(' | '));

      const vencidas = ofrecidas.filter((clave) => clave < hoyISO);
      await conResaltado(page, page.locator('.scal-card'), 'Salidas vencidas en el calendario', () => {
        expect(ofrecidas.length, 'El calendario tiene que ofrecer salidas reservables')
          .toBeGreaterThan(0);
        expect(vencidas.join(' | '),
          `El calendario no puede ofrecer salidas anteriores a hoy (${hoyISO})`)
          .toBe('');
      });
    });

    await paso(page, 'Elegir una salida e intentar avanzar sin agregar habitaciones', async () => {
      // Se vuelve a pedir la pantalla para arrancar de cero: el paso anterior
      // dejo el calendario tres meses adelante.
      await serie.reabrirAsistente();
      const elegida = await serie.elegirPrimeraSalida();
      await adjuntarTexto('Salida elegida para el rechazo', elegida.fecha);

      await serie.siguiente();
      const error = await serie.errorDelPasoActual();
      await adjuntarTexto('Error sin habitaciones', error);

      await conResaltado(page, page.locator('.wizard-nav'), 'Rechazo sin habitaciones', async () => {
        expect(error, 'Sin habitaciones agregadas el asistente tiene que rechazar el paso')
          .toContain(errores.sinHabitaciones);
        expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar')
          .toBe('Disponibilidad');
      });
    });

    await paso(page, 'Verificar los topes de ocupacion de la habitacion', async () => {
      // Los topes son 3 adultos, 2 menores, nunca mas menores que adultos y
      // nunca mas de 4 ocupantes. Se verifican sobre los propios botones: lo que
      // ve la persona es que dejan de responder.
      await serie.configurarOcupacion({ adultos: 3 });
      const conTresAdultos = await serie.topesDeOcupacion();
      await adjuntarTexto('Topes con 3 adultos', JSON.stringify(conTresAdultos, null, 1));
      await conResaltado(page, page.locator('#roomsSection'), 'Tope de adultos', () => {
        expect(conTresAdultos.adultos, 'La habitacion tiene que admitir hasta 3 adultos').toBe(3);
        expect(conTresAdultos.masAdultos,
          'Con 3 adultos no se tiene que poder agregar un cuarto').toBe(true);
      });

      await serie.configurarOcupacion({ adultos: 1, menores: 1, edades: [8] });
      const conUnAdulto = await serie.topesDeOcupacion();
      await adjuntarTexto('Topes con 1 adulto y 1 menor', JSON.stringify(conUnAdulto, null, 1));
      await conResaltado(page, page.locator('#roomsSection'), 'Menores contra adultos', () => {
        expect(conUnAdulto.menores, 'Con un adulto la habitacion admite un menor').toBe(1);
        expect(conUnAdulto.masMenores,
          'Con un solo adulto no se tiene que poder agregar un segundo menor').toBe(true);
        expect(conUnAdulto.menosAdultos,
          'Con un solo adulto no se tiene que poder bajar a cero').toBe(true);
      });
    });

    await paso(page, 'Verificar que no se puedan agregar mas de cuatro habitaciones', async () => {
      // La quinta habitacion no se rechaza con un error de campo: el asistente
      // abre el modal que deriva la consulta a una reserva de grupo.
      for (let i = 0; i < 4; i++) {
        await serie.configurarOcupacion({ adultos: 1 });
        await serie.agregarHabitacion();
      }
      const cargadas = await serie.habitacionesDelResumen();
      await adjuntarTexto('Habitaciones cargadas', cargadas.join(SALTO));
      expect(cargadas.length, 'El asistente tiene que dejar cargar cuatro habitaciones').toBe(4);

      await serie.configurarOcupacion({ adultos: 1 });
      await serie.agregarHabitacion();

      const modal = await serie.textoDelModalDeCupo();
      await adjuntarTexto('Modal al agregar la quinta habitacion', modal);
      await conResaltado(page, page.locator('#summaryCard'), 'Quinta habitacion', async () => {
        expect(modal, 'Al querer agregar una quinta habitacion tiene que avisar por pantalla')
          .not.toBe('');
        expect((await serie.habitacionesDelResumen()).length,
          'La quinta habitacion no se tiene que agregar').toBe(4);
      });
      if (modal) await serie.cerrarModalDeCupo();
    });

    await paso(page, 'Quitar habitaciones del resumen', async () => {
      // La "x" de cada fila las saca de a una. Es la unica forma de corregir una
      // habitacion mal cargada sin empezar todo de nuevo.
      await serie.quitarLaHabitacion(3);
      await serie.quitarLaHabitacion(2);
      const quedaron = await serie.habitacionesDelResumen();
      await adjuntarTexto('Habitaciones despues de quitar dos', quedaron.join(SALTO));

      await conResaltado(page, page.locator('#summaryCard'), 'Quitar habitaciones', () => {
        expect(quedaron.length, 'Quitando dos de las cuatro habitaciones tienen que quedar dos')
          .toBe(2);
      });
    });

    await paso(page, 'Volver a entrar y armar una habitacion con un menor', async () => {
      await serie.reabrirAsistente();
      await serie.elegirPrimeraSalida();
      await serie.configurarOcupacion({ adultos: 1, menores: 1, edades: [8] });
      await serie.agregarHabitacion();

      const habitaciones = await serie.habitacionesDelResumen();
      await adjuntarTexto('Habitacion con un menor', habitaciones.join(SALTO));
      expect(habitaciones.length, 'La habitacion se tiene que agregar').toBe(1);

      await serie.siguiente();
      expect(await serie.pasoActual(), 'El asistente tiene que avanzar al paso de pasajeros')
        .toBe('Pasajeros');
    });

    await paso(page, 'Volver un paso y verificar que no se pierda lo cargado', async () => {
      // Volver regenera los formularios de pasajeros desde cero. Si la habitacion
      // no sobreviviera, la persona tendria que rearmar todo para corregir un dato.
      await serie.volver();
      await conResaltado(page, page.locator('#summaryCard'), 'Volver al paso anterior', async () => {
        expect(await serie.pasoActual(), 'Volver tiene que devolver al paso de disponibilidad')
          .toBe('Disponibilidad');
        expect((await serie.habitacionesDelResumen()).length,
          'Al volver, la habitacion cargada tiene que seguir estando').toBe(1);
      });

      await serie.siguiente();
      expect(await serie.pasoActual(), 'Se tiene que poder volver a avanzar').toBe('Pasajeros');
    });

    await paso(page, 'Cambiar de categoria con un menor cargado y cancelar', async () => {
      // Con menores cargados el cambio de categoria **no se aplica de una**: cada
      // categoria tiene su propia politica de edades, asi que el asistente avisa
      // que se pierde la seleccion y pide confirmar. Sin menores se aplica directo,
      // por eso este caso va con la habitacion que tiene el menor.
      await serie.volver();
      await serie.intentarCambiarCategoria(SERIE.otraCategoria);

      const texto = await serie.textoDelModalDeCategoria();
      await adjuntarTexto('Modal de cambio de categoria', texto);
      await conResaltado(page, page.locator(serie.modalDeCategoria), 'Aviso al cambiar de categoria', () => {
        expect(texto,
          'Cambiar de categoria con habitaciones cargadas tiene que avisar que se pierde la seleccion')
          .not.toBe('');
      });

      await serie.cancelarCambioDeCategoria();
      await conResaltado(page, page.locator('#summaryCard'), 'Cancelar el cambio de categoria', async () => {
        expect((await serie.habitacionesDelResumen()).length,
          'Cancelado el cambio, la habitacion cargada tiene que seguir estando').toBe(1);
        expect(await serie.categoriaElegida(),
          'Cancelado el cambio, el combo tiene que volver a la categoria anterior')
          .not.toContain(SERIE.otraCategoria);
      });
    });

    await paso(page, 'Cambiar de categoria y confirmar el reinicio', async () => {
      await serie.intentarCambiarCategoria(SERIE.otraCategoria);
      await serie.confirmarCambioDeCategoria();

      await conResaltado(page, page.locator('#summaryCard'), 'Confirmar el cambio de categoria', async () => {
        expect((await serie.habitacionesDelResumen()).length,
          'Confirmado el cambio, la seleccion de habitaciones se tiene que reiniciar').toBe(0);
        expect(await serie.categoriaElegida(),
          'Confirmado el cambio, el combo tiene que quedar en la categoria nueva')
          .toContain(SERIE.otraCategoria);
      });

      // Se rearma la habitacion para seguir con los rechazos del paso de pasajeros.
      // La fecha sobrevive al reinicio: lo que se limpia son las habitaciones.
      await serie.configurarOcupacion({ adultos: 1, menores: 1, edades: [8] });
      await serie.agregarHabitacion();
      await serie.siguiente();
      expect(await serie.pasoActual(), 'Rearmada la habitacion, el asistente tiene que avanzar')
        .toBe('Pasajeros');
    });

    await paso(page, 'Intentar avanzar con los pasajeros vacios', async () => {
      await serie.siguiente();
      const error = await serie.errorDelPasoActual();
      await adjuntarTexto('Error con pasajeros vacios', error);

      await conResaltado(page, page.locator(serie.bloqueDePasajeros).first(), 'Rechazo por pasajeros vacios', async () => {
        expect(error, 'Sin cargar los pasajeros el asistente tiene que rechazar el paso')
          .toContain(errores.pasajeros);
        expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar')
          .toBe('Pasajeros');
      });
    });

    await paso(page, 'Intentar avanzar con la fecha de nacimiento del menor de un adulto', async () => {
      // La edad se calcula a la fecha de salida y se compara contra la que se
      // eligio al armar la habitacion: un menor de 8 con fecha de 1990 no es el
      // mismo pasajero.
      await serie.completarPasajero(0, 0, {
        nombre: 'Adulto', apellido: 'Regresion', pasaporte: 'QA0001',
        nacimiento: '01/03/1990', nacionalidad: 'Argentina',
      });
      await serie.completarPasajero(0, 1, {
        nombre: 'Menor', apellido: 'Regresion', pasaporte: 'QA0002',
        nacimiento: '01/03/1990', nacionalidad: 'Argentina',
      });
      await serie.siguiente();

      const error = await serie.errorDelPasoActual();
      await adjuntarTexto('Error por la edad del menor', error);
      await conResaltado(page, page.locator(serie.bloqueDePasajeros).first(), 'Rechazo por la edad del menor', async () => {
        expect(error,
          'Si la fecha de nacimiento no coincide con la edad elegida, el asistente tiene que rechazarla')
          .toContain(errores.edadDelMenor);
        expect(await serie.pasoActual(), 'Rechazado el paso, el asistente no puede avanzar')
          .toBe('Pasajeros');
      });
    });

    await paso(page, 'Corregir la fecha del menor y verificar el freno de los terminos', async () => {
      const hoy = new Date();
      const nacimientoDelMenor = `01/03/${hoy.getFullYear() - 8}`;
      await serie.completarPasajero(0, 1, {
        nombre: 'Menor', apellido: 'Regresion', pasaporte: 'QA0002',
        nacimiento: nacimientoDelMenor, nacionalidad: 'Argentina',
      });
      await serie.siguiente();

      await conResaltado(page, page.locator('.wizard-steps'), 'Avance con la edad corregida', async () => {
        expect(await serie.errorDelPasoActual(),
          'Corregida la fecha, el asistente no tiene que rechazar el paso').toBe('');
        expect(await serie.pasoActual(), 'Corregida la fecha, el asistente tiene que avanzar')
          .toBe('Resumen');
      });

      // El ultimo freno: sin aceptar los terminos no se puede emitir. Se verifica
      // que el boton este deshabilitado y que tildar lo habilite, y **no se
      // confirma**: este test no emite ninguna reserva.
      await conResaltado(page, page.locator('.terms-panel'), 'Finalizar deshabilitado sin terminos', async () => {
        await expect(
          page.locator(serie.botonSiguiente).first(),
          'Sin aceptar los terminos, el boton de finalizar tiene que estar deshabilitado',
        ).toBeDisabled();
      });
      await serie.aceptarTerminos();
    });

    await paso(page, 'Avisar cuando quedan pocos cupos y frenar al agotarlos', async () => {
      // El aviso aparece con 5 cupos o menos, y descuenta las habitaciones ya
      // cargadas: es lo que empuja a la persona a decidir.
      await serie.reabrirAsistente();
      await serie.elegirSalida(SERIE.salidaConCupoBajo);

      const aviso = await serie.textoDelAvisoDePocosCupos();
      await adjuntarTexto('Aviso de pocos cupos', aviso);
      await conResaltado(page, page.locator('.scal-card'), 'Aviso de pocos cupos', async () => {
        const { cupos } = await serie.datosDelCalendario();
        expect(cupos[SERIE.salidaConCupoBajo],
          `La salida ${SERIE.salidaConCupoBajo} tiene que estar preparada con cupo ${SERIE.cupoBajo}`)
          .toBe(SERIE.cupoBajo);
        expect(aviso, 'Con pocos cupos el asistente tiene que avisar cuantos quedan')
          .toContain(String(SERIE.cupoBajo));
      });

      // Cargadas las tres habitaciones que hay de cupo, no queda ninguna: el aviso
      // se apaga porque ya no queda nada que avisar.
      for (let i = 0; i < SERIE.cupoBajo; i++) {
        await serie.configurarOcupacion({ adultos: 1 });
        await serie.agregarHabitacion();
      }
      await conResaltado(page, page.locator('#summaryCard'), 'Cupo consumido por las habitaciones', async () => {
        expect((await serie.habitacionesDelResumen()).length,
          'Se tienen que poder cargar tantas habitaciones como cupo hay').toBe(SERIE.cupoBajo);
        expect(await serie.textoDelAvisoDePocosCupos(),
          'Consumido todo el cupo con habitaciones cargadas, el aviso ya no tiene que mostrarse')
          .toBe('');
      });

      // Y una mas no entra. No es el modal de reserva de grupo —para eso hacen
      // falta cinco—: es el de cupo agotado.
      await serie.configurarOcupacion({ adultos: 1 });
      await serie.agregarHabitacion();
      const modal = await serie.textoDelModalDeCupo();
      await adjuntarTexto('Modal al pedir mas habitaciones que cupo', modal);
      await conResaltado(page, page.locator('#summaryCard'), 'Cupo agotado', async () => {
        expect(modal, 'Sin cupo para otra habitacion, el asistente tiene que avisarlo por pantalla')
          .not.toBe('');
        expect((await serie.habitacionesDelResumen()).length,
          'La habitacion que no tiene cupo no se tiene que agregar').toBe(SERIE.cupoBajo);
      });
      if (modal) await serie.cerrarModalDeCupo();
    });

    await paso(page, 'Derivar a consulta la salida que se quedo sin cupo', async () => {
      // Sin cupo, el servidor manda la salida **sin tarifa**: la celda se dibuja
      // igual, pero elegirla no habilita habitaciones. En su lugar aparece el
      // cartel de consultar por email, y el boton de avanzar queda bloqueado.
      await serie.reabrirAsistente();

      const { cupos } = await serie.datosDelCalendario();
      await adjuntarTexto('Cupo de la salida preparada sin cupo',
        `${SERIE.salidaSinCupo}: ${cupos[SERIE.salidaSinCupo]}`);
      expect(cupos[SERIE.salidaSinCupo],
        `La salida ${SERIE.salidaSinCupo} tiene que estar preparada sin cupo`).toBe(0);

      await serie.elegirSalida(SERIE.salidaSinCupo);

      const cartel = await serie.textoDelCartelDeConsulta();
      await adjuntarTexto('Cartel de consulta', cartel);
      await conResaltado(page, page.locator('#roomsConfigPanel'), 'Salida sin cupo', async () => {
        expect(cartel,
          'Elegida una salida sin cupo, el asistente tiene que derivar la consulta en vez de ' +
          'ofrecer habitaciones')
          .not.toBe('');
        await expect(
          page.locator('#roomsSection'),
          'Sin cupo no se tienen que poder configurar habitaciones',
        ).toBeHidden({ timeout: 15_000 });
        expect(await serie.siguienteDeshabilitado(),
          'Con el cartel de consulta visible, el boton de avanzar tiene que estar deshabilitado')
          .toBe(true);
      });
    });
  });

  /**
   * Multiidioma de las tres pantallas de series.
   *
   * El portal tiene selector de idioma en el encabezado, y las pantallas de
   * series estan llenas de `data-i18n`. Lo que se exige no es que las etiquetas
   * cambien, sino que **el contenido sea el de ese idioma**: el nombre de la serie
   * y el del circuito salen de `SerieDetail` y `ReceptiveTourDetail`, cargados en
   * los tres idiomas. El defecto tipico es que el filtro por idioma no aplique y
   * el contenido caiga al espaniol por defecto.
   *
   * El idioma vive en una cookie del contexto (`Advisor.CustomerLanguage`), que
   * muere con el test: no contamina a los demas.
   *
   * No emite ninguna reserva.
   */
  test('Serie: las pantallas se muestran en el idioma elegido', async ({ page }) => {
    test.setTimeout(900_000);

    const serie = new SeriePage(page);

    const IDIOMAS = [
      { codigo: 'ES', link: 'lnkEsp', nombre: 'Español',
        serie: 'AUTO-QA NO TOCAR - Serie de regresion',
        circuito: 'AUTO-QA NO TOCAR - Serie: Buenos Aires (3 dias / 2 noches)' },
      { codigo: 'EN', link: 'lnkEng', nombre: 'Inglés',
        serie: 'AUTO-QA NO TOCAR - Regression Series',
        circuito: 'AUTO-QA NO TOCAR - Series: Buenos Aires (3 days / 2 nights)' },
      { codigo: 'PT', link: 'lnkPor', nombre: 'Portugués',
        serie: 'AUTO-QA NO TOCAR - Serie de regressao',
        circuito: 'AUTO-QA NO TOCAR - Serie: Buenos Aires (3 dias / 2 noites)' },
    ];

    /** Codigo del idioma activo, tal como lo muestra el encabezado. */
    const idiomaActivo = async () =>
      (await page.locator('.ddLanguage a.header-flug span').first().innerText())
        .replace(/\s+/g, ' ').trim().toUpperCase();

    /**
     * Cambia el idioma desde el encabezado.
     *
     * El control **esconde el idioma activo**, asi que si ya es el buscado no hay
     * nada que hacer: sin esto el test se cuelga esperando una opcion que no
     * existe.
     */
    const cambiarIdioma = async (idioma: { link: string; codigo: string; nombre: string }) => {
      if (await idiomaActivo() === idioma.codigo) return;
      await page.locator('.ddLanguage a.header-flug').first().click();
      const opcion = page.locator(`[id$='${idioma.link}']`).first();
      await expect(opcion, `El selector tiene que ofrecer ${idioma.nombre}`)
        .toBeVisible({ timeout: 30_000 });
      await opcion.click();
      await page.waitForLoadState('domcontentloaded');
      await esperarFinDeCarga(page);
    };

    for (const idioma of IDIOMAS) {
      await paso(page, `Pasar el sitio a ${idioma.nombre} y abrir el listado de series`, async () => {
        await page.goto('/online/');
        await esperarFinDeCarga(page);
        await cambiarIdioma(idioma);

        await conResaltado(page, page.locator('.ddLanguage').first(), `Encabezado en ${idioma.nombre}`, async () => {
          expect(await idiomaActivo(),
            `El encabezado tiene que quedar en ${idioma.codigo} despues de elegir ${idioma.nombre}`)
            .toBe(idioma.codigo);
        });

        await serie.abrirListado();
        const series = await serie.seriesDelListado();
        await adjuntarTexto(`Listado de series en ${idioma.nombre}`, series.join(SALTO));

        await conResaltado(page, page.locator('.serie-grid'), `Nombre de la serie en ${idioma.nombre}`, () => {
          expect(series.join(' | '),
            `En ${idioma.nombre} el listado tiene que mostrar el nombre de ese idioma, ` +
            'el que tiene cargado SerieDetail')
            .toContain(idioma.serie);
        });

        if (idioma.codigo !== 'ES') {
          await conResaltado(page, page.locator('.serie-grid'), `Sin caer al espaniol en ${idioma.nombre}`, () => {
            expect(series.join(' | '),
              `En ${idioma.nombre} el nombre no puede ser el espaniol: seria el filtro por ` +
              'idioma sin aplicar')
              .not.toContain(IDIOMAS[0].serie);
          });
        }
      });

      await paso(page, `Abrir la serie y el asistente en ${idioma.nombre}`, async () => {
        await serie.abrirSerie(idioma.serie);
        const circuitos = await serie.circuitosDeLaSerie();
        await adjuntarTexto(`Circuitos en ${idioma.nombre}`, circuitos.join(SALTO));

        await conResaltado(page, page.locator('body'), `Nombre del circuito en ${idioma.nombre}`, () => {
          expect(circuitos.join(' | '),
            `En ${idioma.nombre} el circuito tiene que mostrar el nombre de ese idioma`)
            .toContain(idioma.circuito);
          if (idioma.codigo !== 'ES') {
            expect(circuitos.join(' | '),
              `En ${idioma.nombre} el circuito no puede mostrar el nombre en espaniol`)
              .not.toContain(IDIOMAS[0].circuito);
          }
        });

        await serie.abrirCircuito(idioma.circuito);
        await conResaltado(page, page.locator('body'), `Asistente en ${idioma.nombre}`, async () => {
          await expect(
            page.locator(serie.sinDisponibilidad),
            `En ${idioma.nombre} el circuito tiene que abrir con disponibilidad, igual que en espaniol`,
          ).toBeHidden({ timeout: 15_000 });
          expect(await page.locator('h1').first().innerText(),
            `El encabezado del asistente tiene que traer el nombre del circuito en ${idioma.nombre}`)
            .toContain(idioma.circuito);
        });

        // Las etiquetas del asistente y el mes del calendario se adjuntan como
        // evidencia y no se exigen: ninguna historia define que tengan que estar
        // traducidas, asi que compararlas seria inventar un resultado esperado.
        const etiquetas = await page.evaluate(() => ({
          pasos: Array.from(document.querySelectorAll('.wizard-step-label'))
            .map((e) => (e as HTMLElement).innerText.trim()),
          mes: document.querySelector('#spanCalLabel')
            ? (document.querySelector('#spanCalLabel') as HTMLElement).innerText.trim() : '',
        }));
        await adjuntarTexto(`Etiquetas del asistente en ${idioma.nombre}`,
          `pasos: ${etiquetas.pasos.join(' | ')}${SALTO}mes del calendario: ${etiquetas.mes}`);
      });
    }
  });

});
