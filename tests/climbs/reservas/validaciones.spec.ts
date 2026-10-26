import { test, expect, Locator } from '@playwright/test';
import { PortalNuevoPage } from '../../../pages/climbs/portal.page';
import { paso, adjuntarTexto, fechaDeBusqueda, reiniciarNumeracionDePasos, conResaltado } from '../../../utils/pasos';
import { SERVICIO_DE_REGRESION } from '../comun/precondiciones';
import { pasajerosDePrueba } from './reservas-comun';

/**
 * RESERVAS — app nueva (ClimbsApp). Casos negativos del checkout.
 *
 * El mismo test que tests/bloque-b/validaciones.spec.ts, con el mismo titulo: que el portal
 * rechace lo que no debe permitir emitir. **No emite ninguna reserva**: llega al checkout,
 * prueba cada rechazo y vacia el carrito.
 *
 * Diferencias de forma con el portal actual, que no cambian lo que se protege:
 * - Sin aceptar los terminos, "Reservar" no esta deshabilitado: al presionarlo avisa que hay
 *   que aceptarlos y no emite. Se exige eso (no emitir y avisar), no el boton deshabilitado.
 * - Con la cantidad vacia, el aviso es el de "cantidad menor" y no uno propio de campo vacio;
 *   bloquea y marca el campo igual. Queda adjunto como observacion.
 */
