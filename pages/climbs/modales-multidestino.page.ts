import { Page, Locator, expect } from '@playwright/test';
import { importeANumero } from '../../utils/pasos';

export type TarjetaNueva = { nombre: string; regular: number | null; privado: number | null; aviso: string | null };
export type HabitacionNueva = { nombre: string; importe: number | null; texto: string };

/** "Regular Tarifa extendida 10 % USD 96" -> 96 */
const precioDelBoton = (texto: string) => importeANumero(texto.match(/[A-Z]{3}\s*([\d.,]+)\s*$/)?.[1] ?? '');

/**
 * Los modales del itinerario de multidestino en el portal nuevo (`/site/custom-tours/{id}/detail`).
 *
 * Cada destino es una region ("Buenos Aires Argentina") con sus "Hoteles" y "Servicios" y
 * los botones "Agregar hotel" / "Agregar servicio". El modal de servicios ("Agregar servicio
 * · Buenos Aires") tiene la fecha (calendario), el buscador "Nombre o tipo", una tarjeta por
 * servicio con un boton por modalidad (Regular / Privado, con su precio) y el paginado. El
 * de hoteles ("Agregar hotel · Buenos Aires") lista hoteles; "Ver habitaciones" despliega
 * una casilla por habitacion con su precio por la estadia.
 */
export class ModalesMultidestinoPage {
  constructor(private readonly page: Page) {}

  destino(ciudad: string): Locator { return this.page.getByRole('region', { name: new RegExp(`^${ciudad}`) }); }
  get modalDeServicios(): Locator { return this.page.getByRole('dialog', { name: /^Agregar servicio/ }); }
  get modalDeHoteles(): Locator { return this.page.getByRole('dialog', { name: /^Agregar hotel/ }); }

  private async esperarTarjetas(modal: Locator) {
    await expect(modal.getByRole('article').first(), 'El modal tiene que listar resultados').toBeVisible({ timeout: 60_000 });
    await this.page.waitForLoadState('networkidle');
  }

  // --- Servicios ----------------------------------------------------------------------

  async abrirModalDeServicios(ciudad: string) {
    await this.destino(ciudad).getByRole('button', { name: 'Agregar servicio', exact: true }).click();
    await expect(this.modalDeServicios).toBeVisible();
    await this.esperarTarjetas(this.modalDeServicios);
  }

  /** El rango del destino que muestra el modal ("02/11/2026 – 05/11/2026"). */
  async rangoDelModal(): Promise<{ desde: string; hasta: string }> {
    const texto = await this.modalDeServicios.getByRole('banner').getByRole('paragraph').innerText();
    const [desde, hasta] = texto.match(/\d{2}\/\d{2}\/\d{4}/g) ?? ['', ''];
    return { desde, hasta };
  }

  /**
   * Las tarjetas que se ven: precio por modalidad (null si no la ofrece) y el aviso de que no
   * opera. Los precios llegan de a poco despues de dibujar las tarjetas (primero sin el
   * markup de la cotizacion): se lee hasta que dos lecturas seguidas coincidan.
   */
  async tarjetas(): Promise<Record<string, TarjetaNueva>> {
    await this.page.waitForLoadState('networkidle');
    let anterior = '';
    let actual = await this.leerTarjetas();
    for (let i = 0; i < 15 && JSON.stringify(actual) !== anterior; i++) {
      anterior = JSON.stringify(actual);
      await this.page.waitForTimeout(1_000);
      actual = await this.leerTarjetas();
    }
    return actual;
  }

  private async leerTarjetas(): Promise<Record<string, TarjetaNueva>> {
    const salida: Record<string, TarjetaNueva> = {};
    for (const t of await this.modalDeServicios.getByRole('article').all()) {
      const nombre = (await t.locator('strong').first().innerText()).trim();
      const botones = (await t.getByRole('button').allInnerTexts()).map((b) => b.replace(/\s+/g, ' ').trim());
      const de = (modalidad: string) => { const b = botones.find((x) => x.startsWith(modalidad)); return b ? precioDelBoton(b) : null; };
      const aviso = (await t.getByRole('listitem').allInnerTexts()).find((l) => /no opera/i.test(l)) ?? null;
      salida[nombre] = { nombre, regular: de('Regular'), privado: de('Privado'), aviso };
    }
    return salida;
  }

  async paginas(): Promise<number> {
    const nav = this.modalDeServicios.getByRole('navigation', { name: /^Página/ });
    if (!(await nav.count())) return 1;
    return Number((await nav.getAttribute('aria-label'))?.match(/de (\d+)/)?.[1] ?? 1);
  }

  async irALaPagina(sentido: 'Siguiente' | 'Anterior') {
    const antes = await this.modalDeServicios.getByRole('navigation', { name: /^Página/ }).getAttribute('aria-label');
    await this.modalDeServicios.getByRole('navigation').getByRole('button', { name: sentido }).click();
    await expect(this.modalDeServicios.getByRole('navigation', { name: /^Página/ })).not.toHaveAttribute('aria-label', antes ?? '');
    await this.esperarTarjetas(this.modalDeServicios);
  }

