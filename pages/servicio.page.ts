import { Page, Locator, expect } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

/**
 * Flujo de reserva de un servicio suelto, desde INICIO hasta el carrito.
 *
 *   INICIO / solapa SERVICIOS -> serviceall.aspx -> servicedetail.aspx -> carrito
 *
 * Referencias:
 *   Online/Module/ServiceSearchControl.ascx  -> ddServicesCountry / ddServicesCity /
 *                                               ddServicesType / txtServicesCalendar / btnSearch
 *   Online/ServiceAll.aspx                   -> cards con link a servicedetail.aspx
 *   Online/ServiceDetail.aspx                -> txtServicesDetailCalendar, lvServiceRates, lnkBookService
 */
export class ServicioPage {
  constructor(private readonly page: Page) {}

  // --- Buscador de la solapa SERVICIOS ---
  readonly comboPais  = "[id$='_ddServicesCountry']";
  readonly comboCiudad = "[id$='_ddServicesCity']";
  readonly comboTipo  = "[id$='_ddServicesType']";
  readonly campoFecha = '#txtServicesCalendar';
  readonly hiddenFecha = "[id$='_hiddenServicesCalendar']";
  readonly btnBuscar  = "[id$='_btnSearch']";

  // --- Ficha del servicio ---
  readonly campoFechaFicha  = '#txtServicesDetailCalendar';
  readonly hiddenFechaFicha = "[id$='hiddenServicesDetailCalendar']";
  readonly btnReservar      = "[id$='lnkBookService']";

  /**
   * Elige una fecha abriendo el calendario y clickeando el dia, como en la
   * pantalla.
   *
   * No se escribe la fecha en el campo: el control es un daterangepicker que al
   * perder el foco reescribe el input con su propia fecha de inicio y vuelve a
   * disparar el onchange, asi que el valor tipeado se pierde. Comprobado contra
   * QA: cargando 08/09 a mano, el hidden quedaba en 08/09 pero la busqueda salia
   * con la fecha del dia. El clic en el dia es ademas lo que hace una persona.
   */
  async elegirFecha(campo: string, hidden: string, fecha: Date) {
    await this.page.locator(campo).click();
    const picker = this.page.locator('.daterangepicker:visible').first();
    await expect(picker).toBeVisible();

    // El picker se abre con showDropdowns, asi que el mes y el anio se eligen en
    // sus combos y despues se clickea el dia. Sin esto solo se podria reservar
    // dentro del mes en curso.
    const combosMes = picker.locator('select.monthselect');
    if (await combosMes.count()) {
      await combosMes.first().selectOption(String(fecha.getMonth()));
      await picker.locator('select.yearselect').first().selectOption(String(fecha.getFullYear()));
    }

    const dia = String(fecha.getDate());
    await picker.locator('td.available:not(.off)')
      .filter({ hasText: new RegExp(`^${dia}$`) }).first().click();

    // autoApply cierra el calendario solo; el hidden es lo que viaja al servidor.
    await expect(this.page.locator(hidden)).not.toHaveValue('');
  }

  /** Completa el buscador de la solapa SERVICIOS y presiona Buscar. */
  async buscar(opciones: {
    panel: Locator; pais: string; ciudad: string; tipo: string; fecha: Date;
  }) {
    const { panel, pais, ciudad, tipo, fecha } = opciones;

    await this.page.locator(this.comboPais).selectOption({ label: pais });
    await esperarFinDeCarga(this.page);        // el pais hace AutoPostBack y recarga Ciudad
    await this.page.locator(this.comboCiudad).selectOption({ label: ciudad });
    await this.page.locator(this.comboTipo).selectOption({ label: tipo });

    await this.elegirFecha(this.campoFecha, this.hiddenFecha, fecha);

    // El boton se acota al panel de la solapa: los cuatro buscadores comparten
    // el sufijo btnSearch y el primero del documento es el de Multidestino.
    await panel.locator(this.btnBuscar).first().click();
    await this.page.waitForURL(/serviceall/i, { timeout: 90_000 });
    await esperarFinDeCarga(this.page);
  }

  // --- Buscador por nombre de la pantalla de resultados (ServiceAll.aspx:38) ---
  // Es un TomSelect, igual que el del tarifario: renombra el <select id="X"> a
  // input #X-ts-control y opciones #X-opt-N.
  readonly buscadorControl  = '#svcNameSearch-ts-control';
  readonly buscadorOpciones = "[id^='svcNameSearch-opt-']";

  /**
   * Ubica el servicio con el buscador por nombre de la pantalla de resultados.
   *
   * Hace falta: el listado pagina de a 10 con scroll infinito, asi que un item
   * cualquiera no esta en la primera pagina. Es ademas lo que hace una persona
   * que sabe cual quiere, y el mismo recorrido que ya usa el Bloque A.
   */
  async buscarPorNombre(termino: string, nombreEsperado?: string) {
    const objetivo = nombreEsperado ?? termino;
    const control = this.page.locator(this.buscadorControl);
    await control.click();
    await control.fill('');
    await control.pressSequentially(termino, { delay: 30 });

    const opciones = this.page.locator(this.buscadorOpciones);
    await expect(opciones.first()).toBeVisible({ timeout: 30_000 });

    const elegida = opciones.filter({ hasText: objetivo }).first();
    if (!(await elegida.count())) {
      const disponibles = await opciones.allInnerTexts();
      throw new Error(
        `El buscador no ofrecio "${objetivo}" al tipear "${termino}". ` +
        `Opciones ofrecidas: ${disponibles.slice(0, 15).join(' | ')}`,
      );
    }
    await elegida.click();
    await esperarFinDeCarga(this.page);
  }

  /**
   * La card del listado, ubicada por el titulo.
   *
   * El h4 corta el nombre a 27 caracteres (`Name.Limit(27)` en ServiceAll.aspx:95),
   * asi que se compara por prefijo y no por igualdad: "AUTO-QA NO TOCAR - Tigre
   * y Delta" se muestra como "AUTO-QA NO TOCAR - Tigre y..".
   */
  card(prefijoDelNombre: string): Locator {
    return this.page.locator('div.panelShadow')
      .filter({ has: this.page.locator('h4.h4Span', { hasText: prefijoDelNombre }) });
  }

  /** Entra a la ficha desde la card, por el boton "Ver mas". */
  async abrirFicha(prefijoDelNombre: string) {
    await this.card(prefijoDelNombre).first()
      .locator("a[href*='servicedetail.aspx']").last().click();
    await this.page.waitForURL(/servicedetail/i, { timeout: 90_000 });
    await esperarFinDeCarga(this.page);
  }
}
