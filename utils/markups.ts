import { expect, Browser, BrowserContext, Page } from '@playwright/test';
import { TarifarioPage } from '../pages/tarifario.page';
import { LoginPage } from '../pages/login.page';
import { numeroDelPortal, adjuntarTexto } from './pasos';
import { ServicioNuevoPage, TarifaDeServicio } from '../pages/climbs/servicio.page';
import { HabitacionNuevaPage, Corte } from '../pages/climbs/habitacion.page';

/**
 * Lo comun a los tests que miran precios con el usuario propio de markups
 * (`autoqa.markups`, agencia 6334, mercado 37): el login en un contexto aparte y
 * la lectura del tarifario de un item.
 */

/** `pais` y `destino` por defecto: Argentina / Buenos Aires, donde estan los items de la suite. */
export type ItemDelTarifario = { tab: string; container: string; nombre: string; terminoBusqueda: string; pais?: string; destino?: string };

/**
 * Abre un contexto propio, sin la sesion de pablo1, y entra con el usuario de
 * markups. Los dos usuarios tienen que estar logueados a la vez.
 */
/**
 * Las credenciales del usuario de markups. Con AMV_JUEGO_DATOS=B (juego B de datos, ver
 * tests/climbs/webadmin/datos.ts) son las de su copia: AMV_MARKUP_USER_B / AMV_MARKUP_PASS_B.
 */
export function credencialesDeMarkups(): { usuario: string; password: string } {
  const b = process.env.AMV_JUEGO_DATOS === 'B' ? '_B' : '';
  const usuario = process.env[`AMV_MARKUP_USER${b}`];
  const password = process.env[`AMV_MARKUP_PASS${b}`];
  expect(usuario, `Falta AMV_MARKUP_USER${b} en el entorno`).toBeTruthy();
  expect(password, `Falta AMV_MARKUP_PASS${b} en el entorno`).toBeTruthy();
  return { usuario: usuario!, password: password! };
}

export async function abrirSesionDeMarkups(browser: Browser, baseURL?: string): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const { usuario, password } = credencialesDeMarkups();

  const contexto = await browser.newContext({
    baseURL,
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    storageState: { cookies: [], origins: [] },
  });
  const pagina = await contexto.newPage();
  const login = new LoginPage(pagina);
  await login.ingresar(usuario!, password!);
  await login.validarSesionIniciada();
  await login.cerrarAvisosDelPortal();
  return { contexto, pagina };
}

/** Recorre el tarifario hasta el item y devuelve las filas de su tabla de tarifas. */
export async function tarifasDe(page: Page, item: ItemDelTarifario): Promise<string[][]> {
  const t = new TarifarioPage(page);
  await page.goto('/online/');
  await t.irDesdeElMenu();
  await t.seleccionarPais(item.pais ?? 'Argentina');
  await t.seleccionarCiudad(item.destino ?? 'Buenos Aires');
  await t.buscar();
  await t.abrirPestania(item.tab, item.container);
  await t.buscarPorNombre(item.terminoBusqueda, item.nombre);
  await t.verTarifario(item.container);
  const filas = await t.leerTablaTarifas(item.container);
  await t.cerrarExplorador();
  return filas;
}

/**
 * Tabla -> precio por celda. Los hoteles traen un precio por columna (SGL, DBL,
 * TPL) y los servicios uno por fila: se toma cada celda con importe y se la
 * identifica por las celdas sin importe de su fila (fechas, tipo, pax) mas su
 * posicion, asi se empareja la misma tarifa entre dos lecturas.
 */
export function porTarifa(filas: string[][]): Map<string, number> {
  const conImporte = (c: string) => /(USD|ARS|\$)\s*[0-9]/.test(c);
  const mapa = new Map<string, number>();
  for (const f of filas) {
    const fila = f.filter((c) => !conImporte(c)).join(' | ');
    f.forEach((celda, i) => {
      if (!conImporte(celda)) return;
      // Solo el primer importe: pablo1 ve al lado la leyenda "Tarifa extendida con incremento (10%)"
      // y, leida entera, "USD 256 ... (10%)" daba 25610.
      const precio = primerImporte(celda);
      if (precio !== null) mapa.set(`${fila} | columna ${i + 1}`, precio);
    });
  }
  return mapa;
}

