import { expect, Page } from '@playwright/test';
import { PortalNuevoPage, PasajeroNuevo } from '../../../pages/climbs/portal.page';
import { BackofficeNuevoPage } from '../../../pages/climbs/backoffice.page';
import { ServiciosDelDestinoPage } from '../../../pages/climbs/servicios-del-destino.page';
import { CircuitoNuevoPage } from '../../../pages/climbs/circuito.page';
import { HotelNuevoPage } from '../../../pages/climbs/hotel.page';
import { leerTabla } from '../../../pages/climbs/tabla';
import { conBackofficeNuevo, exigirHotelesDelCircuito, exigirServiciosDelCircuito, costosDelServicio, tarifaVigente, precioEsperado } from '../../../utils/markups';
import { ModalesMultidestinoPage } from '../../../pages/climbs/modales-multidestino.page';
import candidatos from '../../../data/candidatos.json';
import { paso, adjuntarTexto, conResaltado, importeANumero, selloEnLetras, formatearFecha, fechaDeBusqueda, fechaDeHotel } from '../../../utils/pasos';

/** Datos del usuario con el que se reserva: los pone el sistema a partir de la sesion. */
export const CONTEXTO = {
  agencia: 'AMV. TRAVEL',
  email: (process.env.BO_USER ?? '').toLowerCase(),
  ciudad: 'Buenos Aires',
  pais: 'Argentina',
};

/**
 * Lo que comparten los tests de Reservas de la app nueva. Es el mismo recorrido que
 * tests/bloque-b/reservas-comun.ts, por las pantallas nuevas: el detalle de la reserva en
 * el portal, la bandeja del Backoffice, el detalle con "Generar file", la ficha del file,
 * su rooming y "Destinos y servicios". **No es un archivo de test** (no termina en .spec.ts).
 */

export type Importe = { moneda: string; valor: number | null };

/**
 * "USD 190,00" / "96 USD" / "USD 2.670" / "1.500" -> { moneda, valor }. La app nueva escribe
 * todo en formato es-AR. El Backoffice deja sin moneda algunos importes (los hoteles de un
 * circuito y su total en la bandeja): ahi la moneda queda vacia y no se compara.
 */
export const importe = (texto: string): Importe => {
  const limpio = (texto || '').replace(/\s+/g, ' ').trim();
  const m = limpio.match(/([A-Z]{3})\s*(-?\d[\d.]*(?:,\d+)?)|(-?\d[\d.]*(?:,\d+)?)\s*([A-Z]{3})/);
  if (m) return { moneda: m[1] ?? m[4] ?? '', valor: importeANumero(m[2] ?? m[3] ?? '') };
  return { moneda: '', valor: importeANumero(limpio.match(/-?\d[\d.]*(?:,\d+)?/)?.[0] ?? '') };
};

/** Fecha sin ceros a la izquierda, para comparar fechas escritas de distinta forma. */
/**
 * Meses (0 = enero) en que no opera el traslado 1223 "AUTO-QA NO TOCAR - Aeropuerto Internacional /
 * Hotel centrico" del paquete AUTO-QA Buenos Aires y Ushuaia: marzo, junio, septiembre y diciembre
 * (ServiceMonth 17, verificado en la base el 24/11/2026). En esos meses el multidestino lo marca
 * "No disponible" y no deja continuar al carrito.
 */
export const MESES_SIN_TRASLADO_DEL_PAQUETE = [2, 5, 8, 11];

/** Primera fecha desde fechaDeBusqueda(diasExtra) con los 6 dias del paquete en meses en que opera el traslado. */
export function fechaDelPaquete(diasExtra = 7, mesesCerrados: number[] = MESES_SIN_TRASLADO_DEL_PAQUETE): Date {
  const d = fechaDeBusqueda(diasExtra);
  const fin = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate() + 5);
  // Park Hyatt (el hotel del paquete en Buenos Aires) no tiene tarifa del 28/12 al 02/01: el viaje no puede tocar esos dias.
  const fiestas = (x: Date) => (x.getMonth() === 11 && x.getDate() >= 28) || (x.getMonth() === 0 && x.getDate() <= 2);
  const tocaFiestas = (x: Date) => Array.from({ length: 6 }, (_, i) => new Date(x.getFullYear(), x.getMonth(), x.getDate() + i)).some(fiestas);
  while (mesesCerrados.includes(d.getMonth()) || mesesCerrados.includes(fin(d).getMonth()) || tocaFiestas(d)) d.setDate(d.getDate() + 1);
  return d;
}

export const sinCeros = (fecha: string) => fecha.split('/').map((p) => String(Number(p))).join('/');

/** Los mismos pasajeros que arma la suite actual: nombre fijo, apellido con el sello en letras. */
export function pasajerosDePrueba(cantidad: number, sello: string): PasajeroNuevo[] {
  return Array.from({ length: cantidad }, (_, i) => ({
    nombre: `Pasajero${['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho'][i] ?? 'Extra'}`,
    apellido: `Regresion${selloEnLetras(sello.slice(-6))}`,
    pasaporte: `QA${sello.slice(-8)}${i + 1}`,
    nacimiento: `0${i + 1}/03/1990`,
    nacionalidad: 'Argentina',
  }));
}

