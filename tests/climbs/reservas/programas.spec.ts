import { test, expect } from '@playwright/test';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { ProgramaNuevoPage } from '../../../pages/climbs/programa.page';
import { paso, adjuntarTexto, reiniciarNumeracionDePasos, fechaDeBusqueda, formatearFecha, conResaltado } from '../../../utils/pasos';
import { importe, pasajerosDePrueba } from './reservas-comun';
import candidatos from '../../../data/candidatos.json';

/**
 * RESERVAS — app nueva (ClimbsApp). Programas: del buscador de la portada a la reserva.
 *
 * Solo existe en la app nueva (HQ T-33): la agencia busca programas en la solapa "Programas",
 * abre la ficha, elige la salida, los pasajeros y las habitaciones, lo agrega al carrito y lo
 * reserva. El precio se arma por habitacion (cada single con la tarifa de 1 pasajero, cada
 * doble con la de 2 por sus 2 pasajeros, cada triple con la de 3 por sus 3) y la reserva de
 * una salida regular con cupo descuenta los pasajeros del cupo.
 *
 * Dato propio: el programa "AUTO-QA NO TOCAR - Programa Buenos Aires" (#6, creado por pantalla el
 * 24/11/2026): Buenos Aires -> Buenos Aires, 3 noches, hoteleria "Estándar", salidas regulares
 * todos los dias del 01/12/2026 al 31/12/2031 con cupo 999, tarifas finales por persona
 * 1 PAX 1000, 2 PAX 800 y 3 PAX 700 (USD). La sesion de la suite (pablo1) las ve divididas por su
 * markup y redondeadas hacia arriba (ProgramSiteRules.PerPerson): el markup sale de
 * candidatos._formulaPrecio.markupPorDefecto, el mismo de los demas tests de precios.
 *
 * Cada corrida consume 6 lugares del cupo de su salida (la cancelacion no lo devuelve, T-33):
 * la fecha se corre con el dia de la corrida para repartir el consumo.
 */
