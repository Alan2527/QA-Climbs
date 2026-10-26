import { Page, Locator, expect } from '@playwright/test';

export type ImporteNuevo = { moneda: string; valor: number | null };

/** "94.600 ARS" / "96 USD" / "65,24" -> { moneda, valor } */
const leerImporte = (numero: string, moneda = ''): ImporteNuevo => ({
  moneda,
  valor: numero ? Number(numero.replace(/\./g, '').replace(',', '.')) : null,
});

/**
 * Backoffice de la app nueva (ClimbsApp, raiz del sitio).
 *
 * Bandeja de reservas en `/files/inbox`: muestra cada reserva por su numero sin el
 * prefijo del portal ("BO00025832" se ve como "25832"). Al abrirla se despliega un
 * dialogo con los datos del file a generar y el boton "Generar file". Generado, la
 * ficha del file se abre como dialogo sobre el listado, en `/files/files/{id}`.
 */
export class BackofficeNuevoPage {
  constructor(private readonly page: Page) {}

  /** "BO00025832" -> "25832" */
  static numeroDeReserva(codigo: string): string {
    return String(Number(codigo.replace(/\D/g, '')));
  }

  get fichaDelFile(): Locator {
    return this.page.getByRole('dialog').first();
  }

  /**
   * La fila de la reserva en la bandeja (`/files/inbox`), buscada por su numero. La bandeja
   * separa por origen en solapas ("Online", "Series", "Grupos"...): las de serie viven en la suya.
   */
  async filaDeLaBandeja(codigo: string, origen: 'Online' | 'Series' = 'Online'): Promise<Locator> {
    const numero = BackofficeNuevoPage.numeroDeReserva(codigo);
    await this.page.goto('/files/inbox');
    if (origen !== 'Online') await this.page.getByRole('tab', { name: new RegExp(`^${origen}`) }).click();
    await this.page.getByRole('searchbox', { name: 'Número, referencia, pasajero o agencia' }).fill(numero);
    const fila = this.page.locator('tbody tr').filter({ has: this.page.getByRole('cell', { name: numero, exact: true }) }).first();
    await expect(fila, `La reserva ${codigo} tiene que aparecer en la bandeja de reservas`).toBeVisible({ timeout: 60_000 });
    return fila;
  }