export type ReservaEsperada = {
  /** Nombre del item tal como se reservo, y el fragmento con el que se lo ubica en el Backoffice. */
  item: string; textoEnElBO: string;
  modalidad: string; fecha: string; fechaDeSalida?: string;
  referencia: string; observaciones: string; detalleDelItem: string;
  cantidadPax: number; pasajeros: PasajeroNuevo[];
  /** Solapa del historial del portal donde vive la reserva. */
  solapa: 'Carrito de compras' | 'Multidestino' | 'Series';
};

/**
 * Del historial del portal al file: el mismo tramo que `verificarEnElBackOffice` de la
 * suite actual. Lo que se cargo en el portal tiene que llegar igual al detalle de la
 * reserva, a la bandeja, al detalle con "Generar file", a la ficha, al rooming y a
 * "Destinos y servicios"; y los importes se concilian de punta a punta.
 */
export async function verificarEnElBackofficeNuevo(opciones: {
  page: Page;
  codigo: string;
  reserva: ReservaEsperada;
  contexto: Record<string, string>;
  importes: Record<string, Importe>;
  /** La modalidad como la escribe el file, si difiere ("1 X DOBLE" en un hotel). */
  modalidadEnElFile?: string;
  /** Que importe del portal es la referencia: en servicios y hoteles el de la ficha; en circuitos, el del itinerario. */
  claveDeReferencia?: string;
  /**
   * Con varios items (oferta, multidestino) no se compara item por item contra el total:
   * se concilia el total del viaje y cada item contra su importe del carrito.
   */
  itemUnico?: boolean;
  /** Todos los items que la reserva tiene que traer (fragmentos de su nombre). */
  itemsEsperados?: string[];
  /** Importe que el carrito mostro para cada item, por fragmento de su nombre. */
  importePorItemDelPortal?: Record<string, string>;
  /** Destinos del file, en orden: un circuito tiene varios. */
  ciudades?: string[];
  /**
   * La reserva de una serie no tiene donde cargar referencia, observaciones ni comentario por
   * item (el asistente no los ofrece): exigirlos seria exigir un dato que nadie pudo cargar.
   */
  sinReferenciaNiComentario?: boolean;
}) {
  const { page, codigo, reserva, contexto, importes } = opciones;
  const portal = new PortalNuevoPage(page);
  const bo = new BackofficeNuevoPage(page);
  const destinos = new ServiciosDelDestinoPage(page);
  const modalidadEnElFile = opciones.modalidadEnElFile ?? reserva.modalidad;
  const claveDeReferencia = opciones.claveDeReferencia ?? 'ficha (total)';
  const itemUnico = opciones.itemUnico ?? true;
  const itemsEsperados = opciones.itemsEsperados ?? [reserva.textoEnElBO];
  const importePorItemDelPortal = opciones.importePorItemDelPortal ?? {};
  const ciudades = opciones.ciudades ?? ['Buenos Aires'];
  const sinReferencia = opciones.sinReferenciaNiComentario ?? false;
  const principal = reserva.pasajeros[0];

  await paso(page, 'Abrir el detalle de la reserva en el portal y verificar los comentarios', async () => {
    const fila = await portal.filaDelHistorial(codigo, reserva.solapa);
    const textoDeLaFila = (await fila.innerText()).replace(/\s+/g, ' ');
    importes['historial (total)'] = importe(textoDeLaFila.match(/[A-Z]{3}\s*[\d.,]+\s*$/)?.[0] ?? '');
    await adjuntarTexto('Fila del historial', textoDeLaFila);

    await portal.abrirDetalleDeLaReserva(fila, codigo);
    const detalle = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    await adjuntarTexto('Detalle de la reserva en el portal', detalle);
    if (sinReferencia) return;
    const main = page.locator('main');
    await conResaltado(page, main, 'Comentario del item en el detalle', () => {
      expect(detalle, 'El detalle de la reserva tiene que mostrar el comentario cargado en el item').toContain(reserva.detalleDelItem);
    });
    await conResaltado(page, main, 'Observaciones en el detalle de la reserva', async () => {
      expect(await portal.datoDelDetalle(['Comentario(s)', 'Comentario']), 'El detalle de la reserva tiene que mostrar las observaciones cargadas')
        .toBe(reserva.observaciones);
    });
  });

  let dialogo = page.getByRole('dialog').first();
  await paso(page, 'Ubicar la reserva en la bandeja del Backoffice y comparar la fila', async () => {
    const fila = await bo.filaDeLaBandeja(codigo, reserva.solapa === 'Series' ? 'Series' : 'Online');
    const texto = (await fila.innerText()).replace(/\s+/g, ' ');
    await adjuntarTexto('Fila de la bandeja', texto);
    if (!sinReferencia) {
      await conResaltado(page, fila, 'Referencia en la bandeja', () => {
        expect(texto, 'La bandeja tiene que mostrar la referencia cargada en el portal').toContain(reserva.referencia);
      });
    }
    await conResaltado(page, fila, 'Pasajero principal en la bandeja', () => {
      expect(texto, 'La bandeja tiene que mostrar el pasajero principal')
        .toContain(`${principal.nombre} ${principal.apellido}`.toUpperCase());
    });
    // Agencia, usuario, ciudad y pais: no los carga el test, pero si fueran otros la
    // reserva habria llegado con el contexto equivocado.
    for (const [campo, esperado] of Object.entries(contexto)) {
      expect(esperado, `Falta el valor esperado de ${campo} para comparar la bandeja`).toBeTruthy();
      await conResaltado(page, fila, `Campo ${campo} en la bandeja`, () => {
        expect(texto.toLowerCase(), `La bandeja tiene que mostrar ${campo} de la reserva`).toContain(esperado.toLowerCase());
      });
    }
    importes['bandeja (columna Venta)'] = importe((await bo.celdasDeLaBandeja(fila))['Venta'] ?? '');
    dialogo = await bo.abrirDetalleDeLaBandeja(fila, codigo);
  });

  /**
   * Lo que tienen que mostrar los datos del file a partir de lo cargado en el portal. El
   * detalle de la bandeja pasa a mayuscula nombre, apellido y nacionalidad (igual que el
   * BO viejo); la ficha los muestra como se cargaron. "Nombre del file" es compuesto:
   * NOMBRE/APELLIDO x cantidad, siempre en mayuscula.
   */
  const nombreDelFile = `${principal.nombre.toUpperCase()}/${principal.apellido.toUpperCase()} x ${reserva.cantidadPax}`;

  await paso(page, 'Abrir el detalle y comparar los datos de la reserva', async () => {
    const esperados: Record<string, string> = {
      'ib-pax-count': String(reserva.cantidadPax),
      ...(sinReferencia ? {} : { 'ib-ref': reserva.referencia, 'ib-comment': reserva.observaciones }),
      'ib-pax-name': principal.nombre.toUpperCase(),
      'ib-pax-last': principal.apellido.toUpperCase(),
      'ib-pax-nat': principal.nacionalidad.toUpperCase(),
      'ib-main': nombreDelFile,
    };
    for (const [id, esperado] of Object.entries(esperados)) {
      await conResaltado(page, dialogo.locator(`#${id}`), `Campo ${id} en el detalle`, async () => {
        expect(await bo.campoDelDetalle(dialogo, id), `El campo ${id} tiene que conservar en el detalle lo cargado en el portal`).toBe(esperado);
      });
    }
  });

  await paso(page, 'Comparar la grilla de pasajeros y el item reservado', async () => {
    const tablaPax = bo.tablaCon(dialogo, 'Documento');
    const pax = await leerTabla(tablaPax);
    await adjuntarTexto('Pasajeros del detalle', pax.map((p) => Object.values(p).join(' | ')).join('\n'));
    await conResaltado(page, tablaPax, 'Cantidad de pasajeros en el detalle', () => {
      expect(pax.length, 'El detalle tiene que traer un pasajero por cada uno cargado en el portal').toBe(reserva.pasajeros.length);
    });
    for (const [i, p] of reserva.pasajeros.entries()) {
      const fila = pax[i] ?? {};
      await conResaltado(page, tablaPax.locator('tbody tr').nth(i), `Pasajero ${i + 1} en el detalle`, () => {
        expect(fila['Nombre'], `El pasajero ${i + 1} tiene que conservar su nombre`).toBe(p.nombre);
        expect(fila['Apellido'], `El pasajero ${i + 1} tiene que conservar su apellido`).toBe(p.apellido);
        expect(fila['Documento'], `El pasajero ${i + 1} tiene que conservar su pasaporte`).toBe(p.pasaporte);
        expect(fila['Nacionalidad'], `El pasajero ${i + 1} tiene que conservar su nacionalidad`).toBe(p.nacionalidad);
        expect(sinCeros(fila['Fecha de nac.'] ?? ''), `El pasajero ${i + 1} tiene que conservar su fecha de nacimiento`).toBe(sinCeros(p.nacimiento));
      });
    }

    const tablaItems = bo.tablaCon(dialogo, 'Tipo de tarifa');
    const items = await leerTabla(tablaItems);
    await adjuntarTexto('Items del detalle de la reserva', items.map((f) => Object.entries(f).map(([k, v]) => `${k}: ${v}`).join(' | ')).join('\n'));
    const item = items.find((f) => (f['Detalle'] ?? '').toUpperCase().includes(reserva.textoEnElBO.toUpperCase()));
    await conResaltado(page, tablaItems, 'Item reservado en el detalle', () => {
      expect(item, `El detalle tiene que mostrar el item ${reserva.textoEnElBO}`).toBeTruthy();
      expect(item?.['Fecha de entrada'], 'El detalle tiene que mostrar la fecha de la reserva').toBe(reserva.fecha);
      expect((item?.['Tipo de tarifa'] ?? '').toUpperCase(), 'El detalle tiene que mostrar la modalidad reservada').toContain(reserva.modalidad.toUpperCase());
      if (reserva.fechaDeSalida) expect(item?.['Fecha de salida'], 'El detalle tiene que mostrar la fecha de salida').toBe(reserva.fechaDeSalida);
    });
    importes['detalle (Venta del item)'] = importe(item?.['Venta'] ?? '');
    importes['detalle (V. markup del item)'] = importe(item?.['V. markup'] ?? '');

    // Todos los items del viaje, no solo el que se mira en detalle; y cada uno con su
    // importe del carrito: si uno cambia y otro compensa, el total cierra igual.
    const todos = items.map((f) => (f['Detalle'] ?? '').toUpperCase()).join(' || ');
    for (const esperado of itemsEsperados) {
      await conResaltado(page, tablaItems, `Item ${esperado} en el detalle`, () => {
        expect(todos, `El detalle tiene que traer el item ${esperado} de la reserva`).toContain(esperado.toUpperCase());
      });
    }
    for (const [esperado, delPortal] of Object.entries(importePorItemDelPortal)) {
      // Con recargo por idioma (US 4739) el servicio puede traer un item "Adicional Idioma" aparte: se suman.
      const deEse = items.filter((f) => (f['Detalle'] ?? '').toUpperCase().includes(esperado.toUpperCase())).map((f) => importe(f['Venta'] ?? '').valor ?? 0);
      if (deEse.length > 1) await adjuntarTexto(`Items de ${esperado} en el detalle`, deEse.join(' + '));
      await conResaltado(page, tablaItems, `Importe del item ${esperado} en el detalle`, () => {
        expect(Number(deEse.reduce((a, b) => a + b, 0).toFixed(2)), `El detalle tiene que conservar el importe de ${esperado}`).toBe(importe(delPortal).valor);
      });
    }
  });

  let file = { fileId: '', fileCode: '' };
  await paso(page, 'Elegir la sucursal y generar el file desde el detalle', async () => {
    file = await bo.generarFile(dialogo, 'Argentina');
    await adjuntarTexto('File generado', `Reserva ${codigo} -> file ${file.fileCode} (id ${file.fileId})`);
  });

  await paso(page, 'Comparar los datos del file contra los cargados en el portal', async () => {
    const esperados: Record<string, string> = {
      'Cant. pax': String(reserva.cantidadPax),
      // Las observaciones de la reserva son las de "Uso interno" (en el BO viejo, txtComment).
      ...(sinReferencia ? {} : { 'Referencia del cliente': reserva.referencia, 'Uso interno': reserva.observaciones }),
      'Nombre pax': principal.nombre,
      'Apellido pax': principal.apellido,
      'Nacionalidad pax': principal.nacionalidad,
      'Nombre del file': nombreDelFile,
    };
    for (const [rotulo, esperado] of Object.entries(esperados)) {
      await conResaltado(page, bo.fichaDelFile.getByRole('textbox', { name: rotulo, exact: true }), `${rotulo} en el file`, async () => {
        expect(await bo.campoDeLaFicha(rotulo), `"${rotulo}" tiene que conservar en el file lo cargado en el portal`).toBe(esperado);
      });
    }
  });

  await paso(page, 'Abrir el Rooming del file y comparar los pasajeros', async () => {
    await bo.abrirRooming();
    const tabla = bo.rooming.getByRole('table');
    // Las filas llegan despues de abrir el rooming (primero puede verse una vacia): se espera
    // a que todas traigan su nombre antes de leerlas.
    await expect.poll(async () => (await leerTabla(tabla)).filter((f) => f['Nombre']).length, { timeout: 30_000 })
      .toBeGreaterThanOrEqual(reserva.pasajeros.length);
    const filas = await leerTabla(tabla);
    await adjuntarTexto('Rooming del file', filas.map((f) => [f['Nombre'], f['Apellido'], f['Documento'], f['Nacionalidad'], f['Fecha Nac.']].join(' | ')).join('\n'));
    await conResaltado(page, tabla, 'Cantidad de pasajeros en el rooming', () => {
      expect(filas.length, 'El rooming tiene que tener un pasajero por cada uno cargado en el portal').toBe(reserva.pasajeros.length);
    });
    for (const [i, p] of reserva.pasajeros.entries()) {
      const f = filas[i] ?? {};
      await conResaltado(page, tabla.locator('tbody tr').nth(i), `Pasajero ${i + 1} en el rooming`, () => {
        expect(f['Nombre'], `El rooming tiene que conservar el nombre del pasajero ${i + 1}`).toBe(p.nombre);
        expect(f['Apellido'], `El rooming tiene que conservar el apellido del pasajero ${i + 1}`).toBe(p.apellido);
        expect(f['Documento'], `El rooming tiene que conservar el documento del pasajero ${i + 1}`).toBe(p.pasaporte);
        expect(f['Nacionalidad'], `El rooming tiene que conservar la nacionalidad del pasajero ${i + 1}`).toBe(p.nacionalidad);
        expect(sinCeros(f['Fecha Nac.'] ?? ''), `El rooming tiene que conservar la fecha de nacimiento del pasajero ${i + 1}`).toBe(sinCeros(p.nacimiento));
      });
    }
    await bo.cerrarRooming();
  });

  await paso(page, 'Comparar el servicio en Destinos y servicios del file', async () => {
    await destinos.verDestinosYServicios();
    const items = (await Promise.all(ciudades.map((c) => destinos.itemsDeLaFicha(c)))).flat();
    await adjuntarTexto('Items del file', items.map((i) => i.texto).join('\n'));
    const item = items.find((i) => i.texto.toUpperCase().includes(reserva.textoEnElBO.toUpperCase()));
    const fila = bo.fichaDelFile.locator('section.fs-dest tbody tr').filter({ hasText: reserva.textoEnElBO }).first();
    await conResaltado(page, fila, 'Servicio reservado en el file', () => {
      expect(item, `El file tiene que mostrar el item ${reserva.textoEnElBO}`).toBeTruthy();
      expect(item?.checkin, 'El file tiene que mostrar la fecha de la reserva').toBe(reserva.fecha);
      expect(item?.texto.toUpperCase(), 'El file tiene que mostrar la modalidad reservada').toContain(modalidadEnElFile.toUpperCase());
    });
    // Con recargo por idioma (US 4739) el file suma un item aparte del mismo servicio
    // ("Adicional Idioma ..."): la venta del servicio es la de todos sus items.
    const delServicio = items.filter((i) => i.texto.toUpperCase().includes(reserva.textoEnElBO.toUpperCase()));
    await adjuntarTexto('Items del servicio en el file', `${delServicio.length} item(s): ${delServicio.map((i) => `${i.venta.moneda} ${i.venta.valor}`).join(' + ')}`);
    importes['file (Venta del item)'] = {
      moneda: item?.venta.moneda ?? '',
      valor: delServicio.length > 1 ? Number(delServicio.reduce((x, i) => x + (i.venta.valor ?? 0), 0).toFixed(2)) : (item?.venta.valor ?? null),
    };

    // El equivalente del "ojito" del BO viejo: ningun item oculto al pasajero (lo que se
    // oculta no sale en SIX). La ficha lo cuenta en el filtro "Ocultos al pasajero".
    const ocultos = bo.fichaDelFile.getByRole('button', { name: /^Ocultos al pasajero/ });
    await conResaltado(page, ocultos, 'Items ocultos al pasajero', async () => {
      expect((await ocultos.innerText()).replace(/\s+/g, ' ').trim(), 'Los items reservados tienen que quedar visibles para el pasajero')
        .toBe('Ocultos al pasajero 0');
    });

    const todos = items.map((i) => i.texto.toUpperCase()).join(' || ');
    for (const esperado of itemsEsperados) {
      await conResaltado(page, bo.fichaDelFile.locator('section.fs-dest').first(), `Item ${esperado} en el file`, () => {
        expect(todos, `El file tiene que traer el item ${esperado} de la reserva`).toContain(esperado.toUpperCase());
      });
    }
    for (const [esperado, delPortal] of Object.entries(importePorItemDelPortal)) {
      // Con recargo por idioma (US 4739) el file suma un item "Adicional Idioma" del mismo servicio: se suman.
      const deEse = items.filter((i) => i.texto.toUpperCase().includes(esperado.toUpperCase())).map((i) => i.venta.valor ?? 0);
      if (deEse.length > 1) await adjuntarTexto(`Items de ${esperado} en el file`, deEse.join(' + '));
      expect(Number(deEse.reduce((a, b) => a + b, 0).toFixed(2)), `El file tiene que conservar el importe de ${esperado}`).toBe(importe(delPortal).valor);
    }

    // La suma de las ventas de los items tiene que dar la venta de los destinos y la de
    // los Totales del file: detecta un item que llega con otro importe sin mover el total.
    const suma = Number(items.reduce((a, i) => a + i.venta.valor, 0).toFixed(2));
    const cabeceras = await Promise.all(ciudades.map((c) => destinos.cabeceraDelDestino(c)));
    const ventaDeLosDestinos = Number(cabeceras.reduce((a, c) => a + c.venta, 0).toFixed(2));
    const totales = await destinos.totalesGrabados();
    await adjuntarTexto('Venta de los items, de los destinos y de los Totales',
      `items: ${items.map((i) => i.venta.valor).join(' + ')} = ${suma}\ndestinos: ${cabeceras.map((c) => c.texto).join('\n')}\nTotales: ${totales.texto}`);
    importes['file (Venta en Totales)'] = { moneda: item?.venta.moneda ?? '', valor: totales.venta };
    expect(suma, 'La suma de las ventas de los items tiene que dar la venta de los destinos').toBe(ventaDeLosDestinos);
    if (!itemUnico) expect(suma, 'La suma de las ventas de los items tiene que dar el total del file').toBe(totales.venta);
  });

  await paso(page, 'Conciliar los importes de punta a punta', async () => {
    await adjuntarTexto('Cadena de importes', Object.entries(importes)
      .map(([donde, i]) => `${donde.padEnd(30)} ${i.moneda || '(sin moneda)'} ${i.valor ?? '(no se pudo leer)'}`).join('\n'));
    const referencia = importes[claveDeReferencia];
    expect(referencia?.valor, `Tiene que haber un importe de referencia en ${claveDeReferencia}`).not.toBeNull();
    for (const [donde, i] of Object.entries(importes)) {
      if (i.moneda) expect(i.moneda, `La moneda tiene que ser la misma en ${donde} que en ${claveDeReferencia}`).toBe(referencia.moneda);
    }
    if (itemUnico) {
      // A) El total de venta que vio la persona (con su markup). Sin markup (pablo1 esta en 0,00
      // desde noviembre) el BO no muestra "V. markup" y la Venta del detalle es ese mismo total:
      // si hubiera un markup oculto, la Venta seria el neto y no daria.
      const conMarkup = importes['detalle (V. markup del item)']?.valor != null;
      await adjuntarTexto('Markup de la reserva', conMarkup ? 'con markup: V. markup visible en el detalle' : 'sin markup: el detalle no muestra V. markup');
      for (const donde of ['carrito (total del item)', conMarkup ? 'detalle (V. markup del item)' : 'detalle (Venta del item)']) {
        expect(importes[donde]?.valor, `El importe en ${donde} tiene que ser el total que mostro el portal`).toBe(referencia.valor);
      }
      // B) El historial, la bandeja y el file llevan el neto, que es la Venta del detalle (igual que en el sistema actual).
      const neto = importes['detalle (Venta del item)'];
      for (const donde of ['historial (total)', 'bandeja (columna Venta)', 'file (Venta del item)', 'file (Venta en Totales)']) {
        expect(importes[donde]?.valor, `El importe en ${donde} tiene que ser el neto que muestra el detalle`).toBe(neto?.valor);
      }
    } else {
      // Con varios items la cadena es una sola: el total del itinerario llega igual al
      // historial, a la bandeja y a los Totales del file.
      for (const donde of ['historial (total)', 'bandeja (columna Venta)', 'file (Venta en Totales)']) {
        expect(importes[donde]?.valor, `El importe en ${donde} tiene que ser el total que mostro el itinerario`).toBe(referencia.valor);
      }
    }
  });
}

