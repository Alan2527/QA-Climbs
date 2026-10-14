import { test, expect, Page } from '@playwright/test';
import { WebAdminTarifasServicioPage, TarifaDeServicio } from '../../pages/webadmin-tarifas-servicio.page';
import { TarifarioPage } from '../../pages/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
import { tarifasDe, porTarifa, compararPrecios, ItemDelTarifario } from '../../utils/markups';
import candidatos from '../../data/candidatos.json';

const S = candidatos.tarifasServicio;
const X = S.extension;
const SALTO = String.fromCharCode(10);
const SERVICIO: ItemDelTarifario = {
  tab: 'a-excursions', container: 'excursions-container', nombre: S.nombre, terminoBusqueda: S.terminoBusqueda,
};

/**
 * WebAdmin — extension de tarifas de un servicio.
 *
 * Es la carga masiva de precios de servicios: se tildan tarifas, se elige un rango y
 * un incremento, y se crea una tarifa nueva por cada una. Si el calculo se rompe, el
 * servicio queda vendiendose con precios mal en todo el rango.
 *
 * Sobre el servicio propio 7954 (copia del Tigre y Delta): extiende sus 6 tarifas un
 * 10% al primer trimestre de 2032 y verifica el importe en el WebAdmin y el precio en
 * el portal. El portal muestra por defecto unos 18 meses: el rango se le pide por la
 * URL del tarifario (`from` / `to`), que es como lo arma el propio sitio al buscar.
 * Antes y despues borra lo extendido, asi cada corrida arranca igual.
 */
