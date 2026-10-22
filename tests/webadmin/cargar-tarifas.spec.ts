import { test, expect } from '@playwright/test';
import { WebAdminTarifasHabitacionPage, Corte } from '../../pages/webadmin-tarifas-habitacion.page';
import { TarifarioPage } from '../../pages/tarifario.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
import { tarifasDe, porTarifa } from '../../utils/markups';
import candidatos from '../../data/candidatos.json';

const E = candidatos.extensionTarifas;
const C = E.cargaManual;
const SALTO = String.fromCharCode(10);

/**
 * WebAdmin — carga manual de tarifas de una habitacion y "Generar Tarifario".
 *
 * Es la fuente del precio de hotel: lo que se carga en "Gestion de Tarifas" tiene
 * que terminar en el precio que ve la agencia. Se carga por habitacion y el sistema
 * lo guarda por pax (Doble / 2, Triple / 3). El tarifario recien cambia al presionar
 * "Generar Tarifario"; desde la HU 4949 guardar tarifas lo deja vacio hasta generar.
 *
 * Sobre la habitacion propia 18371 (hotel 15422), rango de data/candidatos (cargaManual).
 * Alterna entre dos juegos de importes: si lee el juego A en pantalla carga el B, y
 * al reves, asi el cambio se nota aunque corra dos veces seguidas.
 *
 * En el portal se mira con pablo1: precio = techo(tarifa por pax / markup del usuario).
 */
test.describe('WebAdmin — carga de tarifas de habitacion', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  const ROOM = E.roomId;
  const HOTEL = { tab: 'a-hotels', container: 'hotels-container', nombre: E.hotelNombre, terminoBusqueda: E.terminoBusqueda };
  const formato = (c: Corte) => `${c.desde} - ${c.hasta} | SGL ${c.sgl} | DBL ${c.dbl} | TPL ${c.tpl} | ${c.extendida}`;
  const porPax = (j: Record<string, number>) => ({ sgl: j['1'], dbl: j['2'] / 2, tpl: j['3'] / 3 });
  const corteDe = (cortes: Corte[]) => cortes.find((c) => c.desde === C.desde && c.hasta === C.hasta);

  test('Lo que se carga en Gestion de Tarifas llega al Tarifario al generarlo y al precio del portal', async ({ page }) => {
    const admin = new WebAdminTarifasHabitacionPage(page);
    let juego: Record<string, number> = C.juegos[0];
    let esperado = porPax(juego);

    await paso(page, 'Elegir el juego de importes distinto al que hay hoy', async () => {
      const antes = corteDe(await admin.cortesDelTarifario(ROOM));
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
      const mensaje = await admin.cargarTarifas(ROOM, C.desde, C.hasta, juego as Record<number, number>);
      await adjuntarTexto('Mensaje', mensaje);
      // 15 dias x los 4 tipos de tarifa de la habitacion.
      expect(mensaje, 'Tiene que guardar una tarifa por dia y por tipo').toMatch(/Se guardaron 60 items/i);
    });

    await paso(page, 'Registrar el estado del Tarifario antes de Generar', async () => {
      // Desde la HU 4949 el estado del Tarifario JUSTO despues de guardar no es
      // determinista: segun el momento en que se lee y lo que dejo la corrida previa,
      // la grilla puede quedar vacia, con lo viejo o ya con lo nuevo. Por eso aca solo
      // se registra, sin afirmar: lo que se exige es el resultado tras Generar (paso
      // siguiente) y en el portal (ultimo paso), que es el valor real del test.
      const corte = corteDe(await admin.cortesDelTarifario(ROOM, { permitirVacio: true }));
      await adjuntarTexto('Tarifario antes de Generar', corte ? formato(corte) : 'grilla vacia');
    });

    await paso(page, 'Generar Tarifario: el corte queda con los importes por pax', async () => {
      await admin.generarTarifario(ROOM);
      const cortes = await admin.cortesDelTarifario(ROOM);
      await adjuntarTexto('Tarifario generado', cortes.map(formato).join(SALTO));
      const corte = corteDe(cortes);
      expect(corte, `El Tarifario tiene que tener el corte ${C.desde} - ${C.hasta}`).toBeTruthy();
      for (const tipo of ['sgl', 'dbl', 'tpl'] as const) {
        expect(Math.abs((corte![tipo] ?? NaN) - esperado[tipo]),
          `${tipo.toUpperCase()}: esperado ${esperado[tipo]} por pax, se ve ${corte![tipo]}`).toBeLessThanOrEqual(1);
      }
      expect(corte!.extendida, 'Una carga manual sin "Es tarifa extendida" no es extendida').toBe('-');
    });

    await paso(page, 'Portal: el tarifario del hotel cobra el corte nuevo', async () => {
      const filas = await tarifasDe(page, HOTEL);
      const markup = (await new TarifarioPage(page).markupActivo()) ?? candidatos._formulaPrecio.markupPorDefecto;
      await adjuntarTexto('Tarifario del portal', `markup del usuario: ${markup}` + SALTO + SALTO +
        filas.map((f) => f.join(' | ')).join(SALTO));
      const fila = filas.find((f) => (f[0] ?? '').startsWith(`${C.desde} - ${C.hasta}`));
      expect(fila, `El portal tiene que mostrar el corte ${C.desde} - ${C.hasta}`).toBeTruthy();
      const precios = [...porTarifa([fila!]).values()];
      const esperados = [esperado.sgl, esperado.dbl, esperado.tpl].map((v) => Math.ceil(Number((v / markup).toFixed(2))));
      expect(precios, `Precios SGL / DBL / TPL: tarifa por pax / ${markup}`).toEqual(esperados);
    });
  });
});
