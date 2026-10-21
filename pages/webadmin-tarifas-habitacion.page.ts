import { Page, expect, Locator } from '@playwright/test';
import { esperarFinDeCarga } from '../utils/pasos';

export type Corte = {
  desde: string; hasta: string; sgl: number | null; dbl: number | null; tpl: number | null;
  extendida: string; origen: string | null;
};

/**
 * WebAdmin (BaseCamp): tarifas de una habitacion (`administration/rooms/detail.aspx`).
 *
 * - Solapa Tarifas (`pnlRoomRates`, RoomRateControl): "Generar Tarifario" y el
 *   modal "Extender Tarifas".
 * - Solapa Tarifario (`pnlTariffs`, RoomTarrifCutControl): la grilla de cortes,
 *   con la columna "Tarifa Extendida" y el corte de origen en el tooltip.
 */
export class WebAdminTarifasHabitacionPage {
  constructor(private readonly page: Page) {}

  private readonly control = '[id$="pnlRoomRates_ctrlRoomRateControl_';
  private sel(id: string) { return `${this.control}${id}"]`; }

  readonly modal = '#extendRatesModal';
  readonly filasDelModal = '#extendRatesCutsBody tr[data-index]';
  readonly avisoPisar = '#extendRatesOverwrite';
  readonly errorDelModal = '#extendRatesError';
  readonly grillaTarifario = '[id$="ctrlRoomTarrifCutControl_gvwRates"]';

  /**
   * Presiona `boton` y devuelve el aviso que muestra la pantalla al volver del
   * PostBack. El aviso se va solo a los pocos segundos: se lo empieza a buscar antes
   * del clic, no despues de esperar la recarga.
   */
  private async clicConAviso(boton: Locator, aviso: RegExp, que: string): Promise<string> {
    await boton.click();
    // Se consulta cada 300 ms en vez de esperar la recarga: el PostBack recarga la
    // pagina (una espera en el navegador se cortaria) y el aviso se va solo.
    let texto: string | null = null;
    const limite = Date.now() + 120_000;
    while (!texto && Date.now() < limite) {
      const cuerpo = await this.page.locator('body').innerText({ timeout: 2_000 }).catch(() => '');
      texto = cuerpo.match(new RegExp(aviso.source, 'i'))?.[0] ?? null;
      if (!texto) await this.page.waitForTimeout(300);
    }
    expect(texto, que).not.toBeNull();
    await esperarFinDeCarga(this.page);
    return texto!.trim();
  }

  async abrir(room: number, solapa: 'pnlRoomRates' | 'pnlTariffs') {
    await this.page.goto(`/administration/rooms/detail.aspx?room=${room}&TabID=${solapa}`);
    await esperarFinDeCarga(this.page);
    await expect(this.page.locator('[id$="RoomTabContainer_pnlRoomRates"], [id$="RoomTabContainer_pnlTariffs"]').first(),
      'La ficha de la habitacion tiene que cargar').toBeAttached();
  }

  /** "Generar Tarifario" con su confirmacion: rearma los cortes desde las tarifas. */
  async generarTarifario(room: number) {
    await this.abrir(room, 'pnlRoomRates');
    await this.page.locator(this.sel('btnCreateTariffs')).click();
    const si = this.page.locator(this.sel('cbCreate_btnYES'));
    await expect(si, 'Generar Tarifario tiene que pedir confirmacion').toBeVisible();
    await Promise.all([this.page.waitForLoadState('load'), si.click()]);
    await esperarFinDeCarga(this.page);
  }