/** Lo que se espera de una reserva de circuito: los cuatro candidatos AUTO-QA del viaje. */
export function reservaDeCircuito(sello: string, fecha: Date) {
  return {
    item: '',
    textoEnElBO: 'Park Hyatt',
    // El Backoffice escribe la habitacion abreviada: "1 DBL" en el detalle, "1 X DOBLE" en el file.
    modalidad: 'DBL',
    fecha: formatearFecha(fecha),
    fechaDeSalida: '',
    referencia: `AUTO-QA ${sello}`,
    observaciones: `Reserva de regresion automatica ${sello}. No operar.`,
    detalleDelItem: `Vuelo de llegada AR1234 ${sello}`,
    cantidadPax: 2,
    dobles: 1,
    // Los cuatro candidatos AUTO-QA que componen el viaje: si se pierde cualquiera, se marca.
    items: ['Park Hyatt', 'Tigre y Delta', 'Angelitos', 'Arakur'],
    importePorItem: {} as Record<string, string>,
    pasajeros: pasajerosDePrueba(0, sello),
    solapa: 'Multidestino' as const,
  };
}

/**
 * Del buscador de la portada a la reserva de circuito confirmada (oferta o multidestino).
 * Devuelve el codigo BOxxxxxxxx. Lo comparten los tests de circuitos y la anulacion.
 */
