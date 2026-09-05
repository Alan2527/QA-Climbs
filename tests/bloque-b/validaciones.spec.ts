import { test, expect, Page, Locator } from '@playwright/test';
import { InicioPage } from '../../pages/inicio.page';
import { ServicioPage } from '../../pages/servicio.page';
import { CarritoPage } from '../../pages/carrito.page';
import {
  paso, adjuntarTexto, esperarFinDeCarga, fechaDeBusqueda, formatearFecha,
  resaltarYCapturar, reiniciarNumeracionDePasos,
} from '../../utils/pasos';

/**
 * BLOQUE B — casos negativos del checkout.
 *
 * Los cuatro flujos de `reservas.spec.ts` recorren el camino feliz. Este archivo
 * cubre lo otro: que el portal **rechace** lo que no debe permitir emitir.
 *
 * Va en un archivo aparte a proposito. Los cuatro flujos estan terminados y en
 * verde; sumarles estos casos obligaria a editarlos, y aca no hace falta: se
 * comparte el page object, que es lo estable.
 *
 * **No emite ninguna reserva.** Llega hasta el checkout y se queda ahi, asi que
 * no deja reservas ni files en QA, a diferencia de los flujos del camino feliz.
 *
 * Las validaciones salen de `Web/Online/CheckOut.aspx.cs`, ValidateInputs y
 * cbxTermsAndConditions_CheckedChanged.
 *
 * El portal tiene selector de idioma pero **no tiene tema oscuro**: no aplica esa
 * consideracion transversal.
 */
