import { Page, expect } from '@playwright/test';
import { InicioPage } from '../pages/inicio.page';
import { ServicioPage } from '../pages/servicio.page';
import { CarritoPage } from '../pages/carrito.page';
import { PortalNuevoPage } from '../pages/climbs/portal.page';
import { TarifaDeServicio } from '../pages/climbs/servicio.page';
import { adjuntarTexto, conResaltado, esperarFinDeCarga, importeANumero } from './pasos';
import { precioConIdioma, tarifaVigente, mismoIdioma } from './markups';

/**
 * Recargo por idioma con el markup que corresponda (agencia, mercado, sucursal), de la ficha al
 * carrito, en el portal viejo y en el nuevo.
 *
 * US 4739: "el valor final tiene que calcularse aplicando el markup de la agencia sobre costo +
 * recargo en conjunto, nunca sobre el costo solo". Precio por persona de la ficha =
 * techo((costo + recargo) / cotizacion / divisor), y el carrito cobra eso por los pasajeros.
 * Las comparaciones son soft: el test sigue y restaura lo que haya tocado. Al final vacia el carrito.
 */
export type ServicioConRecargo = {
  pais: string; ciudad: string; termino: string; nombre: string; modalidad: string; fecha: Date;
  /** Tipo del buscador: etiqueta (portal nuevo) y, en el viejo, el value del combo (la etiqueta sale de un recurso traducible). */
  tipo: string; tipoValor: string;
  /** Las tarifas del servicio leidas en el BackOffice nuevo (costosDelServicio). */
  tarifas: TarifaDeServicio[];
  /** Cotizacion de cada moneda contra el dolar (por defecto la del pais: ARS 1000). */
  cotizaciones?: Record<string, number>;
};

const IDIOMA_CON_RECARGO = /^(English|Ingl[eé]s)$/i;
const SALTO = String.fromCharCode(10);

const valor = (texto: string, que: string): number => {
  const v = importeANumero(texto.replace(/[A-Z]{3}/, '').trim());
  expect(v, `${que}: no se pudo leer un importe de "${texto}"`).not.toBeNull();
  return v as number;
};

function esperadoPorPersona(s: ServicioConRecargo, idioma: string, divisor: number, pax: number) {
  const tarifa = tarifaVigente(s.tarifas, s.modalidad, s.fecha, pax);
  expect(tarifa, `${s.nombre} tiene que tener una tarifa ${s.modalidad} vigente el ${s.fecha.toLocaleDateString('es-AR')}`).toBeDefined();
  const recargo = tarifa!.recargos.find((r) => mismoIdioma(r.idioma, idioma));
  expect(recargo, `La tarifa ${s.modalidad} de ${s.nombre} tiene que tener recargo para ${idioma}`).toBeDefined();
  return { tarifa: tarifa!, recargo: recargo!, esperado: precioConIdioma(tarifa!, idioma, divisor, pax, s.cotizaciones)!, cotizaciones: s.cotizaciones };
}

async function exigir(page: Page, fila: ReturnType<Page['locator']>, titulo: string, idioma: string, divisor: number, pax: number,
  datos: ReturnType<typeof esperadoPorPersona>, precioFicha: number, totalFicha: string, lineaTxt: string): Promise<number> {
  const linea = valor(lineaTxt, 'Linea del carrito');
  await adjuntarTexto(`${titulo}: ficha y carrito en ${idioma}`, [
    `Tarifa del BackOffice: ${datos.tarifa.vigencia} | ${datos.tarifa.modalidad} | ${datos.tarifa.moneda} ${datos.tarifa.costo} | recargo ${JSON.stringify(datos.recargo)}`,
    `Markup: ${divisor}${datos.cotizaciones ? ` | cotizaciones ${JSON.stringify(datos.cotizaciones)}` : ''}`,
    `Esperado por persona: techo((costo + recargo) / cotizacion / ${divisor}) = ${datos.esperado}`,
    `Ficha: por persona ${precioFicha}, total ${totalFicha} (${pax} pax)`,
    `Carrito: ${lineaTxt}`,
  ].join(SALTO));
  await conResaltado(page, fila, `${titulo}: linea del carrito en ${idioma}`, () => {
    expect.soft(precioFicha, `${titulo}: en ${idioma} la ficha tiene que cobrar por persona techo((costo + recargo) / cotizacion / ${divisor}) (US 4739)`).toBe(datos.esperado);
    expect.soft(linea, `${titulo}: el carrito tiene que cobrar techo((costo + recargo) / cotizacion / ${divisor}) x ${pax} pasajeros (US 4739)`).toBe(datos.esperado * pax);
  });
  return linea;
}

