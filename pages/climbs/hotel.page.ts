import { Page, Locator, expect } from '@playwright/test';
import { formatearFecha } from '../../utils/pasos';
import { PortalNuevoPage } from './portal.page';
import { elegirRango } from './calendario-rango';

/** 02/11/2026 -> 2026-11-02, como viaja en la URL de la busqueda. */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Hoteles en el portal nuevo: solapa HOTELES de la portada (Destino, Check-in, Check-out,
 * Viajeros), resultados en `/site/hotels?...` y ficha en `/site/hotels/{id}?...`, con una
 * tarjeta por habitacion ("Total por habitacion", contador "Habitaciones", "Confirmar").
 */
export class HotelNuevoPage {
  constructor(private readonly page: Page) {}

  get panel(): Locator { return this.page.getByRole('tabpanel', { name: 'Hoteles', exact: true }); }

  /** Elige el hotel en el buscador "Destino" (acepta destinos y hoteles): se elige el hotel directo. */
  async elegirHotel(termino: string, nombre: string) {
    await new PortalNuevoPage(this.page).abrirInicio();
    await this.page.getByRole('tab', { name: 'Hoteles', exact: true }).click();
    const destino = this.panel.getByRole('combobox', { name: 'Destino' });
    await destino.click();
    await destino.pressSequentially(termino, { delay: 50 });
    await this.page.getByRole('option', { name: new RegExp(`^${nombre}`) }).click();
    await expect(destino, 'El buscador tiene que quedar con el hotel elegido').toHaveValue(new RegExp(`^${nombre}`));
  }

  async elegirFechas(entrada: Date, salida: Date) {
    // Desde la US 5040 Check-in y Check-out son un solo selector de rango ("Check-in | Check-out").
    const rango = this.panel.getByRole('button', { name: 'Check-in | Check-out' });
    if (await rango.count()) { await elegirRango(this.page, rango, entrada, salida); return; }
    for (const [rotulo, fecha] of [['Check-in', entrada], ['Check-out', salida]] as const) {
      const campo = this.panel.getByRole('textbox', { name: rotulo });
      await campo.fill(formatearFecha(fecha));
      await campo.press('Tab');
      await expect(campo, `${rotulo} tiene que quedar con la fecha elegida`).toHaveValue(formatearFecha(fecha));
    }
  }

  /** Los contadores del panel "Viajeros" arrancan en 0: se suben con "Uno mas" hasta el valor pedido. */
  async cargarViajeros(habitaciones: number, adultos: number) {
    await this.panel.getByRole('button', { name: 'Viajeros' }).click();
    for (const [campo, objetivo] of [['Habitaciones', habitaciones], ['Adultos', adultos]] as const) {
      const mas = this.page.getByRole('button', { name: `Uno más: ${campo}` });
      const valor = async () => Number((await mas.locator('..').innerText()).match(/\d+/)?.[0] ?? 0);
      for (let i = 0; i < 20 && (await valor()) < objetivo; i++) await mas.click();
      expect(await valor(), `${campo} tiene que quedar en ${objetivo}`).toBe(objetivo);
    }
    const viajeros = this.panel.getByRole('button', { name: 'Viajeros' });
    await this.page.keyboard.press('Escape');
    if ((await viajeros.getAttribute('aria-expanded')) === 'true') await viajeros.click();
    await expect(this.panel.getByRole('button', { name: 'Viajeros' }))
      .toHaveText(`${adultos} adulto${adultos === 1 ? '' : 's'} · ${habitaciones} habitaci${habitaciones === 1 ? 'ón' : 'ones'}`);
  }

  async buscar(entrada: Date, salida: Date) {
    await this.panel.getByRole('button', { name: 'Buscar' }).click();
    await expect(this.page, 'La busqueda tiene que salir con las fechas elegidas')
      .toHaveURL(new RegExp(`/site/hotels\\?.*checkin=${iso(entrada)}&checkout=${iso(salida)}`), { timeout: 60_000 });
  }

  async abrirFicha(nombre: string) {
    // Desde noviembre el nombre de la tarjeta no es un link: la ficha se abre con "Ver más".
    const porNombre = this.page.locator('main').getByRole('link').filter({ hasText: nombre }).first();
    const verMas = this.page.locator('main article').filter({ has: this.page.getByRole('heading', { name: nombre, exact: true }) }).first()
      .getByRole('link', { name: /^(Ver más|See more|Ver mais)$/ });
    await porNombre.or(verMas).first().click();
    // El titulo de los resultados ("<hotel>: 1 Resultados") tambien contiene el nombre: se espera
    // la ficha de verdad (su URL y su titulo exacto).
    await expect(this.page, `Tiene que abrir la ficha de ${nombre}`).toHaveURL(/\/site\/hotels\/\d+/, { timeout: 60_000 });
    await expect(this.page.getByRole('heading', { level: 1, name: nombre, exact: true }), `Tiene que abrir la ficha de ${nombre}`).toBeVisible({ timeout: 60_000 });
  }

  habitacion(nombre: string): Locator {
    return this.page.locator('main article').filter({ has: this.page.getByRole('heading', { name: nombre, exact: true }) }).first();
  }

  /** Tipo de tarifa que eligio la ficha para los adultos buscados ("Doble"). */
  async tipoDeTarifa(nombre: string): Promise<string> {
    return (await this.habitacion(nombre).locator('strong').first().innerText()).trim();
  }

  /** "Total por habitacion": el precio de una habitacion por la estadia. */
  async precioDeLaHabitacion(nombre: string): Promise<string> {
    const texto = (await this.habitacion(nombre).innerText()).replace(/\s+/g, ' ');
    return texto.match(/Total por habitaci[oó]n\s+([A-Z]{3}\s*[\d.,]+)/i)?.[1] ?? '';
  }

  /** Sube el contador "Habitaciones" de la tarjeta y confirma; devuelve el total que armo la tarjeta. */
  async reservarHabitacion(nombre: string, cantidad: number): Promise<string> {
    const tarjeta = this.habitacion(nombre);
    const contador = tarjeta.getByRole('group', { name: 'Habitaciones' });
    for (let i = 0; i < cantidad; i++) await contador.getByRole('button', { name: 'Agregar una habitación' }).click();
    await expect(contador.getByRole('status'), `La tarjeta tiene que quedar con ${cantidad} habitacion(es)`).toHaveText(String(cantidad));
    // Desde noviembre el total es "Total" + moneda + importe en elementos pegados ("TotalUSD500"):
    // se lee la caja del total; si no esta, el texto de la tarjeta sin exigir espacios ni mayusculas.
    const caja = tarjeta.locator('.hdp-room__total');
    const total = (await caja.count())
      ? `${(await caja.locator('em').innerText()).trim()} ${(await caja.locator('span').last().innerText()).trim()}`
      : (await tarjeta.innerText()).replace(/\s+/g, ' ').match(/\bTotal\s*([A-Z]{3}\s*[\d.,]+)/i)?.[1] ?? '';
    await tarjeta.getByRole('button', { name: 'Confirmar' }).click();
    return total;
  }
}
