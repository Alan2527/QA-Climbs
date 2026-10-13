import { test, expect } from '@playwright/test';
import { WebAdminTarifasHabitacionPage, Corte } from '../../pages/webadmin-tarifas-habitacion.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const E = candidatos.extensionTarifas;
const SALTO = String.fromCharCode(10);

/**
 * WebAdmin — extension de tarifas de una habitacion.
 *
 * Es la carga masiva de precios de hotel: toma un corte tarifario, le aplica un
 * incremento y crea las tarifas de todo un rango de fechas, pisando lo que hubiera.
 * Si el calculo se rompe, la habitacion queda vendiendose con precios mal en todo
 * ese rango.
 *
 * Trabaja sobre la habitacion propia 18371 (hotel 15422, "AUTO-QA NO TOCAR"), con un
 * corte base de enero 2031 de valores redondos (100 / 60 / 50 por pax), asi los
 * esperados son exactos:
 *
 * - enero +10% a marzo  -> 110 / 66 / 55, "10%"
 * - marzo +10% a mayo   -> 121 / 72,60 / 60,50, "21%": el porcentaje se informa
 *   contra la ultima tarifa real (enero), no contra el corte ya extendido.
 *
 * Cada corrida pisa sus propios rangos de marzo y mayo 2031: es repetible sin limpiar.
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
    `${c.desde} - ${c.hasta} | SGL ${c.sgl} | DBL ${c.dbl} | TPL ${c.tpl} | ${c.extendida}${c.origen ? ` {${c.origen}}` : ''}`;

  /** Los importes del Tarifario se muestran sin decimales: se acepta el redondeo. */
  function exigirCorte(cortes: Corte[], desde: string, hasta: string,
    esperado: { sgl: number; dbl: number; tpl: number }, extendida: string, origen?: string) {
    const corte = cortes.find((c) => c.desde === desde && c.hasta === hasta);
    expect(corte, `El Tarifario tiene que tener el corte ${desde} - ${hasta}`).toBeTruthy();
    for (const tipo of ['sgl', 'dbl', 'tpl'] as const) {
      expect(Math.abs((corte![tipo] ?? NaN) - esperado[tipo]),
        `${tipo.toUpperCase()} del corte ${desde} - ${hasta}: esperado ${esperado[tipo]}, se ve ${corte![tipo]}`)
        .toBeLessThanOrEqual(1);
    }
    expect(corte!.extendida, `La Tarifa Extendida del corte ${desde} - ${hasta}`).toBe(extendida);
    if (origen) {
      expect(corte!.origen ?? '', `El tooltip del corte ${desde} - ${hasta} tiene que nombrar el corte de origen`)
        .toContain(origen);
    }
  }

  test('Extender un corte con incremento crea las tarifas del rango y se puede volver a extender', async ({ page }) => {
    const admin = new WebAdminTarifasHabitacionPage(page);
    const factor1 = 1 + P1.porcentaje / 100;
    const factorTotal = 1 + P2.porcentajeTotal / 100;
    const primera = { sgl: B.sgl * factor1, dbl: B.dbl * factor1, tpl: B.tpl * factor1 };
    const segunda = { sgl: B.sgl * factorTotal, dbl: B.dbl * factorTotal, tpl: B.tpl * factorTotal };

    await paso(page, `Generar el tarifario de la habitacion ${ROOM}`, async () => {
      await admin.generarTarifario(ROOM);
      const cortes = await admin.cortesDelTarifario(ROOM);
      await adjuntarTexto('Tarifario despues de generar', cortes.map(formato).join(SALTO));
      exigirCorte(cortes, B.desde, B.hasta, B, '-');
    });

    await paso(page, `Extender ${B.desde} - ${B.hasta} un ${P1.porcentaje}% a ${P1.desde} - ${P1.hasta}: la vista previa`, async () => {
      await admin.abrirExtender(ROOM);
      await adjuntarTexto('Cortes del modal', (await admin.cortesDelModal()).map((f) => f.join(' | ')).join(SALTO));
      await admin.elegirCorte(B.desde, B.hasta);
      await admin.completar(P1.desde, P1.hasta, String(P1.porcentaje));
      expect(await admin.vistaPrevia(), 'La vista previa tiene que mostrar el corte base mas el incremento')
        .toEqual({ sgl: primera.sgl.toFixed(2), dbl: primera.dbl.toFixed(2), tpl: primera.tpl.toFixed(2) });
    });

    await paso(page, 'Aceptar: el Tarifario muestra el corte nuevo con el incremento y su origen', async () => {
      await admin.extender();
      const cortes = await admin.cortesDelTarifario(ROOM);
      await adjuntarTexto('Tarifario despues de la primera extension', cortes.map(formato).join(SALTO));
      exigirCorte(cortes, P1.desde, P1.hasta, primera, `${P1.porcentaje}%`, `${B.desde} - ${B.hasta}`);
      exigirCorte(cortes, B.desde, B.hasta, B, '-');
    });

    await paso(page, `Extender el corte extendido un ${P2.porcentaje}% a ${P2.desde} - ${P2.hasta}`, async () => {
      await admin.abrirExtender(ROOM);
      await admin.elegirCorte(P1.desde, P1.hasta);
      await admin.completar(P2.desde, P2.hasta, String(P2.porcentaje));
      expect(await admin.vistaPrevia(), 'La vista previa parte del corte ya extendido')
        .toEqual({ sgl: segunda.sgl.toFixed(2), dbl: segunda.dbl.toFixed(2), tpl: segunda.tpl.toFixed(2) });
      await admin.extender();
      const cortes = await admin.cortesDelTarifario(ROOM);
      await adjuntarTexto('Tarifario despues de la segunda extension', cortes.map(formato).join(SALTO));
      exigirCorte(cortes, P2.desde, P2.hasta, segunda, `${P2.porcentajeTotal}%`, `${P1.desde} - ${P1.hasta}`);
    });

    await paso(page, 'Extender sobre un rango con tarifas avisa que las va a pisar, y Cancelar no cambia nada', async () => {
      await admin.abrirExtender(ROOM);
      await admin.elegirCorte(B.desde, B.hasta);
      await admin.completar(P1.desde, P1.hasta, '50');
      const avisa = await admin.aceptar();
      expect(avisa, 'Tiene que avisar que ya hay tarifas en el rango').toBe(true);
      const aviso = await admin.textoDelAviso();
      await adjuntarTexto('Aviso', aviso);
      expect(aviso, 'El aviso tiene que decir que se van a reemplazar').toMatch(/Ya hay .*tarifas cargadas.*reemplazar/i);
      await admin.cancelarAviso();

      const cortes = await admin.cortesDelTarifario(ROOM);
      exigirCorte(cortes, P1.desde, P1.hasta, primera, `${P1.porcentaje}%`);
    });

    await paso(page, 'El incremento no puede pasar de 100', async () => {
      await admin.abrirExtender(ROOM);
      await admin.completar(P1.desde, P1.hasta, '150');
      expect(Number(await admin.porcentajeCargado()), 'El campo Incremento tiene que topearse en 100')
        .toBeLessThanOrEqual(100);
    });
  });
});
