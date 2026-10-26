import { Page, Locator, expect, Download } from '@playwright/test';
import { PortalNuevoPage } from './portal.page';

/** Una tabla tal como se ve: la fila de encabezados y una fila por tarifa, celda por celda. */
export type Tabla = string[][];

const limpio = (t: string) => t.replace(/\s+/g, ' ').trim();

/**
 * Tarifario del portal nuevo (`/site/tariff`, menu "Tarifario").
 *
 * Solapas Paquetes, Excursiones, Hoteles, Traslados, Cena show, Cruceros y Ofertas; filtros
 * País y Destino con "Buscar"; a la izquierda "Filtrar resultados" con el buscador "Buscar
 * <solapa> por nombre". Cada item es una card (`article`) con el nombre y su pastilla
 * (`.trf-chip`), la descripcion recortada, tags, observaciones destacadas, la barra de
 * operatividad con sus tooltips, las amenities destacadas y los botones "Ver Proveedores",
 * "Ver detalle", "Ver Tarifario" ("Ver precios" en cruceros), Word y "Cotizar y reservar".
 * "Ver Tarifario" abre el explorador de tarifas en un dialogo; "Ver detalle", la ficha.
 */
export class TarifarioNuevoPage {
  constructor(private readonly page: Page) {}

  async irDesdeElMenu() {
    await new PortalNuevoPage(this.page).abrirInicio();
    await this.page.getByRole('banner').locator('nav a[href^="/site/tariff"]').click();
    await expect(this.page.getByRole('tablist').first()).toBeVisible({ timeout: 60_000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Los filtros de arriba son los dos primeros combos de la pantalla (País y Destino). Se
   * ubican por posicion y no por el rotulo, que se traduce ("Country", "País").
   */
  private filtro(rotulo: string): Locator {
    return this.page.locator('main').getByRole('combobox').nth(rotulo === 'País' ? 0 : 1);
  }

  private async elegir(rotulo: string, valor: string) {
    const combo = this.filtro(rotulo);
    if ((await combo.inputValue()) === valor) return;
    await combo.click();
    await combo.fill(valor);
    await this.page.getByRole('option', { name: valor, exact: true }).first().click();
    await expect(combo).toHaveValue(valor);
  }

  async filtrar(pais: string, destino: string) {
    await this.elegir('País', pais);
    await this.elegir('Destino', destino);
    // El boton de buscar es el que sigue a los filtros (su rotulo tambien se traduce).
    await this.filtro('Destino').locator('xpath=following::button[1]').click();
    await this.page.waitForLoadState('networkidle');
  }

  async filtrosActuales(): Promise<{ pais: string; destino: string }> {
    return { pais: await this.filtro('País').inputValue(), destino: await this.filtro('Destino').inputValue() };
  }

  /** Las solapas, en orden: Paquetes, Excursiones, Hoteles, Traslados, Cena show, Cruceros, Ofertas. */
  static readonly SOLAPAS = ['Paquetes', 'Excursiones', 'Hoteles', 'Traslados', 'Cena show', 'Cruceros', 'Ofertas'];

  /** La solapa por su nombre en espanol; en otro idioma se ubica por su posicion. */
  solapa(nombre: string): Locator {
    return this.page.locator('main').getByRole('tablist').first().getByRole('tab').nth(TarifarioNuevoPage.SOLAPAS.indexOf(nombre));
  }

  async abrirSolapa(nombre: string) {
    await this.solapa(nombre).click();
    await expect(this.solapa(nombre)).toHaveAttribute('aria-selected', 'true');
    await this.page.waitForLoadState('networkidle');
  }

  /** El buscador por nombre de la solapa ("Buscar <solapa> por nombre"): el segundo combo del lateral. */
  get buscador(): Locator {
    return this.page.locator('main').getByRole('complementary').getByRole('combobox').nth(1);
  }

  /** El buscador por nombre de la solapa: se escribe y se elige la sugerencia del item. */
  async buscarPorNombre(termino: string, nombre: string) {
    const buscador = this.buscador;
    await buscador.click();
    await buscador.pressSequentially(termino, { delay: 40 });
    // La sugerencia puede traer algo mas que el nombre: se prefiere la exacta y si no, la que lo contiene.
    const exacta = this.page.getByRole('option', { name: nombre, exact: true });
    const opcion = (await exacta.first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false))
      ? exacta.first() : this.page.getByRole('option').filter({ hasText: nombre.replace(/\s*\(.*$/, '') }).first();
    await opcion.click();
    await expect(this.card(nombre), `Tiene que quedar la card de ${nombre}`).toBeVisible({ timeout: 60_000 });
    await this.page.waitForLoadState('networkidle');
  }

  /** La card del item: el h2 empieza con su nombre (despues va la pastilla). */
  card(nombre: string): Locator {
    const inicio = nombre.replace(/\s*\(.*$/, '');
    return this.page.locator('main article').filter({
      has: this.page.getByRole('heading', { level: 2 }).filter({ hasText: inicio }),
    }).first();
  }

  /** El titulo de la card sin las pastillas, y las pastillas aparte. */
  async tituloDeLaCard(card: Locator): Promise<{ nombre: string; pastillas: string[] }> {
    const h2 = card.getByRole('heading', { level: 2 });
    const nombre = await h2.evaluate((el) => {
      const copia = el.cloneNode(true) as HTMLElement;
      copia.querySelectorAll('.trf-chip').forEach((x) => x.remove());
      return (copia.textContent ?? '').replace(/\s+/g, ' ').trim();
    });
    const pastillas = (await h2.locator('.trf-chip').allInnerTexts()).map(limpio);
    return { nombre, pastillas };
  }

  async descripcionDeLaCard(card: Locator): Promise<string> {
    return limpio(await card.locator('.trf-card__desc').first().innerText().catch(() => ''));
  }

  /** Que componentes tiene la card. */
  async componentes(card: Locator): Promise<Record<string, boolean>> {
    const hay = async (l: Locator) => (await l.count()) > 0;
    return {
      imagen: await hay(card.locator('.trf-photos img[src]:not([src=""])')),
      texto: (await this.descripcionDeLaCard(card)) !== '',
      botonTarifario: await hay(card.getByRole('button', { name: /^(Ver Tarifario|Ver precios)$/ })),
      cotizarYReservar: await hay(card.getByRole('link', { name: 'Cotizar y reservar' })),
      proveedores: await hay(card.getByRole('button', { name: 'Ver Proveedores' })),
      descargaWord: await hay(card.getByRole('link', { name: 'Descargar en formato Word' })),
      tagRecomendado: await hay(card.locator('.trf-badge').filter({ hasText: /Recomendado/i })),
      observaciones: await hay(card.locator('.trf-obs__item')),
      iconosTooltips: await hay(card.locator('.trf-op [role="tooltip"]')),
    };
  }

  async srcImagen(card: Locator): Promise<string | null> {
    return card.locator('.trf-photos img').first().getAttribute('src').catch(() => null);
  }

  async observacionesDestacadas(card: Locator): Promise<string[]> {
    return (await card.locator('.trf-obs__item').allInnerTexts()).map(limpio);
  }

  async tagsDeServicio(card: Locator): Promise<string[]> {
    return (await card.locator('.trf-card__tags .trf-tag').allInnerTexts()).map(limpio);
  }

  /** La barra de operatividad: el texto de cada item, sus meses y la lista de su tooltip. */
  async barraDeOperatividad(card: Locator): Promise<{ texto: string; meses: string; items: string[]; esCalendario: boolean }[]> {
    return card.locator('.trf-op > .trf-op__item:not(.trf-op__amenities)').evaluateAll((els) => els.map((e) => {
      const tip = e.querySelector('[role="tooltip"]');
      const copia = e.cloneNode(true) as HTMLElement;
      copia.querySelectorAll('[role="tooltip"], small').forEach((x) => x.remove());
      return {
        texto: (copia.textContent ?? '').replace(/\s+/g, ' ').trim(),
        meses: (e.querySelector('small')?.textContent ?? '').trim(),
        items: Array.from(tip?.querySelectorAll('li') ?? []).map((li) => (li.textContent ?? '').trim()),
        esCalendario: !!e.querySelector('.trf-op__days'),
      };
    }));
  }

  async amenitiesDestacadas(card: Locator): Promise<{ estado: string; nombre: string; nota: string }[]> {
    return card.locator('.trf-amenity').evaluateAll((els) => els.map((e) => ({
      estado: (e.querySelector('.trf-tip__status')?.textContent ?? '').trim(),
      nombre: (e.querySelector('.trf-tip__name')?.textContent ?? '').trim(),
      nota: (e.querySelector('.trf-tip__note')?.textContent ?? '').trim(),
    })));
  }

  // --- Explorador de tarifas ("Ver Tarifario") ----------------------------------------

  get dialogo(): Locator { return this.page.getByRole('dialog').last(); }

  async verTarifario(card: Locator): Promise<Locator> {
    await card.getByRole('button', { name: /^(Ver Tarifario|Ver precios)$/ }).click();
    await expect(this.dialogo, 'Ver Tarifario tiene que abrir el explorador de tarifas').toBeVisible();
    await expect(this.dialogo.locator('table, [role="table"]').first().or(this.dialogo.getByText(/Todavía no hay/)), 'El explorador tiene que mostrar las tarifas')
      .toBeVisible({ timeout: 60_000 });
    await this.page.waitForLoadState('networkidle');
    return this.dialogo;
  }

  async tituloDelDialogo(): Promise<string> {
    return limpio(await this.dialogo.getByRole('banner').getByRole('heading').first().innerText());
  }

  /** Las solapas de idioma del explorador (navegacion "Idioma"); ninguna si no hay. */
  async idiomasDelExplorador(): Promise<string[]> {
    const nav = this.dialogo.getByRole('navigation', { name: 'Idioma' });
    if (!(await nav.count())) return [];
    return (await nav.getByRole('button').allInnerTexts()).map(limpio);
  }

  /** Las categorias o habitaciones del explorador (paquetes, hoteles): el rotulo de cada boton. */
  async categoriasDelExplorador(): Promise<{ nombre: string; boton: Locator }[]> {
    const nav = this.dialogo.getByRole('navigation').filter({ hasText: /disponibles?$|categor[ií]as? disponibles?|habitaciones disponibles/ }).first();
    if (!(await nav.count())) return [];
    const botones = await nav.getByRole('button').all();
    return Promise.all(botones.map(async (b) => ({ nombre: limpio(await b.locator('strong').first().innerText()), boton: b })));
  }

  /** La tabla de tarifas visible en el explorador, celda por celda (con la nota de la fecha). */
  async tablaDelExplorador(): Promise<Tabla> {
    const tabla = this.dialogo.locator('table').first();
    await expect(tabla.locator('tbody tr').first()).toBeVisible({ timeout: 60_000 });
    return tabla.evaluate((t) => Array.from(t.querySelectorAll('tr')).map((tr) =>
      Array.from(tr.querySelectorAll('th, td')).map((c) => ((c as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim())));
  }

  async elegirIdiomaDelExplorador(idioma: string) {
    const boton = this.dialogo.getByRole('navigation', { name: 'Idioma' }).getByRole('button', { name: idioma, exact: true });
    await boton.click();
    await expect(boton).toHaveAttribute('aria-pressed', 'true');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500);
  }

  async cerrarDialogo() {
    const d = this.dialogo;
    await d.getByRole('banner').getByRole('button', { name: 'Cerrar' }).click();
    await expect(d).toBeHidden();
  }

  // --- Ver detalle y proveedores ------------------------------------------------------

  async abrirDetalle(card: Locator): Promise<Locator> {
    await card.getByRole('button', { name: /^Ver [Dd]etalle$/ }).click();
    await expect(this.dialogo, 'Ver detalle tiene que abrir la ficha').toBeVisible();
    await expect(this.dialogo.getByRole('contentinfo')).toBeVisible({ timeout: 30_000 });
    // La ficha dibuja las solapas a medida que llegan los datos.
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(800);
    return this.dialogo;
  }

  /** Las solapas de la ficha por su clave (`data-tour="tab-description"` -> "description"), las mismas del portal actual. */
  async solapasDelDetalle(): Promise<string[]> {
    // Las solapas aparecen cuando llegan los datos de la ficha.
    await this.dialogo.getByRole('tab').first().waitFor({ timeout: 30_000 }).catch(() => {});
    return this.dialogo.getByRole('tablist').first().getByRole('tab').evaluateAll((ts) =>
      ts.map((t) => (t.getAttribute('data-tour') ?? t.textContent ?? '').replace(/^tab-/, '').trim()));
  }

  async abrirSolapaDelDetalle(nombre: string) {
    await this.dialogo.getByRole('tablist').first().getByRole('tab', { name: nombre, exact: true }).click();
    await this.page.waitForTimeout(400);
  }

  /** El texto del cuerpo de la ficha (sin el titulo ni los botones), linea por linea. */
  async textoDelDetalle(): Promise<string> {
    // Todo el dialogo menos el encabezado, el pie y los rotulos de las solapas, que no son contenido.
    let texto = await this.dialogo.innerText();
    const quitar = [
      ...(await this.dialogo.getByRole('banner').allInnerTexts()),
      ...(await this.dialogo.getByRole('contentinfo').allInnerTexts()),
      ...(await this.dialogo.getByRole('tablist').allInnerTexts()).flatMap((x) => x.split('\n')),
    ].map((x) => x.trim()).filter(Boolean);
    for (const q of quitar) texto = texto.replace(q, '');
    return texto;
  }

  /** Incluye / No incluye: el texto de cada item (nombre y, si tiene, su descripcion). */
  async amenitiesDelDetalle(): Promise<{ incluye: string[]; noIncluye: string[] }> {
    const lista = async (titulo: string) => {
      const h = this.dialogo.getByRole('heading', { level: 4, name: titulo, exact: true });
      return (await h.locator('xpath=following-sibling::*[1]').locator('li').allInnerTexts()).map(limpio);
    };
    return { incluye: await lista('Incluye'), noIncluye: await lista('No incluye') };
  }

  /** Ficha tecnica: observaciones (con su marca de destacada) y los datos (termino / definicion). */
  async fichaTecnica(): Promise<{ observaciones: { texto: string; prioritaria: boolean }[]; campos: { etiqueta: string; valor: string }[] }> {
    const observaciones = await this.dialogo.locator('.svc-sheet__notes li').evaluateAll((lis) => lis.map((li) => ({
      texto: (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
      prioritaria: li.classList.contains('svc-sheet__note--priority'),
    })));
    const campos = await this.dialogo.locator('dt').evaluateAll((dts) => dts.map((dt) => ({
      etiqueta: (dt.textContent ?? '').trim(),
      valor: ((dt.nextElementSibling?.textContent) ?? '').replace(/\s+/g, ' ').trim(),
    })));
    return { observaciones, campos };
  }

  /** Salidas: las modalidades y los meses (1-12) con algun dia que opera, recorriendo un anio. */
  async salidas(): Promise<{ modalidades: string[]; meses: number[] }> {
    const modalidades = (await this.dialogo.getByRole('tablist', { name: 'Salidas' }).getByRole('tab').allInnerTexts().catch(() => [] as string[])).map(limpio);
    const meses = new Set<number>();
    for (let i = 0; i < 4; i++) {
      const titulos = await this.dialogo.locator('.cal-day.on[title]').evaluateAll((ds) => ds.map((d) => d.getAttribute('title') ?? ''));
      for (const t of titulos) { const m = /^\d{2}\/(\d{2})\//.exec(t); if (m) meses.add(Number(m[1])); }
      const sig = this.dialogo.getByRole('button', { name: 'Meses siguientes' });
      if (await sig.isDisabled()) break;
      await sig.click();
      await this.page.waitForTimeout(300);
    }
    return { modalidades, meses: [...meses].sort((a, b) => a - b) };
  }

  async abrirProveedores(card: Locator): Promise<string[][]> {
    await card.getByRole('button', { name: 'Ver Proveedores' }).click();
    const d = this.page.getByRole('dialog', { name: 'Proveedores Disponibles' });
    await expect(d.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
    return d.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').trim())));
  }

  /** Baja el Word de la card. */
  async descargarWord(card: Locator): Promise<Download> {
    const [descarga] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 120_000 }),
      card.getByRole('link', { name: 'Descargar en formato Word' }).click(),
    ]);
    return descarga;
  }

  /** El markup del usuario, como lo muestra el encabezado ("M 0,50"). */
  async markupActivo(): Promise<number | null> {
    const texto = await this.page.getByRole('banner').innerText();
    const m = texto.match(/\bM\s*([0-9]+[.,][0-9]+)/);
    return m ? Number(m[1].replace(',', '.')) : null;
  }
}