export async function armarCircuitoYEmitir(page: Page, opciones: {
  solapa: 'OFERTAS' | 'MULTIDESTINO'; viaje: string; fecha: Date; sello: string;
  reserva: ReservaEsperada & { dobles: number; items: string[]; importePorItem: Record<string, string> };
  importes: Record<string, Importe>;
  /**
   * Servicio del viaje en el que se elige English antes de ir al carrito (US 4739): "al pasar del carrito al
   * checkout y de ahi a la reserva, el idioma elegido y el recargo aplicado no tienen que perderse en ningun
   * paso intermedio: tienen que llegar completos hasta el item de la reserva".
   */
  idioma?: { servicioId: number; item: string };
}): Promise<string> {
  const { solapa, viaje, fecha, sello, reserva, importes } = opciones;
  const ct = new CircuitoNuevoPage(page);
  let codigo = '';

  await paso(page, `Abrir la solapa ${solapa} de INICIO y elegir el viaje`, async () => {
    await ct.buscarViaje(solapa, { pais: 'Argentina', ciudad: 'Buenos Aires', nombre: viaje, fecha });
  });

  await paso(page, 'Cargar la fecha de inicio, los pax y las habitaciones', async () => {
    await expect(ct.fechaDeSalida, 'El armado tiene que quedar con la fecha de inicio elegida').toHaveValue(reserva.fecha);
    await ct.configurarViaje(reserva.cantidadPax, reserva.dobles);
    // La salida del primer destino sale de las noches que define el viaje, no de un numero fijo.
    const noches = await ct.nochesDelDestino(0);
    const salida = new Date(fecha);
    salida.setDate(salida.getDate() + noches);
    reserva.fechaDeSalida = formatearFecha(salida);
    await adjuntarTexto('Noches del primer destino y fecha de salida', `${noches} noches -> ${reserva.fechaDeSalida}`);
  });

  await paso(page, 'Revisar el itinerario y tomar su total', async () => {
    await ct.irAlItinerario();
    const opcion = await ct.opcionesDeCotizacion();
    await adjuntarTexto('Opciones de cotizacion del itinerario', opcion.lineas.join(' | '));
    const panel = page.locator('main');
    await conResaltado(page, panel, 'Hotel del paquete en el itinerario', () => {
      expect(opcion.lineas.join(' | '), 'El itinerario tiene que armarse con el hotel del paquete').toContain('Park Hyatt');
    });
    // US 4800: "El precio de cada servicio de la cotizacion ... tiene que calcularse con el markup de
    // servicios" de la agencia. El CustomMarkup personal del usuario no entra en el circuito.
    const filas = await ct.serviciosDelItinerario(fecha);
    const servicios = await conBackofficeNuevo(page.context().browser()!, (bo) =>
      exigirServiciosDelCircuito(bo, filas, candidatos._usuarioTest.markupsDeLaAgencia.servicio));
    await adjuntarTexto('Importes de los servicios contra el costo', servicios.join(' | '));
    expect.soft(servicios.filter((l) => !l.startsWith('OK')),
      'Cada servicio del itinerario tiene que costar techo(costo / cotizacion / markup) por pasajero, con su modalidad').toEqual([]);
    // US 4800: el precio de cada hotel "tiene que calcularse con el markup de hoteles de la agencia".
    const hoteles = await conBackofficeNuevo(page.context().browser()!, (bo) =>
      exigirHotelesDelCircuito(bo, opcion.lineas, fecha, reserva.cantidadPax, candidatos._usuarioTest.markupsDeLaAgencia.hotel));
    await adjuntarTexto('Importes de los hoteles contra los cortes', hoteles.join(' | '));
    expect.soft(hoteles.filter((l) => !l.startsWith('OK')),
      'Cada hotel del itinerario tiene que costar techo(cortes DBL por persona de sus noches x pax / markup de hoteles de la agencia)').toEqual([]);
    importes['itinerario (total)'] = importe(opcion.total);
    // El total tiene que ser la habitacion mas los servicios, que es lo que el panel muestra.
    await conResaltado(page, panel, 'Total del itinerario', () => {
      expect(importes['itinerario (total)'].valor, 'El total del itinerario tiene que ser la habitacion mas los servicios')
        .toBe((importe(opcion.habitacion).valor ?? 0) + (importe(opcion.servicios).valor ?? 0));
    });
  });

  const { idioma } = opciones;
  if (idioma) {
    await paso(page, `Elegir English en ${idioma.item} del itinerario: la fila suma el recargo con el markup de la agencia (US 4739)`, async () => {
      const mk = candidatos._usuarioTest.markupsDeLaAgencia.servicio;
      const pax = reserva.cantidadPax;
      const tarifas = await conBackofficeNuevo(page.context().browser()!, (bo) => costosDelServicio(bo, idioma.servicioId));
      const tarifa = tarifaVigente(tarifas, 'Regular', fecha, pax);
      expect(tarifa, `El servicio ${idioma.servicioId} tiene que tener tarifa Regular vigente`).toBeDefined();
      const recargo = tarifa!.recargos.find((r) => /^(English|Ingl[eé]s)$/i.test(r.idioma));
      expect(recargo, `La tarifa Regular del servicio ${idioma.servicioId} tiene que tener recargo para English`).toBeDefined();
      const recargoPax = recargo!.tipo === 'porcentaje' ? tarifa!.costo! * recargo!.valor / 100 : recargo!.tipo === 'porPasajero' ? recargo!.valor : recargo!.valor / pax;
      // La fila es el total de los pasajeros: techo(costo por persona / markup de servicios de la agencia) x pax.
      const espanolEsperado = precioEsperado(tarifa!.costo!, tarifa!.moneda, mk)! * pax;
      const inglesEsperado = precioEsperado(tarifa!.costo! + recargoPax, tarifa!.moneda, mk)! * pax;
      const mod = new ModalesMultidestinoPage(page);
      const fila = page.locator('main article').filter({ hasText: new RegExp(idioma.item, 'i') }).last();
      const precio = async () => (await mod.itemsDelDestino('Buenos Aires', 'Servicios')).filter((i) => new RegExp(idioma.item, 'i').test(i.nombre)).at(-1)?.importe ?? null;
      const enEspanol = await precio();
      const totalAntes = importes['itinerario (total)'].valor;
      const combo = fila.getByRole('combobox', { name: 'Idioma', exact: true });
      await expect(combo, `La fila de ${idioma.item} tiene que tener el combo Idioma`).toBeVisible();
      const opcionesDelCombo = (await combo.locator('option').allInnerTexts()).map((o) => o.trim());
      const ingles = opcionesDelCombo.find((o) => /^(English|Ingl[eé]s)$/i.test(o));
      expect(ingles, `El combo Idioma tiene que ofrecer English. Ofrece: ${opcionesDelCombo.join(', ')}`).toBeDefined();
      await combo.selectOption({ label: ingles! });
      await expect.poll(precio, { message: 'La fila tiene que recalcular el precio al elegir English', timeout: 60_000 }).not.toBe(enEspanol);
      await page.waitForLoadState('networkidle');
      const enIngles = await precio();
      importes['itinerario (total)'] = importe((await ct.opcionesDeCotizacion()).total);
      await adjuntarTexto(`${idioma.item} en English`, [
        `Tarifa del BackOffice: ${tarifa!.vigencia} | ${tarifa!.moneda} ${tarifa!.costo} | recargos ${JSON.stringify(tarifa!.recargos)}`,
        `Fila: Espanol ${enEspanol} -> English ${enIngles}`,
        `Esperado: Espanol techo(${tarifa!.costo} / ${mk}) x ${pax} = ${espanolEsperado}; English techo((${tarifa!.costo} + ${recargoPax}) / ${mk}) x ${pax} = ${inglesEsperado}`,
        `Total del itinerario: ${totalAntes} -> ${importes['itinerario (total)'].valor}`,
      ].join('\n'));
      await conResaltado(page, fila, `${idioma.item} en English`, () => {
        expect.soft(enEspanol, `En Espanol la fila tiene que ser techo(costo / markup de la agencia) x ${pax} = ${espanolEsperado}`).toBe(espanolEsperado);
        expect.soft(enIngles, `En English la fila tiene que ser techo((costo + recargo) / markup de la agencia) x ${pax} = ${inglesEsperado} (US 4739)`).toBe(inglesEsperado);
        expect.soft((importes['itinerario (total)'].valor ?? 0) - (totalAntes ?? 0), 'El total del itinerario tiene que subir lo mismo que la fila').toBe((enIngles ?? 0) - (enEspanol ?? 0));
      });
    });
  }

  await paso(page, 'Continuar al carrito y revisar que conserve el total', async () => {
    await ct.continuarAlCarrito();
    reserva.importePorItem = await ct.importePorItem(reserva.items);
    await adjuntarTexto('Importe de cada item en el carrito', Object.entries(reserva.importePorItem).map(([k, v]) => `${k}: ${v}`).join('\n'));
    for (const [item, valor] of Object.entries(reserva.importePorItem)) {
      expect(valor, `El carrito tiene que mostrar el importe del item ${item}`).not.toBe('');
    }
    importes['carrito (total del item)'] = importe(await ct.total());
    await conResaltado(page, page.locator('main'), 'Total del carrito', () => {
      expect(importes['carrito (total del item)'].valor, 'El carrito tiene que conservar el total que mostro el itinerario')
        .toBe(importes['itinerario (total)'].valor);
    });
    reserva.pasajeros = pasajerosDePrueba(reserva.cantidadPax, sello);
    await adjuntarTexto('Datos con los que se genera la reserva', JSON.stringify(reserva, null, 2));
  });

  await paso(page, 'Cargar los pasajeros y emitir la reserva', async () => {
    await ct.completarPasajeros(reserva.pasajeros);
    await ct.completarComentarioDelItem(reserva.detalleDelItem);
    await ct.completarDatosDeLaReserva(reserva.referencia, reserva.observaciones);
    codigo = await ct.confirmarReserva();
    await adjuntarTexto('Codigo de la reserva emitida', codigo);
    expect(codigo, 'La confirmacion tiene que mostrar el codigo de la reserva').toMatch(/^BO\d{8}$/);
  });
  return codigo;
}

