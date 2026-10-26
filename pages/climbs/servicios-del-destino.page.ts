import { Page, Locator, expect } from '@playwright/test';

export type Importe = { moneda: string; valor: number };
export type ItemDeLaFicha = { texto: string; tarifa: string; checkin: string; rooming: string; proveedor: string; costo: Importe; venta: Importe };
export type FilaDeLaGrilla = { texto: string; checkin: string; rooming: string; costo: number; monedaDeCosto: string; venta: number; monedaDeVenta: string };
export type ResultadoDelBuscador = { celdas: Record<string, string>; costo: Importe; venta: Importe; fila: Locator };

/** "94.600,00" -> 94600 */
export const numero = (t: string) => Number((t || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
const importe = (t: string): Importe => {
  const m = t.match(/([A-Z]{3})\s*(-?\d[\d.]*(?:,\d+)?)|(-?\d[\d.]*(?:,\d+)?)\s*([A-Z]{3})/);
  return { moneda: (m?.[1] ?? m?.[4] ?? '').trim(), valor: numero(m?.[2] ?? m?.[3] ?? '') };
};

/**
 * Alta manual de servicios en el Backoffice nuevo.
 *
 * Desde la ficha del file (solapa "Destinos y servicios"), el boton "Servicios ›" de cada
 * destino abre la pantalla "Servicios del destino · {ciudad}" (/files/files/{id}/destinations/
 * {destino}). "Agregar servicio" abre el buscador "Busqueda de servicios y hoteles"; cada
 * resultado tiene su "Agregar", que suma una fila al final de la grilla editable (el buscador
 * queda abierto). "Guardar y volver" graba y vuelve a la ficha.
 */
export class ServiciosDelDestinoPage {
  constructor(private readonly page: Page) {}

  get ficha(): Locator { return this.page.getByRole('dialog').first(); }
  get pantalla(): Locator { return this.page.getByRole('dialog', { name: /^Servicios del destino/ }); }
  get buscador(): Locator { return this.page.getByRole('dialog', { name: 'Búsqueda de servicios y hoteles' }); }

  // --- Ficha del file, solapa "Destinos y servicios" ----------------------------------

  async verDestinosYServicios() {
    await this.ficha.getByRole('tab', { name: /^Destinos y servicios/ }).click();
    await expect(this.ficha.locator('section.fs-dest').first(), 'La solapa tiene que mostrar los destinos').toBeVisible({ timeout: 60_000 });
  }

  destino(ciudad: string): Locator {
    return this.ficha.locator('section.fs-dest').filter({ hasText: ciudad }).first();
  }

  /** Los items del destino en la ficha, en el orden en que se muestran. */
  async itemsDeLaFicha(ciudad: string): Promise<ItemDeLaFicha[]> {
    const filas = this.destino(ciudad).locator('tbody tr').filter({ has: this.page.getByRole('button', { name: /^Estado del ítem:/ }) });
    const out: ItemDeLaFicha[] = [];
    for (const f of await filas.all()) {
      const texto = (await f.innerText()).replace(/\s+/g, ' ').trim();
      const importes = [...texto.matchAll(/(-?\d[\d.]*(?:,\d+)?)\s*(ARS|USD|EUR|BRL)\b/g)];
      out.push({
        texto,
        tarifa: texto.match(/\b(REGULAR|PRIVADO)\b/i)?.[1]?.toUpperCase() ?? '',
        checkin: texto.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] ?? '',
        rooming: texto.match(/\b\d+-\d+(?:\.\d+(?:-\d+)?)*\b/)?.[0] ?? '',
        proveedor: texto.match(/GRUPO SUMMA|SIN PROVEEDOR/i)?.[0] ?? '',
        costo: { valor: numero(importes[0]?.[1] ?? ''), moneda: importes[0]?.[2] ?? '' },
        venta: { valor: numero(importes[1]?.[1] ?? ''), moneda: importes[1]?.[2] ?? '' },
      });
    }
    return out;
  }

  /** Cabecera del destino: Costo, Venta y la cantidad de servicios ("1 servicio"). */
  async cabeceraDelDestino(ciudad: string): Promise<{ costo: number; venta: number; servicios: number; texto: string }> {
    const texto = (await this.destino(ciudad).locator('header, .fs-dest-head').first().innerText()).replace(/\s+/g, ' ');
    return {
      texto,
      costo: numero(texto.match(/COSTO\s+(-?[\d.,]+)/i)?.[1] ?? ''),
      venta: numero(texto.match(/VENTA\s+(-?[\d.,]+)/i)?.[1] ?? ''),
      servicios: Number(texto.match(/(\d+)\s+servicios?/i)?.[1] ?? 0),
    };
  }

  /** Panel "Totales" de la solapa (lo grabado en el file: lo recalcula un proceso aparte). */
  async totalesGrabados(): Promise<{ costo: number; venta: number; texto: string }> {
    const card = this.ficha.locator('section, .card').filter({ has: this.page.getByRole('heading', { name: 'Totales', exact: true }) }).last();
    const texto = (await card.innerText()).replace(/\s+/g, ' ');
    return { texto, costo: numero(texto.match(/COSTO\s+(-?[\d.,]+)/i)?.[1] ?? ''), venta: numero(texto.match(/VENTA\s+(-?[\d.,]+)/i)?.[1] ?? '') };
  }

  // --- Pantalla de servicios del destino ----------------------------------------------

  async abrirServiciosDelDestino(ciudad: string) {
    await this.destino(ciudad).getByRole('button', { name: /^Servicios/ }).click();
    await expect(this.pantalla, `Tiene que abrir los servicios del destino ${ciudad}`).toBeVisible({ timeout: 60_000 });
    await expect(this.filasDeLaGrilla().first()).toBeVisible({ timeout: 60_000 });
  }

  filasDeLaGrilla(): Locator {
    return this.pantalla.locator('tr[data-sort-key]');
  }

  async leerFila(fila: Locator): Promise<FilaDeLaGrilla> {
    const monedaCosto = fila.getByRole('button', { name: /^Moneda del costo:/ });
    return {
      texto: (await fila.innerText()).replace(/\s+/g, ' ').trim(),
      checkin: await fila.getByRole('textbox', { name: 'In', exact: true }).inputValue(),
      rooming: await fila.getByRole('textbox', { name: 'Rooming', exact: true }).inputValue(),
      costo: numero(await fila.getByRole('textbox', { name: 'Costo', exact: true }).inputValue()),
      monedaDeCosto: (await monedaCosto.count())
        ? ((await monedaCosto.getAttribute('aria-label')) ?? '').replace(/^Moneda del costo:\s*/, '').trim()
        : ((await fila.innerText()).match(/\b(ARS|USD|EUR|BRL)\b/)?.[1] ?? ''),
      venta: numero(await fila.getByRole('textbox', { name: 'Venta', exact: true }).inputValue()),
      monedaDeVenta: ((await fila.innerText()).match(/\b(ARS|USD|EUR|BRL)\b(?![\s\S]*\b(ARS|USD|EUR|BRL)\b)/)?.[1] ?? ''),
    };
  }

  // --- Buscador -----------------------------------------------------------------------

  async abrirBuscador() {
    await this.pantalla.getByRole('button', { name: 'Agregar servicio', exact: true }).first().click();
    await expect(this.buscador).toBeVisible();
  }

  /** Solo servicios, por nombre (eligiendo la opcion de la lista), con rooming y tipo de tarifa. */
  async buscarServicio(termino: string, opcion: RegExp, rooming: string, tarifa: string): Promise<ResultadoDelBuscador[]> {
    const b = this.buscador;
    await b.getByRole('tab', { name: 'Servicios', exact: true }).click();
    const nombre = b.locator('#fd-bsq-name');
    await nombre.click();
    await nombre.pressSequentially(termino, { delay: 40 });
    await this.page.getByRole('option', { name: opcion }).first().click();
    await b.locator('#fd-bsq-rooming').fill(rooming);
    await b.locator('#fd-bsq-rate').selectOption({ label: tarifa });
    await b.getByRole('button', { name: 'Buscar', exact: true }).click();
    const tabla = b.locator('table').last();
    await expect(tabla.locator('tbody tr').first(), 'El buscador tiene que traer resultados').toBeVisible({ timeout: 60_000 });
    await this.page.waitForLoadState('networkidle');
    // Los encabezados ordenables llevan la flecha del orden ("Servicio / Hotel ↓"): se saca.
    const encabezados = (await tabla.locator('thead th').allInnerTexts()).map((t) => t.replace(/[↑↓▲▼]/g, '').replace(/\s+/g, ' ').trim());
    const out: ResultadoDelBuscador[] = [];
    for (const fila of await tabla.locator('tbody tr').all()) {
      const valores = (await fila.locator('td').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      const celdas: Record<string, string> = {};
      encabezados.forEach((h, i) => { if (h) celdas[h] = valores[i] ?? ''; });
      out.push({ celdas, costo: importe(celdas['Costo'] ?? ''), venta: importe(celdas['Venta'] ?? ''), fila });
    }
    return out;
  }

  /** "Agregar" del resultado: suma la fila y avisa. El buscador queda abierto y se cierra. */
  async agregar(r: ResultadoDelBuscador) {
    await r.fila.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(this.page.getByText('Se agregó correctamente el servicio').first(), 'Agregar tiene que confirmar el servicio').toBeVisible({ timeout: 30_000 });
    await this.buscador.getByRole('button', { name: 'Cerrar' }).last().click();
    await expect(this.buscador).toBeHidden();
  }

  /**
   * "Guardar y volver". Devuelve si, ya guardado, la pantalla igual pregunto "Hay cambios sin
   * guardar" al salir (observado el 26/10/2026: el pie dice "Al dia" y aun asi pregunta). En ese
   * caso se elige "Descartar cambios", que es lo que haria quien ya vio que quedo guardado.
   */
  async guardarYVolver(fileId: string): Promise<{ preguntoSinCambios: boolean }> {
    await this.pantalla.getByRole('button', { name: 'Guardar y volver', exact: true }).click();
    await expect(this.page.getByText('Se guardaron los servicios del destino.').first(), 'Guardar tiene que confirmar').toBeVisible({ timeout: 60_000 });
    const pregunta = this.page.getByRole('alertdialog').filter({ hasText: 'Hay cambios sin guardar' });
    const pregunto = await pregunta.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
    if (pregunto) {
      await expect(this.pantalla.getByText('Al día', { exact: true }), 'Para descartar sin perder nada, el pie tiene que decir "Al día"').toBeVisible();
      await pregunta.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
    }
    await expect(this.page, 'Guardar y volver tiene que volver a la ficha del file').toHaveURL(new RegExp(`/files/files/${fileId}(\\?|$)`), { timeout: 60_000 });
    return { preguntoSinCambios: pregunto };
  }
}
