import { expect, Page } from '@playwright/test';
import { PortalNuevoPage, PasajeroNuevo } from '../../../pages/climbs/portal.page';
import { BackofficeNuevoPage } from '../../../pages/climbs/backoffice.page';
import { ServiciosDelDestinoPage } from '../../../pages/climbs/servicios-del-destino.page';
import { leerTabla } from '../../../pages/climbs/tabla';
import { paso, adjuntarTexto, conResaltado, importeANumero, selloEnLetras } from '../../../utils/pasos';

/**
 * Lo que comparten los tests de Reservas de la app nueva. Es el mismo recorrido que
 * tests/bloque-b/reservas-comun.ts, por las pantallas nuevas: el detalle de la reserva en
 * el portal, la bandeja del Backoffice, el detalle con "Generar file", la ficha del file,
 * su rooming y "Destinos y servicios". **No es un archivo de test** (no termina en .spec.ts).
 */

export type Importe = { moneda: string; valor: number | null };

/** "USD 190,00" / "96 USD" / "USD 2.670" -> { moneda, valor }. La app nueva escribe todo en formato es-AR. */
export const importe = (texto: string): Importe => {
  const limpio = (texto || '').replace(/\s+/g, ' ').trim();
  const m = limpio.match(/([A-Z]{3})\s*(-?\d[\d.]*(?:,\d+)?)|(-?\d[\d.]*(?:,\d+)?)\s*([A-Z]{3})/);
  return { moneda: m?.[1] ?? m?.[4] ?? '', valor: importeANumero(m?.[2] ?? m?.[3] ?? '') };
};