/**
 * Compara dos lecturas del mismo tarifario hechas con divisores distintos.
 *
 * El precio es techo(x / divisor). De un precio p leido con `divisorAntes`, x esta
 * en ((p-1) * divisorAntes, p * divisorAntes]; con `divisorDespues` el precio tiene
 * que caer en [techo((p-1) * antes / despues), techo(p * antes / despues)], con 1
 * de margen por el redondeo. Con los dos divisores iguales exige el mismo precio.
 *
 * Devuelve una linea por tarifa para adjuntar y las claves que no cumplen.
 */
export function compararPrecios(
  antes: Map<string, number>, despues: Map<string, number>, divisorAntes: number, divisorDespues: number,
): { lineas: string[]; fuera: string[] } {
  const lineas: string[] = [];
  const fuera: string[] = [];
  const iguales = divisorAntes === divisorDespues;
  for (const [clave, p] of antes) {
    const q = despues.get(clave);
    const minimo = iguales ? p : Math.ceil(((p - 1) * divisorAntes) / divisorDespues) - 1;
    const maximo = iguales ? p : Math.ceil((p * divisorAntes) / divisorDespues) + 1;
    const ok = q !== undefined && q >= minimo && q <= maximo;
    lineas.push(`${ok ? 'OK  ' : 'MAL '} ${clave}  ->  antes ${p}  /  esperado ${minimo === maximo ? minimo : `${minimo}..${maximo}`}  /  obtenido ${q ?? 'sin fila'}`);
    if (!ok) fuera.push(clave);
  }
  for (const clave of despues.keys()) {
    if (!antes.has(clave)) fuera.push(`${clave} (no estaba antes)`);
  }
  return { lineas, fuera };
}

/** El primer importe de una celda ("USD 1.000 TARIFA EXTENDIDA ... (10%)" -> 1000), o null. */
export function primerImporte(celda: string): number | null {
  const m = (celda || '').match(/(?:[A-Z]{3}|\$)\s*([0-9][\d.,]*)/);
  return m ? numeroDelPortal(m[1]) : null;
}

/**
 * Cotizacion del pais de las agencias de la suite (Argentina, pais 10): el portal muestra todo en
 * dolares y lo que tiene costo en pesos se divide por esta cotizacion. Es la "del pais" del test
 * de tipo de cambio; si cambia, cambian los precios en pesos y estos tests tienen que fallar.
 */
export const COTIZACION: Record<string, number> = { USD: 1, ARS: 1000 };

/** Precio del portal: techo(costo / cotizacion / divisor). toFixed evita que 94,6000000001 suba de mas. */
export function precioEsperado(costo: number, moneda: string, divisor: number, cotizaciones: Record<string, number> = COTIZACION): number | null {
  const cotizacion = cotizaciones[moneda];
  if (!cotizacion) return null;
  return Math.ceil(Number((costo / cotizacion / divisor).toFixed(6)));
}

/**
 * Lee los costos en el Backoffice nuevo con la sesion guardada de la app nueva, en un contexto
 * aparte: los tests del portal viejo no la tienen en su `page`.
 */
/**
 * Precio por persona con el recargo de un idioma (US 4739): "el valor final tiene que calcularse
 * aplicando el markup de la agencia sobre costo + recargo en conjunto, nunca sobre el costo solo".
 * El recargo se lee de la tarifa en el Backoffice nuevo: porcentaje sobre el costo, monto por
 * pasajero, o monto por grupo repartido entre los pasajeros. Sin recargo para ese idioma, el precio base.
 */
/** El BO nuevo nombra los idiomas como estan en la base ("English"); el portal, en espanol (US 5086). */
const IDIOMA_EN_ESPANOL: Record<string, string> = { english: 'inglés', portuguese: 'portugués', portugues: 'portugués', french: 'francés', italian: 'italiano', german: 'alemán', spanish: 'español', chinese: 'chino' };
export const mismoIdioma = (a: string, b: string): boolean => {
  const n = (x: string) => { const t = x.trim().toLowerCase(); return IDIOMA_EN_ESPANOL[t] ?? t; };
  return n(a) === n(b);
};

