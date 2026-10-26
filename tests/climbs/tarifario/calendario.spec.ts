import { test, expect } from '@playwright/test';
import { TarifarioNuevoPage } from '../../../pages/climbs/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';

/**
 * TARIFARIO — app nueva (ClimbsApp). Operatividad dia por dia de la solapa Salidas de la ficha.
 *
 * El mismo test que tests/bloque-a/calendario.spec.ts. Lo esperado sale de la base: el
 * Tigre y Delta tiene la regla habitual en sus dos modalidades (los siete dias) y ServiceMonth
 * deshabilita junio y julio. Asi que en los meses habilitados todos los dias operan, en junio
 * y julio ninguno, y ningun dia figura cerrado por excepcion.
 *
 * Cada dia del calendario es un `.cal-day` con su fecha en el title ("01/10/2026 · Test", la
 * fecha y el horario): `on` si opera; el resto, sin salida o cerrado.
 */
test.describe('Tarifario — operatividad del calendario', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  const CANDIDATO = { nombre: 'AUTO-QA NO TOCAR - Tigre y Delta', busqueda: 'Tigre y Delta' };
  const MODALIDADES_ESPERADAS = 2;
  const MESES_SIN_SALIDA = [6, 7];

  test('El calendario opera todos los dias que declaran sus reglas', async ({ page }) => {
    test.setTimeout(600_000);
    const t = new TarifarioNuevoPage(page);

    await paso(page, 'Abrir la ficha de la excursion candidata', async () => {
      await t.irDesdeElMenu();
      await t.filtrar('Argentina', 'Buenos Aires');
      await t.abrirSolapa('Excursiones');
      await t.buscarPorNombre(CANDIDATO.busqueda, CANDIDATO.nombre);
      await t.abrirDetalle(t.card(CANDIDATO.nombre));
      await t.abrirSolapaDelDetalle('Salidas');
    });

    await paso(page, 'Comparar dia por dia contra las reglas del servicio', async () => {
      // Se recorre un anio, de a tres meses, leyendo cada dia: fecha, si opera, si esta cerrado y su horario.
      type Dia = { fecha: string; mes: number; opera: boolean; cerrado: boolean; horario: string };
      const dias: Dia[] = [];
      for (let i = 0; i < 4; i++) {
        dias.push(...await t.dialogo.locator('.cal-day[title]').evaluateAll((ds) => ds.map((d) => {
          const titulo = d.getAttribute('title') ?? '';
          const [fecha, horario] = titulo.split(' · ');
          return { fecha, mes: Number(fecha.split('/')[1]), opera: d.classList.contains('on'), cerrado: /closed|cierre|cerrad/i.test(d.className), horario: (horario ?? '').trim() };
        })));
        const sig = t.dialogo.getByRole('button', { name: 'Meses siguientes' });
        if (await sig.isDisabled()) break;
        await sig.click();
        await page.waitForTimeout(300);
      }
      const unicos = [...new Map(dias.map((d) => [d.fecha, d])).values()];
      const deberianOperar = unicos.filter((d) => !MESES_SIN_SALIDA.includes(d.mes) && !d.opera);
      const noDeberianOperar = unicos.filter((d) => MESES_SIN_SALIDA.includes(d.mes) && d.opera);
      const sinHorario = unicos.filter((d) => d.opera && !d.horario);
      const cerrados = unicos.filter((d) => d.cerrado);
      await adjuntarTexto('Calendario de Salidas', [
        `dias leidos: ${unicos.length} (${unicos[0]?.fecha} a ${unicos.at(-1)?.fecha})`,
        `operan: ${unicos.filter((d) => d.opera).length}`,
        `sin salida en meses habilitados: ${deberianOperar.slice(0, 40).map((d) => d.fecha).join(' | ') || '-'}`,
        `con salida en junio/julio: ${noDeberianOperar.slice(0, 40).map((d) => d.fecha).join(' | ') || '-'}`,
        `cerrados: ${cerrados.slice(0, 40).map((d) => d.fecha).join(' | ') || '-'}`,
      ].join('\n'));
      const panel = t.dialogo;
      await conResaltado(page, panel, 'El calendario trae datos', () => {
        expect(unicos.length, 'El calendario tiene que traer los dias de los meses que muestra').toBeGreaterThan(0);
      });
      await conResaltado(page, panel, 'Horarios de los dias operables', () => {
        expect(sinHorario.length, `Todos los dias con salida tienen que tener un horario. Hay ${sinHorario.length} sin horario`).toBe(0);
      });
      await conResaltado(page, panel, 'Operatividad en los meses habilitados', () => {
        expect(deberianOperar.length, `En los meses habilitados todos los dias tienen que tener salida. Quedaron ${deberianOperar.length} sin salida, empezando por ${deberianOperar[0]?.fecha ?? '-'}`).toBe(0);
      });
      await conResaltado(page, panel, 'Meses sin salida', () => {
        expect(noDeberianOperar.length, `Junio y julio estan deshabilitados: ningun dia puede tener salida. Quedaron ${noDeberianOperar.length}, empezando por ${noDeberianOperar[0]?.fecha ?? '-'}`).toBe(0);
      });
      await conResaltado(page, panel, 'Dias cerrados por excepcion', () => {
        expect(cerrados.length, `El servicio no tiene excepciones de cierre cargadas. Quedaron ${cerrados.length}, empezando por ${cerrados[0]?.fecha ?? '-'}`).toBe(0);
      });
    });

    await paso(page, 'Las modalidades del calendario son las que tienen regla', async () => {
      const modalidades = (await t.dialogo.getByRole('tablist', { name: 'Salidas' }).getByRole('tab').allInnerTexts()).map((x) => x.trim());
      await adjuntarTexto('Modalidades del calendario', modalidades.join(' | '));
      expect(modalidades.length, 'El calendario tiene que ofrecer una subsolapa por modalidad con regla cargada').toBe(MODALIDADES_ESPERADAS);
    });
  });
});