/** Fecha sin ceros a la izquierda, para comparar fechas escritas de distinta forma. */
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
}) {
  const { page, codigo, reserva, contexto, importes } = opciones;
  const portal = new PortalNuevoPage(page);
  const bo = new BackofficeNuevoPage(page);
  const destinos = new ServiciosDelDestinoPage(page);
  const modalidadEnElFile = opciones.modalidadEnElFile ?? reserva.modalidad;
  const principal = reserva.pasajeros[0];

  await paso(page, 'Abrir el detalle de la reserva en el portal y verificar los comentarios', async () => {
    const fila = await portal.filaDelHistorial(codigo, reserva.solapa);
    const textoDeLaFila = (await fila.innerText()).replace(/\s+/g, ' ');
    importes['historial (total)'] = importe(textoDeLaFila.match(/[A-Z]{3}\s*[\d.,]+\s*$/)?.[0] ?? '');
    await adjuntarTexto('Fila del historial', textoDeLaFila);

    await portal.abrirDetalleDeLaReserva(fila, codigo);
    const detalle = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    await adjuntarTexto('Detalle de la reserva en el portal', detalle);
    const main = page.locator('main');
    await conResaltado(page, main, 'Comentario del item en el detalle', () => {
      expect(detalle, 'El detalle de la reserva tiene que mostrar el comentario cargado en el item').toContain(reserva.detalleDelItem);
    });
    await conResaltado(page, main, 'Observaciones en el detalle de la reserva', async () => {
      expect(await portal.datoDelDetalle('Comentario(s)'), 'El detalle de la reserva tiene que mostrar las observaciones cargadas')
        .toBe(reserva.observaciones);
    });
  });

  let dialogo = page.getByRole('dialog').first();
  await paso(page, 'Ubicar la reserva en la bandeja del Backoffice y comparar la fila', async () => {
    const fila = await bo.filaDeLaBandeja(codigo);
    const texto = (await fila.innerText()).replace(/\s+/g, ' ');
    await adjuntarTexto('Fila de la bandeja', texto);
    await conResaltado(page, fila, 'Referencia en la bandeja', () => {
      expect(texto, 'La bandeja tiene que mostrar la referencia cargada en el portal').toContain(reserva.referencia);
    });
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
      'ib-ref': reserva.referencia,
      'ib-comment': reserva.observaciones,
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
  });

  let file = { fileId: '', fileCode: '' };
  await paso(page, 'Elegir la sucursal y generar el file desde el detalle', async () => {
    file = await bo.generarFile(dialogo, 'Argentina');
    await adjuntarTexto('File generado', `Reserva ${codigo} -> file ${file.fileCode} (id ${file.fileId})`);
  });

  await paso(page, 'Comparar los datos del file contra los cargados en el portal', async () => {
    const esperados: Record<string, string> = {
      'Cant. pax': String(reserva.cantidadPax),
      'Referencia del cliente': reserva.referencia,
      // Las observaciones de la reserva son las de "Uso interno" (en el BO viejo, txtComment).
      'Uso interno': reserva.observaciones,
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
    const ciudad = 'Buenos Aires';
    const items = await destinos.itemsDeLaFicha(ciudad);
    await adjuntarTexto('Items del file', items.map((i) => i.texto).join('\n'));
    const item = items.find((i) => i.texto.toUpperCase().includes(reserva.textoEnElBO.toUpperCase()));
    const fila = destinos.destino(ciudad).locator('tbody tr').filter({ hasText: reserva.textoEnElBO }).first();
    await conResaltado(page, fila, 'Servicio reservado en el file', () => {
      expect(item, `El file tiene que mostrar el item ${reserva.textoEnElBO}`).toBeTruthy();
      expect(item?.checkin, 'El file tiene que mostrar la fecha de la reserva').toBe(reserva.fecha);
      expect(item?.texto.toUpperCase(), 'El file tiene que mostrar la modalidad reservada').toContain(modalidadEnElFile.toUpperCase());
    });
    importes['file (Venta del item)'] = { moneda: item?.venta.moneda ?? '', valor: item?.venta.valor ?? null };

    // El equivalente del "ojito" del BO viejo: ningun item oculto al pasajero (lo que se
    // oculta no sale en SIX). La ficha lo cuenta en el filtro "Ocultos al pasajero".
    const ocultos = bo.fichaDelFile.getByRole('button', { name: /^Ocultos al pasajero/ });
    await conResaltado(page, ocultos, 'Items ocultos al pasajero', async () => {
      expect((await ocultos.innerText()).replace(/\s+/g, ' ').trim(), 'Los items reservados tienen que quedar visibles para el pasajero')
        .toBe('Ocultos al pasajero 0');
    });

    // La suma de las ventas de los items tiene que dar la venta del destino y la de los
    // Totales del file: detecta un item que llega con otro importe sin mover el total.
    const suma = items.reduce((a, i) => a + i.venta.valor, 0);
    const cabecera = await destinos.cabeceraDelDestino(ciudad);
    const totales = await destinos.totalesGrabados();
    await adjuntarTexto('Venta de los items, del destino y de los Totales', `items: ${items.map((i) => i.venta.valor).join(' + ')} = ${suma}\ndestino: ${cabecera.texto}\nTotales: ${totales.texto}`);
    importes['file (Venta en Totales)'] = { moneda: item?.venta.moneda ?? '', valor: totales.venta };
    expect(suma, 'La suma de las ventas de los items tiene que dar la venta del destino').toBe(cabecera.venta);
  });

  await paso(page, 'Conciliar los importes de punta a punta', async () => {
    await adjuntarTexto('Cadena de importes', Object.entries(importes)
      .map(([donde, i]) => `${donde.padEnd(30)} ${i.moneda || '(sin moneda)'} ${i.valor ?? '(no se pudo leer)'}`).join('\n'));
    const referencia = importes['ficha (total)'];
    expect(referencia?.valor, 'Tiene que haber un importe de referencia en la ficha').not.toBeNull();
    for (const [donde, i] of Object.entries(importes)) {
      if (i.moneda) expect(i.moneda, `La moneda tiene que ser la misma en ${donde} que en la ficha`).toBe(referencia.moneda);
    }
    // A) El total de venta que vio la persona (con su markup).
    for (const donde of ['carrito (total del item)', 'detalle (V. markup del item)']) {
      expect(importes[donde]?.valor, `El importe en ${donde} tiene que ser el total que mostro el portal`).toBe(referencia.valor);
    }
    // B) El historial, la bandeja y el file llevan el neto, que es la Venta del detalle (igual que en el sistema actual).
    const neto = importes['detalle (Venta del item)'];
    for (const donde of ['historial (total)', 'bandeja (columna Venta)', 'file (Venta del item)', 'file (Venta en Totales)']) {
      expect(importes[donde]?.valor, `El importe en ${donde} tiene que ser el neto que muestra el detalle`).toBe(neto?.valor);
    }
  });
}
