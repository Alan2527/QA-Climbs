# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bloque-c/cobranzas.spec.ts >> Cobranzas >> Validaciones: el BO rechaza lo que no debe permitir
- Location: tests/bloque-c/cobranzas.spec.ts:1792:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#txtNonTaxable')
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for locator('#txtNonTaxable')

```

```yaml
- link "":
  - /url: javascript:;
- text: Backoffice
- combobox:
  - option [selected]
- text: 
- combobox "Ir a..."
- navigation:
  - list:
    - listitem:
      - link " Principal":
        - /url: https://qa.bo.amv.travel/main
    - listitem:
      - link " Reservas":
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
          - heading "Serv. Guía & Varios" [level=5]
        - listitem:
          - link "Adm. Servicios":
            - /url: https://qa.bo.amv.travel/booking/manage/services/true
        - listitem:
          - heading "Reportes" [level=5]
        - listitem:
          - link "Operaciones":
            - /url: https://qa.bo.amv.travel/booking/operators-report
        - listitem:
          - link "Files Vencidos":
            - /url: https://qa.bo.amv.travel/main/ExpirationDateFile
    - listitem:
      - link " Facturación":
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
      - link " Administración":
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
      - link " Mesa de Tráfico":
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
      - link " Agenda & Parám.":
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
      - link " Parám. Admin.":
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
      - link " Contabilidad":
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
      - link " Gerencia":
        - /url: javascript:void(0);
      - list:
        - listitem:
          - heading "Reportes" [level=5]
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
      - link " Sistema":
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
    - link "":
      - /url: javascript:;
  - listitem:
    - link "Test Environment":
      - /url: javascript:void(0);
- list:
  - listitem:
    - link:
      - /url: javascript:void(0);
  - listitem:
    - link "pablo@amv.travel":
      - /url: https://qa.bo.amv.travel/management-main/user-profit
  - listitem:
    - link "":
      - /url: javascript:__doPostBack('ctl00$lnkSignOut','')
- text: Carga del Comprobante de Proveedores Adm. de Proveedores
- heading "Carga del Comprobante de Proveedores" [level=5]
- list:
  - listitem:
    - link "Archivo":
      - /url: "#inv-file"
  - listitem:
    - link "Datos":
      - /url: "#inv-data"
- text: Sucursal
- combobox:
  - option "Seleccione..." [selected]
  - option "Perú"
  - option "Argentina"
  - option "Colombia"
  - option "Mexico"
  - option "Chile"
- text: Proveedor
- textbox "Clic para buscar un proveedor"
- button "Buscar proveedor": 
- alert:  Seleccione una sucursal y un proveedor para continuar con la carga del comprobante.
- button "Cancelar"
- button "Guardar y Volver" [disabled]
- button "Guardar" [disabled]
- text: ¡Factura Importada! La IA completó los datos correctamente.
- button
- contentinfo:
  - navigation:
    - list:
      - listitem:
        - link "":
          - /url: javascript:;
  - navigation:
    - list:
      - listitem:
        - link "miércoles 09 septiembre 2026 14:15":
          - /url: javascript:;
      - listitem: AFIP
      - listitem:
        - link "powered by Climbs":
          - /url: https://amv.travel/
