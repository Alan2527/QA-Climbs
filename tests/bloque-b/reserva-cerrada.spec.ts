import { test, expect, Page } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage } from '../../pages/carrito.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, conResaltado, esperarFinDeCarga, formatearFecha } from '../../utils/pasos';
import { importeDelPortal } from './reservas-comun';
import candidatos from '../../data/candidatos.json';
import lineaBase from '../../data/importes-lineabase.json';
import { conBackofficeNuevo, costosDelServicio } from '../../utils/markups';
import { recargoEnFichaYCarritoViejo } from '../../utils/recargo-por-idioma';

/** Markup con que el portal le vende a pablo1 (su CustomMarkup). */
const MARKUP_PABLO = candidatos._formulaPrecio.markupPorDefecto;

const EX = candidatos.tarifario.excursiones;

/**
 * Precio por persona de la modalidad Regular segun la linea base del tarifario (en Espanol):
 * "USD 95" para Tigre y Delta. Es lo que la ficha tiene que mostrar con la reserva abierta.
 */
const PRECIO_REGULAR = (() => {
  const filas = (lineaBase.items as Record<string, any>).excursiones.porIdioma['Español'] as string[][];
  const fila = filas.find((f) => f[1] === 'Regular');
  return importeDelPortal((fila?.at(-1) ?? '').replace(/TARIFA EXTENDIDA/i, ''));
})();

/**
 * BLOQUE B — Servicio con la reserva online cerrada (anticipacion minima, Azure 5108).
 *
 * Al comprar un servicio suelto por el carrito, las reservas online cierran 72 horas antes del
 * comienzo. En la ficha (ServiceDetail.aspx), si la fecha elegida cae dentro de esa ventana, en
 * vez de las tarjetas de tarifa se muestra el cartel
 * "El servicio comienza el dd/mm/yyyy y las reservas online cierran 72 horas antes. Por favor,
 * comuniquese con su ejecutivo de ventas para gestionarla." con el estilo del cartel "este
 * servicio no opera" (sd-rates-empty--closed), y sin tarifa no hay "Agregar al carrito". Al
 * entrar a la ficha, el check-in no precarga hoy: precarga la primera fecha reservable (la
 * primera con tarifa desde hoy + 3 dias).
 *
 * Solo en el portal viejo: la US es "solo WEB" y la migracion a la app nueva va por separado
 * (al 24/11/2026 no hay tarea en HQ). Servicio: la excursion AUTO-QA de Buenos Aires (Tigre y
 * Delta, tarifas hasta 2031), con pablo1. Las fechas se calculan con el dia de la corrida.
 * Importes: con la reserva abierta la tarjeta Regular muestra el precio de la linea base del
 * tarifario, el total de la ficha es ese precio por los pasajeros y el carrito cobra ese total.
 * No emite: al final vacia el carrito.
 *
 * Recargo por idioma (US 4739): al final se vuelve a elegir el servicio en English (buscado a 7 dias). Tigre
 * y Delta tiene English 10% en su tarifa Regular; la ficha y el carrito tienen que cobrar por persona
 * techo((costo + recargo) / cotizacion / markup de pablo1). Con un recargo porcentual el resultado es el mismo
 * aplique el markup al recargo o no: aca se verifica el importe en English.
 */