  /** Las celdas de una fila de la bandeja por el nombre de su columna (ID, Agencia, Usuario, Pax, Ref., Venta...). */
  async celdasDeLaBandeja(fila: Locator): Promise<Record<string, string>> {
    const titulos = (await this.page.locator('table').first().locator('thead th').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    const celdas = (await fila.locator('td').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    return Object.fromEntries(celdas.map((c, i) => [titulos[i] || `#${i}`, c]));
  }

  async abrirReservaDeLaBandeja(codigo: string): Promise<Locator> {
    const fila = await this.filaDeLaBandeja(codigo);
    return this.abrirDetalleDeLaBandeja(fila, codigo);
  }

  async abrirDetalleDeLaBandeja(fila: Locator, codigo: string): Promise<Locator> {
    const numero = BackofficeNuevoPage.numeroDeReserva(codigo);
    await fila.click();
    const dialogo = this.page.getByRole('dialog').filter({ hasText: numero }).first();
    await expect(dialogo, `Tiene que abrir el detalle de la reserva ${codigo}`).toBeVisible();
    await expect(dialogo.getByText(/Sin emitir/), 'La reserva recien hecha tiene que estar sin emitir').toBeVisible();
    return dialogo;
  }

  /** Los campos del detalle de la reserva por su id (`#ib-pax-name`, `#ib-ref`, `#ib-comment`...). */
  async campoDelDetalle(dialogo: Locator, id: string): Promise<string> {
    const campo = dialogo.locator(`#${id}`);
    return campo.evaluate((e: HTMLInputElement | HTMLSelectElement) =>
      (e instanceof HTMLSelectElement ? e.options[e.selectedIndex]?.text ?? '' : e.value).trim());
  }

  /** Una tabla del detalle o de la ficha, ubicada por una de sus columnas ("Documento", "Tipo de tarifa"). */
  tablaCon(raiz: Locator, columna: string): Locator {
    return raiz.getByRole('table').filter({ has: this.page.getByRole('columnheader', { name: columna, exact: true }) }).first();
  }

  // --- Ficha del file: solapa Datos y rooming ------------------------------------------

  /** Un campo de texto de la solapa Datos por su rotulo ("Nombre pax", "Referencia del cliente", "Uso interno"...). */
  async campoDeLaFicha(rotulo: string): Promise<string> {
    await this.fichaDelFile.getByRole('tab', { name: 'Datos', exact: true }).click();
    return (await this.fichaDelFile.getByRole('textbox', { name: rotulo, exact: true }).inputValue()).trim();
  }

  get rooming(): Locator {
    return this.page.getByRole('dialog', { name: 'Rooming' });
  }

  async abrirRooming() {
    await this.fichaDelFile.getByRole('contentinfo').getByRole('button', { name: 'Rooming', exact: true }).click();
    await expect(this.rooming, 'Tiene que abrir el rooming del file').toBeVisible();
    await expect(this.rooming.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
  }

  async cerrarRooming() {
    await this.rooming.getByRole('banner').getByRole('button', { name: 'Cerrar' }).click();
    await expect(this.rooming).toBeHidden();
  }

  /** Elige la sucursal y genera el file. Devuelve el id y el codigo del file ("AMV-AR-30444"). */
  async generarFile(dialogo: Locator, sucursal: string): Promise<{ fileId: string; fileCode: string }> {
    await dialogo.getByRole('combobox', { name: 'Sucursal', exact: true }).selectOption({ label: sucursal });
    await dialogo.getByRole('button', { name: 'Generar file', exact: true }).click();
    await expect(this.page, 'Generar el file tiene que abrir la ficha del file').toHaveURL(/\/files\/files\/\d+/, { timeout: 90_000 });
    const encabezado = this.fichaDelFile.getByRole('banner');
    await expect(encabezado, 'La ficha tiene que mostrar el codigo del file').toContainText(/AMV-[A-Z]{2}-\d+/);
    return {
      fileId: this.page.url().match(/\/files\/files\/(\d+)/)?.[1] ?? '',
      fileCode: (await encabezado.innerText()).match(/AMV-[A-Z]{2}-\d+/)?.[0] ?? '',
    };
  }

  /** Abre la ficha del file por su id (dialogo sobre el listado de Files). */
  async abrirFicha(fileId: string) {
    await this.page.goto(`/files/files/${fileId}`);
    await expect(this.fichaDelFile.getByRole('banner'), 'Tiene que abrir la ficha del file').toContainText(/AMV-[A-Z]{2}-\d+/, { timeout: 60_000 });
  }

  /** Estado del file (solapa Datos, combo "Estado"): "A facturar", "Facturado", "Reserva"... */
  async estadoDelFile(): Promise<string> {
    await this.fichaDelFile.getByRole('tab', { name: 'Datos', exact: true }).click();
    return this.fichaDelFile.getByRole('combobox', { name: 'Estado', exact: true })
      .evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text?.trim() ?? '');
  }

  /** Solapa "Finanzas" de la ficha: ahi vive el panel "Comprobantes y saldos". */
  async verFinanzas() {
    await this.fichaDelFile.getByRole('tab', { name: 'Finanzas', exact: true }).click();
    await expect(this.ladoCliente(), 'La solapa Finanzas tiene que mostrar el panel "Comprobantes y saldos"').toBeVisible({ timeout: 60_000 });
    await expect(this.ladoCliente().locator('.fa-figure').first()).toBeVisible({ timeout: 60_000 });
  }

  /** Lado "Cliente" del panel "Comprobantes y saldos" de la ficha. */
  ladoCliente(): Locator {
    return this.fichaDelFile.locator('section.fa-side[aria-label="Cliente"]');
  }

  /** Las cifras de un lado: "Venta del file", "Facturado", "Cobrado", "Falta cobrar". */
  async cifras(lado: Locator): Promise<Record<string, string>> {
    await expect(lado, 'La ficha tiene que mostrar el panel "Comprobantes y saldos"').toBeVisible({ timeout: 60_000 });
    const out: Record<string, string> = {};
    for (const cifra of await lado.locator('.fa-figure').all()) {
      out[(await cifra.locator('dt').innerText()).trim()] = (await cifra.locator('dd .fa-big').innerText()).trim();
    }
    return out;
  }

  /** Lado "Proveedores" del panel "Comprobantes y saldos". */
  ladoProveedores(): Locator {
    return this.fichaDelFile.locator('section.fa-side[aria-label="Proveedores"]');
  }

  /** Una lista del panel por su titulo: "Facturas", "Órdenes de cobro", "Facturas de proveedor", "Órdenes de pago". */
  lista(lado: Locator, titulo: RegExp): Locator {
    return lado.locator('.fa-list').filter({ has: this.page.locator('h4', { hasText: titulo }) }).first();
  }

  /** Lista "Facturas" del lado Cliente. */
  listaDeFacturas(): Locator {
    return this.lista(this.ladoCliente(), /^Facturas$/);
  }

  /** El texto completo de una cifra (importe y la marca "Al día" si la tiene). */
  async textoDeCifra(lado: Locator, nombre: string): Promise<string> {
    const cifra = lado.locator('.fa-figure').filter({ has: this.page.locator('dt', { hasText: new RegExp(`^${nombre}$`) }) }).first();
    return (await cifra.locator('dd').innerText()).replace(/\s+/g, ' ').trim();
  }

  async clienteDelFile(): Promise<string> {
    await this.fichaDelFile.getByRole('tab', { name: 'Datos', exact: true }).click();
    return (await this.fichaDelFile.getByRole('combobox', { name: 'Cliente', exact: true }).inputValue()).trim();
  }

  /**
   * Fila del servicio en "Destinos y servicios": el costo va en la moneda del proveedor
   * (ARS para GRUPO SUMMA) y la venta en la del file. Son los dos primeros importes
   * con moneda de la fila; despues viene el porcentaje de utilidad.
   */
  async importesDelItem(servicio: string): Promise<{ costo: ImporteNuevo; venta: ImporteNuevo; texto: string }> {
    await this.fichaDelFile.getByRole('tab', { name: /^Destinos y servicios/ }).click();
    const fila = this.fichaDelFile.locator('tr, [role="row"]').filter({ hasText: servicio }).first();
    await expect(fila, `El file tiene que tener el servicio ${servicio}`).toBeVisible();
    const texto = (await fila.innerText()).replace(/\s+/g, ' ');
    // Solo codigos de moneda: el nombre corto del servicio ("1 TIG/DEL") tambien es numero + tres letras.
    const importes = [...texto.matchAll(/(\d[\d.]*(?:,\d+)?)\s*(ARS|USD|EUR|BRL|CLP|COP|PEN|MXN|UYU)\b/g)];
    return {
      costo: leerImporte(importes[0]?.[1] ?? '', importes[0]?.[2]),
      venta: leerImporte(importes[1]?.[1] ?? '', importes[1]?.[2]),
      texto,
    };
  }
}