```

# Test source

```ts
  1737 |       const modal = await caja.abrirPreCierre();
  1738 |       const fila = await caja.filaDelPreCierre(CAJA_DE_REGRESION);
  1739 |       await adjuntarTexto('Fila de la caja en el pre-cierre', fila.join(' | '));
  1740 | 
  1741 |       await conResaltado(page, modal, 'Pre-cierre con la caja de regresion', () => {
  1742 |         expect(fila.length,
  1743 |           `El pre-cierre tiene que listar ${CAJA_DE_REGRESION} con su cuadre`)
  1744 |           .toBeGreaterThan(0);
  1745 |       });
  1746 | 
  1747 |       // Columnas: (c), Nombre, M, Inicial, Ingreso, Salida, Balance dia, Final.
  1748 |       // El cuadre del pre-cierre tiene que dar lo mismo que el de la pantalla.
  1749 |       const numeros = fila.map(importe).map((i) => i.valor);
  1750 |       await conResaltado(page, modal, 'Cuadre del pre-cierre', () => {
  1751 |         expect(numeros,
  1752 |           'El balance del dia en el pre-cierre tiene que coincidir con el de la pantalla')
  1753 |           .toContain(importe(totalesDeLaCaja?.balance ?? '').valor);
  1754 |       });
  1755 | 
  1756 |       await adjuntarTexto('Cadena completa generada', [
  1757 |         `File: ${base.fileCode}`,
  1758 |         `Factura de proveedor: ${facturaProveedor.puntoDeVenta}-${facturaProveedor.numeroDeFactura}`,
  1759 |         `Orden de pago: ${ordenDePago} (costo ${costo})`,
  1760 |         `Comprobante al cliente: ${facturaCliente.comprobante}`,
  1761 |         `Orden de cobro: ${ordenDeCobro} (venta ${venta})`,
  1762 |         `Utilidad: ${venta - costo}`,
  1763 |       ].join(SALTO));
  1764 |     });
  1765 | 
  1766 |     await paso(page, 'Verificar la caja en la bandeja y que quede abierta', async () => {
  1767 |       await caja.cerrarPreCierre();
  1768 | 
  1769 |       // El test **no cierra la caja** a proposito: cerrarla bloquea los aprobados
  1770 |       // de las ordenes de pago y de cobro de esa sucursal por el resto del dia, y
  1771 |       // no se puede reabrir desde la pantalla. Que siga abierta es parte del
  1772 |       // resultado esperado.
  1773 |       await caja.irABandejaDeCajas();
  1774 |       const fila = caja.filaDeLaFecha(fechaDeHoy);
  1775 |       await expect(
  1776 |         fila,
  1777 |         `La caja del ${fechaDeHoy} tiene que aparecer en la bandeja de gastos y movimientos`,
  1778 |       ).toBeVisible({ timeout: 60_000 });
  1779 | 
  1780 |       const celdas = await caja.celdas(fila);
  1781 |       await adjuntarTexto('Fila de la caja en la bandeja', celdas.join(' | '));
  1782 | 
  1783 |       await conResaltado(page, fila, 'Caja abierta al terminar', () => {
  1784 |         expect(celdas.join(' | ').toUpperCase(),
  1785 |           'La caja tiene que quedar abierta: el test no la cierra, y cerrarla dejaria sin poder ' +
  1786 |           'aprobar las ordenes del resto del dia')
  1787 |           .not.toContain('CERRAD');
  1788 |       });
  1789 |     });
  1790 |   });
  1791 | 
  1792 |   test('Validaciones: el BO rechaza lo que no debe permitir', async ({ page }) => {
  1793 |     test.setTimeout(600_000);
  1794 | 
  1795 |     const factura = new FacturaProveedorPage(page);
  1796 |     const orden = new OrdenDePagoPage(page);
  1797 |     const bo = new BackOfficePage(page);
  1798 | 
  1799 |     const ahora = new Date();
  1800 |     const sello = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
  1801 |     const fechaDeHoy = formatearFecha(ahora);
  1802 | 
  1803 |     const datos = {
  1804 |       proveedor: 'GRUPO SUMMA',
  1805 |       razonSocial: 'GRUPO SUMMA SRL',
  1806 |       tipo: 'Factura A',
  1807 |       sucursal: 'Argentina',
  1808 |       moneda: 'USD',
  1809 |       puntoDeVenta: '0001',
  1810 |       numero: [
  1811 |         String(ahora.getDate()).padStart(2, '0'),
  1812 |         String(ahora.getHours()).padStart(2, '0'),
  1813 |         String(ahora.getMinutes()).padStart(2, '0'),
  1814 |         String(ahora.getSeconds()).padStart(2, '0'),
  1815 |       ].join(''),
  1816 |       importe: '10,00',
  1817 |     };
  1818 | 
  1819 |     /** Espera el aviso de error del BO, que aparece y se desvanece solo. */
  1820 |     const esperarAviso = async (mensaje: string, etiqueta: string) => {
  1821 |       const aviso = page.locator('.noty_text, .noty_body, .noty_message').filter({ hasText: mensaje }).first();
  1822 |       await conResaltado(page, page.locator('body'), etiqueta, async () => {
  1823 |         await expect(
  1824 |           aviso,
  1825 |           `El BO tiene que avisar "${mensaje}"`,
  1826 |         ).toBeVisible({ timeout: 30_000 });
  1827 |       });
  1828 |       await adjuntarTexto(etiqueta, mensaje);
  1829 |     };
  1830 | 
  1831 |     // Este test no reserva ni genera file: ninguna de estas validaciones lo
  1832 |     // necesita. Deja un solo comprobante y una sola orden sin aprobar en QA.
  1833 |     await paso(page, 'Entrar al BackOffice y abrir una factura de proveedor nueva', async () => {
  1834 |       await bo.ingresar(process.env.BO_USER!, process.env.BO_PASS!);
  1835 |       await factura.irABandejaDeFacturas();
  1836 |       await factura.nuevaFactura();
> 1837 |       await expect(page.locator(factura.campoExento)).toBeVisible();
       |                                                       ^ Error: expect(locator).toBeVisible() failed
  1838 |     });
  1839 | 
  1840 |     await paso(page, 'Intentar guardar la factura sin proveedor', async () => {
  1841 |       // supplier.js:361 corta antes de mandar nada al servidor.
  1842 |       await page.locator(factura.btnGuardar).click();
  1843 |       await esperarAviso('Debe seleccionar un Proveedor', 'Factura sin proveedor');
  1844 |       await expect(page, 'La pantalla no tiene que navegar si falta el proveedor')
  1845 |         .toHaveURL(/supplierinvoice\/0/i);
  1846 |     });
  1847 | 
  1848 |     await paso(page, 'Intentar guardar la factura con importe en cero', async () => {
  1849 |       await factura.elegirSucursal(datos.sucursal);
  1850 |       await factura.elegirProveedor(datos.proveedor, datos.razonSocial);
  1851 |       await page.locator(factura.comboTipo).selectOption({ label: datos.tipo });
  1852 |       await esperarFinDeCarga(page);
  1853 |       await page.locator(factura.campoPuntoDeVenta).fill(datos.puntoDeVenta);
  1854 |       await page.locator(factura.campoNumero).fill(datos.numero);
  1855 |       await page.locator(factura.comboMoneda).selectOption({ label: datos.moneda });
  1856 |       await esperarFinDeCarga(page);
  1857 | 
  1858 |       // El total sigue en cero porque no se cargo ningun importe.
  1859 |       await page.locator(factura.btnGuardar).click();
  1860 |       await esperarAviso('El monto total no puede ser igual a 0', 'Factura con total cero');
  1861 |       await expect(page, 'La pantalla no tiene que navegar si el total es cero')
  1862 |         .toHaveURL(/supplierinvoice\/0/i);
  1863 |     });
  1864 | 
  1865 |     let idDeLaFactura = '';
  1866 |     await paso(page, 'Cargar el importe y guardar la factura', async () => {
  1867 |       await factura.cargarImporte(datos.importe);
  1868 |       idDeLaFactura = await factura.guardar();
  1869 |       expect(idDeLaFactura, 'Con el importe cargado, la factura tiene que poder guardarse')
  1870 |         .toMatch(/^\d+$/);
  1871 |     });
  1872 | 
  1873 |     await paso(page, 'Intentar cargar otra factura con el mismo numero y proveedor', async () => {
  1874 |       // Detail.aspx.cs:987. Es la validacion que hace que el numero del test
  1875 |       // tenga que derivarse del sello de tiempo.
  1876 |       await factura.irABandejaDeFacturas();
  1877 |       await factura.nuevaFactura();
  1878 |       await factura.elegirSucursal(datos.sucursal);
  1879 |       await factura.elegirProveedor(datos.proveedor, datos.razonSocial);
  1880 |       await page.locator(factura.comboTipo).selectOption({ label: datos.tipo });
  1881 |       await esperarFinDeCarga(page);
  1882 |       await page.locator(factura.campoPuntoDeVenta).fill(datos.puntoDeVenta);
  1883 |       await page.locator(factura.campoNumero).fill(datos.numero);
  1884 |       await page.locator(factura.comboMoneda).selectOption({ label: datos.moneda });
  1885 |       await esperarFinDeCarga(page);
  1886 |       await factura.cargarImporte(datos.importe);
  1887 | 
  1888 |       await page.locator(factura.btnGuardar).click();
  1889 |       await esperarAviso(
  1890 |         'Ya existe un comprobante con el mismo número y el mismo proveedor',
  1891 |         'Factura con numero repetido',
  1892 |       );
  1893 |       await expect(page, 'El comprobante repetido no tiene que crearse')
  1894 |         .toHaveURL(/supplierinvoice\/0/i);
  1895 |     });
  1896 | 
  1897 |     let idDeLaOrden = '';
  1898 |     await paso(page, 'Intentar guardar una orden de pago sin forma de pago', async () => {
  1899 |       // Detail.aspx.cs:567: sin caja elegida el guardado corta.
  1900 |       await orden.irABandejaDeOrdenes();
  1901 |       await orden.nuevaOrden();
  1902 |       await orden.elegirProveedor(datos.proveedor, datos.razonSocial);
  1903 |       await orden.elegirEnCombo(orden.comboMoneda, datos.moneda);
  1904 |       await orden.cargarImporte('10,00');
  1905 | 
  1906 |       await page.locator(orden.btnGuardar).click();
  1907 |       await esperarAviso('Debe seleccionar Medios de Pago', 'Orden sin forma de pago');
  1908 |       await expect(page, 'La orden no tiene que crearse sin forma de pago')
  1909 |         .toHaveURL(/payorder\/0/i);
  1910 |     });
  1911 | 
  1912 |     await paso(page, 'Guardar la orden e intentar aprobarla con fechas invalidas', async () => {
  1913 |       await orden.elegirEnCombo(orden.comboCaja, CAJA_DE_REGRESION);
  1914 |       await orden.cargarImporte('10,00');
  1915 |       idDeLaOrden = await orden.guardar();
  1916 |       expect(idDeLaOrden, 'Con la caja elegida, la orden tiene que poder guardarse')
  1917 |         .toMatch(/^\d+$/);
  1918 | 
  1919 |       // Detail.aspx.cs:1150: el recibo no puede ser posterior a hoy.
  1920 |       //
  1921 |       // Se usan **tres dias** y no uno: el servidor puede estar en otro huso que
  1922 |       // la maquina que corre el test, y cerca de la medianoche "manana" para el
  1923 |       // test todavia es "hoy" para el BO. Con un dia de diferencia la orden se
  1924 |       // aprobaba y el caso negativo no probaba nada.
  1925 |       const fechaFutura = masDias(fechaDeHoy, 3);
  1926 |       await orden.elegirFechaDelRecibo(fechaFutura);
  1927 |       await page.locator(orden.campoNumeroDelRecibo).fill(`AUTOQA${sello.slice(-8)}`);
  1928 |       await page.locator(orden.campoNumeroDelRecibo).blur();
  1929 |       await page.locator(orden.btnAprobar).click();
  1930 |       await esperarAviso(
  1931 |         'La fecha del Recibo no puede ser mayor a la fecha de hoy',
  1932 |         'Recibo con fecha futura',
  1933 |       );
  1934 | 
  1935 |       await conResaltado(page, page.locator(orden.btnAprobar), 'Orden sin aprobar', async () => {
  1936 |         expect(await orden.estado(),
  1937 |           'Rechazada la aprobacion, la orden tiene que seguir pendiente')
```