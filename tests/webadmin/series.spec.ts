import { test, expect, Page } from '@playwright/test';
import { WebAdminSeriePage, TarifasPorCategoria } from '../../pages/webadmin-serie.page';
import { SeriePage } from '../../pages/serie.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos } from '../../utils/pasos';
import candidatos from '../../data/candidatos.json';

const S = candidatos.serieWebAdmin;

/**
 * WebAdmin — series: cupo, salidas y tarifas de una salida.
 *
 * Es lo que decide que salidas de una serie se venden, cuantas plazas quedan y a que
 * precio. Si se rompe, se vende una salida sin cupo o borrada, o con otra tarifa.
 *
 * Sobre la serie propia 20 (paquete 5067; NO la de regresion del bloque B), sobre la
 * primera salida que caiga dentro de por lo menos una semana:
 * 1. Cupo 0 en esa fecha: el portal no la ofrece. Se vuelve a 10.
 * 2. Quitar la salida: el portal no la ofrece. Se vuelve a agregar: nace sin tarifas.
 * 3. Cargarle las tarifas desde el WebAdmin: el portal la ofrece con ese precio.
 * Las tarifas que se cargan son las mismas de la serie, asi que al terminar queda como
 * estaba; si falla a mitad, el `finally` la restaura.
 */
test.describe('WebAdmin — series: cupo, salidas y tarifas', () => {
  test.beforeEach(() => {
    reiniciarNumeracionDePasos();
  });

  // Las tarifas de la serie: SGL 400+10g, DBL 300+10g, TPL 250+10g, menor 150, por categoria g.
  const TARIFAS: TarifasPorCategoria = Object.fromEntries([1, 2, 3, 4].map((g) =>
    [g, { sgl: 400 + 10 * g, dbl: 300 + 10 * g, tpl: 250 + 10 * g, mnr: 150 }]));
  const PRECIO_PRIMERA_DBL = S.tarifas.primeraDBL;

  /** La primera salida de la serie (los lunes del rango) que cae dentro de por lo menos 7 dias. */
  function salidaObjetivo(): string {
    const limite = new Date(); limite.setHours(0, 0, 0, 0); limite.setDate(limite.getDate() + 7);
    const d = new Date(`${S.salidas.desde}T00:00:00`);
    const fin = new Date(`${S.salidas.hasta}T00:00:00`);
    while (d <= fin) {
      if (d >= limite) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      d.setDate(d.getDate() + 7);
    }
    throw new Error(`La serie ${S.serieId} no tiene salidas despues del ${limite.toISOString().slice(0, 10)}: hay que renovarlas`);
  }

  async function enElPortal(page: Page, clave: string) {
    const serie = new SeriePage(page);
    await serie.abrirListado();
    await serie.abrirSerie(S.nombre);
    await serie.abrirCircuito(S.circuito);
    await serie.elegirCategoria(S.categoria);
    const estado = await serie.salidaDelCalendario(clave);
    await adjuntarTexto(`Portal, salida ${clave}`, JSON.stringify(estado));
    return estado;
  }

  test('El cupo, las salidas y las tarifas de una salida se reflejan en el portal', async ({ page }) => {
    test.setTimeout(900_000);
    const admin = new WebAdminSeriePage(page);
    const clave = salidaObjetivo();

    await paso(page, `Portal: la salida ${clave} se ofrece con cupo y su tarifa`, async () => {
      const e = await enElPortal(page, clave);
      expect(e.ofrecida, `La salida ${clave} tiene que estar a la venta`).toBe(true);
      expect(e.tarifa, `Tarifa ${S.categoria} con 2 adultos`).toBe(PRECIO_PRIMERA_DBL);
      expect(e.cupo, 'Cupo de la salida').toBe(S.cupoPorSalida);
    });

    try {
      await paso(page, `WebAdmin: cupo 0 el ${clave}`, async () => {
        await admin.cupoDelDia(S.serieId, clave, 0);
      });

      await paso(page, 'Portal: sin cupo, la salida no se ofrece', async () => {
        const e = await enElPortal(page, clave);
        expect(e.cupo, 'El portal tiene que ver el cupo en 0').toBe(0);
        expect(e.ofrecida, 'Sin cupo la salida no se tiene que poder reservar').toBe(false);
      });

      await paso(page, `WebAdmin: volver el cupo a ${S.cupoPorSalida} y quitar la salida`, async () => {
        await admin.cupoDelDia(S.serieId, clave, S.cupoPorSalida);
        await admin.salida(S.serieId, clave, false);
      });

      await paso(page, 'Portal: la salida quitada no se ofrece', async () => {
        const e = await enElPortal(page, clave);
        expect(e.ofrecida, 'Una salida quitada no se tiene que poder reservar').toBe(false);
      });

      await paso(page, 'WebAdmin: volver a agregar la salida y cargarle las tarifas', async () => {
        await admin.salida(S.serieId, clave, true);
        await admin.tarifas(S.serieId, clave, TARIFAS);
      });

      await paso(page, 'Portal: la salida vuelve a la venta con la tarifa cargada', async () => {
        const e = await enElPortal(page, clave);
        expect(e.ofrecida, 'Con salida, cupo y tarifa, la salida se tiene que poder reservar').toBe(true);
        expect(e.tarifa, `Tarifa ${S.categoria} con 2 adultos`).toBe(PRECIO_PRIMERA_DBL);
        expect(e.cupo, 'El cupo de la fecha no se pierde al quitar y volver a agregar la salida').toBe(S.cupoPorSalida);
      });
    } finally {
      await paso(page, `Restaurar la salida ${clave}: existe, con cupo ${S.cupoPorSalida} y sus tarifas`, async () => {
        await admin.salida(S.serieId, clave, true);
        await admin.cupoDelDia(S.serieId, clave, S.cupoPorSalida);
        await admin.tarifas(S.serieId, clave, TARIFAS);
      });
    }
  });
});
