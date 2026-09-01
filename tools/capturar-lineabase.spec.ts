import { test, expect, Page } from '@playwright/test';
import { TarifarioPage } from '../pages/tarifario.page';
import { esperarFinDeCarga, normalizarFechaDeHoy } from '../utils/pasos';
import * as fs from 'fs';
import candidatos from '../data/candidatos.json';

/**
 * Capturador de linea base. No es un test de regresion: recorre las 7 pestanias,
 * despliega el tarifario y vuelca a disco los importes tal como se ven hoy,
 * incluyendo una tabla por cada solapa de idioma y la marca TARIFA EXTENDIDA.
 *
 * Se corre a mano cuando cambian los datos:
 *   npx playwright test tests/bloque-a/_capturar-lineabase.spec.ts
 */
const T = candidatos.tarifario as Record<string, any>;
const CIUDAD: Record<string, string> = { 'a-cruises': 'Ushuaia', 'a-opportunities': 'Ushuaia' };

async function leerTablas(page: Page, container: string) {
  const filas = await page.locator(`#${container}, [id^="detailcnt-"], [id^="detailoptcnt-"]`)
    .locator('table:visible tr')
    .evaluateAll((trs) =>
      trs.map((tr) =>
        Array.from(tr.querySelectorAll('th,td'))
          .map((c) => (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
          .filter(Boolean),
      ).filter((f) => f.length),
    );
  // Mismo criterio que la suite: la fecha de hoy se guarda como <HOY> para que
  // la linea base no caduque al dia siguiente.
  return filas.map((f) => f.map((celda) => normalizarFechaDeHoy(celda)));
}

for (const [clave, cfg] of Object.entries(T)) {
  test(`capturar ${clave}`, async ({ page }) => {
    test.setTimeout(180_000);
    const t = new TarifarioPage(page);
    await page.goto('/online/');
    await t.irDesdeElMenu();
    await t.seleccionarPais('Argentina');
    await t.seleccionarCiudad(CIUDAD[cfg.tab] ?? 'Buenos Aires');
    await t.buscar();
    await t.abrirPestania(cfg.tab, cfg.container);
    await t.buscarPorNombre(cfg.terminoBusqueda, cfg.nombre);
    await t.verTarifario(cfg.container);

    const salida: any = { item: cfg.nombre, id: cfg.id, porIdioma: {}, tarifaExtendida: 0 };

    // Solapas de idioma (recargo por idioma): se captura la tabla de cada una.
    // Los dos prefijos que existen: "srl-" (servicios) y "trl-" (paquetes).
    const solapas = page.locator("[class*='-lang-tabs-'] > *");
    const cantidad = await solapas.count();
    if (cantidad > 0) {
      for (let i = 0; i < cantidad; i++) {
        const nombre = (await solapas.nth(i).innerText()).trim() || `solapa-${i}`;
        await solapas.nth(i).click().catch(() => {});
        await esperarFinDeCarga(page);
        salida.porIdioma[nombre] = await leerTablas(page, cfg.container);
      }
    } else {
      salida.porIdioma['sin-solapas'] = await leerTablas(page, cfg.container);
    }

    salida.tarifaExtendida = await page.locator('.tariff-extended-label').count();
    salida.solapasIdioma = cantidad;

    fs.mkdirSync('lineabase', { recursive: true });
    fs.writeFileSync(`lineabase/${clave}.json`, JSON.stringify(salida, null, 2), 'utf8');
    expect(Object.keys(salida.porIdioma).length, 'no se capturo ninguna tabla').toBeGreaterThan(0);
  });
}