  /** Cortes de la solapa Tarifario, en la vista por pax (la que trae por defecto). */
  async cortesDelTarifario(room: number): Promise<Corte[]> {
    await this.abrir(room, 'pnlTariffs');
    const grilla = this.page.locator(this.grillaTarifario);
    await expect(grilla, 'El Tarifario tiene que mostrar la grilla de cortes').toBeVisible();
    const filas = await grilla.locator('tr').evaluateAll((trs) => trs.slice(1).map((tr) => {
      const celdas = Array.from(tr.querySelectorAll('td'));
      const texto = (i: number) => (celdas[i]?.textContent ?? '').replace(/\s+/g, ' ').trim();
      // El tooltip viene como `title` y el script de la pantalla lo pasa a `data-tooltip`.
      const span = celdas[5]?.querySelector('span[title], span[data-tooltip]');
      const tooltip = span?.getAttribute('data-tooltip') ?? span?.getAttribute('title') ?? null;
      return [texto(0), texto(1), texto(2), texto(3), texto(4), texto(5), tooltip];
    }));
    return filas.filter((f) => /\d{2}\/\d{2}\/\d{4}/.test(f[0] ?? '')).map((f) => ({
      desde: f[0]!, hasta: f[1]!,
      sgl: importe(f[2]!), dbl: importe(f[3]!), tpl: importe(f[4]!),
      extendida: f[5]!, origen: f[6],
    }));
  }

  /**
   * "Gestion de Tarifas": carga un rango de fechas con un importe POR HABITACION por
   * tipo (1 Single, 2 Doble, 3 Triple, 20 Menores), todos los dias de la semana.
   * Pisa lo que hubiera en el rango. Devuelve el mensaje que muestra la pantalla.
   */
  async cargarTarifas(room: number, desde: string, hasta: string, porTipo: Record<number, number>): Promise<string> {
    await this.abrir(room, 'pnlRoomRates');
    await this.fecha('ctrlFromDate', desde);
    await this.fecha('ctrlToDate', hasta);
    await expect(this.page.locator(this.sel('hfWeekdays')), 'Tienen que quedar elegidos todos los dias').toHaveValue('1111111');
    const ids = await this.page.locator('[id*="ctrlRoomRateControl_lvTarifas"][id$="hfID"]').evaluateAll((hs) =>
      hs.map((h) => ({ id: h.id, tipo: Number((h as HTMLInputElement).value) })));
    for (const { id, tipo } of ids) {
      const valor = porTipo[tipo];
      expect(valor, `Falta el importe del tipo de tarifa ${tipo}`).not.toBeUndefined();
      const campo = this.page.locator(`#${id.replace(/hfID$/, 'txtTarifa_txtValue')}`);
      await campo.fill(String(valor).replace('.', ','));
    }
    return this.clicConAviso(this.page.locator(this.sel('btnSave')), /Se guardaron \d+ items/,
      'Guardar tiene que informar cuantas tarifas guardo');
  }

  /** "Eliminar tarifas por rango de fechas": borra las tarifas del rango, todos los dias. */
  async eliminarTarifas(room: number, desde: string, hasta: string): Promise<string> {
    await this.abrir(room, 'pnlRoomRates');
    await this.fecha('ctrlFromDate', desde);
    await this.fecha('ctrlToDate', hasta);
    const interruptor = this.page.locator(this.sel('cdDeleteTariffs'));
    if (!(await interruptor.isChecked())) await interruptor.click({ force: true });
    await expect(this.page.locator(this.sel('btnDelete')), 'El boton Eliminar se habilita con el interruptor').toBeEnabled();
    await this.page.locator(this.sel('btnDelete')).click();
    const confirmar = this.page.locator(this.sel('confirmBoxDelete_btnYES'));
    await expect(confirmar, 'Eliminar tiene que pedir confirmacion').toBeVisible();
    return this.clicConAviso(confirmar, /Se borraron \d+ items/, 'Eliminar tiene que informar cuantas tarifas borro');
  }

