import { test, expect } from '@playwright/test';
import { HabitacionNuevaPage, Corte } from '../../../pages/climbs/habitacion.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import candidatos from '../../../data/candidatos.json';

const E = candidatos.extensionTarifas;
const SALTO = String.fromCharCode(10);

/**
 * WEBADMIN — app nueva (ClimbsApp). Extension de tarifas de una habitacion.
 *
 * El mismo test que tests/webadmin/extender-tarifas.spec.ts, con el mismo titulo. En la app
 * nueva no hay WebAdmin: la habitacion se administra en el Backoffice (/hotels/rooms/{id}),
 * solapas Tarifas / Tarifario. "Extender" no graba al aceptar: suma el cambio a "Cambios
 * sin guardar" (el Tarifario muestra la vista previa) y se escribe con "Guardar".
 *
 * Misma habitacion propia 18371 (hotel 15422) y mismo corte base de enero 2028
 * (100 / 60 / 50 por pax), asi los esperados son exactos:
 * - enero +10% a marzo  -> 110 / 66 / 55, "+10 %"
 * - marzo +10% a mayo   -> 121 / 72,60 / 60,50, "+21 %" (contra la ultima tarifa real).
 * Cada corrida pisa sus propios rangos de marzo y mayo 2028: es repetible sin limpiar.
 *
 * Equivalencias con el WebAdmin: la "vista previa" del modal es el Tarifario con los cambios
 * sin guardar; el aviso "Ya hay tarifas cargadas, se van a reemplazar" es el resumen de
 * cambios ("N dias modificados") y su Cancelar es "Descartar todo".
 */
