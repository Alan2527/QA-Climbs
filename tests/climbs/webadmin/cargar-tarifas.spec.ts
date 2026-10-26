import { test, expect } from '@playwright/test';
import { HabitacionNuevaPage, Corte } from '../../../pages/climbs/habitacion.page';
import { TarifarioNuevoPage } from '../../../pages/climbs/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../../utils/pasos';
import { porTarifa } from '../../../utils/markups';
import { tarifasDelPortal, ItemDelPortal } from '../comun/tarifario-del-portal';
import candidatos from '../../../data/candidatos.json';

const E = candidatos.extensionTarifas;
const C = E.cargaManual;
const SALTO = String.fromCharCode(10);

/**
 * WEBADMIN — app nueva (ClimbsApp). Carga manual de tarifas de una habitacion y el tarifario.
 *
 * El mismo test que tests/webadmin/cargar-tarifas.spec.ts, con el mismo titulo. En la app
 * nueva la "Gestion de Tarifas" es la solapa Tarifas de la habitacion en el Backoffice:
 * "Cargar tarifas" suma el cambio a "Cambios sin guardar" ("N dias modificados") y "Guardar"
 * lo escribe; "Generar Tarifario" es "Regenerar tarifario" de la solapa Tarifario. Se carga
 * por habitacion y el tarifario lo muestra por pax (Doble / 2, Triple / 3).
 *
 * Sobre la habitacion propia 18371 (hotel 15422), rango de data/candidatos (cargaManual).
 * Alterna entre dos juegos de importes: si lee el juego A carga el B, y al reves, asi el
 * cambio se nota aunque corra dos veces seguidas.
 *
 * En el portal nuevo se mira con el usuario de la suite: precio = techo(tarifa por pax / markup).
 */
test.describe('WebAdmin — carga de tarifas de habitacion', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const ROOM = E.roomId;
  const HOTEL: ItemDelPortal = { solapa: 'Hoteles', nombre: E.hotelNombre, terminoBusqueda: E.terminoBusqueda };
  const formato = (c: Corte) => `${c.desde} - ${c.hasta} | SGL ${c.sgl} | DBL ${c.dbl} | TPL ${c.tpl} | ${c.extendida ? 'Extendida' : '-'}`;
  const porPax = (j: Record<string, number>) => ({ sgl: j['1'], dbl: j['2'] / 2, tpl: j['3'] / 3 });
  const corteDe = (cortes: Corte[]) => cortes.find((c) => c.desde === C.desde && c.hasta === C.hasta);

  test('Lo que se carga en Gestion de Tarifas llega al Tarifario al generarlo y al precio del portal', async ({ page }) => {
    test.setTimeout(600_000);
    const hab = new HabitacionNuevaPage(page);
    let juego: Record<string, number> = C.juegos[0];
    let esperado = porPax(juego);

    await paso(page, 'Elegir el juego de importes distinto al que hay hoy', async () => {
      await hab.abrir(ROOM);
      const antes = corteDe(await hab.tarifario());
      const a = porPax(C.juegos[0]);
      const yaEsA = !!antes && antes.sgl === a.sgl && antes.dbl === a.dbl && antes.tpl === a.tpl;
      juego = yaEsA ? C.juegos[1] : C.juegos[0];
      esperado = porPax(juego);
      await adjuntarTexto('Juego elegido',
        `hoy: ${antes ? formato(antes) : 'sin corte en el rango'}` + SALTO +
        `se carga (por habitacion): ${JSON.stringify(juego)}` + SALTO +
        `por pax: SGL ${esperado.sgl} | DBL ${esperado.dbl} | TPL ${esperado.tpl}`);
    });

    await paso(page, `Cargar ${C.desde} - ${C.hasta} en Gestion de Tarifas`, async () => {
      const error = await hab.cargarTarifas(C.desde, C.hasta, { single: juego['1'], doble: juego['2'], triple: juego['3'], menores: juego['20'] || null });
      expect(error, 'La carga tiene que sumarse a los cambios sin error').toBeNull();
      const mensaje = await hab.textoDePendientes();
      await adjuntarTexto('Mensaje', mensaje);
      // El WebAdmin contaba items (15 dias x 4 tipos = 60); la app nueva cuenta dias.
      expect(mensaje, 'Tiene que cambiar una tarifa por cada uno de los 15 dias').toMatch(/15 días (modificados|nuevos)/i);
      await hab.guardar();
    });

    await paso(page, 'Registrar el estado del Tarifario antes de Generar', async () => {
      // Como en el WebAdmin, solo se registra: lo que se exige es el resultado tras regenerar y en el portal.
      await hab.abrir(ROOM);
      const corte = corteDe(await hab.tarifario());
      await adjuntarTexto('Tarifario antes de Generar', corte ? formato(corte) : 'grilla vacia');
    });

    await paso(page, 'Generar Tarifario: el corte queda con los importes por pax', async () => {
      await hab.regenerarTarifario();
      await hab.abrir(ROOM);
      const cortes = await hab.tarifario();
      await adjuntarTexto('Tarifario generado', cortes.map(formato).join(SALTO));
      const corte = corteDe(cortes);
      expect(corte, `El Tarifario tiene que tener el corte ${C.desde} - ${C.hasta}`).toBeTruthy();
      for (const tipo of ['sgl', 'dbl', 'tpl'] as const) {
        expect(Math.abs((corte![tipo] ?? NaN) - esperado[tipo]),
          `${tipo.toUpperCase()}: esperado ${esperado[tipo]} por pax, se ve ${corte![tipo]}`).toBeLessThanOrEqual(0.01);
      }
      expect(corte!.extendida, 'Una carga manual sin "Es tarifa extendida" no es extendida').toBe(false);
    });

    await paso(page, 'Portal: el tarifario del hotel cobra el corte nuevo', async () => {
      const filas = await tarifasDelPortal(page, HOTEL);
      const markup = (await new TarifarioNuevoPage(page).markupActivo()) ?? candidatos._formulaPrecio.markupPorDefecto;
      await adjuntarTexto('Tarifario del portal', `markup del usuario: ${markup}` + SALTO + SALTO +
        filas.map((f) => f.join(' | ')).join(SALTO));
      const fila = filas.find((f) => f.join(' ').includes(C.desde) && f.join(' ').includes(C.hasta));
      expect(fila, `El portal tiene que mostrar el corte ${C.desde} - ${C.hasta}`).toBeTruthy();
      const precios = [...porTarifa([fila!]).values()];
      const esperados = [esperado.sgl, esperado.dbl, esperado.tpl].map((v) => Math.ceil(Number((v / markup).toFixed(2))));
      expect(precios, `Precios SGL / DBL / TPL: tarifa por pax / ${markup}`).toEqual(esperados);
    });
  });
});