export function precioConIdioma(tarifa: TarifaDeServicio, idioma: string | null, divisor: number, pax: number, cotizaciones: Record<string, number> = COTIZACION): number | null {
  if (tarifa.costo === null) return null;
  const r = idioma ? tarifa.recargos.find((x) => mismoIdioma(x.idioma, idioma)) : undefined;
  const costo = !r ? tarifa.costo
    : r.tipo === 'porcentaje' ? tarifa.costo * (1 + r.valor / 100)
    : r.tipo === 'porPasajero' ? tarifa.costo + r.valor
    : tarifa.costo + r.valor / pax;
  return precioEsperado(costo, tarifa.moneda, divisor, cotizaciones);
}

/**
 * La tarifa de la modalidad vigente en la fecha. Si la modalidad tiene varias (bandas de pasajeros,
 * como Privado), la de la banda que incluye `pax`; con una sola (Regular), esa.
 */
export function tarifaVigente(costos: TarifaDeServicio[], modalidad: string, fecha: Date, pax?: number): TarifaDeServicio | undefined {
  const dia = (s: string) => { const [d, m, a] = s.split('/').map(Number); return new Date(a, m - 1, d).getTime(); };
  const vigentes = costos.filter((t) => {
    if (t.modalidad?.toLowerCase() !== modalidad.toLowerCase() || t.costo === null) return false;
    const [desde, hasta] = t.vigencia.split(' - ');
    return dia(desde) <= fecha.getTime() && fecha.getTime() <= dia(hasta);
  });
  if (vigentes.length <= 1 || pax === undefined) return vigentes[0];
  return vigentes.find((t) => { const [a, b] = (t.pax || '').split(/\s*a\s*/).map(Number); return pax >= a && pax <= (b || a); });
}

export async function conBackofficeNuevo<T>(browser: Browser, fn: (page: Page) => Promise<T>): Promise<T> {
  const contexto = await browser.newContext({
    baseURL: process.env.CLIMBS_URL ?? 'https://climbs-qa.amv.travel', locale: 'es-AR',
    viewport: { width: 1920, height: 1080 }, storageState: 'playwright/.auth/app-nueva.json',
  });
  try {
    return await fn(await contexto.newPage());
  } finally {
    await contexto.close();
  }
}

export async function costosDelServicio(page: Page, id: number): Promise<TarifaDeServicio[]> {
  const s = new ServicioNuevoPage(page);
  await s.abrir(id);
  return (await s.tarifas()).filter((t) => t.costo !== null);
}

export async function cortesDeLaHabitacion(page: Page, id: number): Promise<Corte[]> {
  const h = new HabitacionNuevaPage(page);
  await h.abrir(id);
  return h.tarifario();
}

/**
 * Habitaciones de los circuitos de la suite, en el orden del itinerario, con las noches que fija el
 * paquete (Oferta 5060: Buenos Aires 3 noches, Ushuaia 2). El nombre es el que muestra el resumen.
 */
export const HABITACIONES_DEL_CIRCUITO = [
  { nombre: 'King Deluxe - Edificio Posadas', habitacion: 9193, noches: 3 },
  { nombre: 'Standard (Solo MAT)', habitacion: 12785, noches: 2 },
];

/**
 * Importe exacto de cada hotel del resumen del itinerario (viejo y nuevo): una doble para `pax`,
 * techo(suma de los cortes DBL por persona de cada noche x pax / markup de hoteles de la agencia),
 * con los cortes leidos en la ficha de la habitacion del Backoffice nuevo. Las noches se encadenan
 * desde la fecha de inicio. `lineas` es el resumen tal como lo leen los dos portales: el nombre de
 * la habitacion y, en la linea siguiente, su importe. Devuelve las lineas OK / MAL.
 */
