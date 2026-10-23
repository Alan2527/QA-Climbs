# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bloque-c/movimientos-entre-cajas.spec.ts >> Movimientos entre cajas >> Movimiento entre sucursales: la entrada vive en la caja destino, se ve en solo lectura y no se copia
- Location: tests/bloque-c/movimientos-entre-cajas.spec.ts:345:7

# Error details

```
Error: La baja de una caja con movimientos de otra sucursal tiene que bloquearse con un cartel

expect(locator).toBeVisible() failed

Locator:  locator('.sweet-alert.visible').filter({ hasText: 'No es posible eliminar la caja' }).last()
Expected: visible
Received: hidden
Timeout:  60000ms

Call log:
  - La baja de una caja con movimientos de otra sucursal tiene que bloquearse con un cartel with timeout 60000ms
  - waiting for locator('.sweet-alert.visible').filter({ hasText: 'No es posible eliminar la caja' }).last()
    115 × locator resolved to <div data-timer="null" data-custom-class="" data-animation="pop" data-has-done-function="true" data-has-cancel-button="false" data-has-confirm-button="true" data-allow-outside-click="false" class="sweet-alert showSweetAlert visible">…</div>
        - unexpected value "hidden"

```

```yaml
- text: Sherpa
- textbox "Buscar pantalla"
- text: Ctrl K
- navigation:
  - list:
    - listitem:
      - link "Principal":
        - /url: https://qa.bo.amv.travel/main
    - listitem:
      - link "Reservas":
        - /url: javascript:void(0);
      - list:
        - listitem:
          - heading "Online" [level=5]
        - listitem:
          - link "Reservas":
            - /url: https://qa.bo.amv.travel/booking/files/inbox/10
        - listitem:
          - link "Cotizaciones":
            - /url: https://qa.bo.amv.travel/booking/files/inbox/20
        - listitem:
          - heading "Files" [level=5]
        - listitem:
          - link "Files":
            - /url: https://qa.bo.amv.travel/booking/files/all
        - listitem:
          - link "Cancelados":
            - /url: https://qa.bo.amv.travel/booking/files/cancelled-all
        - listitem:
          - link "Nuevo File":
            - /url: https://qa.bo.amv.travel/booking/files/managefile/new/status/10
        - listitem:
          - link "Venta de Opcionales":
            - /url: https://qa.bo.amv.travel/booking/files/optional-tours
        - listitem:
          - heading "Tarifarios" [level=5]
        - listitem:
          - link "Hoteles":
            - /url: https://qa.bo.amv.travel/booking/tariffs/hotels
        - listitem:
          - link "Servicios":
            - /url: https://qa.bo.amv.travel/booking/tariffs/services
        - listitem:
          - link "Serv. por Proveedor":
            - /url: https://qa.bo.amv.travel/booking/tariffs/servicesbysuppliers
        - listitem:
          - link "Serv. Especiales":
            - /url: https://qa.bo.amv.travel/booking/specialservices
        - listitem:
          - link "Observ. Hab.":
            - /url: https://qa.bo.amv.travel/booking/habitualobservations
        - listitem:
          - heading "Reportes" [level=5]
        - listitem:
          - link "Operaciones":
            - /url: https://qa.bo.amv.travel/booking/operators-report
        - listitem:
          - link "Files Vencidos":
            - /url: https://qa.bo.amv.travel/booking/expired-files
    - listitem:
      - link "Facturación":
        - /url: javascript:void(0);
      - list:
        - listitem:
          - heading "Fact. Fiscal" [level=5]
        - listitem:
          - link "Nuevo Compr.":
            - /url: https://qa.bo.amv.travel/invoice-management/fiscal/newinvoice
        - listitem:
          - link "Pendientes":
            - /url: https://qa.bo.amv.travel/invoice-management/fiscal/pending
        - listitem:
          - link "Pendientes T":
            - /url: https://qa.bo.amv.travel/invoice-management/fiscal/pending-tur
        - listitem:
          - link "Emitidos":
            - /url: https://qa.bo.amv.travel/invoice-management/fiscal/issued
        - listitem:
          - link "Reporte":
            - /url: https://qa.bo.amv.travel/invoice-management/fiscal/billing-report
        - listitem:
          - link "Tipos de Cambio":
            - /url: https://qa.bo.amv.travel/administration/exchangerates/all
        - listitem:
          - heading "Invoices" [level=5]
        - listitem:
          - link "Nuevo Compr.":
            - /url: https://qa.bo.amv.travel/invoice-management/invoicing/newinvoice
        - listitem:
          - link "Pendientes":
            - /url: https://qa.bo.amv.travel/invoice-management/invoicing/pending
        - listitem:
          - link "Emitidos":
            - /url: https://qa.bo.amv.travel/invoice-management/invoicing/issued
        - listitem:
          - link "Cartas de Cob.":
            - /url: https://qa.bo.amv.travel/invoice-management/invoicing/issued-letters
    - listitem:
      - link "Administración":
        - /url: javascript:void(0);
      - list:
        - listitem:
          - heading "Clientes" [level=5]
        - listitem:
          - link "Cuentas Corr.":
            - /url: https://qa.bo.amv.travel/administration/accounting/summary
        - listitem:
          - link "Ordenes Cobro":
            - /url: https://qa.bo.amv.travel/administration/chargeorders
        - listitem:
          - link "Ctas. Contables":
            - /url: https://qa.bo.amv.travel/administration/accounting/acc-customers
        - listitem:
          - heading "Proveedores" [level=5]
        - listitem:
          - link "Fact. de Proveed.":
            - /url: https://qa.bo.amv.travel/administration/supplierinvoices
        - listitem:
          - link "Fact. Internas":
            - /url: https://qa.bo.amv.travel/administration/internalinvoices/true
        - listitem:
          - link "Cuentas Corr.":
            - /url: https://qa.bo.amv.travel/administration/accounting/supplier-summary
        - listitem:
          - link "Ordenes Pago":
            - /url: https://qa.bo.amv.travel/administration/payorders
        - listitem:
          - link "Planilla Prepagos":
            - /url: https://qa.bo.amv.travel/administration/prepaid/payroll
        - listitem:
          - heading "Movimientos" [level=5]
        - listitem:
          - link "Gastos & Mov.":
            - /url: https://qa.bo.amv.travel/administration/movements/daily-expenses
        - listitem:
          - link "Cash Flow":
            - /url: https://qa.bo.amv.travel/administration/movements/funding-report
        - listitem:
          - link "Referencias":
            - /url: https://qa.bo.amv.travel/administration/movements/paymentrefs-report
        - listitem:
          - link "Rep. Consolidado":
            - /url: https://qa.bo.amv.travel/administration/movements/cash-flow-report
        - listitem:
          - link "Plantillas":
            - /url: https://qa.bo.amv.travel/administration/movements/templates
        - listitem:
          - heading "Auditoria" [level=5]
        - listitem:
          - link "Items sin asignar":
            - /url: https://qa.bo.amv.travel/administration/unassigned-items
        - listitem:
          - link "Facturas sin asignar":
            - /url: https://qa.bo.amv.travel/administration/unassigned-invoices
        - listitem:
          - link "Ordenes de pago sin asignar":
            - /url: https://qa.bo.amv.travel/administration/unassigned-payorders
    - listitem:
      - link "Mesa de Tráfico":
        - /url: javascript:void(0);
      - list:
        - listitem:
          - link "Traslados & Mov.":
            - /url: https://qa.bo.amv.travel/traffic/manage/all
        - listitem:
          - heading "Pasajeros SIX" [level=5]
        - listitem:
          - link "Pasajeros":
            - /url: https://qa.bo.amv.travel/traffic/passengers
        - listitem:
          - link "Altas":
            - /url: https://qa.bo.amv.travel/traffic/sixsignups
        - listitem:
          - heading "Encuestas SIX" [level=5]
        - listitem:
          - link "Encuestas":
            - /url: https://qa.bo.amv.travel/traffic/surveys
        - listitem:
          - link "Administración":
            - /url: https://qa.bo.amv.travel/traffic/surveyitems
        - listitem:
          - link "Encuestas Globales":
            - /url: https://qa.bo.amv.travel/traffic/passenger-report
    - listitem:
      - link "Series":
        - /url: javascript:void(0);
      - list:
        - listitem:
          - link "Salidas":
            - /url: https://qa.bo.amv.travel/series/departures
        - listitem:
          - link "Tráfico":
            - /url: https://qa.bo.amv.travel/series/trafico/0
    - listitem:
      - link "Agenda & Parám.":
        - /url: javascript:void(0);
      - list:
        - listitem:
          - heading "Clientes" [level=5]
        - listitem:
          - link "Clientes":
            - /url: https://qa.bo.amv.travel/agenda/customers
        - listitem:
          - link "Agencias":
            - /url: https://qa.bo.amv.travel/agenda/agencies
        - listitem:
          - link "Bancos":
            - /url: https://qa.bo.amv.travel/agenda/proceedaccounts
        - listitem:
          - heading "Proveedores" [level=5]
        - listitem:
          - link "Proveedores":
            - /url: https://qa.bo.amv.travel/agenda/suppliers
        - listitem:
          - link "Aerolíneas":
            - /url: https://qa.bo.amv.travel/agenda/airlines
        - listitem:
          - link "Guías":
            - /url: https://qa.bo.amv.travel/agenda/guides
        - listitem:
          - link "Operadores":
            - /url: https://qa.bo.amv.travel/agenda/operators
        - listitem:
          - heading "Geo" [level=5]
        - listitem:
          - link "Países":
            - /url: https://qa.bo.amv.travel/agenda/countries
        - listitem:
          - link "Ciudades":
            - /url: https://qa.bo.amv.travel/agenda/cities
    - listitem:
      - link "Parám. Admin.":
        - /url: javascript:void(0);
      - list:
        - listitem:
          - heading "Prod. & Rubros" [level=5]
        - listitem:
          - link "Productos":
            - /url: https://qa.bo.amv.travel/adminparams/products
        - listitem:
          - link "Rubros":
            - /url: https://qa.bo.amv.travel/adminparams/productstypes
        - listitem:
          - heading "Egresos" [level=5]
        - listitem:
          - link "Categorías":
            - /url: https://qa.bo.amv.travel/adminparams/expensecategoriestype
        - listitem:
          - link "Conceptos":
            - /url: https://qa.bo.amv.travel/adminparams/expensecategories
        - listitem:
          - link "Pagos & Cobros":
            - /url: https://qa.bo.amv.travel/adminparams/paymentrefs
        - listitem:
          - heading "Cash Flow" [level=5]
        - listitem:
          - link "Categorías":
            - /url: https://qa.bo.amv.travel/adminparams/cashflow/categories
        - listitem:
          - link "Conceptos":
            - /url: https://qa.bo.amv.travel/adminparams/cashflow/default
        - listitem:
          - heading "Monedas" [level=5]
        - listitem:
          - link "Monedas":
            - /url: https://qa.bo.amv.travel/adminparams/exchanges/currencies
        - listitem:
          - heading "Cuentas Cont." [level=5]
        - listitem:
          - link "Plan de Cuentas":
            - /url: https://qa.bo.amv.travel/adminparams/ledgeraccounts
        - listitem:
          - heading "Sucursales" [level=5]
        - listitem:
          - link "Sucursales":
            - /url: https://qa.bo.amv.travel/adminparams/branches/default
        - listitem:
          - heading "Empresa" [level=5]
        - listitem:
          - link "Razón Social":
            - /url: https://qa.bo.amv.travel/adminparams/businessesinfo/default
        - listitem
    - listitem:
      - link "Contabilidad":
        - /url: javascript:void(0);
      - list:
        - listitem:
          - heading "IVA" [level=5]
        - listitem:
          - link "Débito Fiscal":
            - /url: https://qa.bo.amv.travel/contabilidad/debitofiscal
        - listitem:
          - link "Crédito Fiscal":
            - /url: https://qa.bo.amv.travel/contabilidad/creditofiscal
        - listitem:
          - link "Períodos Contables":
            - /url: https://qa.bo.amv.travel/contabilidad/fiscal-periods
    - listitem:
      - link "Gerencia":
        - /url: javascript:void(0);
      - list:
        - listitem:
          - heading "Reportes" [level=5]
        - listitem:
          - link "Consolidado":
            - /url: https://qa.bo.amv.travel/management-main/consolidated
        - listitem:
          - link "Por File":
            - /url: https://qa.bo.amv.travel/management-main/files-report
        - listitem:
          - link "Ventas Globales":
            - /url: https://qa.bo.amv.travel/management-main/global-sales
        - listitem:
          - link "Deuda":
            - /url: https://qa.bo.amv.travel/management-main/debt
        - listitem:
          - link "Comisiones":
            - /url: https://qa.bo.amv.travel/management-main/user-profit
        - listitem:
          - link "Egresos":
            - /url: https://qa.bo.amv.travel/management-main/expenses-report
        - listitem:
          - link "Financiero":
            - /url: https://qa.bo.amv.travel/management-main/financial-report
        - listitem:
          - link "Vtas. por Proveedor":
            - /url: https://qa.bo.amv.travel/management-main/supplier-sales
        - listitem:
          - heading "Estadísticas" [level=5]
        - listitem:
          - link "Hotelería":
            - /url: https://qa.bo.amv.travel/management-main/statistics/by-hotel
        - listitem:
          - link "Svcs. por Cliente":
            - /url: https://qa.bo.amv.travel/management-main/statistics/by-customer
        - listitem:
          - link "Svcs. por Proveedor":
            - /url: https://qa.bo.amv.travel/management-main/statistics/by-supplier
    - listitem:
      - link "Sistema":
        - /url: javascript:void(0);
      - list:
        - listitem:
          - heading "Logs" [level=5]
        - listitem:
          - link "Logs":
            - /url: https://qa.bo.amv.travel/system/logviewer
        - listitem:
          - link "Auditoría":
            - /url: https://qa.bo.amv.travel/system/auditlog-viewer
        - listitem:
          - link "Auditoría de acciones":
            - /url: https://qa.bo.amv.travel/system/auditlog-stock
        - listitem:
          - link "Auditoría de tráfico":
            - /url: https://qa.bo.amv.travel/system/auditlog-traffic
        - listitem:
          - heading "Usuarios" [level=5]
        - listitem:
          - link "Usuarios":
            - /url: https://qa.bo.amv.travel/system/users
        - listitem:
          - link "Usuarios Externos":
            - /url: https://qa.bo.amv.travel/system/users-external
        - listitem:
          - link "Roles de Usuarios":
            - /url: https://qa.bo.amv.travel/system/userroles
        - listitem:
          - heading "Configuración" [level=5]
        - listitem:
          - link "Conf. Sistema":
            - /url: https://qa.bo.amv.travel/system/sysconfiguration
- list:
  - listitem:
    - link "Colapsar o expandir el menú":
      - /url: javascript:;
- list:
  - listitem
  - listitem:
    - combobox "Sucursal sobre la que estas trabajando":
      - option "Perú"
      - option "Colombia"
      - option "Mexico"
      - option "Chile"
      - option "Argentina" [selected]
    - combobox:  Argentina
  - listitem:
    - link "pablo@amv.travel":
      - /url: https://qa.bo.amv.travel/management-main/user-profit
  - listitem:
    - link "Cambiar modo claro/oscuro":
      - /url: javascript:void(0);
  - listitem:
    - link "Cerrar sesion":
      - /url: javascript:__doPostBack('ctl00$lnkSignOut','')
- text: Gastos & Movimientos Administración
- link " Apertura":
  - /url: https://qa.bo.amv.travel/administration/movements/daily-cash/0
- heading "Gastos & Movimientos" [level=5]
- text: Sucursal
- combobox:
  - option "Perú"
  - option "Argentina"
  - option "Colombia" [selected]
  - option "Mexico"
  - option "Chile"
- text: 
- searchbox ""
- grid:
  - rowgroup:
    - 'row "ID: activate to sort column ascending Fecha: activate to sort column ascending Apertura: activate to sort column ascending Cierre: activate to sort column ascending Detalle: activate to sort column ascending Estado: activate to sort column ascending B E"':
      - 'columnheader "ID: activate to sort column ascending"': ID ↕
      - 'columnheader "Fecha: activate to sort column ascending"': Fecha ↓
      - 'columnheader "Apertura: activate to sort column ascending"': Apertura ↕
      - 'columnheader "Cierre: activate to sort column ascending"': Cierre ↕
      - 'columnheader "Detalle: activate to sort column ascending"': Detalle ↕
      - 'columnheader "Estado: activate to sort column ascending"': Estado ↕
      - columnheader "B"
      - columnheader "E"
  - rowgroup:
    - row "20261023-RZYQ 23/10/2026 23/10/2026 10:33 Caja de regresion automatica 20261023133332. No operar. ABIERTO  ":
      - gridcell "20261023-RZYQ"
      - gridcell "23/10/2026"
      - gridcell "23/10/2026 10:33"
      - gridcell
      - gridcell "Caja de regresion automatica 20261023133332. No operar."
      - gridcell "ABIERTO"
      - gridcell "":
        - link "":
          - /url: javascript:void(0);
      - gridcell "":
        - link "":
          - /url: https://qa.bo.amv.travel/administration/movements/daily-cash/3261
    - row "20261022-WWJW 22/10/2026 22/10/2026 12:33 Caja de regresion automatica 20261022153341. No operar. ABIERTO  ":
      - gridcell "20261022-WWJW"
      - gridcell "22/10/2026"
      - gridcell "22/10/2026 12:33"
      - gridcell
      - gridcell "Caja de regresion automatica 20261022153341. No operar."
      - gridcell "ABIERTO"
      - gridcell "":
        - link "":
          - /url: javascript:void(0);
      - gridcell "":
        - link "":
          - /url: https://qa.bo.amv.travel/administration/movements/daily-cash/3259
- status: 1 - 2 (2 registros)
- list:
  - listitem:
    - link "←":
      - /url: "#"
  - listitem:
    - link "1":
      - /url: "#"
  - listitem:
    - link "→":
      - /url: "#"
- link:
  - /url: javascript:__doPostBack('ctl00$cphMain$lnkDelete','')
- contentinfo:
  - navigation:
    - list:
      - listitem:
        - link "":
          - /url: javascript:;
  - navigation:
    - list:
      - listitem:
        - link "viernes 23 octubre 2026 17:08":
          - /url: javascript:;
      - listitem: AFIP
      - listitem:
        - link "powered by Climbs":
          - /url: https://amv.travel/
```