test.describe('WebAdmin — extension de tarifas de servicio', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const formato = (t: TarifaDeServicio) => `${t.fechas} | ${t.tipo} | ${t.pax} | ${t.tarifa} ${t.moneda} | ext ${t.extension}`;
  const clave = (t: TarifaDeServicio) => `${t.tipo} | ${t.pax}`;
  const delRango = (rango: string) => (t: TarifaDeServicio) => t.fechas.startsWith(rango);
  const extendidas = (ts: TarifaDeServicio[]) => ts.filter(delRango(`${X.desde} - ${X.hasta}`));

  /** Las claves del portal, sin el rango de fechas: asi se emparejan base y extension. */
  const sinFechas = (m: Map<string, number>) => new Map([...m].map(([k, v]) =>
    [k.replace(/\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4}/, '').replace(/Recargo por idioma[^|]*/i, '').replace(/\s+/g, ' ').trim(), v]));

  async function tarifarioDelRango(page: Page, desde: string, hasta: string): Promise<string[][]> {
    const f = (d: string) => d.replace(/\//g, '-');
    await page.goto(`/online/defaulttariff.aspx?country=10&city=5000&from=${f(desde)}&to=${f(hasta)}&resident=false&tab=excursion`);
    const t = new TarifarioPage(page);
    await t.abrirPestania(SERVICIO.tab, SERVICIO.container);
    await t.buscarPorNombre(SERVICIO.terminoBusqueda, SERVICIO.nombre);
    await t.verTarifario(SERVICIO.container);
    const filas = await t.leerTablaTarifas(SERVICIO.container);
    await t.cerrarExplorador();
    return filas;
  }

  test('Extender las tarifas de un servicio con incremento crea las del rango y el portal las cobra', async ({ page }) => {
    test.setTimeout(600_000);
    const admin = new WebAdminTarifasServicioPage(page);
    let base: TarifaDeServicio[] = [];
    let portalBase = new Map<string, number>();

    await paso(page, `Dejar el servicio ${S.servicioId} con sus 6 tarifas base y sin extension a 2032`, async () => {
      await admin.abrir(S.servicioId);
      const previas = extendidas(await admin.tarifas());
      if (previas.length) await admin.borrar(previas);
      await admin.abrir(S.servicioId);
      const todas = await admin.tarifas();
      await adjuntarTexto('Tarifas de partida', todas.map(formato).join(SALTO));
      base = todas.filter(delRango(S.vigenciaBase));
      expect(base.length, `El servicio tiene que tener sus 6 tarifas ${S.vigenciaBase}`).toBe(6);
      expect(extendidas(todas), 'No tiene que quedar nada extendido a 2032').toHaveLength(0);
    });

    await paso(page, 'Leer en el portal el precio de las tarifas base', async () => {
      const filas = await tarifasDe(page, SERVICIO);
      portalBase = sinFechas(porTarifa(filas));
      await adjuntarTexto('Portal, tarifas base', filas.map((f) => f.join(' | ')).join(SALTO));
      expect(portalBase.size, 'El portal tiene que mostrar las tarifas del servicio').toBeGreaterThan(0);
    });

    try {
      await paso(page, `Extender las 6 tarifas un ${X.porcentaje}% del ${X.desde} al ${X.hasta}`, async () => {
        // Se vuelve al WebAdmin y se releen las filas: las de antes eran de otra carga.
        await admin.abrir(S.servicioId);
        const aExtender = (await admin.tarifas()).filter(delRango(S.vigenciaBase));
        expect(aExtender.length, 'Tienen que seguir las 6 tarifas base').toBe(base.length);
        await admin.extender(aExtender, X.desde, X.hasta, X.porcentaje);
      });

      await paso(page, 'WebAdmin: hay una tarifa nueva por cada una, con el incremento aplicado', async () => {
        await admin.abrir(S.servicioId);
        const nuevas = extendidas(await admin.tarifas());
        await adjuntarTexto('Tarifas extendidas', nuevas.map(formato).join(SALTO));
        expect(nuevas.length, 'Tiene que crear una tarifa por cada una de las tildadas').toBe(base.length);
        const factor = 1 + X.porcentaje / 100;
        for (const b of base) {
          const n = nuevas.find((t) => clave(t) === clave(b));
          expect(n, `Falta la tarifa extendida ${clave(b)}`).toBeTruthy();
          expect(Math.abs((n!.tarifa ?? NaN) - (b.tarifa ?? NaN) * factor),
            `${clave(b)}: esperado ${b.tarifa} + ${X.porcentaje}% = ${((b.tarifa ?? 0) * factor).toFixed(2)}, se ve ${n!.tarifa}`)
            .toBeLessThanOrEqual(0.01);
          expect(n!.moneda, `${clave(b)}: la extension tiene que conservar la moneda`).toBe(b.moneda);
        }
      });

      await paso(page, 'Portal: el rango extendido se cobra con el incremento', async () => {
        const filas = await tarifarioDelRango(page, X.desde, X.hasta);
        const portalNuevo = sinFechas(porTarifa(filas.filter((f) => (f[0] ?? '').startsWith(`${X.desde} - ${X.hasta}`) || !/\d{2}\/\d{2}\/\d{4}/.test(f[0] ?? ''))));
        await adjuntarTexto('Portal, rango extendido', filas.map((f) => f.join(' | ')).join(SALTO));
        // El precio es techo(tarifa / ...): subir la tarifa un 10% es dividir por 1 / 1,10.
        const { lineas, fuera } = compararPrecios(portalBase, portalNuevo, 1, 1 / (1 + X.porcentaje / 100));
        await adjuntarTexto('Comparacion', lineas.join(SALTO));
        expect(fuera, 'Tarifas del portal que no aplican el incremento:' + SALTO + fuera.join(SALTO)).toEqual([]);
      });
    } finally {
      await paso(page, `Limpiar: borrar lo extendido del ${X.desde} al ${X.hasta}`, async () => {
        await admin.abrir(S.servicioId);
        await admin.borrar(extendidas(await admin.tarifas()));
        await admin.abrir(S.servicioId);
        expect(extendidas(await admin.tarifas()), 'No tiene que quedar nada extendido a 2032').toHaveLength(0);
      });
    }
  });
});