test.describe('Reserva online cerrada: anticipacion minima del servicio', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  const HORAS = 72;
  const dia = (n: number) => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), h.getDate() + n); };
  const aFecha = (t: string) => { const [d, m, a] = t.split('/').map(Number); return new Date(a, m - 1, d); };
  const cartel = (f: Date) => `El servicio comienza el ${formatearFecha(f)} y las reservas online cierran ${HORAS} horas antes. ` +
    'Por favor, comuniquese con su ejecutivo de ventas para gestionarla.';

  test('Servicio: dentro de las 72 horas muestra el cartel y no deja agregar; desde hoy + 3 se agrega al carrito', async ({ page }) => {
    test.setTimeout(600_000);
    const inicio = new InicioPage(page);
    const servicio = new ServicioPage(page);
    const carrito = new CarritoPage(page);
    const checkin = page.locator(servicio.campoFechaFicha);
    const cerrado = page.locator('.sd-rates-empty--closed');
    const tarifas = servicio.bloquesDeTarifa();
    const zona = page.locator('.sd-rates, .sd-rates-empty').first();
    const primera = dia(3);
    const r = { pax: 0, totalFicha: '' };

    const elegirCheckin = async (f: Date) => {
      await servicio.elegirFecha(servicio.campoFechaFicha, servicio.hiddenFechaFicha, f);
      await esperarFinDeCarga(page);
      await expect(checkin, `El check-in de la ficha tiene que quedar en ${formatearFecha(f)}`).toHaveValue(formatearFecha(f));
    };

    const exigirCerrado = async (p: Page, f: Date) => {
      await conResaltado(p, zona, `reserva cerrada ${formatearFecha(f)}`, async () => {
        await expect(cerrado, `Con ${formatearFecha(f)} (dentro de las ${HORAS} horas) tiene que verse el cartel de reserva cerrada`).toBeVisible({ timeout: 30_000 });
        expect((await cerrado.innerText()).replace(/\s+/g, ' ').trim(), 'El texto del cartel es el de la US con la fecha del servicio').toBe(cartel(f));
        await expect(tarifas, 'Con la reserva cerrada no tiene que haber tarjetas de tarifa para elegir').toHaveCount(0);
        await expect(page.locator(servicio.btnReservar).first(), 'Con la reserva cerrada "Agregar al carrito" no tiene que habilitarse').not.toBeVisible();
      });
    };

    try {
      await paso(page, 'Vaciar el carrito y abrir la ficha del servicio con la fecha que propone el buscador', async () => {
        await inicio.abrir();
        await carrito.vaciar();
        await inicio.abrir();
        const panel = await inicio.abrirSolapa('servicios');
        await page.locator(servicio.comboPais).selectOption({ label: EX.ciudad.pais });
        await esperarFinDeCarga(page);
        await page.locator(servicio.comboCiudad).selectOption({ label: EX.ciudad.nombre });
        // Por valor: la etiqueta del tipo sale de un recurso traducible (1 = Excursion).
        await page.locator(servicio.comboTipo).selectOption({ value: String(EX.serviceTypeId) });
        await adjuntarTexto('Fecha que propone el buscador', await page.locator(servicio.campoFecha).inputValue());
        await panel.locator(servicio.btnBuscar).first().click();
        await page.waitForURL(/serviceall/i, { timeout: 90_000 });
        await esperarFinDeCarga(page);
        await servicio.buscarPorNombre(EX.terminoBusqueda, EX.nombre);
        await servicio.abrirFicha(EX.nombre.slice(0, 25));
      });

      await paso(page, 'La ficha precarga la primera fecha reservable, no hoy', async () => {
        const precargado = await checkin.inputValue();
        await adjuntarTexto('Check-in precargado', `${precargado} (hoy ${formatearFecha(dia(0))}, primera reservable desde ${formatearFecha(primera)})`);
        await conResaltado(page, checkin, 'check-in precargado', async () => {
          expect(precargado, 'El check-in no tiene que precargar la fecha de hoy').not.toBe(formatearFecha(dia(0)));
          expect(aFecha(precargado).getTime(), `El check-in tiene que precargar una fecha desde hoy + 3 dias (${formatearFecha(primera)})`)
            .toBeGreaterThanOrEqual(primera.getTime());
        });
        await conResaltado(page, zona, 'tarifas de la fecha precargada', async () => {
          await expect(tarifas.first(), 'Con la fecha precargada se tienen que ver las tarjetas de tarifa').toBeVisible({ timeout: 30_000 });
          await expect(cerrado, 'Con la fecha precargada no tiene que verse el cartel de reserva cerrada').toHaveCount(0);
        });
      });

      await paso(page, 'Check-in hoy: cartel de reserva cerrada y sin "Agregar al carrito"', async () => {
        await elegirCheckin(dia(0));
        await exigirCerrado(page, dia(0));
      });

      await paso(page, 'Check-in hoy + 2: sigue dentro de las 72 horas', async () => {
        await elegirCheckin(dia(2));
        await exigirCerrado(page, dia(2));
      });

      await paso(page, 'Check-in hoy + 3: vuelven las tarifas y el servicio entra al carrito', async () => {
        await elegirCheckin(primera);
        await conResaltado(page, zona, 'tarifas desde hoy + 3', async () => {
          await expect(cerrado, `Con ${formatearFecha(primera)} no tiene que verse el cartel de reserva cerrada`).toHaveCount(0);
          await expect(tarifas.first(), `Con ${formatearFecha(primera)} se tienen que ver las tarjetas de tarifa`).toBeVisible({ timeout: 30_000 });
        });
        // Bloque Regular por su nombre exacto: "Menores en regular" tambien contiene "regular".
        const bloque = tarifas.filter({ has: page.locator('.sd-rate__name', { hasText: /^\s*Regular\s*$/i }) }).first();
        const minimo = Number((await bloque.innerText()).match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
        r.pax = Math.max(2, minimo);
        await bloque.locator(servicio.comboPax).selectOption(String(r.pax));
        await esperarFinDeCarga(page);
        r.totalFicha = await servicio.esperarTotal();
        // El precio por persona de la tarjeta dice "-" hasta que se eligen los pasajeros.
        const valorDeLaTarjeta = bloque.locator('.sd-rate__price-val, .js-sd-price').first();
        await expect.poll(async () => (await valorDeLaTarjeta.innerText()).trim(), { message: 'La tarjeta tiene que mostrar el precio por persona', timeout: 30_000 }).toMatch(/\d/);
        const precio = importeDelPortal(await valorDeLaTarjeta.innerText());
        const total = importeDelPortal(r.totalFicha);
        await adjuntarTexto('Importes de la ficha', `Regular: ${precio.moneda} ${precio.valor} por persona (linea base ${PRECIO_REGULAR.moneda} ${PRECIO_REGULAR.valor}) x ${r.pax} = ${r.totalFicha}`);
        await conResaltado(page, bloque, 'precio por persona', () => {
          expect(precio.valor, `La tarjeta Regular tiene que mostrar el precio de la linea base del tarifario (${PRECIO_REGULAR.moneda} ${PRECIO_REGULAR.valor})`).toBe(PRECIO_REGULAR.valor);
          expect(precio.moneda, 'La tarjeta tiene que cotizar en la moneda de la linea base').toBe(PRECIO_REGULAR.moneda);
        });
        await conResaltado(page, page.locator('#totals'), 'total de la ficha', () => {
          expect(total.valor, `El total de la ficha tiene que ser el precio por persona por los pasajeros (${precio.valor} x ${r.pax})`).toBe((precio.valor ?? NaN) * r.pax);
          expect(total.moneda, 'El total va en la moneda de la tarjeta').toBe(precio.moneda);
        });
        await servicio.agregarAlCarrito();
      });

      await paso(page, 'Carrito: el servicio figura con la fecha, los pasajeros y el total de la ficha', async () => {
        await carrito.irAlCarrito();
        const fila = page.locator(carrito.filas).filter({ hasText: EX.terminoBusqueda });
        await expect(fila, 'El carrito tiene que traer el servicio').toHaveCount(1);
        const texto = (await fila.innerText()).replace(/\s+/g, ' ');
        const linea = importeDelPortal(await fila.locator('.ct-row__total').innerText());
        const totalCarrito = importeDelPortal(await page.locator('.ct-total .ct-opt__total-val').first().innerText());
        await adjuntarTexto('Linea del carrito', `${texto}\nLinea:${linea.moneda} ${linea.valor} | Total del carrito: ${totalCarrito.moneda} ${totalCarrito.valor} | Ficha: ${r.totalFicha}`);
        await conResaltado(page, fila, 'linea del carrito', async () => {
          expect(texto, `La linea tiene que llevar la fecha del servicio (${formatearFecha(primera)})`).toContain(formatearFecha(primera));
          expect(await fila.locator('.sc-qty').innerText(), 'El carrito tiene que traer los pasajeros elegidos en la ficha').toMatch(new RegExp(`^\\s*${r.pax}\\b`));
          expect(linea.valor, `La linea tiene que cobrar el total de la ficha (${r.totalFicha})`).toBe(importeDelPortal(r.totalFicha).valor);
          expect(linea.moneda, 'La linea va en la moneda de la ficha').toBe(importeDelPortal(r.totalFicha).moneda);
        });
        await conResaltado(page, page.locator('.ct-total').first(), 'total del carrito', () => {
          expect(totalCarrito.valor, 'Con un solo servicio, el total del carrito es su linea').toBe(linea.valor);
        });
      });

      await paso(page, 'En English: la ficha y el carrito cobran techo((costo + recargo) / markup) (US 4739)', async () => {
        const tarifasDelServicio = await conBackofficeNuevo(page.context().browser()!, (bo) => costosDelServicio(bo, EX.id));
        await recargoEnFichaYCarritoViejo(page, {
          pais: EX.ciudad.pais, ciudad: EX.ciudad.nombre, termino: EX.terminoBusqueda, nombre: EX.nombre, modalidad: 'Regular',
          fecha: dia(7), tarifas: tarifasDelServicio, tipo: 'Excursión', tipoValor: String(EX.serviceTypeId),
        }, MARKUP_PABLO, 'pablo1');
      });
    } finally {
      await new InicioPage(page).abrir().catch(() => {});
      await new CarritoPage(page).vaciar().catch(() => {});
      await esperarFinDeCarga(page).catch(() => {});
    }
  });
});