/**
 * Una reserva de hotel por pantalla, sin verificar el recorrido (de eso se ocupa el test
 * del hotel): el Park Hyatt de prueba, una doble para 2 adultos, una noche.
 */
export async function reservarHotelEnElPortalNuevo(page: Page, sello: string, opciones: { diasExtra: number; referencia: string; observaciones: string }): Promise<string> {
  const portal = new PortalNuevoPage(page);
  const hotel = new HotelNuevoPage(page);
  const entrada = fechaDeHotel(opciones.diasExtra);
  const salida = new Date(entrada);
  salida.setDate(salida.getDate() + 1);
  await portal.vaciarCarrito();
  await hotel.elegirHotel('Park Hyatt', 'AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau');
  await hotel.elegirFechas(entrada, salida);
  await hotel.cargarViajeros(1, 2);
  await hotel.buscar(entrada, salida);
  await hotel.abrirFicha('AUTO-QA NO TOCAR - Park Hyatt Palacio Duhau');
  await hotel.reservarHabitacion('King Deluxe - Edificio Posadas ..', 1);
  await expect.poll(() => portal.itemsEnElCarrito(), { timeout: 30_000 }).toBe(1);
  await portal.reservarDesdeElCarrito(opciones.referencia, opciones.observaciones);
  await portal.completarDatosDeLaReserva(pasajerosDePrueba(2, sello), `Vuelo de llegada AR1234 ${sello}`);
  return portal.confirmarReserva();
}
