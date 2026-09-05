import { test, expect, Page, Locator } from '@playwright/test';
import { TarifarioPage } from '../../pages/tarifario.page';
import {
  paso, adjuntarTexto, resaltarYCapturar, reiniciarNumeracionDePasos,
} from '../../utils/pasos';

/**
 * BLOQUE A — operatividad dia por dia del calendario de Salidas.
 *
 * Los siete tests validan **que meses** tienen salida y cuantas subsolapas de
 * modalidad hay. Esto baja al detalle: que dia opera, que dia no, y con que
 * horario.
 *
 * El calendario se arma en cliente desde los atributos de `.svc-calendar`
 * (`ServiceSheetCalendarHtml.Render`): `data-start` es el primer dia,
 * `data-months` cuantos meses cubre y `data-days` un codigo por dia — `-1` fuera
 * de operatividad, `-2` cierre declarado por excepcion, y de 0 en adelante un
 * indice dentro de `data-schedules`, que es el horario.
 *
 * **El esperado sale de la base, no de la pantalla.** Lo gobiernan dos tablas:
 *
 *   `ServiceCalendar`  ID 1569 y 1570, IsDefault=1, modalidades 6 y 7, los siete
 *                      dias. Las tres reglas con fecha vencieron en 2025, asi que
 *                      para el periodo que se muestra rige solo la habitual.
 *   `ServiceMonth`     ID 16: **junio y julio en 0**, los otros diez meses en 1.
 *
 * De ahi sale lo que el test exige: en los meses habilitados **todos** los dias
 * operan, y en junio y julio **ninguno**. Mirar solo `ServiceCalendar` no alcanza
 * — es lo que hizo fallar la primera version de este test.
 *
 * Si esto empieza a fallar, lo primero a mirar no es el codigo sino los datos: o
 * se cargo una excepcion nueva, o cambio la regla habitual, o se habilito o
 * deshabilito un mes.
 *
 * El portal tiene selector de idioma pero **no tiene tema oscuro**: no aplica esa
 * consideracion transversal.
 */