  /** "Freesale": deja el cupo de cada dia del rango en `cupo`. */
  async guardarCupo(room: number, desde: string, hasta: string, cupo: number) {
    await this.abrir(room, 'pnlRoomRates');
    // Desde la HU 4949 la pantalla tiene dos solapas: "Gestion de tarifas" y "Actualizar
    // Freesale". El cupo y sus fechas viven en la segunda, asi que hay que abrirla primero.
    const solapaFreesale = this.page.locator('[data-pane="ratePaneFreesale"]');
    await solapaFreesale.click();
    await expect(this.page.locator(this.sel('txtFreesale_txtValue')), 'La solapa Freesale tiene que mostrar el campo de cupo')
      .toBeVisible({ timeout: 15_000 });
    await this.fecha('ctrlFromDateFs', desde);
    await this.fecha('ctrlToDateFs', hasta);
    await this.page.locator(this.sel('txtFreesale_txtValue')).fill(String(cupo));
    await this.clicConAviso(this.page.locator(this.sel('btnFreesale')), /Los datos se guardaron correctamente/,
      'Guardar Freesale tiene que confirmar');
  }

  /** Solapa Detalle: tilda o destilda "Publicado" y guarda la habitacion. */
  async publicarHabitacion(room: number, publicada: boolean) {
    await this.guardarDetalle(room, { publicada });
  }

  /**
   * Solapa Detalle: deja "Publicado" y "Tiene freesale" como se pide y guarda.
   * Sin freesale, el formulario de cupo de la solapa Tarifas queda deshabilitado.
   */
  /** El regimen de comidas de la habitacion (`ddlMealType`): el valor y el texto elegidos. */
  async regimen(room: number): Promise<{ valor: string; texto: string }> {
    await this.page.goto(`/administration/rooms/detail.aspx?room=${room}`);
    await esperarFinDeCarga(this.page);
    const combo = this.page.locator('[id$="pnlRoomDetails_ddlMealType"]');
    return { valor: await combo.inputValue(), texto: (await combo.locator('option:checked').innerText()).trim() };
  }

  /**
   * Guarda la solapa de datos con los cambios pedidos. `regimen` es el valor de
   * `ddlMealType` ("" = Seleccione, que guarda la habitacion sin regimen).
   */
  async guardarDetalle(room: number, cambios: { publicada?: boolean; freesale?: boolean; regimen?: string }) {
    await this.page.goto(`/administration/rooms/detail.aspx?room=${room}`);
    await esperarFinDeCarga(this.page);
    const comboRegimen = this.page.locator('[id$="pnlRoomDetails_ddlMealType"]');
    if (cambios.regimen !== undefined) await comboRegimen.selectOption(cambios.regimen);
    const checks = {
      publicada: this.page.locator('[id$="pnlRoomDetails_cbPublicado"]'),
      freesale: this.page.locator('[id$="pnlRoomDetails_cbHasFreesale"]'),
    };
    for (const clave of ['publicada', 'freesale'] as const) {
      const valor = cambios[clave];
      if (valor === undefined) continue;
      const check = checks[clave];
      await expect(check).toBeAttached();
      if ((await check.isChecked()) !== valor) {
        await check.click();
        // Si la habitacion esta en un paquete no se puede despublicar: el sistema
        // vuelve a tildar el check y abre un modal. La de prueba no esta en ninguno.
        await expect(check, `"${clave}" tiene que quedar ${valor ? 'tildado' : 'destildado'}`).toBeChecked({ checked: valor });
      }
    }
    await Promise.all([this.page.waitForLoadState('load'), this.page.locator('[id$="pnlRoomDetails_btnSave"]').click()]);
    await esperarFinDeCarga(this.page);
    await this.page.goto(`/administration/rooms/detail.aspx?room=${room}`);
    await esperarFinDeCarga(this.page);
    for (const clave of ['publicada', 'freesale'] as const) {
      const valor = cambios[clave];
      if (valor === undefined) continue;
      await expect(checks[clave], `La habitacion tiene que quedar con "${clave}" en ${valor}`).toBeChecked({ checked: valor });
    }
    if (cambios.regimen !== undefined) {
      await expect(comboRegimen, 'La habitacion tiene que quedar con el regimen elegido').toHaveValue(cambios.regimen);
    }
  }