export async function exigirHotelesDelCircuito(bo: Page, lineas: string[], inicio: Date, pax: number, divisor: number): Promise<string[]> {
  const dia = (t: string) => { const [d, m, a] = t.split('/').map(Number); return new Date(a, m - 1, d).getTime(); };
  const salida: string[] = [];
  const entrada = new Date(inicio);
  for (const h of HABITACIONES_DEL_CIRCUITO) {
    const i = lineas.findIndex((l) => l.startsWith(h.nombre));
    const enPortal = i >= 0 ? Number((lineas[i + 1] ?? '').replace(/[^\d]/g, '')) : null;
    const cortes = await cortesDeLaHabitacion(bo, h.habitacion);
    const noches: string[] = [];
    let suma = 0;
    let completo = true;
    for (let n = 0; n < h.noches; n++) {
      const noche = new Date(entrada);
      noche.setDate(noche.getDate() + n);
      const corte = cortes.find((c) => dia(c.desde) <= noche.getTime() && noche.getTime() <= dia(c.hasta));
      if (!corte?.dbl) { completo = false; noches.push(`${formatoDia(noche)} sin corte DBL`); continue; }
      suma += corte.dbl;
      noches.push(`${formatoDia(noche)} ${corte.dbl}`);
    }
    entrada.setDate(entrada.getDate() + h.noches);
    const esperado = completo ? precioEsperado(suma * pax, 'USD', divisor) : null;
    const ok = esperado !== null && enPortal === esperado;
    salida.push(`${ok ? 'OK ' : 'MAL'} ${h.nombre} (${h.habitacion}) | ${h.noches} noches, DBL por persona: ${noches.join(', ')} -> ${suma} x ${pax} pax / ${divisor} = ${esperado} / portal ${i >= 0 ? lineas[i + 1] : 'sin la habitacion en el resumen'}`);
  }
  return salida;
}
/** Una fila de servicio del itinerario de un circuito, como la ve la persona (viejo y nuevo). */
export type FilaDeServicio = { nombre: string; fecha: string; pax: string; modalidad: string; importe: string };

/** Servicios de los circuitos de la suite: el nombre del itinerario y su ID. */
export const SERVICIOS_DEL_CIRCUITO: [RegExp, number][] = [[/Tigre y Delta/i, 5], [/Angelitos/i, 163], [/Aeropuerto Internacional/i, 1223]];

/**
 * Importe exacto de cada servicio del itinerario (viejo y nuevo), con la modalidad, los pax y la fecha
 * de su fila, contra su costo y su Markup en la ficha del Backoffice nuevo:
 * techo(costo / cotizacion / markup del servicio / markup de servicios de la agencia) por pasajero,
 * por los pasajeros. Las bandas de pasajeros (tambien las de Privado) son precio por persona.
 * Devuelve las lineas OK / MAL.
 */
export async function exigirServiciosDelCircuito(bo: Page, filas: FilaDeServicio[], divisor: number): Promise<string[]> {
  const lineas: string[] = [];
  const idDe = (f: FilaDeServicio) => SERVICIOS_DEL_CIRCUITO.find(([re]) => re.test(f.nombre))?.[1];
  const ids = [...new Set(filas.map(idDe).filter((x): x is number => !!x))];
  const ficha = new ServicioNuevoPage(bo);
  const costos = new Map<number, TarifaDeServicio[]>();
  const markups = new Map<number, number>();
  for (const id of ids) {
    await ficha.abrir(id);
    markups.set(id, await ficha.markup());
    costos.set(id, (await ficha.tarifas()).filter((t) => t.costo !== null));
  }
  for (const f of filas) {
    const id = idDe(f);
    const pax = Number(f.pax);
    const [d, mm, a] = f.fecha.split('/').map(Number);
    const tarifa = id ? tarifaVigente(costos.get(id) ?? [], f.modalidad, new Date(a, mm - 1, d), pax) : undefined;
    const markupDelServicio = id ? markups.get(id) ?? 1 : 1;
    const unitario = tarifa ? precioEsperado(tarifa.costo!, tarifa.moneda, divisor * markupDelServicio) : null;
    const esperado = unitario === null ? null : unitario * pax;
    const enPortal = Number(f.importe.replace(/[^\d]/g, ''));
    const ok = esperado !== null && esperado === enPortal;
    lineas.push(`${ok ? 'OK ' : 'MAL'} ${f.nombre} | ${f.fecha} | ${f.modalidad} | ${pax} pax -> ${tarifa ? `${tarifa.moneda} ${tarifa.costo} (banda ${tarifa.pax || '-'}) / markup del servicio ${markupDelServicio} / markup de servicios de la agencia ${divisor} = ${unitario} x ${pax} = ${esperado}` : 'sin tarifa en el Backoffice'} / portal ${f.importe}`);
  }
  if (!filas.length) lineas.push('MAL el itinerario no muestra servicios');
  return lineas;
}

const formatoDia = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/** Una tarifa por persona de una cabina en una salida, como la muestra la solapa Tarifas del crucero. */
export type TarifaDeCrucero = { cabina: string; tipo: string; fecha: string; costo: number };