# Test source

```ts
  372 |         `${(error as Error).message}`,
  373 |       );
  374 |     }
  375 |     await esperarFinDeCarga(this.page);
  376 |     await this.esperarVelo();
  377 |   }
  378 | 
  379 |   /** Cierra el modal con el boton "Cerrar" del pie. */
  380 |   async cerrarModal() {
  381 |     await this.page.locator(this.btnCerrarModal).click();
  382 |     await expect(this.page.locator(this.modal)).toBeHidden({ timeout: 30_000 });
  383 |     await this.esperarVelo();
  384 |   }
  385 | 
  386 |   // ------------------------------------------------------------------
  387 |   // Baja de un movimiento
  388 |   // ------------------------------------------------------------------
  389 | 
  390 |   /**
  391 |    * Borra el movimiento con la papelera de la fila de origen y la confirmacion
  392 |    * "Sí, eliminar". El borrado es logico y alcanza a las dos filas (`lnkDelete_Command`).
  393 |    *
  394 |    * El clic en "Si, eliminar" mientras el cartel todavia entra lo cierra sin llamar al
  395 |    * callback (medido el 15/10 en las anulaciones): se espera a que termine de abrirse, se
  396 |    * exige que salga el POST `lnkDelete` y, si no sale, se reintenta una vez.
  397 |    */
  398 |   async eliminar(fila: Locator) {
  399 |     const borrado = (r: Request) =>
  400 |       r.method() === 'POST' && /__EVENTTARGET=[^&]*lnkDelete/.test(r.postData() ?? '');
  401 | 
  402 |     for (let intento = 0; intento < 2; intento++) {
  403 |       await fila.locator('a:has(i.ph-trash)').click();
  404 |       const cartel = this.page.locator(this.cartel).last();
  405 |       await expect(cartel, 'El BO tiene que pedir confirmacion antes de eliminar el movimiento')
  406 |         .toBeVisible({ timeout: 30_000 });
  407 |       await this.page.waitForTimeout(500);
  408 |       const post = this.page.waitForRequest(borrado, { timeout: 15_000 }).then(() => true).catch(() => false);
  409 |       await cartel.getByRole('button', { name: /S[ií],\s*eliminar/i }).click();
  410 |       if (await post) {
  411 |         await esperarFinDeCarga(this.page);
  412 |         await this.esperarVelo();
  413 |         return;
  414 |       }
  415 |     }
  416 |     throw new Error('Confirmado el cartel, el BO no envio el borrado del movimiento (no salio el POST lnkDelete)');
  417 |   }
  418 | 
  419 |   // ------------------------------------------------------------------
  420 |   // Modal Copiar movimientos
  421 |   // ------------------------------------------------------------------
  422 | 
  423 |   /**
  424 |    * Abre "Copiar" sobre la caja del dia. Sin fecha el servicio toma hoy
  425 |    * (`FindDailyExpenses`: `DateTime date = DateTime.Today`) y busca la caja de la MISMA
  426 |    * sucursal, asi que lista los movimientos de origen de la caja abierta.
  427 |    */
  428 |   async abrirCopiar() {
  429 |     await this.page.locator(this.btnCopiar).click();
  430 |     await expect(this.page.locator(this.modalCopiar)).toBeVisible({ timeout: 30_000 });
  431 |     await this.page.waitForFunction(() => !!(window as any).tblDailyCashCopy, undefined, { timeout: 30_000 });
  432 |     await esperarFinDeCarga(this.page);
  433 |     await expect(this.page.locator('#tblDailyCashCopy_processing')).toBeHidden({ timeout: 60_000 });
  434 |   }
  435 | 
  436 |   /** Fila del modal Copiar ubicada por el comentario (la tabla no muestra el codigo). */
  437 |   filaDelModalCopiar(comentario: string): Locator {
  438 |     return this.page.locator(this.filasDelModalCopiar).filter({ hasText: comentario }).first();
  439 |   }
  440 | 
  441 |   async cerrarCopiar() {
  442 |     await this.page.locator(`${this.modalCopiar} .modal-footer button[data-dismiss="modal"]`).click();
  443 |     await expect(this.page.locator(this.modalCopiar)).toBeHidden({ timeout: 30_000 });
  444 |   }
  445 | 
  446 |   // ------------------------------------------------------------------
  447 |   // Baja de una caja diaria desde la bandeja
  448 |   // ------------------------------------------------------------------
  449 | 
  450 |   /**
  451 |    * Intenta eliminar la caja del dia desde la bandeja. Devuelve el texto del cartel que
  452 |    * muestra el BO. Si la caja tuviera movimientos con otra sucursal, la baja se bloquea
  453 |    * (`DailyExpenses.aspx.cs`, Delete).
  454 |    *
  455 |    * **Solo llamarlo con una caja sin otros datos**: si el bloqueo fallara, la baja se llevaria
  456 |    * puestos todos sus movimientos (`DeleteByDailyExpense`).
  457 |    */
  458 |   async intentarEliminarCajaDeLaBandeja(fecha: string): Promise<string> {
  459 |     const fila = this.filaDeLaBandejaDeLaFecha(fecha);
  460 |     await fila.locator('a.del-data').click();
  461 |     const confirmacion = this.page.locator(this.cartel).last();
  462 |     // Timeouts holgados (60s): el segundo cartel sale despues de que el servidor valida
  463 |     // el bloqueo, y en una corrida completa, con el BO bajo carga, eso llega a pasar los
  464 |     // 30s (flaqueo asi en la corrida #146, sin reintento porque cobranzas emite).
  465 |     await expect(confirmacion).toBeVisible({ timeout: 60_000 });
  466 |     await this.page.waitForTimeout(500);
  467 |     await confirmacion.getByRole('button', { name: /S[ií],\s*eliminar/i }).click();
  468 | 
  469 |     // Llega un segundo cartel (showErrorPopUp) con el motivo del bloqueo.
  470 |     const bloqueo = this.page.locator(this.cartel).filter({ hasText: 'No es posible eliminar la caja' }).last();
  471 |     await expect(bloqueo, 'La baja de una caja con movimientos de otra sucursal tiene que bloquearse con un cartel')
> 472 |       .toBeVisible({ timeout: 60_000 });
      |        ^ Error: La baja de una caja con movimientos de otra sucursal tiene que bloquearse con un cartel
  473 |     const texto = (await bloqueo.innerText()).replace(/\s+/g, ' ').trim();
  474 |     await bloqueo.getByRole('button', { name: /Aceptar/i }).click();
  475 |     return texto;
  476 |   }
  477 | }
  478 | 
```