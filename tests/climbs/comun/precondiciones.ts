import { Page, expect } from '@playwright/test';
import { PortalNuevoPage, PasajeroNuevo } from '../../../pages/climbs/portal.page';
import { BackofficeNuevoPage, ImporteNuevo } from '../../../pages/climbs/backoffice.page';
import { paso, adjuntarTexto, fechaDeBusqueda, formatearFecha, selloEnLetras } from '../../../utils/pasos';

/**
 * Precondiciones de la app nueva, por pantalla y como un usuario real: la agencia
 * reserva en el portal (`/site`) y el personal genera el file en el Backoffice.
 *
 * Es la misma precondicion de la suite actual (tests/bloque-c/cobranzas-comun.ts):
 * el servicio "AUTO-QA NO TOCAR - Tigre y Delta", modalidad Regular, con el minimo de
 * pasajeros, a una semana. Cada test genera la suya: un item de file solo se imputa una vez.
 */
export const SERVICIO_DE_REGRESION = {
  nombre: 'AUTO-QA NO TOCAR - Tigre y Delta',
  termino: 'Tigre y Delta',
  modalidad: 'Regular',
};

export type ReservaNueva = {
  referencia: string;
  fecha: string;
  apellidoDelPax: string;
  cantidadPax: number;
  pasajeros: PasajeroNuevo[];
  /** Codigo que muestra el portal al confirmar, ej. "BO00025832". */
  codigo: string;
};

export async function reservarServicioEnElPortalNuevo(page: Page, sello: string): Promise<ReservaNueva> {
  const portal = new PortalNuevoPage(page);
  const fecha = fechaDeBusqueda();
  const referencia = `AUTO-QA ${sello}`;
  const apellido = `Regresion${selloEnLetras(sello.slice(-6))}`;
  let cantidadPax = 0;
  let pasajeros: PasajeroNuevo[] = [];
  let codigo = '';

  await paso(page, 'Portal nuevo: reservar el servicio de regresion y confirmar la reserva', async () => {
    await portal.vaciarCarrito();
    await portal.buscarServicios(fecha);
    await portal.elegirServicio(SERVICIO_DE_REGRESION.termino, SERVICIO_DE_REGRESION.nombre);
    await expect(portal.bloqueDeModalidad(SERVICIO_DE_REGRESION.modalidad),
      `La ficha tiene que ofrecer la modalidad ${SERVICIO_DE_REGRESION.modalidad} para el ${formatearFecha(fecha)}`).toBeVisible();
    cantidadPax = await portal.minimoDePasajeros(SERVICIO_DE_REGRESION.modalidad);
    await portal.agregarAlCarrito(SERVICIO_DE_REGRESION.modalidad, cantidadPax);
    // El contador cuenta items, no pasajeros: una sola excursion.
    await expect.poll(() => portal.itemsEnElCarrito(), { timeout: 30_000 }).toBe(1);

    pasajeros = Array.from({ length: cantidadPax }, (_, i) => ({
      nombre: `Pasajero${['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho'][i] ?? 'Extra'}`,
      apellido,
      nacimiento: `0${i + 1}/03/1990`,
      nacionalidad: 'Argentina',
      pasaporte: `QA${sello.slice(-8)}${i + 1}`,
    }));
    await portal.reservarDesdeElCarrito(referencia, `Reserva de regresion automatica ${sello}. No operar.`);
    await portal.completarDatosDeLaReserva(pasajeros, `Vuelo de llegada AR1234 ${sello}`);
    codigo = await portal.confirmarReserva();
    await adjuntarTexto('Reserva confirmada en el portal nuevo', `${codigo} · ${referencia} · ${cantidadPax} pax · ${formatearFecha(fecha)}`);
  });

  return { referencia, fecha: formatearFecha(fecha), apellidoDelPax: apellido, cantidadPax, pasajeros, codigo };
}

export type FileNuevo = ReservaNueva & {
  fileId: string;
  fileCode: string;
  cliente: string;
  costoDelItem: ImporteNuevo;
  ventaDelItem: ImporteNuevo;
};

/**
 * Lo que un usuario ya tendria hecho antes de facturar: la reserva del portal y su file
 * generado desde la bandeja del Backoffice. No se verifica aca —de eso se ocupa el bloque
 * de Reservas—, pero se corta con un motivo claro si algo no esta.
 */
export async function reservarServicioYGenerarFile(page: Page, sello: string): Promise<FileNuevo> {
  const reserva = await reservarServicioEnElPortalNuevo(page, sello);
  const bo = new BackofficeNuevoPage(page);
  let file = { fileId: '', fileCode: '' };
  let cliente = '';
  let item = { costo: { moneda: '', valor: null } as ImporteNuevo, venta: { moneda: '', valor: null } as ImporteNuevo, texto: '' };

  await paso(page, 'Backoffice nuevo: generar el file de la reserva desde la bandeja', async () => {
    const dialogo = await bo.abrirReservaDeLaBandeja(reserva.codigo);
    file = await bo.generarFile(dialogo, 'Argentina');
    expect(file.fileId, 'Generar el file tiene que devolver su id').toMatch(/^\d+$/);
    cliente = await bo.clienteDelFile();
    item = await bo.importesDelItem(SERVICIO_DE_REGRESION.termino);
    await adjuntarTexto('Precondicion generada', [
      `Reserva: ${reserva.codigo}`,
      `File: ${file.fileCode} (id ${file.fileId})`,
      `Cliente: ${cliente}`,
      `Item: ${item.texto}`,
    ].join('\n'));
    expect(cliente, 'El file tiene que quedar con el cliente de la agencia').not.toBe('');
    // Sin costo no hay nada que facturar al proveedor; sin venta, nada al cliente.
    expect(item.costo.valor, 'El item del file tiene que tener costo. Si viene en cero, revisar las tarifas de costo del servicio').toBeGreaterThan(0);
    expect(item.venta.valor, 'El item del file tiene que tener venta').toBeGreaterThan(0);
  });

  return { ...reserva, ...file, cliente, costoDelItem: item.costo, ventaDelItem: item.venta };
}