  /** Elige el dia en el calendario del modal (dentro del destino) y busca por nombre. */
  async buscarServicio(termino: string, dia?: Date) {
    if (dia) {
      await this.modalDeServicios.getByRole('button', { name: /^Fecha:/ }).click();
      await this.page.getByRole('dialog', { name: 'Calendario' }).getByRole('button', { name: String(dia.getDate()), exact: true }).click();
      const dd = `${String(dia.getDate()).padStart(2, '0')}/${String(dia.getMonth() + 1).padStart(2, '0')}/${dia.getFullYear()}`;
      await expect(this.modalDeServicios.getByRole('button', { name: `Fecha: ${dd}` }), `El modal tiene que quedar en el ${dd}`).toBeVisible();
    }
    await this.modalDeServicios.getByRole('textbox', { name: 'Nombre o tipo' }).fill(termino);
    await this.modalDeServicios.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(this.modalDeServicios.getByRole('article').filter({ hasText: termino }).first(), `La busqueda "${termino}" tiene que traer resultados`).toBeVisible({ timeout: 60_000 });
    await this.page.waitForLoadState('networkidle');
  }

  tarjeta(nombre: string): Locator {
    return this.modalDeServicios.getByRole('article').filter({ has: this.page.locator('strong', { hasText: new RegExp(`^${nombre}$`) }) }).first();
  }

  async elegirServicio(nombre: string, modalidad: 'Regular' | 'Privado') {
    const boton = this.tarjeta(nombre).getByRole('button', { name: new RegExp(`^${modalidad}`) });
    await boton.click();
    await expect(boton, `Tiene que quedar elegida la modalidad ${modalidad}`).toHaveAttribute('aria-pressed', 'true');
    await expect(this.modalDeServicios.getByRole('contentinfo'), 'El pie tiene que contar el servicio elegido').toContainText('1 seleccionado');
  }

  async confirmar(modal: Locator) {
    await modal.getByRole('contentinfo').getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(modal, 'Agregar tiene que cerrar el modal').toBeHidden({ timeout: 120_000 });
    await this.page.waitForLoadState('networkidle');
  }

  async cerrar(modal: Locator) {
    await modal.getByRole('contentinfo').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(modal).toBeHidden();
  }

  // --- Hoteles ------------------------------------------------------------------------

  async abrirModalDeHoteles(ciudad: string) {
    await this.destino(ciudad).getByRole('button', { name: 'Agregar hotel', exact: true }).click();
    await expect(this.modalDeHoteles).toBeVisible();
    await this.esperarTarjetas(this.modalDeHoteles);
  }

  /** Busca el hotel y despliega sus habitaciones. */
  async verHabitaciones(termino: string, nombre: string) {
    await this.modalDeHoteles.getByRole('textbox', { name: 'Nombre del hotel' }).fill(termino);
    await this.modalDeHoteles.getByRole('button', { name: 'Buscar', exact: true }).click();
    const ver = this.modalDeHoteles.getByRole('button', { name: `Ver habitaciones: ${nombre}` });
    await expect(ver, `El modal tiene que listar el hotel ${nombre}`).toBeVisible({ timeout: 60_000 });
    await ver.click();
    await expect(this.modalDeHoteles.getByRole('checkbox').first(), 'El hotel tiene que desplegar sus habitaciones').toBeVisible({ timeout: 60_000 });
  }

  /** La primera habitacion del hotel (la mas barata): nombre y precio por la estadia. */
  async primeraHabitacion(): Promise<HabitacionNueva & { casilla: Locator }> {
    const item = this.modalDeHoteles.getByRole('listitem').filter({ has: this.page.getByRole('checkbox') }).first();
    const texto = (await item.innerText()).replace(/\s+/g, ' ').trim();
    const precio = (await item.locator('strong').last().innerText()).trim();
    return { nombre: texto.split(/ Disponible| A requerir/)[0].trim(), importe: importeANumero(precio.replace(/[A-Z]{3}\s*/, '')), texto, casilla: item.getByRole('checkbox') };
  }

  // --- Itinerario ---------------------------------------------------------------------

  /** Los items de una seccion ("Hoteles" o "Servicios") del destino, en orden: nombre e importe. */
  async itemsDelDestino(ciudad: string, seccion: 'Hoteles' | 'Servicios'): Promise<{ nombre: string; importe: number | null; texto: string }[]> {
    const region = this.destino(ciudad);
    const titulos = ['Hoteles', 'Servicios', 'Servicios opcionales'];
    // Los items de cada seccion son los article entre su titulo y el siguiente.
    const todos = await region.locator('h3, article').evaluateAll((els, args) => {
      const out: { seccion: string; texto: string; nombre: string }[] = [];
      let actual = '';
      for (const e of els) {
        if (e.tagName === 'H3') { actual = (e.textContent ?? '').trim(); continue; }
        if (args.titulos.includes(actual)) out.push({ seccion: actual, texto: (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim(), nombre: e.querySelector('strong')?.textContent?.trim() ?? '' });
      }
      return out;
    }, { titulos });
    return todos.filter((t) => t.seccion === seccion).map((t) => ({
      nombre: t.nombre, texto: t.texto,
      importe: importeANumero(t.texto.match(/[A-Z]{3}\s*([\d.,]+)(?!.*[A-Z]{3}\s*[\d.,]+)/)?.[1] ?? ''),
    }));
  }
}