test.describe('Tarifario — operatividad del calendario', () => {

  const EXCURSIONES = { tab: 'a-excursions', container: 'excursions-container' };
  const CANDIDATO = { nombre: 'AUTO-QA NO TOCAR - Tigre y Delta', busqueda: 'Tigre y Delta' };

  /** Cuantas modalidades tienen regla en ServiceCalendar: RateTypeID 6 y 7. */
  const MODALIDADES_ESPERADAS = 2;

  /** Meses con salida segun ServiceMonth: todos menos junio y julio. */
  const MESES_SIN_SALIDA = [6, 7];

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await page.goto('/online/');
    await new TarifarioPage(page).irDesdeElMenu();
  });

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

  test('El calendario opera todos los dias que declaran sus reglas', async ({ page }) => {
    test.setTimeout(600_000);
    const tarifario = new TarifarioPage(page);

    await paso(page, 'Abrir la ficha de la excursion candidata', async () => {
      await tarifario.seleccionarPais('Argentina');
      await tarifario.seleccionarCiudad('Buenos Aires');
      await tarifario.buscar();
      await tarifario.abrirPestania(EXCURSIONES.tab, EXCURSIONES.container);
      await tarifario.buscarPorNombre(CANDIDATO.busqueda, CANDIDATO.nombre);
      await tarifario.abrirFichaDetalle(EXCURSIONES.container);
    });

    await paso(page, 'Comparar dia por dia contra las reglas del servicio', async () => {
      const calendario = await tarifario.reglasDelCalendario();
      const { inicio, meses, dias, horarios, notas } = calendario;

      await adjuntarTexto('Calendario de Salidas', [
        `inicio: ${inicio}`,
        `meses: ${meses}`,
        `dias: ${dias.length}`,
        `horarios: ${JSON.stringify(horarios)}`,
        `notas: ${JSON.stringify(notas)}`,
      ].join(String.fromCharCode(10)));

      const panel = tarifario.locatorPanelDeSolapa('calendar');

      await conResaltado(page, panel, 'El calendario trae datos', () => {
        expect(dias.length, 'El calendario tiene que traer un codigo por dia').toBeGreaterThan(0);
        expect(meses, 'El calendario tiene que declarar cuantos meses cubre').toBeGreaterThan(0);
      });

      // Cada codigo >= 0 es un indice dentro de data-schedules: si apuntara fuera
      // del arreglo, el dia se dibujaria sin horario.
      const fueraDeRango = dias.filter((c) => c >= 0 && c >= horarios.length);
      await conResaltado(page, panel, 'Horarios de los dias operables', () => {
        expect(fueraDeRango.length,
          `Todos los dias con salida tienen que apuntar a un horario cargado. ` +
          `Hay ${fueraDeRango.length} dias apuntando fuera de los ${horarios.length} horarios.`)
          .toBe(0);
        expect(horarios.length,
          'Un servicio con salidas tiene que declarar al menos un horario')
          .toBeGreaterThan(0);
      });

      // Cada dia se compara contra el mes al que pertenece: en los meses
      // habilitados por ServiceMonth tiene que operar, y en junio y julio no.
      const desde = new Date(inicio + (inicio.length <= 10 ? 'T00:00:00' : ''));
      const fechaDe = (i: number) =>
        new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i);
      const nombrar = (i: number) => {
        const d = fechaDe(i);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      };

      const deberianOperar: number[] = [];
      const noDeberianOperar: number[] = [];
      dias.forEach((codigo, i) => {
        const mes = fechaDe(i).getMonth() + 1;
        const habilitado = !MESES_SIN_SALIDA.includes(mes);
        if (habilitado && codigo < 0) deberianOperar.push(i);
        if (!habilitado && codigo >= 0) noDeberianOperar.push(i);
      });

      if (deberianOperar.length) {
        await adjuntarTexto('Dias sin salida en meses habilitados',
          deberianOperar.slice(0, 40).map(nombrar).join(' | '));
      }
      if (noDeberianOperar.length) {
        await adjuntarTexto('Dias con salida en meses deshabilitados',
          noDeberianOperar.slice(0, 40).map(nombrar).join(' | '));
      }

      await conResaltado(page, panel, 'Operatividad en los meses habilitados', () => {
        expect(deberianOperar.length,
          'En los meses que ServiceMonth habilita, la regla habitual cubre los siete dias de la ' +
          `semana, asi que todos tienen que tener salida. Quedaron ${deberianOperar.length} sin ` +
          `salida, empezando por ${deberianOperar.length ? nombrar(deberianOperar[0]) : '-'}`)
          .toBe(0);
      });

      await conResaltado(page, panel, 'Meses sin salida', () => {
        expect(noDeberianOperar.length,
          `Junio y julio estan deshabilitados en ServiceMonth, asi que ningun dia de esos meses ` +
          `puede tener salida. Quedaron ${noDeberianOperar.length}, empezando por ` +
          `${noDeberianOperar.length ? nombrar(noDeberianOperar[0]) : '-'}`)
          .toBe(0);
      });

      // Un dia sin salida en un mes deshabilitado es "fuera de operatividad"
      // (-1), no "cierre por excepcion" (-2): el servicio no tiene excepciones
      // cargadas y confundirlos cambiaria lo que ve la persona.
      const cerrados = dias.map((c, i) => ({ c, i })).filter((x) => x.c === -2);
      if (cerrados.length) {
        await adjuntarTexto('Dias cerrados por excepcion',
          cerrados.slice(0, 40).map((x) => nombrar(x.i)).join(' | '));
      }
      await conResaltado(page, panel, 'Dias cerrados por excepcion', () => {
        expect(cerrados.length,
          'El servicio no tiene excepciones de cierre cargadas, asi que ningun dia puede ' +
          `figurar cerrado. Quedaron ${cerrados.length}, empezando por ` +
          `${cerrados.length ? nombrar(cerrados[0].i) : '-'}`)
          .toBe(0);
      });
    });

    await paso(page, 'Las modalidades del calendario son las que tienen regla', async () => {
      const { modalidades } = await tarifario.calendarioDeSalidas();
      await adjuntarTexto('Modalidades del calendario', modalidades.join(' | '));

      // ServiceCalendar tiene una regla habitual por modalidad: RateTypeID 6 y 7.
      await conResaltado(page, tarifario.locatorPanelDeSolapa('calendar'), 'Modalidades', () => {
        expect(modalidades.length,
          'El calendario tiene que ofrecer una subsolapa por modalidad con regla cargada')
          .toBe(MODALIDADES_ESPERADAS);
      });
    });
  });
});
