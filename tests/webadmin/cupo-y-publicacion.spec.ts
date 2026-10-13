import { test, expect, Page } from '@playwright/test';
import { WebAdminTarifasHabitacionPage } from '../../pages/webadmin-tarifas-habitacion.page';
import { InicioPage } from '../../pages/inicio.page';
import { HotelPage } from '../../pages/hotel.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, formatearFecha, esperarFinDeCarga } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const E = candidatos.extensionTarifas;

/**
 * WebAdmin — cupo (freesale) y publicacion de una habitacion.
 *
 * Es lo que decide como se vende una habitacion. Con cupo, la ficha del portal la
 * ofrece disponible ("Todas disponibles", "N disponibles"); sin cupo la sigue
 * ofreciendo pero a pedido ("N noches a requerir"); despublicada no la ofrece. Si se
 * rompe, se vende como confirmada una habitacion sin cupo, o se deja de vender.
 *
 * Sobre la habitacion propia 18371 (hotel 15422, unica habitacion del hotel), en
 * noches cercanas para que el test no venza: primero carga las tarifas de esas
 * noches, asi no depende de lo que haya quedado. Al final deja la habitacion
 * publicada y con cupo, aunque falle.
 *
 * En el portal se busca con pablo1, 1 habitacion y 2 adultos.
 */
test.describe('WebAdmin — cupo y publicacion de habitacion', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const ROOM = E.roomId;
  const HOTEL_ID = E.hotelId;
  const entrada = fechaDeBusqueda(60);
  const salida = fechaDeBusqueda(62);
  // Las noches son la de entrada y la siguiente: el dia de salida no se cobra, pero
  // se carga igual para no depender de como cuente el buscador.
  const desde = formatearFecha(entrada);
  const hasta = formatearFecha(salida);

  type Estado = { ofrece: boolean; texto: string };

  /**
   * Busca el hotel en el portal para las fechas del test y devuelve como lo ofrece:
   * si el listado lo trae y la ficha tiene la habitacion, y el texto de la ficha
   * para leer su disponibilidad.
   */
  async function estadoEnElPortal(page: Page): Promise<Estado> {
    const inicio = new InicioPage(page);
    const hotel = new HotelPage(page);
    await inicio.abrir();
    await inicio.abrirSolapa('hoteles');
    await hotel.verificarResidente();
    await hotel.elegirHotel(HOTEL_ID, E.hotelNombre.replace(/^AUTO-QA NO TOCAR - /, ''));
    await hotel.fijarViajeros(1, 2);
    await hotel.elegirFechas(entrada, salida);
    await expect(page.locator(hotel.campoFechas), 'El calendario tiene que quedar con las fechas del test')
      .toHaveValue(`${desde} - ${hasta}`);
    await hotel.buscar();

    const enlace = page.locator(`a[href*='hoteldetail.aspx'][href*='hotel=${HOTEL_ID}']`).first();
    // El listado carga por partes: se espera a que termine antes de decidir que no esta.
    await esperarFinDeCarga(page);
    if (!(await enlace.isVisible({ timeout: 30_000 }).catch(() => false))) {
      return { ofrece: false, texto: 'el listado no ofrece el hotel' };
    }

    await enlace.click();
    await page.waitForURL(/hoteldetail/i, { timeout: 90_000 });
    await esperarFinDeCarga(page);
    await page.waitForFunction(() => {
      const w = window as any;
      return typeof w.jQuery === 'undefined' || w.jQuery.active === 0;
    }, undefined, { timeout: 60_000 });
    const ofrece = await page.locator("[onclick*='Guardar']").first().isVisible({ timeout: 30_000 }).catch(() => false);
    const cuerpo = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const desdeLaHabitacion = cuerpo.slice(Math.max(0, cuerpo.search(/Disponibilidad de la habitaci/i)));
    return { ofrece, texto: desdeLaHabitacion.slice(0, 600) };
  }

  async function exigirEstado(page: Page, titulo: string, exigir: (e: Estado) => void) {
    const estado = await estadoEnElPortal(page);
    await adjuntarTexto(`Portal: ${titulo}`, `ofrece la habitacion: ${estado.ofrece}

${estado.texto}`);
    exigir(estado);
  }

  test('Con cupo se vende disponible, sin cupo pasa a requerir y despublicada no se ofrece', async ({ page }) => {
    test.setTimeout(600_000);
    const admin = new WebAdminTarifasHabitacionPage(page);

    await paso(page, `Cargar tarifas y cupo 5 en la habitacion ${ROOM} del ${desde} al ${hasta}`, async () => {
      // El cupo solo se administra en habitaciones con "Tiene freesale".
      await admin.guardarDetalle(ROOM, { publicada: true, freesale: true });
      await admin.cargarTarifas(ROOM, desde, hasta, E.cargaManual.juegos[0] as Record<number, number>);
      await admin.guardarCupo(ROOM, desde, hasta, 5);
    });

    try {
      await paso(page, 'Portal: con cupo 5, la habitacion se ofrece disponible', async () => {
        await exigirEstado(page, 'con cupo 5', (e) => {
          expect(e.ofrece, 'La ficha tiene que ofrecer la habitacion').toBe(true);
          expect(e.texto, 'Con cupo, las noches tienen que figurar disponibles').toMatch(/TODAS DISPONIBLES/i);
          expect(e.texto, 'Tiene que mostrar el cupo cargado').toMatch(/\b5 DISPONIBLES/i);
        });
      });

      await paso(page, 'WebAdmin: dejar el cupo en 0', async () => {
        await admin.guardarCupo(ROOM, desde, hasta, 0);
      });

      await paso(page, 'Portal: sin cupo, la habitacion pasa a requerir', async () => {
        await exigirEstado(page, 'con cupo 0', (e) => {
          expect(e.ofrece, 'Sin cupo la ficha la sigue ofreciendo, a pedido').toBe(true);
          expect(e.texto, 'Sin cupo, las noches tienen que figurar a requerir').toMatch(/NOCHES A REQUERIR/i);
          expect(e.texto, 'Sin cupo no puede figurar disponible').not.toMatch(/TODAS DISPONIBLES/i);
        });
      });

      await paso(page, 'WebAdmin: volver a cupo 5 y despublicar la habitacion', async () => {
        await admin.guardarCupo(ROOM, desde, hasta, 5);
        await admin.publicarHabitacion(ROOM, false);
      });

      await paso(page, 'Portal: despublicada, la habitacion no se ofrece', async () => {
        await exigirEstado(page, 'despublicada', (e) => {
          expect(e.ofrece, 'Despublicada, el portal no tiene que ofrecer la habitacion').toBe(false);
        });
      });
    } finally {
      await paso(page, 'Restaurar: habitacion publicada y con cupo 5', async () => {
        await admin.publicarHabitacion(ROOM, true);
        await admin.guardarCupo(ROOM, desde, hasta, 5);
        await adjuntarTexto('Estado final', `Habitacion ${ROOM} publicada, cupo 5 del ${desde} al ${hasta}`);
      });
    }
  });
});
