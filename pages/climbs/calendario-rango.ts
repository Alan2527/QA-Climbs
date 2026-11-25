import { Page, Locator, expect } from '@playwright/test';

/**
 * Selector de rango de fechas del portal nuevo (US 5040): un boton que muestra
 * "dd/mm/aaaa - dd/mm/aaaa" y abre un calendario de uno o dos meses. Se elige como una
 * persona: se avanza de mes hasta ver el de la fecha y se toca el dia; primero la entrada y
 * despues la salida.
 */
const MESES: string[][] = [
  ['enero', 'january', 'janeiro'], ['febrero', 'february', 'fevereiro'], ['marzo', 'march', 'março'],
  ['abril', 'april', 'abril'], ['mayo', 'may', 'maio'], ['junio', 'june', 'junho'], ['julio', 'july', 'julho'],
  ['agosto', 'august', 'agosto'], ['septiembre', 'september', 'setembro'], ['octubre', 'october', 'outubro'],
  ['noviembre', 'november', 'novembro'], ['diciembre', 'december', 'dezembro'],
];

async function mesesVisibles(pop: Locator): Promise<{ mes: number; anio: number }[]> {
  return pop.locator('.date-range__month').evaluateAll((bloques, meses) => bloques.map((b) => {
    // Con listas desplegables el mes va abreviado ("dic"): se lee el valor de la lista (0 a 11).
    const mesSel = b.querySelector('select.monthselect') as HTMLSelectElement | null;
    const anioSel = b.querySelector('select.yearselect') as HTMLSelectElement | null;
    if (mesSel && anioSel) return { mes: Number(mesSel.value) + 1, anio: Number(anioSel.value) };
    const texto = (b.querySelector('.date-pop-head')?.textContent ?? '').toLowerCase();
    const mes = meses.findIndex((nombres) => nombres.some((n) => new RegExp(`(^|\\s)${n}(\\s|$)`).test(texto))) + 1;
    return { mes, anio: Number(texto.match(/\d{4}/)?.[0] ?? 0) };
  }), MESES);
}

async function tocarDia(page: Page, pop: Locator, fecha: Date) {
  const objetivo = fecha.getFullYear() * 12 + fecha.getMonth();
  for (let i = 0; i < 40; i++) {
    const vistos = await mesesVisibles(pop);
    if (vistos.some((v) => v.mes < 1 || !v.anio)) throw new Error(`No se pudo leer el mes del calendario: ${JSON.stringify(vistos)}`);
    const k = vistos.findIndex((v) => v.anio * 12 + (v.mes - 1) === objetivo);
    if (k >= 0) {
      await pop.locator('.date-range__month').nth(k).locator('button.cal-day').filter({ hasText: new RegExp(`^${fecha.getDate()}$`) }).click();
      return;
    }
    const primero = pop.locator('.date-range__month').first();
    if (await primero.locator('select.yearselect').count()) {
      // Con listas, se elige el anio y el mes en el primer bloque, como lo haria una persona.
      await primero.locator('select.yearselect').selectOption(String(fecha.getFullYear()));
      await primero.locator('select.monthselect').selectOption(String(fecha.getMonth()));
      continue;
    }
    const inicio = vistos[0].anio * 12 + (vistos[0].mes - 1);
    const boton = objetivo < inicio ? /anterior|previous/i : /siguiente|next|próximo/i;
    await pop.locator('.date-pop-head').getByRole('button', { name: boton }).first().click();
  }
  throw new Error(`No se llego al mes de ${fecha.toLocaleDateString('es-AR')} en el calendario`);
}

export async function elegirRango(page: Page, boton: Locator, entrada: Date, salida: Date) {
  const dd = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const esperado = `${dd(entrada)} - ${dd(salida)}`;
  if ((await boton.innerText()).trim() === esperado) return;
  if ((await boton.getAttribute('aria-expanded')) !== 'true') await boton.click();
  const pop = page.locator('.date-pop--range').last();
  await expect(pop, 'Tiene que abrir el calendario del rango').toBeVisible();
  await tocarDia(page, pop, entrada);
  await tocarDia(page, pop, salida);
  await expect(boton, `El rango tiene que quedar en ${esperado}`).toHaveText(esperado);
}