test.describe('WebAdmin — extension de tarifas de habitacion', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const ROOM = E.roomId;
  const B = E.corteBase;
  const P1 = E.primeraExtension;
  const P2 = E.segundaExtension;

  const formato = (c: Corte) =>
    `${c.desde} - ${c.hasta} | SGL ${c.sgl} | DBL ${c.dbl} | TPL ${c.tpl} | ${c.extendida ? 'Extendida' : '-'}${c.observacion ? ` | ${c.observacion}` : ''}`;

  /** Los importes del Tarifario van con dos decimales: se acepta el redondeo al centavo. */
  function exigirCorte(cortes: Corte[], desde: string, hasta: string,
    esperado: { sgl: number; dbl: number; tpl: number }, extendida: boolean) {
    const corte = cortes.find((c) => c.desde === desde && c.hasta === hasta);
    expect(corte, `El Tarifario tiene que tener el corte ${desde} - ${hasta}`).toBeTruthy();
    for (const tipo of ['sgl', 'dbl', 'tpl'] as const) {
      expect(Math.abs((corte![tipo] ?? NaN) - esperado[tipo]),
        `${tipo.toUpperCase()} del corte ${desde} - ${hasta}: esperado ${esperado[tipo]}, se ve ${corte![tipo]}`)
        .toBeLessThanOrEqual(0.01);
    }
    expect(corte!.extendida, `La marca de tarifa extendida del corte ${desde} - ${hasta}`).toBe(extendida);
  }

  test('Extender un corte con incremento crea las tarifas del rango y se puede volver a extender', async ({ page }) => {
    test.setTimeout(600_000);
    const hab = new HabitacionNuevaPage(page);
    const factor1 = 1 + P1.porcentaje / 100;
    const factorTotal = 1 + P2.porcentajeTotal / 100;
    const primera = { sgl: B.sgl * factor1, dbl: B.dbl * factor1, tpl: B.tpl * factor1 };
    const segunda = { sgl: B.sgl * factorTotal, dbl: B.dbl * factorTotal, tpl: B.tpl * factorTotal };
    let pendientesDeLaPrimera = '';

    await paso(page, `Generar el tarifario de la habitacion ${ROOM}`, async () => {
      await hab.abrir(ROOM);
      await hab.regenerarTarifario();
      const cortes = await hab.tarifario();
      await adjuntarTexto('Tarifario despues de generar', cortes.map(formato).join(SALTO));
      exigirCorte(cortes, B.desde, B.hasta, B, false);
    });

    await paso(page, `Extender ${B.desde} - ${B.hasta} un ${P1.porcentaje}% a ${P1.desde} - ${P1.hasta}: la vista previa`, async () => {
      const origenes = await hab.origenesParaExtender();
      await adjuntarTexto('Cortes del combo Origen', origenes.join(SALTO));
      const error = await hab.extender(B, P1.desde, P1.hasta, String(P1.porcentaje));
      expect(error, 'La extension tiene que sumarse a los cambios sin error').toBeNull();
      pendientesDeLaPrimera = await hab.textoDePendientes();
      await adjuntarTexto('Cambios sin guardar', pendientesDeLaPrimera);
      const cortes = await hab.tarifario();
      await adjuntarTexto('Vista previa del Tarifario', cortes.map(formato).join(SALTO));
      exigirCorte(cortes, P1.desde, P1.hasta, primera, true);
    });

    await paso(page, 'Guardar: el Tarifario muestra el corte nuevo con el incremento y su origen', async () => {
      await hab.guardar();
      await hab.abrir(ROOM);
      const cortes = await hab.tarifario();
      await adjuntarTexto('Tarifario despues de la primera extension', cortes.map(formato).join(SALTO));
      exigirCorte(cortes, P1.desde, P1.hasta, primera, true);
      exigirCorte(cortes, B.desde, B.hasta, B, false);
      const tramo = (await hab.tramos()).find((t) => t.desde === P1.desde && t.hasta === P1.hasta);
      await adjuntarTexto('Tramo en la solapa Tarifas', JSON.stringify(tramo));
      expect(tramo?.extension, 'La solapa Tarifas tiene que informar el incremento del tramo extendido').toBe(`+${P1.porcentaje} %`);
      // El WebAdmin nombraba el corte de origen en el tooltip del corte ya grabado. La app
      // nueva lo dice solo en el cambio pendiente; grabado, no queda a la vista.
      expect(pendientesDeLaPrimera, 'Antes de guardar, el cambio tiene que nombrar el corte de origen')
        .toContain(`del ${B.desde} al ${B.hasta}`);
      expect.soft(JSON.stringify(cortes.find((c) => c.desde === P1.desde)) + JSON.stringify(tramo),
        'DIFERENCIA con el WebAdmin: grabada la extension, ni el Tarifario ni Tarifas nombran el corte de origen')
        .toContain(B.desde);
    });

    await paso(page, `Extender el corte extendido un ${P2.porcentaje}% a ${P2.desde} - ${P2.hasta}`, async () => {
      const error = await hab.extender(P1, P2.desde, P2.hasta, String(P2.porcentaje));
      expect(error, 'La extension tiene que sumarse a los cambios sin error').toBeNull();
      exigirCorte(await hab.tarifario(), P2.desde, P2.hasta, segunda, true);
      await hab.guardar();
      await hab.abrir(ROOM);
      const cortes = await hab.tarifario();
      await adjuntarTexto('Tarifario despues de la segunda extension', cortes.map(formato).join(SALTO));
      exigirCorte(cortes, P2.desde, P2.hasta, segunda, true);
      const tramo = (await hab.tramos()).find((t) => t.desde === P2.desde && t.hasta === P2.hasta);
      expect(tramo?.extension, 'El porcentaje se informa contra la ultima tarifa real (enero), no contra el corte ya extendido')
        .toBe(`+${P2.porcentajeTotal} %`);
    });

    await paso(page, 'Extender sobre un rango con tarifas avisa que las va a pisar, y descartar no cambia nada', async () => {
      const error = await hab.extender(B, P1.desde, P1.hasta, '50');
      expect(error, 'La extension tiene que sumarse a los cambios').toBeNull();
      const aviso = await hab.textoDePendientes();
      await adjuntarTexto('Aviso', aviso);
      expect(aviso, 'El resumen tiene que avisar que los 31 dias con tarifa se modifican').toMatch(/31 días modificados/i);
      await hab.descartarCambios();
      exigirCorte(await hab.tarifario(), P1.desde, P1.hasta, primera, true);
      await hab.abrir(ROOM);
      exigirCorte(await hab.tarifario(), P1.desde, P1.hasta, primera, true);
    });

    await paso(page, 'El incremento no puede pasar de 100', async () => {
      const error = await hab.extender(B, P1.desde, P1.hasta, '150');
      await adjuntarTexto('Aviso', String(error));
      expect(error, 'Un incremento de 150 tiene que rechazarse').not.toBeNull();
      expect(await hab.textoDePendientes(), 'Rechazado, no tiene que quedar un cambio pendiente').toBe('');
    });
  });
});