test.describe('Reservas — validaciones', () => {
  test.beforeEach(() => reiniciarNumeracionDePasos());

  test('Checkout: el portal no deja emitir una reserva incompleta', async ({ page }) => {
    test.setTimeout(600_000);
    const portal = new PortalNuevoPage(page);
    const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const AVISO_DE_CAMPOS_EN_ROJO = /Revis[aeá] los datos de los pasajeros: hay campos incompletos o con errores, marcados en rojo/;
    const AVISO_DE_CANTIDAD = /La cantidad de pasajeros es menor a los pasajeros cargados/;
    const AVISO_DE_TERMINOS = /aceptar los t[eé]rminos y condiciones/i;
    const reservar = page.getByRole('button', { name: 'Reservar', exact: true });
    const cantidad = page.getByRole('spinbutton', { name: /^Cantidad de pasajeros/ });
    const grupos = page.getByRole('group').filter({ has: page.getByRole('textbox', { name: 'Pasaporte', exact: true }) });
    let cantidadPax = 0;

    /** El aviso del checkout (rol alert) que trae ese texto; se lee en el momento. */
    const esperarAviso = async (texto: RegExp, etiqueta: string, noDebeDecir?: RegExp): Promise<string> => {
      const aviso = page.getByRole('alert').filter({ hasText: texto }).last();
      let leido = '';
      await conResaltado(page, page.locator('main'), etiqueta, async () => {
        await expect(aviso, `El portal tiene que avisar ${texto}`).toBeVisible({ timeout: 30_000 });
        leido = (await aviso.innerText()).replace(/\s+/g, ' ').trim();
      });
      await adjuntarTexto(etiqueta, leido || '(no aparecio)');
      if (noDebeDecir) expect(leido, `El aviso tiene que ser solo por ${texto}`).not.toMatch(noDebeDecir);
      return leido;
    };

    /** Presiona Reservar y exige que la reserva **no** se emita. */
    const intentarConfirmar = async () => {
      await reservar.click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'Reserva enviada' }), 'Rechazada la validacion, el portal no tiene que emitir la reserva').toHaveCount(0);
      await expect(page, 'Rechazada la validacion, el portal tiene que quedarse en los datos de la reserva').toHaveURL(/\/site\/checkout/);
    };

    const marcadoEnRojo = async (campo: Locator, etiqueta: string, porque: string) => {
      await conResaltado(page, campo, etiqueta, async () => {
        await expect(campo, porque).toHaveAttribute('aria-invalid', 'true', { timeout: 30_000 });
      });
    };

    await paso(page, 'Armar el carrito con un servicio y llegar al checkout', async () => {
      await portal.vaciarCarrito();
      await portal.buscarServicios(fechaDeBusqueda());
      await portal.elegirServicio(SERVICIO_DE_REGRESION.termino, SERVICIO_DE_REGRESION.nombre);
      cantidadPax = await portal.minimoDePasajeros(SERVICIO_DE_REGRESION.modalidad);
      // El caso de "menos pax que los cargados" necesita al menos dos pasajeros.
      expect(cantidadPax, 'El servicio elegido tiene que pedir al menos dos pasajeros para poder probar la validacion de cantidad').toBeGreaterThan(1);
      await portal.agregarAlCarrito(SERVICIO_DE_REGRESION.modalidad, cantidadPax);
      await portal.reservarDesdeElCarrito(`AUTO-QA ${sello}`, `Validaciones de regresion automatica ${sello}. No operar.`);
      await adjuntarTexto('Carrito armado', `${SERVICIO_DE_REGRESION.nombre} | ${cantidadPax} pax`);
    });

    await paso(page, 'Intentar confirmar con un pasajero sin apellido', async () => {
      // Se cargan todos los pasajeros y despues se vacia el apellido del primero: asi el
      // unico motivo del rechazo es ese campo.
      await portal.completarDatosDeLaReserva(pasajerosDePrueba(cantidadPax, sello), `Validaciones ${sello}`);
      const apellido = grupos.nth(0).getByRole('textbox', { name: /^Apellido/ });
      await apellido.fill('');
      await intentarConfirmar();
      await esperarAviso(AVISO_DE_CAMPOS_EN_ROJO, 'Aviso por campo vacio');
      // El aviso no alcanza: la pantalla tiene que senalar cual es el campo.
      await marcadoEnRojo(apellido, 'Campo marcado en rojo', 'El apellido vacio tiene que quedar marcado en rojo');
    });

    await paso(page, 'Intentar confirmar con menos pasajeros que los cargados', async () => {
      await grupos.nth(0).getByRole('textbox', { name: /^Apellido/ }).fill(pasajerosDePrueba(1, sello)[0].apellido);
      await cantidad.fill(String(cantidadPax - 1));
      await intentarConfirmar();
      await esperarAviso(AVISO_DE_CANTIDAD, 'Aviso por cantidad menor', AVISO_DE_CAMPOS_EN_ROJO);
    });

    await paso(page, 'Intentar confirmar con la cantidad de pasajeros vacia', async () => {
      await cantidad.fill('');
      await intentarConfirmar();
      const leido = await esperarAviso(/cantidad de pasajeros/i, 'Aviso por cantidad vacia', AVISO_DE_CAMPOS_EN_ROJO);
      if (!/Complet/i.test(leido)) {
        await adjuntarTexto('OBSERVACION', `Con la cantidad vacia el aviso es "${leido}" (el portal actual dice "Completá la cantidad de pasajeros"). Bloquea y marca el campo igual.`);
      }
      await marcadoEnRojo(cantidad, 'Cantidad marcada en rojo', 'La cantidad vacia tiene que quedar marcada en rojo');
    });

    await paso(page, 'Verificar que sin aceptar los terminos no se pueda confirmar', async () => {
      // Con todo lo demas valido, el unico motivo del rechazo son los terminos.
      await cantidad.fill(String(cantidadPax));
      const terminos = page.getByRole('checkbox', { name: 'Acepto los términos y condiciones' });
      await terminos.uncheck();
      if (await reservar.isDisabled()) {
        await adjuntarTexto('Reservar sin terminos', 'Deshabilitado, como en el portal actual');
      } else {
        await intentarConfirmar();
        await esperarAviso(AVISO_DE_TERMINOS, 'Aviso por terminos sin aceptar');
      }
      await terminos.check();
      await expect(reservar, 'Aceptados los terminos, Reservar tiene que quedar habilitado').toBeEnabled();
    });

    await paso(page, 'Dejar el carrito vacio', async () => {
      await portal.vaciarCarrito();
      await expect.poll(() => portal.itemsEnElCarrito(), { timeout: 30_000 }).toBe(0);
    });
  });
});