test.describe('Reservas — validaciones', () => {

  test.beforeEach(async ({ page }) => {
    reiniciarNumeracionDePasos();
    await new InicioPage(page).abrir();
  });

  /** Marca en rojo la zona que origino el fallo y lo registra como fallo blando. */
  async function conResaltado(
    page: Page, locator: Locator, etiqueta: string, fn: () => void | Promise<void>,
  ) {
    try {
      await fn();
    } catch (error) {
      await resaltarYCapturar(page, locator, `FALLA: ${etiqueta}`);
      expect.soft(false, (error as Error).message).toBe(true);
    }
  }

  test('Checkout: el portal no deja emitir una reserva incompleta', async ({ page }) => {
    test.setTimeout(600_000);

    const inicio = new InicioPage(page);
    const servicio = new ServicioPage(page);
    const carrito = new CarritoPage(page);

    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const fecha = fechaDeBusqueda();

    const datos = {
      servicio: 'AUTO-QA NO TOCAR - Tigre y Delta',
      terminoDeBusqueda: 'Tigre y Delta',
      modalidad: 'Regular',
      fecha: formatearFecha(fecha),
      referencia: `AUTO-QA ${sello}`,
      observaciones: `Validaciones de regresion automatica ${sello}. No operar.`,
      cantidadPax: 0,
      avisoDeCamposEnRojo: 'Se deben completar los campos en rojo',
      avisoDeCantidad: 'La cantidad de pasajeros ingresada es menor a los pasajeros cargados',
    };

    /** El aviso de error del checkout, que se pinta en un alert-danger. */
    const aviso = page.locator('.alert-danger').first();

    /** Confirma y exige que la reserva **no** se emita. */
    const intentarConfirmar = async () => {
      await page.locator(carrito.btnConfirmar).first().click();
      await esperarFinDeCarga(page);
      await expect(
        page,
        'Rechazada la validacion, el portal no tiene que emitir la reserva',
      ).not.toHaveURL(/bookinghistory/i);
    };

    await paso(page, 'Armar el carrito con un servicio y llegar al checkout', async () => {
      await carrito.vaciar();
      await inicio.abrir();
      const panel = await inicio.abrirSolapa('servicios');
      await servicio.buscar({
        panel, pais: 'Argentina', ciudad: 'Buenos Aires', tipo: 'Excursión', fecha,
      });
      await servicio.buscarPorNombre(datos.terminoDeBusqueda, datos.servicio);
      await servicio.abrirFicha(datos.servicio.slice(0, 24));

      const fila = page.locator('tr')
        .filter({ has: page.locator("select[id*='ddPax']") })
        .filter({ hasText: datos.modalidad }).first();
      await expect(
        fila,
        `La ficha tiene que ofrecer la modalidad ${datos.modalidad} para el ${datos.fecha}`,
      ).toBeVisible({ timeout: 30_000 });

      const texto = (await fila.innerText()).replace(/\s+/g, ' ');
      datos.cantidadPax = Number(texto.match(/M[ií]nimo\s+(\d+)/i)?.[1] ?? 1);
      // El caso de "menos pax que los cargados" necesita al menos dos bloques.
      expect(datos.cantidadPax,
        'El servicio elegido tiene que pedir al menos dos pasajeros para poder probar la ' +
        'validacion de cantidad')
        .toBeGreaterThan(1);

      await fila.locator("select[id*='ddPax']").selectOption(String(datos.cantidadPax));
      await esperarFinDeCarga(page);
      await page.locator("[id$='lnkBookService']").first().click();
      await esperarFinDeCarga(page);

      await carrito.irAlCarrito();
      await carrito.crearReserva(datos.referencia, datos.observaciones);
      await carrito.asegurarPasajeros(datos.cantidadPax);
      await adjuntarTexto('Carrito armado',
        `${datos.servicio} | ${datos.fecha} | ${datos.cantidadPax} pax`);
    });

    await paso(page, 'Verificar que sin aceptar los terminos no se pueda confirmar', async () => {
      // cbxTermsAndConditions_CheckedChanged: el boton se habilita solo con el
      // check tildado. Es la unica de las cuatro validaciones que se resuelve sin
      // llegar al servidor.
      await conResaltado(page, page.locator(carrito.btnConfirmar).first(), 'Confirmar deshabilitado', async () => {
        await expect(
          page.locator(carrito.btnConfirmar).first(),
          'Sin aceptar los terminos y condiciones, Confirmar tiene que estar deshabilitado',
        ).toBeDisabled();
      });

      await carrito.aceptarTerminos();
      await conResaltado(page, page.locator(carrito.btnConfirmar).first(), 'Confirmar habilitado', async () => {
        await expect(
          page.locator(carrito.btnConfirmar).first(),
          'Aceptados los terminos, Confirmar tiene que habilitarse',
        ).toBeEnabled();
      });
    });

    await paso(page, 'Intentar confirmar con un pasajero sin apellido', async () => {
      // Se cargan los dos pasajeros y despues se vacia el apellido del primero:
      // asi el unico motivo del rechazo es ese campo.
      for (let i = 0; i < datos.cantidadPax; i++) {
        await carrito.completarPasajero(i, {
          nombre: `Pasajero${i + 1}`,
          apellido: `Regresion${sello.slice(-6)}`,
          pasaporte: `QA${sello.slice(-8)}${i + 1}`,
          nacimiento: `0${i + 1}/03/1990`,
          nacionalidad: 'Argentina',
        });
      }
      await carrito.completarDatosDeLaReserva(
        datos.cantidadPax, datos.referencia, datos.observaciones,
      );

      const apellido = page.locator("[id*='lvPassengersData'][id$='_txtSurName']").first();
      await apellido.fill('');
      await intentarConfirmar();

      await conResaltado(page, aviso, 'Aviso por campo vacio', async () => {
        await expect(aviso, `El portal tiene que avisar "${datos.avisoDeCamposEnRojo}"`)
          .toContainText(datos.avisoDeCamposEnRojo, { timeout: 30_000 });
      });

      // El aviso no alcanza: la pantalla tiene que senalar cual es el campo.
      const marcado = page.locator("[id*='lvPassengersData'][id$='_txtSurName'].border-danger").first();
      await conResaltado(page, apellido, 'Campo marcado en rojo', async () => {
        await expect(marcado, 'El apellido vacio tiene que quedar marcado en rojo')
          .toBeVisible({ timeout: 30_000 });
      });
      await adjuntarTexto('Aviso por campo vacio', (await aviso.innerText()).replace(/\s+/g, ' ').trim());
    });

    await paso(page, 'Intentar confirmar con menos pasajeros que los cargados', async () => {
      await carrito.completarPasajero(0, {
        nombre: 'Pasajero1',
        apellido: `Regresion${sello.slice(-6)}`,
        pasaporte: `QA${sello.slice(-8)}1`,
        nacimiento: '01/03/1990',
        nacionalidad: 'Argentina',
      });

      // Un pasajero menos que los bloques cargados.
      await page.locator(carrito.campoCantidadPax).first().fill(String(datos.cantidadPax - 1));
      await intentarConfirmar();

      await conResaltado(page, aviso, 'Aviso por cantidad menor', async () => {
        await expect(aviso, `El portal tiene que avisar "${datos.avisoDeCantidad}"`)
          .toContainText(datos.avisoDeCantidad, { timeout: 30_000 });
      });
      await adjuntarTexto('Aviso por cantidad menor', (await aviso.innerText()).replace(/\s+/g, ' ').trim());
    });

    await paso(page, 'Intentar confirmar con la cantidad de pasajeros vacia', async () => {
      await page.locator(carrito.campoCantidadPax).first().fill('');
      await intentarConfirmar();

      await conResaltado(page, aviso, 'Aviso por cantidad vacia', async () => {
        await expect(aviso, `El portal tiene que avisar "${datos.avisoDeCamposEnRojo}"`)
          .toContainText(datos.avisoDeCamposEnRojo, { timeout: 30_000 });
      });

      const marcado = page.locator(`${carrito.campoCantidadPax}.border-danger`).first();
      await conResaltado(page, page.locator(carrito.campoCantidadPax).first(), 'Cantidad marcada en rojo', async () => {
        await expect(marcado, 'La cantidad vacia tiene que quedar marcada en rojo')
          .toBeVisible({ timeout: 30_000 });
      });
    });

    await paso(page, 'Dejar el carrito vacio', async () => {
      // El carrito vive del lado del servidor y viaja en la cookie de sesion: lo
      // que quede aca aparece en la corrida siguiente.
      await carrito.vaciar();
      await expect
        .poll(() => carrito.paxEnElCarrito(), { timeout: 30_000 })
        .toBe(0);
    });
  });
});
