import { test, expect } from '@playwright/test';
import { ServicioNuevoPage, TarifaDeServicio } from '../../../pages/climbs/servicio.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { porTarifa, compararPrecios } from '../../../utils/markups';
import { tarifasDelPortal, ItemDelPortal } from '../comun/tarifario-del-portal';
import candidatos from '../../../data/candidatos.json';

const S = candidatos.tarifasServicio;
const X = S.extension;
const SALTO = String.fromCharCode(10);
const SERVICIO: ItemDelPortal = { solapa: 'Excursiones', nombre: S.nombre, terminoBusqueda: S.terminoBusqueda };

/**
 * WEBADMIN — app nueva (ClimbsApp). Extension de tarifas de un servicio.
 *
 * El mismo test que tests/webadmin/tarifas-servicio.spec.ts, con el mismo titulo. En la app nueva
 * es la solapa Tarifas del servicio en el Backoffice (/services/services/{id}): se eligen las
 * tarifas ("Elegir"), "Extender elegidas" pide rango y aumento y suma el cambio a "Cambios sin
 * guardar"; "Guardar" crea una tarifa nueva por cada elegida.
 *
 * Sobre el servicio propio 7954 (copia del Tigre y Delta): extiende sus 6 tarifas un 10% al
 * primer trimestre de 2029 y verifica el costo en el Backoffice y el precio en el portal nuevo.
 * El portal muestra por defecto unos 18 meses: el rango se le pide por la direccion del
 * tarifario (`from` / `to`), que es como la arma el propio sitio. Antes y despues borra lo
 * extendido, asi cada corrida arranca igual.
 */
test.describe('WebAdmin — extension de tarifas de servicio', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const formato = (t: TarifaDeServicio) => `${t.vigencia} | ${t.modalidad} | ${t.pax} | ${t.costo} ${t.moneda} | ext ${t.extension}`;
  const clave = (t: TarifaDeServicio) => `${t.modalidad} | ${t.pax}`;
  const delRango = (rango: string) => (t: TarifaDeServicio) => t.vigencia.startsWith(rango);
  const extendidas = (ts: TarifaDeServicio[]) => ts.filter(delRango(`${X.desde} - ${X.hasta}`));

  /** Las claves del portal, sin el rango de fechas: asi se emparejan base y extension. */
  const sinFechas = (m: Map<string, number>) => new Map([...m].map(([k, v]) =>
    [k.replace(/\d{2}\/\d{2}\/\d{4}\s*[-–]\s*\d{2}\/\d{2}\/\d{4}/g, '').replace(/Recargo por idioma[^|]*/i, '').replace(/Tarifa extendida/gi, '').replace(/\s+/g, ' ').trim(), v]));

  async function borrarExtendidas(admin: ServicioNuevoPage) {
    await admin.abrir(S.servicioId);
    const previas = extendidas(await admin.tarifas());
    if (!previas.length) return;
    await admin.elegir(previas);
    await admin.borrarElegidas();
    await admin.guardar();
  }

  test('Extender las tarifas de un servicio con incremento crea las del rango y el portal las cobra', async ({ page }) => {
    test.setTimeout(600_000);
    const admin = new ServicioNuevoPage(page);
    let base: TarifaDeServicio[] = [];
    let portalBase = new Map<string, number>();

    await paso(page, `Dejar el servicio ${S.servicioId} con sus 6 tarifas base y sin extension a 2029`, async () => {
      await borrarExtendidas(admin);
      await admin.abrir(S.servicioId);
      const todas = await admin.tarifas();
      await adjuntarTexto('Tarifas de partida', todas.map(formato).join(SALTO));
      base = todas.filter(delRango(S.vigenciaBase));
      expect(base.length, `El servicio tiene que tener sus 6 tarifas ${S.vigenciaBase}`).toBe(6);
      expect(extendidas(todas), 'No tiene que quedar nada extendido a 2029').toHaveLength(0);
    });

    await paso(page, 'Leer en el portal el precio de las tarifas base', async () => {
      const filas = await tarifasDelPortal(page, SERVICIO);
      portalBase = sinFechas(porTarifa(filas));
      await adjuntarTexto('Portal, tarifas base', filas.map((f) => f.join(' | ')).join(SALTO));
      expect(portalBase.size, 'El portal tiene que mostrar las tarifas del servicio').toBeGreaterThan(0);
    });

    try {
      await paso(page, `Extender las 6 tarifas un ${X.porcentaje}% del ${X.desde} al ${X.hasta}`, async () => {
        // Se vuelve al Backoffice y se releen las filas: las de antes eran de otra carga.
        await admin.abrir(S.servicioId);
        const aExtender = (await admin.tarifas()).filter(delRango(S.vigenciaBase));
        expect(aExtender.length, 'Tienen que seguir las 6 tarifas base').toBe(base.length);
        await admin.elegir(aExtender);
        const error = await admin.extenderElegidas(X.desde, X.hasta, X.porcentaje);
        expect(error, 'La extension tiene que sumarse a los cambios sin error').toBeNull();
        await adjuntarTexto('Cambios sin guardar', await admin.textoDePendientes());
        await admin.guardar();
      });

      await paso(page, 'WebAdmin: hay una tarifa nueva por cada una, con el incremento aplicado', async () => {
        await admin.abrir(S.servicioId);
        const nuevas = extendidas(await admin.tarifas());
        await adjuntarTexto('Tarifas extendidas', nuevas.map(formato).join(SALTO));
        expect(nuevas.length, 'Tiene que crear una tarifa por cada una de las elegidas').toBe(base.length);
        const factor = 1 + X.porcentaje / 100;
        for (const b of base) {
          const n = nuevas.find((t) => clave(t) === clave(b));
          expect(n, `Falta la tarifa extendida ${clave(b)}`).toBeTruthy();
          expect(Math.abs((n!.costo ?? NaN) - (b.costo ?? NaN) * factor),
            `${clave(b)}: esperado ${b.costo} + ${X.porcentaje}% = ${((b.costo ?? 0) * factor).toFixed(2)}, se ve ${n!.costo}`)
            .toBeLessThanOrEqual(0.01);
          expect(n!.moneda, `${clave(b)}: la extension tiene que conservar la moneda`).toBe(b.moneda);
        }
      });

      await paso(page, 'Portal: el rango extendido se cobra con el incremento', async () => {
        const filas = await tarifasDelPortal(page, SERVICIO, { desde: X.desde, hasta: X.hasta });
        const delRangoExtendido = filas.filter((f) => f.join(' ').includes(X.desde) || !/\d{2}\/\d{2}\/\d{4}/.test(f.join(' ')));
        const portalNuevo = sinFechas(porTarifa(delRangoExtendido));
        await adjuntarTexto('Portal, rango extendido', filas.map((f) => f.join(' | ')).join(SALTO));
        // El precio es techo(tarifa / ...): subir la tarifa un 10% es dividir por 1 / 1,10.
        const { lineas, fuera } = compararPrecios(portalBase, portalNuevo, 1, 1 / (1 + X.porcentaje / 100));
        await adjuntarTexto('Comparacion', lineas.join(SALTO));
        expect(fuera, 'Tarifas del portal que no aplican el incremento:' + SALTO + fuera.join(SALTO)).toEqual([]);
      });
    } finally {
      await paso(page, `Limpiar: borrar lo extendido del ${X.desde} al ${X.hasta}`, async () => {
        await borrarExtendidas(admin);
        await admin.abrir(S.servicioId);
        expect(extendidas(await admin.tarifas()), 'No tiene que quedar nada extendido a 2029').toHaveLength(0);
      });
    }
  });
});
