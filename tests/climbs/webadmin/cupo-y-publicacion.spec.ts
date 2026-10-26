import { test, expect, Page } from '@playwright/test';
import { HabitacionNuevaPage } from '../../../pages/climbs/habitacion.page';
import { HotelNuevoPage } from '../../../pages/climbs/hotel.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, formatearFecha } from '../../../utils/pasos';
import candidatos from '../../../data/candidatos.json';

const E = candidatos.extensionTarifas;

/**
 * WEBADMIN — app nueva (ClimbsApp). Cupo (freesale) y publicacion de una habitacion.
 *
 * El mismo test que tests/webadmin/cupo-y-publicacion.spec.ts, con el mismo titulo. En la app
 * nueva el cupo se carga en la solapa Freesale de la habitacion ("Aplicar cupo") y la
 * publicacion es la casilla "Publicada" de Detalle; los dos se graban con el "Guardar" de la
 * ficha. Con cupo, la ficha del portal ofrece la habitacion disponible ("Todas disponibles",
 * "N disponibles"); sin cupo la sigue ofreciendo a pedido ("N noches a requerir");
 * despublicada no la ofrece.
 *
 * Sobre la habitacion propia 18371 (hotel 15422, unica habitacion del hotel), en noches
 * cercanas para que el test no venza: primero carga las tarifas de esas noches, asi no
 * depende de lo que haya quedado. Al final deja la habitacion publicada y con cupo, aunque
 * falle. En el portal nuevo se busca con el usuario de la suite, 1 habitacion y 2 adultos.
 */
test.describe('WebAdmin — cupo y publicacion de habitacion', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const ROOM = E.roomId;
  const entrada = fechaDeBusqueda(60);
  const salida = fechaDeBusqueda(62);
  const desde = formatearFecha(entrada);
  const hasta = formatearFecha(salida);
  const J = E.cargaManual.juegos[0] as Record<string, number>;

  type Estado = { ofrece: boolean; texto: string };

  /** Busca el hotel en el portal nuevo para las fechas del test y devuelve como ofrece la habitacion. */
  async function estadoEnElPortal(page: Page): Promise<Estado> {
    const hotel = new HotelNuevoPage(page);
    await hotel.elegirHotel(E.terminoBusqueda, E.hotelNombre);
    await hotel.elegirFechas(entrada, salida);
    await hotel.cargarViajeros(1, 2);
    await hotel.buscar(entrada, salida);
    await page.waitForLoadState('networkidle').catch(() => {});
    const enlace = page.locator('main article').getByRole('link').filter({ hasText: E.hotelNombre }).first();
    // El listado llega unos segundos despues de la busqueda: se espera antes de decidir que no esta.
    const sinResultados = page.getByText('No se encontraron hoteles para esta búsqueda.');
    await enlace.or(sinResultados).first().waitFor({ state: 'visible', timeout: 60_000 }).catch(() => {});
    if (!(await enlace.isVisible())) {
      const listado = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 400);
      return { ofrece: false, texto: `el listado no ofrece el hotel: ${listado}` };
    }
    await hotel.abrirFicha(E.hotelNombre);
    await page.waitForLoadState('networkidle').catch(() => {});
    const tarjetas = page.locator('main article').filter({ has: page.getByRole('button', { name: 'Confirmar' }) });
    await tarjetas.first().waitFor({ timeout: 30_000 }).catch(() => {});
    const ofrece = (await tarjetas.count()) > 0;
    const texto = ofrece ? (await tarjetas.first().innerText()).replace(/\s+/g, ' ').trim()
      : (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 600);
    return { ofrece, texto: texto.slice(0, 600) };
  }

  async function exigirEstado(page: Page, titulo: string, exigir: (e: Estado) => void) {
    const estado = await estadoEnElPortal(page);
    await adjuntarTexto(`Portal: ${titulo}`, `ofrece la habitacion: ${estado.ofrece}\n\n${estado.texto}`);
    exigir(estado);
  }

  async function cupo(hab: HabitacionNuevaPage, n: number) {
    await hab.abrir(ROOM);
    expect(await hab.aplicarCupo(desde, hasta, n), `El cupo ${n} tiene que sumarse a los cambios`).toBeNull();
    await hab.guardar();
    await calendario(hab, n);
  }

  /**
   * El calendario de Freesale de la habitacion tiene que mostrar el cupo cargado. Soft: el WebAdmin
   * lo mostraba; en la app nueva el dia muestra el mayor cupo de sus ocupaciones, y la triple (que
   * "Aplicar cupo" no toca) puede traer otro valor de antes.
   */
  async function calendario(hab: HabitacionNuevaPage, n: number) {
    await hab.abrir(ROOM);
    const visto = await hab.cupoDelDia(desde);
    await adjuntarTexto(`Calendario de Freesale el ${desde}`, `cupo cargado ${n}, el calendario muestra ${visto}`);
    expect.soft(visto, `DIFERENCIA con el WebAdmin: el calendario de Freesale tiene que mostrar el cupo ${n} cargado el ${desde}`).toBe(n);
  }

  async function publicar(hab: HabitacionNuevaPage, si: boolean) {
    await hab.abrir(ROOM);
    if ((await hab.publicada()) === si) return;
    await hab.marcarPublicada(si);
    await hab.guardar();
  }

  test('Con cupo se vende disponible, sin cupo pasa a requerir y despublicada no se ofrece', async ({ page }) => {
    test.setTimeout(600_000);
    const hab = new HabitacionNuevaPage(page);

    await paso(page, `Cargar tarifas y cupo 5 en la habitacion ${ROOM} del ${desde} al ${hasta}`, async () => {
      await publicar(hab, true);
      // El cupo solo se carga con el freesale habilitado.
      expect(await hab.freesaleHabilitado(), 'La habitacion tiene que tener el freesale habilitado').toBe(true);
      expect(await hab.cargarTarifas(desde, hasta, { single: J['1'], doble: J['2'], triple: J['3'] }), 'Las tarifas tienen que sumarse a los cambios').toBeNull();
      expect(await hab.aplicarCupo(desde, hasta, 5), 'El cupo tiene que sumarse a los cambios').toBeNull();
      await hab.guardar();
      await calendario(hab, 5);
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
        await cupo(hab, 0);
      });

      await paso(page, 'Portal: sin cupo, la habitacion pasa a requerir', async () => {
        await exigirEstado(page, 'con cupo 0', (e) => {
          expect(e.ofrece, 'Sin cupo la ficha la sigue ofreciendo, a pedido').toBe(true);
          expect(e.texto, 'Sin cupo, las noches tienen que figurar a requerir').toMatch(/NOCHES A REQUERIR/i);
          expect(e.texto, 'Sin cupo no puede figurar disponible').not.toMatch(/TODAS DISPONIBLES/i);
        });
      });

      await paso(page, 'WebAdmin: volver a cupo 5 y despublicar la habitacion', async () => {
        await cupo(hab, 5);
        await publicar(hab, false);
      });

      await paso(page, 'Portal: despublicada, la habitacion no se ofrece', async () => {
        await exigirEstado(page, 'despublicada', (e) => {
          expect(e.ofrece, 'Despublicada, el portal no tiene que ofrecer la habitacion').toBe(false);
        });
      });
    } finally {
      await paso(page, 'Restaurar: habitacion publicada y con cupo 5', async () => {
        await publicar(hab, true);
        await cupo(hab, 5);
        await adjuntarTexto('Estado final', `Habitacion ${ROOM} publicada, cupo 5 del ${desde} al ${hasta}`);
      });
    }
  });
});