/** Portal viejo (ServiceDetail.aspx y ShoppingCartPage.aspx). */
/** conservarCarrito: no vacia el carrito ni antes ni despues (para sumar el item a un carrito ya armado). */
export async function recargoEnFichaYCarritoViejo(page: Page, s: ServicioConRecargo, divisor: number, titulo: string, conservarCarrito = false): Promise<number> {
  const inicio = new InicioPage(page);
  const servicio = new ServicioPage(page);
  const carrito = new CarritoPage(page);
  const bloque = () => servicio.bloquesDeTarifa()
    .filter({ has: page.locator('.sd-rate__name', { hasText: new RegExp(`^\\s*${s.modalidad}\\s*$`, 'i') }) }).first();
  try {
    await inicio.abrir();
    if (!conservarCarrito) await carrito.vaciar();
    await inicio.abrir();
    const panel = await inicio.abrirSolapa('servicios');
    await page.locator(servicio.comboPais).selectOption({ label: s.pais });
    await esperarFinDeCarga(page);
    await page.locator(servicio.comboCiudad).selectOption({ label: s.ciudad });
    await page.locator(servicio.comboTipo).selectOption({ value: s.tipoValor });
    await servicio.elegirFecha(servicio.campoFecha, servicio.hiddenFecha, s.fecha);
    await panel.locator(servicio.btnBuscar).first().click();
    await page.waitForURL(/serviceall/i, { timeout: 90_000 });
    await esperarFinDeCarga(page);
    // Con el nombre exacto: las copias AUTO-QA de Tigre y Delta heredaron su nombre y el termino solo elige la primera.
    await servicio.buscarPorNombre(s.termino, s.nombre).catch(() => servicio.buscarPorNombre(s.termino));
    await servicio.abrirFicha(s.nombre.slice(0, 24));

    const opciones = await page.locator('#sdLangSelect option').evaluateAll(
      (os) => os.map((o) => ({ valor: (o as HTMLOptionElement).value, texto: (o.textContent ?? '').trim() })));
    await adjuntarTexto(`${titulo}: idiomas de la ficha`, opciones.map((o) => `${o.valor}=${o.texto}`).join(' | '));
    const ingles = opciones.find((o) => IDIOMA_CON_RECARGO.test(o.texto));
    expect(ingles, `La ficha tiene que ofrecer el idioma English. Ofrece: ${opciones.map((o) => o.texto).join(', ')}`).toBeDefined();
    await page.locator('#sdLangSelect').selectOption(ingles!.valor);
    await esperarFinDeCarga(page);

    const minimo = Number((await bloque().innerText()).match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
    const pax = Math.max(2, minimo);
    await bloque().locator(servicio.comboPax).selectOption(String(pax));
    await esperarFinDeCarga(page);
    const totalFicha = await servicio.esperarTotal();
    const precioFicha = valor(await bloque().locator('.sd-rate__price-val').first().innerText(), 'Precio por persona de la ficha');
    const datos = esperadoPorPersona(s, ingles!.texto, divisor, pax);

    await servicio.agregarAlCarrito();
    await carrito.irAlCarrito();
    const fila = page.locator(carrito.filas).filter({ hasText: s.termino });
    await expect(fila, `El carrito tiene que traer ${s.nombre}`).toHaveCount(1);
    const lineaTxt = (await fila.locator('.ct-row__total').innerText()).trim();
    return await exigir(page, fila, titulo, ingles!.texto, divisor, pax, datos, precioFicha, totalFicha, lineaTxt);
  } finally {
    if (!conservarCarrito) {
      await inicio.abrir().catch(() => {});
      await carrito.vaciar().catch(() => {});
    }
  }
}

/** Portal nuevo (ClimbsApp, /site/services). */
export async function recargoEnFichaYCarritoNuevo(page: Page, s: ServicioConRecargo, divisor: number, titulo: string, conservarCarrito = false): Promise<number> {
  const web = new PortalNuevoPage(page);
  try {
    if (!conservarCarrito) await web.vaciarCarrito();
    const enBuenosAires = s.pais === 'Argentina' && s.ciudad === 'Buenos Aires';
    await web.buscarServicios(s.fecha, s.tipo, enBuenosAires ? undefined : { pais: s.pais, ciudad: s.ciudad });
    await web.elegirServicio(s.termino, s.nombre);
    const idioma = page.locator('main').getByRole('combobox', { name: 'Idioma del servicio' });
    await expect(idioma, 'La ficha tiene que mostrar el selector "Idioma del servicio"').toBeVisible();
    const opciones = (await idioma.locator('option').allInnerTexts()).map((t) => t.trim());
    await adjuntarTexto(`${titulo}: idiomas de la ficha`, opciones.join(' | '));
    const ingles = opciones.find((o) => IDIOMA_CON_RECARGO.test(o));
    expect(ingles, `La ficha tiene que ofrecer el idioma English. Ofrece: ${opciones.join(', ')}`).toBeDefined();
    await idioma.selectOption({ label: ingles! });

    const pax = Math.max(2, await web.minimoDePasajeros(s.modalidad));
    await web.elegirPasajeros(s.modalidad, pax);
    // La ficha recalcula por API: se lee el total cuando deja de cambiar.
    let previo = '';
    let totalFicha = await web.totalDeLaFicha();
    for (let i = 0; i < 10 && totalFicha !== previo; i++) {
      await page.waitForTimeout(1_000);
      previo = totalFicha;
      totalFicha = await web.totalDeLaFicha();
    }
    const precioFicha = valor(await web.precioDeLaModalidad(s.modalidad), 'Precio por persona de la ficha');
    const datos = esperadoPorPersona(s, ingles!, divisor, pax);

    await page.getByRole('button', { name: 'Agregar al carrito' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Se agregó \d+ ítem al carrito/ }).last(), 'Agregar al carrito tiene que confirmar').toBeVisible();
    await web.irAlCarrito();
    const item = page.locator('main article').filter({ hasText: s.termino });
    await expect(item, `El carrito tiene que traer ${s.nombre}`).toHaveCount(1);
    const lineaTxt = (await item.innerText()).replace(/\s+/g, ' ').match(/[A-Z]{3}\s*[\d.,]+/g)?.at(-1) ?? '';
    return await exigir(page, item, titulo, ingles!, divisor, pax, datos, precioFicha, totalFicha, lineaTxt);
  } finally {
    if (!conservarCarrito) await web.vaciarCarrito().catch(() => {});
  }
}
