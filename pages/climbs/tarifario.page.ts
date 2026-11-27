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
    // La busqueda viaja en la direccion: hasta que llega, un clic en una solapa se pierde.
    await expect(this.page).toHaveURL(/\/site\/tariff\?.*city=\d+/, { timeout: 60_000 });
    await this.page.waitForLoadState('networkidle');
  }

  async filtrosActuales(): Promise<{ pais: string; destino: string }> {
    return { pais: await this.filtro('País').inputValue(), destino: await this.filtro('Destino').inputValue() };
  }

  /**
   * Las solapas, en orden. Desde noviembre (T-100) va "Programas" despues de Paquetes y las
   * solapas dependen de los tipos con servicios visibles en el destino.
   */
  static readonly SOLAPAS = ['Paquetes', 'Programas', 'Excursiones', 'Hoteles', 'Traslados', 'Cena show', 'Cruceros', 'Ofertas'];

  /** El nombre de cada solapa en ES, EN y PT. */
  static readonly TRADUCCIONES: Record<string, string[]> = {
    Paquetes: ['Paquetes', 'Packages', 'Pacotes'],
    Programas: ['Programas', 'Programs'],
    Excursiones: ['Excursiones', 'Tours', 'Excursões'],
    Hoteles: ['Hoteles', 'Hotels', 'Hotéis'],
    Traslados: ['Traslados', 'Transfers', 'Traslado'],
    'Cena show': ['Cena show', 'Dinner show', 'Jantar show'],
    Cruceros: ['Cruceros', 'Cruises', 'Cruzeiros'],
    Ofertas: ['Ofertas', 'Recommended', 'Oferta'],
  };

  /**
   * Formas mal escritas que la pantalla mostro alguna vez: con ellas se ubica la solapa para
   * seguir el recorrido, pero se marca error. "Hoteis" sin tilde se mostraba en portugues hasta la
   * T-100 (#100, en qa el 27/11/2026), que lo corrigio a "Hotéis".
   */
  static readonly MAL_ESCRITAS: Record<string, string[]> = {
    Hoteles: ['Hoteis'],
  };

  /** La solapa por su nombre en espanol; en otro idioma se ubica por su posicion. */
  solapa(nombre: string): Locator {
    // Por el nombre en cualquiera de los tres idiomas (texts.ts del sitio): las solapas que se
    // muestran dependen de los tipos con servicios visibles en el destino, la posicion no sirve.
    const nombres = [...(TarifarioNuevoPage.TRADUCCIONES[nombre] ?? [nombre]), ...(TarifarioNuevoPage.MAL_ESCRITAS[nombre] ?? [])];
    return this.page.locator('main').getByRole('tablist').first().getByRole('tab')
      .filter({ hasText: new RegExp(`^(${nombres.join('|')})$`) }).first();
  }

  async abrirSolapa(nombre: string) {
    // Si la pantalla todavia esta aplicando la busqueda, la solapa vuelve a la primera: se reintenta.
    await expect(async () => {
      await this.solapa(nombre).click();
      await expect(this.solapa(nombre)).toHaveAttribute('aria-selected', 'true', { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await this.page.waitForLoadState('networkidle');
    await expect(this.solapa(nombre)).toHaveAttribute('aria-selected', 'true');
    // textContent y no innerText: el estilo puede pasarla a mayusculas y el regex de solapa() mira el texto.
    const rotulo = ((await this.solapa(nombre).textContent()) ?? '').replace(/\s+/g, ' ').trim();
    const correctas = TarifarioNuevoPage.TRADUCCIONES[nombre] ?? [nombre];
    expect.soft(correctas, `La solapa "${rotulo}" esta mal escrita: tiene que ser una de ${correctas.join(' / ')}`).toContain(rotulo);
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
    // En hoteles, antes del texto va el rotulo "Ubicacion: <barrio>"; la descripcion es el ultimo span.
    const desc = card.locator('.trf-card__desc').first();
    const texto = desc.locator(':scope > span').last();
    if (await texto.count()) return limpio(await texto.innerText().catch(() => ''));
    return limpio(await desc.innerText().catch(() => ''));
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
      descargaWord: await hay(this.botonWord(card)),
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
    // Sin distinguir mayusculas: desde el pase del 23/11 la solapa dice "Ficha Técnica" (antes "Ficha técnica").
    const exacto = new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`, 'i');
    await this.dialogo.getByRole('tablist').first().getByRole('tab', { name: exacto }).click();
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
    // Cada lista es un bloque .svc-sheet__amenity-list--in / --out con su titulo en un div (antes, un h4).
    const lista = async (tipo: 'in' | 'out') =>
      (await this.dialogo.locator(`.svc-sheet__amenity-list--${tipo} li`).allInnerTexts()).map(limpio);
    return { incluye: await lista('in'), noIncluye: await lista('out') };
  }

  /** Ficha tecnica: observaciones (con su marca de destacada) y los datos (termino / definicion). */
  async fichaTecnica(): Promise<{ observaciones: { texto: string; prioritaria: boolean }[]; campos: { etiqueta: string; valor: string }[] }> {
    // Cada observacion es un .svc-sheet__note (antes, un li de la lista).
    const observaciones = await this.dialogo.locator('.svc-sheet__notes li, .svc-sheet__notes .svc-sheet__note').evaluateAll((lis) => lis.map((li) => ({
      texto: (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
      prioritaria: li.classList.contains('svc-sheet__note--priority'),
    })));
    const campos = await this.dialogo.locator('dt').evaluateAll((dts) => dts.map((dt) => ({
      etiqueta: (dt.textContent ?? '').trim(),
      valor: ((dt.nextElementSibling?.textContent) ?? '').replace(/\s+/g, ' ').trim(),
    })));
    return { observaciones, campos };
  }

  /**
   * Las modalidades del calendario de Salidas. Desde la US 5040 (como el portal viejo) son
   * botones ("Regular", "Privado") arriba a la derecha del calendario, no una lista de solapas.
   */
  async modalidadesDelCalendario(): Promise<string[]> {
    return (await this.dialogo.locator('.svc-sheet__modality-tab').allInnerTexts().catch(() => [] as string[])).map(limpio);
  }

  /**
   * Los dias de los tres meses que muestra el calendario. Desde la US 5040 cada dia es un
   * `.svc-sheet__day` con solo su numero (sin fecha ni horario en el title): la fecha sale del
   * mes ("Noviembre 2026") y el numero; opera si tiene `is-on`.
   */
  async diasDelCalendario(): Promise<{ fecha: string; mes: number; opera: boolean; cerrado: boolean }[]> {
    return this.dialogo.locator('.svc-sheet__months > div').evaluateAll((bloques) => {
      const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const out: { fecha: string; mes: number; opera: boolean; cerrado: boolean }[] = [];
      for (const b of bloques) {
        const [nombre, anio] = (b.querySelector('.svc-sheet__month')?.textContent ?? '').trim().toLowerCase().split(/\s+/);
        const mes = MESES.indexOf(nombre) + 1;
        if (!mes) continue;
        for (const d of Array.from(b.querySelectorAll('.svc-sheet__day:not(.is-empty)'))) {
          const dia = Number(d.textContent?.trim());
          if (!dia) continue;
          out.push({
            fecha: `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`,
            mes,
            opera: d.classList.contains('is-on'),
            cerrado: /closed|cierre|cerrad/i.test(d.className),
          });
        }
      }
      return out;
    });
  }

  /** Salidas: las modalidades y los meses (1-12) con algun dia que opera, recorriendo un anio. */
  async salidas(): Promise<{ modalidades: string[]; meses: number[] }> {
    const modalidades = await this.modalidadesDelCalendario();
    const meses = new Set<number>();
    for (let i = 0; i < 4; i++) {
      for (const d of await this.diasDelCalendario()) if (d.opera) meses.add(d.mes);
      const sig = this.dialogo.getByRole('button', { name: 'Meses siguientes' });
      if (await sig.isDisabled()) break;
      await sig.click();
      await this.page.waitForTimeout(300);
    }
    return { modalidades, meses: [...meses].sort((a, b) => a - b) };
  }

  async abrirProveedores(card: Locator): Promise<string[][]> {
    await card.getByRole('button', { name: 'Ver Proveedores' }).click();
    // Desde el pase del 23/11 el modal se titula "Ver proveedores" (antes "Proveedores Disponibles").
    const d = this.page.getByRole('dialog', { name: /^(Proveedores Disponibles|Ver proveedores)$/ });
    await expect(d.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
    return d.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').trim())));
  }

  /** Baja el Word de la card. */
  async descargarWord(card: Locator): Promise<Download> {
    const espera = this.page.waitForEvent('download', { timeout: 120_000 });
    await this.botonWord(card).click();
    // Con impersonacion, la app pide elegir la marca en el modal "Exportar a Word" antes de bajarlo.
    const marca = this.page.getByRole('dialog', { name: 'Exportar a Word' });
    if (await marca.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true, () => false)) await marca.getByRole('button', { name: 'Descargar' }).click();
    return espera;
  }

  /** El Word de la card: era un link y desde el pase del 23/11 es un boton con icono (mismo nombre accesible). */
  private botonWord(card: Locator): Locator {
    const nombre = 'Descargar en formato Word';
    return card.getByRole('button', { name: nombre }).or(card.getByRole('link', { name: nombre })).first();
  }

  /** El markup del usuario, como lo muestra el encabezado ("M 0,50"). */
  async markupActivo(): Promise<number | null> {
    // Con el explorador abierto el modal tiene su propio banner: se lee el primero, el del sitio.
    const texto = await this.page.getByRole('banner').first().innerText();
    const m = texto.match(/\bM\s*([0-9]+[.,][0-9]+)/);
    return m ? Number(m[1].replace(',', '.')) : null;
  }
}