test.describe('Programas', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  const PROGRAMA = 'AUTO-QA NO TOCAR - Programa Buenos Aires';
  const HOTELERIA = 'Estándar';
  // Tarifas finales por persona cargadas en el programa (BackOffice). El sitio las divide por el
  // markup de la agencia (ProgramSiteRules.PerPerson) y redondea hacia arriba: con pablo1 se usa el
  // mismo markup de la suite que los demas tests de precios.
  const CARGADA = { single: 1000, doble: 800, triple: 700 };
  const MARKUP = candidatos._formulaPrecio.markupPorDefecto;
  const precio = (t: number) => Math.ceil(t / MARKUP);
  const TARIFA = { single: precio(CARGADA.single), doble: precio(CARGADA.doble), triple: precio(CARGADA.triple) };
  const HABITACIONES = { single: 1, doble: 1, triple: 1 };
  const PAX = HABITACIONES.single + 2 * HABITACIONES.doble + 3 * HABITACIONES.triple;
  const TOTAL = HABITACIONES.single * TARIFA.single + 2 * HABITACIONES.doble * TARIFA.doble + 3 * HABITACIONES.triple * TARIFA.triple;
  // Lo que AMV le cobra a la agencia: las tarifas cargadas, sin el markup de la agencia. Como en el
  // resto de las reservas (checkout, historial y file), el detalle de la reserva muestra el neto.
  const NETO = HABITACIONES.single * CARGADA.single + 2 * HABITACIONES.doble * CARGADA.doble + 3 * HABITACIONES.triple * CARGADA.triple;

  test('Programa: se busca, se cotiza por habitacion, se reserva y descuenta el cupo de la salida', async ({ page }) => {
    test.setTimeout(600_000);
    const portal = new PortalNuevoPage(page);
    const programa = new ProgramaNuevoPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda(45);
    const pasajeros = pasajerosDePrueba(PAX, sello);
    const r = { cupoAntes: null as number | null, codigo: '', totalFicha: '', totalCarrito: '' };
    await adjuntarTexto('Datos de la corrida', [
      `Programa: ${PROGRAMA}`, `Salida: ${formatearFecha(fecha)} (regular)`,
      `Habitaciones: ${HABITACIONES.single} single, ${HABITACIONES.doble} doble, ${HABITACIONES.triple} triple = ${PAX} pasajeros`,
      `Tarifas cargadas por persona: SGL ${CARGADA.single}, DBL ${CARGADA.doble}, TPL ${CARGADA.triple}; markup ${MARKUP}`,
      `Tarifas por persona para la agencia: SGL ${TARIFA.single}, DBL ${TARIFA.doble}, TPL ${TARIFA.triple}`,
      `Total esperado: USD ${TOTAL}`,
    ].join('\n'));

    await paso(page, 'BackOffice: leer el cupo de la salida en la ficha del programa', async () => {
      await programa.abrirSalidasEnElBackoffice(PROGRAMA);
      r.cupoAntes = await programa.leerCupo(fecha);
      await adjuntarTexto('Cupo antes de reservar', `${formatearFecha(fecha)}: ${r.cupoAntes ?? 'A requerir'}`);
      await conResaltado(page, programa.cupoDeLaSalida(fecha), 'cupo antes', () => {
        expect(r.cupoAntes, `La salida del ${formatearFecha(fecha)} tiene que tener cupo para ${PAX} pasajeros`).toBeGreaterThanOrEqual(PAX);
      });
    });

    await paso(page, 'Vaciar el carrito y buscar programas regulares en Buenos Aires', async () => {
      await portal.vaciarCarrito();
      await programa.buscar(fecha, 'Regulares');
      await expect(programa.tarjeta(PROGRAMA), 'El programa AUTO-QA tiene que aparecer en los resultados').toBeVisible({ timeout: 60_000 });
      const desde = await programa.desdeDeLaTarjeta(PROGRAMA);
      await adjuntarTexto('Tarjeta del resultado', desde);
      await conResaltado(page, programa.tarjeta(PROGRAMA), 'precio desde', () => {
        expect(importe(desde).valor, `La tarjeta tiene que mostrar "desde" la tarifa doble por persona (USD ${TARIFA.doble})`).toBe(TARIFA.doble);
      });
    });

    await paso(page, 'Ficha: elegir la salida, los pasajeros y las habitaciones', async () => {
      await programa.abrirFicha(PROGRAMA);
      await programa.elegirSalida(fecha, PAX, HABITACIONES);
      const salida = programa.tarjetaDeLaSalida(fecha);
      const texto = (await salida.innerText()).replace(/\s+/g, ' ');
      await adjuntarTexto('Tarjeta de la salida', texto);
      await conResaltado(page, salida, 'salida regular disponible', async () => {
        await expect(salida, 'La salida tiene que ser regular').toContainText('Regular');
        await expect(salida, 'Una salida regular con cupo para los pasajeros tiene que estar Disponible').toContainText('Disponible');
      });
      // Cada hoteleria es una fila "Estándar USD 4.700" con su radio; el total se lee de la fila.
      r.totalFicha = texto.match(new RegExp(`${HOTELERIA}\\s+([A-Z]{3}\\s*[\\d.,]+)`))?.[1] ?? '';
      await adjuntarTexto('Total de la ficha', r.totalFicha);
      await conResaltado(page, salida, 'total por habitacion', () => {
        expect(importe(r.totalFicha).valor, `El total tiene que salir por habitacion: ${HABITACIONES.single} x ${TARIFA.single} + ${HABITACIONES.doble} x 2 x ${TARIFA.doble} + ${HABITACIONES.triple} x 3 x ${TARIFA.triple} = ${TOTAL}`).toBe(TOTAL);
        expect(importe(r.totalFicha).moneda, 'El programa cotiza en USD').toBe('USD');
      });
    });

    await paso(page, 'Agregar al carrito: la linea del programa trae el total de la ficha', async () => {
      const opcion = programa.hoteleria(fecha, HOTELERIA);
      if (!(await opcion.isChecked())) await programa.tarjetaDeLaSalida(fecha).getByText(HOTELERIA, { exact: true }).click();
      await expect(opcion, `La hoteleria ${HOTELERIA} tiene que quedar elegida`).toBeChecked();
      await programa.tarjetaDeLaSalida(fecha).getByRole('button', { name: 'Agregar al carrito' }).click();
      // El programa entra en una linea por tipo de habitacion: el contador puede subir de a varias.
      await expect.poll(() => portal.itemsEnElCarrito(), { message: 'Agregar al carrito tiene que sumar el programa al carrito', timeout: 30_000 }).toBeGreaterThan(0);
      await portal.irAlCarrito();
      const lineas = page.locator('main article').filter({ has: page.getByRole('heading', { name: PROGRAMA, exact: true }) });
      const textos = (await lineas.allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
      r.totalCarrito = await portal.totalDelCarrito();
      await adjuntarTexto('Carrito', `${textos.join('\n')}\nTotal: ${r.totalCarrito}`);
      // Cada base del carrito con su habitacion y su parte del precio (T-33 / T-60: "cada base del carrito se abre en sus habitaciones").
      const bases = [
        { rotulo: 'Single', cantidad: HABITACIONES.single, importe: HABITACIONES.single * TARIFA.single },
        { rotulo: 'Doble', cantidad: HABITACIONES.doble, importe: HABITACIONES.doble * 2 * TARIFA.doble },
        { rotulo: 'Triple', cantidad: HABITACIONES.triple, importe: HABITACIONES.triple * 3 * TARIFA.triple },
      ].filter((b) => b.cantidad > 0);
      await conResaltado(page, page.locator('main'), 'lineas del programa', () => {
        expect(textos, `El carrito tiene que traer una linea del programa por tipo de habitacion (${bases.map((b) => b.rotulo).join(', ')})`).toHaveLength(bases.length);
        for (const b of bases) {
          const linea = textos.find((t) => new RegExp(`\\b${b.cantidad} ${b.rotulo}\\b`).test(t)) ?? '';
          expect(linea, `Tiene que haber una linea "${b.cantidad} ${b.rotulo}"`).not.toBe('');
          expect(linea, `La linea ${b.rotulo} tiene que llevar la fecha de la salida`).toContain(formatearFecha(fecha));
          // El rotulo va en mayusculas por estilo ("ESTÁNDAR · REGULAR"): se compara sin distinguir.
          expect(linea.toLowerCase(), `La linea ${b.rotulo} tiene que llevar la hoteleria y la salida regular`).toContain(`${HOTELERIA} · Regular`.toLowerCase());
          expect(importe(linea.match(/[A-Z]{3}\s*[\d.,]+/g)?.at(-1) ?? '').valor, `La linea ${b.rotulo} tiene que valer ${b.importe}`).toBe(b.importe);
        }
      });
      await conResaltado(page, portal.cajaDelTotal, 'total del carrito', () => {
        expect(importe(r.totalCarrito).valor, `El carrito tiene que cobrar el total de la ficha (USD ${TOTAL})`).toBe(TOTAL);
      });
    });

    await paso(page, 'Reservar: datos de los pasajeros y confirmacion', async () => {
      await portal.reservarDesdeElCarrito(`AUTO-QA ${sello}`, `Reserva de regresion automatica ${sello}. No operar.`);
      await portal.completarDatosDeLaReserva(pasajeros, `Programa AUTO-QA ${sello}`);
      r.codigo = await portal.confirmarReserva();
      await adjuntarTexto('Codigo de la reserva', r.codigo);
    });

    await paso(page, 'Historial: la reserva figura con el neto del programa', async () => {
      const fila = await portal.filaDelHistorial(r.codigo, 'Carrito de compras');
      await portal.abrirDetalleDeLaReserva(fila, r.codigo);
      const total = await portal.datoDelDetalle(['Monto total', 'Total de la reserva']);
      await adjuntarTexto('Detalle de la reserva', `Total: ${total}`);
      await conResaltado(page, page.locator('main'), 'total de la reserva', async () => {
        await expect(page.locator('main'), 'El detalle tiene que nombrar el programa').toContainText(PROGRAMA);
        expect(importe(total).valor, `La reserva tiene que quedar por el neto de la agencia: las tarifas cargadas sin su markup (USD ${NETO})`).toBe(NETO);
      });
    });

    await paso(page, 'BackOffice: el cupo de la salida bajo en los pasajeros reservados', async () => {
      await programa.abrirSalidasEnElBackoffice(PROGRAMA);
      const despues = await programa.leerCupo(fecha);
      await adjuntarTexto('Cupo despues de reservar', `${formatearFecha(fecha)}: antes ${r.cupoAntes}, despues ${despues ?? 'A requerir'} (reserva ${r.codigo})`);
      await conResaltado(page, programa.cupoDeLaSalida(fecha), 'cupo despues', () => {
        expect(despues, `La reserva de ${PAX} pasajeros en una salida regular tiene que descontarlos del cupo (${r.cupoAntes} - ${PAX})`).toBe((r.cupoAntes ?? 0) - PAX);
      });
    });
  });
});