/**
 * Las tarifas del crucero en el Backoffice nuevo (/cruises/cruises/{id}, solapa Tarifas, vista Listado):
 * por cada cabina y cada tipo de tarifa (SGL, DBL, TPL, Junior), el precio de cada salida, que el chip
 * trae en su titulo ("01/11/2026 · DBL: USD 2.562,00"). Solo lectura: no elige salidas ni guarda.
 */
export async function tarifasDelCrucero(bo: Page, id: number): Promise<TarifaDeCrucero[]> {
  await bo.goto(`/cruises/cruises/${id}`);
  await bo.getByRole('tab', { name: /^Tarifas/ }).click();
  const nav = bo.locator('.cabin-nav');
  await expect(nav, 'La solapa Tarifas tiene que listar las cabinas del crucero').toBeVisible({ timeout: 60_000 });
  await bo.getByRole('tab', { name: /Listado/ }).click();
  const salida: TarifaDeCrucero[] = [];
  const cabinas = nav.locator('button');
  const n = await cabinas.count();
  for (let i = 0; i < n; i++) {
    await cabinas.nth(i).click();
    const cabina = (await bo.locator('.cr-rates-head b').innerText()).trim();
    const barra = bo.locator('.cr-rates-bar').first();
    for (const tipo of ['SGL', 'DBL', 'TPL', 'Junior']) {
      const boton = barra.getByText(tipo, { exact: true });
      if (!(await boton.count())) continue;
      await boton.click();
      await expect(bo.locator('.cr-rates-head b')).toHaveText(cabina);
      // El titulo de cada chip trae el tipo elegido: se espera a que lo muestre antes de leer.
      await expect(bo.locator('.cr-rates-list button.cr-rate-day').first()).toHaveAttribute('title', new RegExp(` · ${tipo}: `));
      const titulos = await bo.locator('.cr-rates-list button.cr-rate-day').evaluateAll((bs) => bs.map((x) => x.getAttribute('title') ?? ''));
      for (const t of titulos) {
        const m = t.match(/^(\d{2}\/\d{2}\/\d{4}) · [^:]+: [A-Z]{3} ([\d.,]+)/);
        const costo = m ? Number(m[2].replace(/\./g, '').replace(',', '.')) : 0;
        // Una tarifa en 0 es un tipo que la cabina no vende en esa salida: el portal lo muestra como "–".
        if (m && costo > 0) salida.push({ cabina, tipo, fecha: m[1], costo });
      }
    }
  }
  return salida;
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "dom 3 ene 2027", "3 ene. 2027" o "03/01/2027" -> "03/01/2027"; '' si la celda no trae fecha. */
export function fechaDeCelda(celda: string): string {
  const dd = (x: string | number) => String(x).padStart(2, '0');
  const n = celda.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (n) return `${dd(n[1])}/${dd(n[2])}/${n[3]}`;
  const m = sinTildes(celda.toLowerCase()).match(/(\d{1,2})\s+(?:de\s+)?([a-z]{3})[a-z]*\.?\s+(?:de\s+)?(\d{4})/);
  if (!m) return '';
  const mes = MESES_CORTOS.indexOf(m[2]) + 1;
  return mes ? `${dd(m[1])}/${dd(mes)}/${m[3]}` : '';
}

/**
 * Precio exacto de cada salida de una cabina en el tarifario (viejo y nuevo): por cada columna
 * (SGL, DBL, TPL y la de menores), techo(tarifa por persona del Backoffice / divisor). `filas` es la
 * tabla del portal con el encabezado primero: [salida, SGL, DBL, ...]. Ademas, cada salida futura
 * con tarifa en el Backoffice tiene que estar en el portal. El impuesto de la celda no se compara.
 */
export function exigirPreciosDelCrucero(cabina: string, filas: string[][], costos: TarifaDeCrucero[], divisor: number, hoy = new Date()): { lineas: string[]; fuera: string[] } {
  const lineas: string[] = [];
  const fuera: string[] = [];
  const delaCabina = costos.filter((c) => c.cabina.toLowerCase() === cabina.toLowerCase());
  if (!delaCabina.length) fuera.push(`la cabina ${cabina} no tiene tarifas en el Backoffice`);
  const tipoDe = (rotulo: string) => (/^(SGL|DBL|TPL)$/i.test(rotulo) ? rotulo.toUpperCase() : 'Junior');
  const encabezado = filas[0] ?? [];
  const vistas = new Set<string>();
  for (const f of filas.slice(1)) {
    const fecha = fechaDeCelda(f[0] ?? '');
    if (!fecha) continue;
    for (let i = 1; i < f.length; i++) {
      const precio = primerImporte(f[i]);
      if (precio === null) continue;
      const tipo = tipoDe(encabezado[i] ?? '');
      const costo = delaCabina.find((c) => c.fecha === fecha && c.tipo === tipo);
      const esperado = costo ? precioEsperado(costo.costo, 'USD', divisor) : null;
      const ok = esperado !== null && esperado === precio;
      vistas.add(`${fecha}|${tipo}`);
      if (!ok) fuera.push(`${cabina} ${fecha} ${tipo}: portal ${precio}, esperado ${esperado ?? 'sin tarifa en el Backoffice'}`);
      lineas.push(`${ok ? 'OK ' : 'MAL'} ${cabina} | ${fecha} | ${tipo} -> ${costo ? `USD ${costo.costo}` : 'sin tarifa'} / ${divisor} = ${esperado} / portal ${precio}`);
    }
  }
  const dia = (t: string) => { const [d, m, a] = t.split('/').map(Number); return new Date(a, m - 1, d).getTime(); };
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  for (const c of delaCabina) {
    if (dia(c.fecha) < desde || vistas.has(`${c.fecha}|${c.tipo}`)) continue;
    fuera.push(`falta en el portal: ${cabina} ${c.fecha} ${c.tipo} (USD ${c.costo})`);
  }
  return { lineas, fuera };
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** "Menores en regular" y "Menores regular" son la misma modalidad. */
const modalidad = (s: string) => sinTildes(s).toLowerCase().replace(/\ben\b/g, ' ').replace(/\s+/g, ' ').trim();
/** "4 - 6" (portal) y "4 a 6" (Backoffice) son el mismo rango; "Minimo 2 pasajeros" no es un rango. */
const pax = (s: string) => (/^\s*\d+(\s*(-|a)\s*\d+)?\s*$/.test(s ?? '') ? s.replace(/\s*(-|a)\s*/, '-').trim() : '');

/**
 * Precio absoluto de cada tarifa de un servicio: techo(costo / cotizacion / divisor), con el costo
 * leido en el Backoffice. Se agrupa por modalidad y pasajeros (y no por vigencia, porque el
 * tarifario recorta las fechas a su ventana); en cada grupo los precios del portal tienen que ser
 * exactamente los que salen de los costos, y cada grupo del Backoffice tiene que estar en el portal.
 *
 * `filas` es la tabla del portal, con o sin encabezado: [fecha, modalidad, (pax), precio].
 */
export function exigirPreciosDeServicio(filas: string[][], costos: TarifaDeServicio[], divisor: number, cotizaciones: Record<string, number> = COTIZACION): { lineas: string[]; fuera: string[] } {
  const lineas: string[] = [];
  const fuera: string[] = [];
  const conPrecio = filas.filter((f) => primerImporte(f.at(-1) ?? '') !== null);
  const vistos = new Set<string>();
  for (const f of conPrecio) {
    const m = modalidad(f[1] ?? '');
    const p = f.length > 3 ? pax(f[2]) : '';
    const delGrupo = costos.filter((c) => modalidad(c.modalidad) === m && (p === '' || pax(c.pax) === p));
    const esperados = [...new Set(delGrupo.map((c) => precioEsperado(c.costo!, c.moneda, divisor, cotizaciones)))];
    const precio = primerImporte(f.at(-1) ?? '');
    const ok = esperados.length > 0 && esperados.includes(precio);
    delGrupo.forEach((c) => vistos.add(`${c.modalidad}|${c.pax}|${c.costo}`));
    const detalle = delGrupo.map((c) => `${c.moneda} ${c.costo}`).join(' o ') || 'sin costo en el Backoffice';
    lineas.push(`${ok ? 'OK  ' : 'MAL '} ${f[1]} | ${p || '-'}  ->  ${detalle} / ${divisor} = ${esperados.join(' o ') || '?'}  /  portal ${precio}`);
    if (!ok) fuera.push(f.join(' | '));
  }
  // Una tarifa del Backoffice que el portal no ofrece tambien es un error de importes.
  for (const c of costos) {
    const clave = `${c.modalidad}|${c.pax}|${c.costo}`;
    if (vistos.has(clave)) continue;
    const enPortal = conPrecio.some((f) => modalidad(f[1] ?? '') === modalidad(c.modalidad) && primerImporte(f.at(-1) ?? '') === precioEsperado(c.costo!, c.moneda, divisor, cotizaciones));
    if (!enPortal) fuera.push(`falta en el portal: ${c.modalidad} | ${c.pax} | ${c.moneda} ${c.costo}`);
  }
  return { lineas, fuera };
}

/**
 * Precio absoluto de cada corte de una habitacion: SGL, DBL y TPL = techo(costo por persona / divisor),
 * con los cortes "Por persona" de la ficha de la habitacion. Cada fila del portal se empareja con el
 * corte que termina el mismo dia (el inicio lo recorta la ventana del tarifario). Hoteles en USD.
 */
export function exigirPreciosDeHabitacion(filas: string[][], cortes: Corte[], divisor: number): { lineas: string[]; fuera: string[] } {
  const lineas: string[] = [];
  const fuera: string[] = [];
  // Portal viejo: SGL / DBL / TPL; app nueva: Single / Doble / Triple.
  const encabezado = filas.find((f) => f.some((c) => /^(SGL|Single)$/i.test(c.trim()))) ?? [];
  const tipo = (c: string): keyof Corte | undefined =>
    /^(SGL|Single)$/i.test(c) ? 'sgl' : /^(DBL|Doble)$/i.test(c) ? 'dbl' : /^(TPL|Triple)$/i.test(c) ? 'tpl' : undefined;
  for (const f of filas) {
    if (f === encabezado || !f.some((c) => primerImporte(c) !== null)) continue;
    const hasta = f[0].match(/-\s*(\d{2}\/\d{2}\/\d{4})/)?.[1];
    const corte = cortes.find((c) => c.hasta === hasta);
    f.forEach((celda, i) => {
      const precio = primerImporte(celda);
      const campo = tipo((encabezado[i] ?? '').trim());
      if (precio === null || !campo) return;
      const costo = corte?.[campo] as number | null | undefined;
      const esperado = costo == null ? null : precioEsperado(costo, 'USD', divisor);
      const ok = esperado !== null && precio === esperado;
      lineas.push(`${ok ? 'OK  ' : 'MAL '} ${f[0]} | ${encabezado[i]}  ->  costo ${costo ?? 'sin corte'} / ${divisor} = ${esperado ?? '?'}  /  portal ${precio}`);
      if (!ok) fuera.push(`${f[0]} | ${encabezado[i]} | portal ${precio}, esperado ${esperado ?? 'sin corte en la habitacion'}`);
    });
  }
  return { lineas, fuera };
}

/** Costos de un item, leidos una vez: las tarifas de un servicio o los cortes de una habitacion. */
export type CostosDelItem = { servicio: TarifaDeServicio[] } | { habitacion: Corte[] };

export async function leerCostos(browser: Browser, de: { servicio?: number; habitacion?: number }): Promise<CostosDelItem> {
  return conBackofficeNuevo(browser, async (bo) => (de.servicio
    ? { servicio: await costosDelServicio(bo, de.servicio) }
    : { habitacion: await cortesDeLaHabitacion(bo, de.habitacion!) }));
}

/** Cada precio de la tabla = techo(costo / cotizacion / divisor), sin margen; adjunta el detalle. */
export async function exigirImportes(filas: string[][], costos: CostosDelItem, divisor: number, que: string, cotizaciones: Record<string, number> = COTIZACION) {
  const { lineas, fuera } = 'servicio' in costos
    ? exigirPreciosDeServicio(filas, costos.servicio, divisor, cotizaciones)
    : exigirPreciosDeHabitacion(filas, costos.habitacion, divisor);
  await adjuntarTexto(`Importes: ${que}`, `precio = techo(costo / cotizacion / ${divisor})\n\n${lineas.join('\n')}`);
  expect(lineas.length, `${que}: tiene que haber precios para comparar`).toBeGreaterThan(0);
  expect(fuera, `${que}: precios que no son techo(costo / ${divisor})\n${fuera.join('\n')}`).toEqual([]);
}