  /**
   * Solapa Observaciones (`pnlTariffDetails`, RoomTariffCutDetailControl): el texto
   * de un periodo que el portal muestra debajo de las fechas del corte. Se entra con
   * `observationFrom/observationTo` en la URL, como el boton "Crear" del Tarifario,
   * que precarga las fechas. El texto es obligatorio en todos los idiomas: es un
   * textarea por idioma, cada uno en su solapa (MultiLanguageQuillEditor en texto plano).
   *
   * Devuelve el error de la pantalla si lo hay (por ejemplo un periodo superpuesto),
   * o null si guardo.
   */
  async crearObservacion(room: number, desdeISO: string, hastaISO: string, texto: string): Promise<string | null> {
    await this.page.goto(`/administration/rooms/detail.aspx?room=${room}&TabID=pnlTariffDetails&observationFrom=${desdeISO}&observationTo=${hastaISO}`);
    await esperarFinDeCarga(this.page);
    const panel = this.page.locator('div[id$="_pnlTariffDetails"]');
    const [a, m, d] = desdeISO.split('-');
    await expect(panel.locator('[id$="ctrlDateFrom_txtDateTime"]'), 'El periodo tiene que venir precargado')
      .toHaveValue(`${d}/${m}/${a}`);
    const idiomas = panel.locator('a.tab-link');
    const n = await idiomas.count();
    expect(n, 'El editor tiene que ofrecer al menos un idioma').toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await idiomas.nth(i).click();
      await panel.locator('textarea[id$="txtPlain"]').filter({ visible: true }).first().fill(texto);
    }
    await panel.locator('[id$="btnNewTariffCutDetail"]').click();
    await esperarFinDeCarga(this.page);
    const error = this.page.locator('.messageBox.messageBoxError').filter({ visible: true });
    if (await error.count()) return (await error.first().innerText()).trim();
    return null;
  }

  /** Las filas de la grilla de observaciones: Desde | Hasta | Detalle. */
  async observaciones(room: number): Promise<string[][]> {
    await this.page.goto(`/administration/rooms/detail.aspx?room=${room}&TabID=pnlTariffDetails`);
    await esperarFinDeCarga(this.page);
    const filas = this.page.locator('div[id$="_pnlTariffDetails"] [id$="gvwDetails"] tr').filter({ has: this.page.locator('td') });
    const out: string[][] = [];
    for (const f of await filas.all()) out.push((await f.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim()));
    return out;
  }

  /** Borra la observacion del periodo que empieza en `desde` (dd/mm/aaaa), en todos sus idiomas. */
  async borrarObservacion(room: number, desde: string) {
    await this.page.goto(`/administration/rooms/detail.aspx?room=${room}&TabID=pnlTariffDetails`);
    await esperarFinDeCarga(this.page);
    const fila = this.page.locator('div[id$="_pnlTariffDetails"] [id$="gvwDetails"] tr').filter({ hasText: desde }).first();
    if (!(await fila.count())) return;
    await fila.locator('[id$="lnkDelete"]').click();
    await esperarFinDeCarga(this.page);
  }

  async abrirExtender(room: number) {
    await this.abrir(room, 'pnlRoomRates');
    await this.page.locator(this.sel('btnExtendRates')).click();
    await expect(this.page.locator(this.modal), 'Tiene que abrirse el modal Extender Tarifas').toHaveClass(/is-open/);
    // El listado de cortes se trae por AJAX al abrir el modal.
    await expect(this.page.locator(this.filasDelModal).first(), 'El modal tiene que listar los cortes').toBeVisible({ timeout: 60_000 });
  }

  async cortesDelModal(): Promise<string[][]> {
    return this.page.locator(this.filasDelModal).evaluateAll((trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('td')).slice(1).map((td) => (td.textContent ?? '').trim())));
  }

  filaDelModal(desde: string, hasta: string): Locator {
    return this.page.locator(this.filasDelModal)
      .filter({ has: this.page.locator('td:nth-child(2)', { hasText: desde }) })
      .filter({ has: this.page.locator('td:nth-child(3)', { hasText: hasta }) });
  }

  async elegirCorte(desde: string, hasta: string) {
    const fila = this.filaDelModal(desde, hasta);
    await expect(fila, `El modal tiene que listar el corte ${desde} - ${hasta}`).toHaveCount(1);
    await fila.click();
    await expect(fila, 'El corte elegido tiene que quedar marcado').toHaveClass(/selected/);
  }

  async completar(desde: string, hasta: string, porcentaje: string) {
    await this.fecha('ctrlExtendFrom', desde);
    await this.fecha('ctrlExtendTo', hasta);
    const pct = this.page.locator(this.sel('txtExtendPercentage'));
    await pct.fill('');
    // Se tipea para que corran los oninput del campo: el tope de 100 y la vista previa.
    await pct.pressSequentially(porcentaje);
  }

  private async fecha(control: string, valor: string) {
    const campo = this.page.locator(this.sel(`${control}_txtDateTime`));
    // Es un flatpickr que interpreta lo tipeado recien al perder el foco, y en el
    // camino descartaba la fecha: se la carga con su propia API, como si se eligiera
    // el dia en el calendario (dispara el change igual).
    await campo.evaluate((el, v) => {
      const fp = (el as any)._flatpickr;
      if (fp) fp.setDate(v, true, 'd/m/Y');
      else (el as HTMLInputElement).value = v;
    }, valor);
    await expect(campo, `La fecha ${valor} tiene que quedar cargada`).toHaveValue(valor);
  }

  async porcentajeCargado(): Promise<string> {
    return this.page.locator(this.sel('txtExtendPercentage')).inputValue();
  }

  async vistaPrevia(): Promise<{ sgl: string; dbl: string; tpl: string }> {
    const leer = (id: string) => this.page.locator(`#${id}`).innerText().then((t) => t.trim());
    return { sgl: await leer('extendPreviewSGL'), dbl: await leer('extendPreviewDBL'), tpl: await leer('extendPreviewTPL') };
  }

  /**
   * Presiona Aceptar. Si ya hay tarifas en el rango aparece el aviso de que se van
   * a pisar y no se envia nada todavia: devuelve `true` y deja el aviso abierto.
   * Si no, el sistema guarda y redirige al Tarifario.
   */
  async aceptar(): Promise<boolean> {
    await this.page.locator(this.sel('btnExtendConfirm')).click();
    const aviso = this.page.locator(this.avisoPisar);
    const resultado = await Promise.race([
      expect(aviso).toHaveClass(/is-open/, { timeout: 60_000 }).then(() => 'aviso' as const),
      this.page.waitForURL(/extended=/, { timeout: 120_000 }).then(() => 'guardado' as const),
    ]);
    if (resultado === 'guardado') await esperarFinDeCarga(this.page);
    return resultado === 'aviso';
  }

  async textoDelAviso(): Promise<string> {
    return (await this.page.locator('#extendRatesOverwriteText').innerText()).trim();
  }

  async pisar() {
    await Promise.all([
      this.page.waitForURL(/extended=/, { timeout: 120_000 }),
      this.page.locator(this.avisoPisar).getByRole('button', { name: 'Pisar las tarifas' }).click(),
    ]);
    await esperarFinDeCarga(this.page);
  }

  async cancelarAviso() {
    await this.page.locator(this.avisoPisar).getByRole('button', { name: 'Cancelar' }).click();
    await expect(this.page.locator(this.avisoPisar)).not.toHaveClass(/is-open/);
  }

  /** Aceptar y, si avisa que pisa tarifas (corridas anteriores), confirmar. */
  async extender(): Promise<void> {
    if (await this.aceptar()) await this.pisar();
    await expect(this.page, 'Despues de extender tiene que volver a la solapa Tarifario').toHaveURL(/TabID=pnlTariffs/i);
  }
}

/** "1.234,56", "72,60", "500" -> numero; "-" o vacio -> null. */
function importe(texto: string): number | null {
  const limpio = texto.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(limpio)) return null;
  return Number(limpio.replace(/\./g, '').replace(',', '.'));
}
