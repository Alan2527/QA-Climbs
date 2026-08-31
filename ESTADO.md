# Estado de la suite E2E — AMV Travel (QA)

Documento de traspaso. Última actualización: **2026-08-31**.

## Qué es esto

Suite de regresión funcional en **Playwright + Allure** que valida flujos completos
del portal de AMV Travel sobre el ambiente **QA**. Nació de un pedido del PM
(Nicolás Angulo): automatizar los flujos críticos que las historias de usuario no cubren.

- Repo: `github.com/Alan2527/QA-Climbs`
- Local: `C:\Users\alanh\AmvTravel\qa-e2e`
- Reporte: `https://alan2527.github.io/QA-Climbs/`

## Ambiente

| | URL |
|---|---|
| Front | https://qa.amv.travel |
| WebAdmin | https://qa.amv.travel/administration/ |
| BackOffice | https://qa.bo.amv.travel |

Base de datos: **`qa`** en `40.74.225.224,1433`.

> Se apunta a QA y no a preprod porque no hay acceso a la base de preprod. Validar
> el front de un ambiente contra los datos de otro daría falsos positivos. Cuando
> haya acceso, se regenera el dataset y se cambia `AMV_BASE_URL`.

## Cómo correr

```powershell
cd C:\Users\alanh\AmvTravel\qa-e2e
npm install
npx playwright install chromium
# crear el .env con AMV_USER / AMV_PASS / BO_USER / BO_PASS
npx playwright test tests/bloque-a
npm run report
```

Usuario de prueba: `Pablo@amv.travel` — WebUserID 332, AgencyID 1 (AMV. TRAVEL),
CityID 5000, CurrencyID 1 (USD), markup del header **M 0.50**.

---

## BLOQUE A — Tarifario: terminado

7 tests, uno por pestaña. **6 en verde**, Cruceros en rojo por un defecto real de
la aplicación (ver Hallazgos).

### Recorrido de cada test

Sin atajos por URL, como lo haría un usuario:

1. Login (una vez, reusado con `storageState`)
2. Menú TARIFARIO
3. Filtros País / Ciudad
4. Botón Buscar — sin esto las pestañas cargan vacías
5. Abrir la pestaña
6. Buscar el ítem por nombre en el buscador de la pantalla (TomSelect)

### Qué valida

| Paso | Validación |
|---|---|
| 4 | El ítem aparece con su nombre exacto de la base |
| 5 | Componentes de la card, según la matriz de cada control |
| 6 | Se despliega el tarifario — dos niveles: Ver Tarifario + cabecera de grupo |
| 7 | El botón pasa de Ver Tarifario a Cerrar Tarifario |
| 8 | Importes contra la línea base, solapa por solapa y fila por fila |
| 9+ | Popup de detalle: solapas, incluye / no incluye, idiomas |

### Matriz de componentes por pestaña

Tomada del markup de cada `*TariffControl.ascx`. Se valida presencia **y ausencia**:
si aparece un componente que esa pestaña no debería tener, también falla.

| Componente | Servicios | Hoteles | Paquetes | Ofertas | Cruceros |
|---|---|---|---|---|---|
| Imagen (contra el archivo de la base) | si | si | si | si | si |
| Texto | si | si | si | si | si |
| Botón tarifario | si | si | si | si | si |
| Proveedores | si | si | — | — | — |
| Descarga Word | — | — | si | si | — |
| Cotizar y reservar (nunca se clickea) | — | — | si | si | — |
| Tag RECOMENDADO | — | si | — | — | — |
| Observaciones destacadas | si | — | — | — | — |
| Iconos + tooltips | si | — | — | — | — |

> **"Cotizar y reservar" se verifica por presencia y jamás se clickea**: navega a
> `ShoppingCartPage.aspx` y saca al test del tarifario. Fue la causa de varios
> fallos hasta que se acotaron los selectores al contenedor de la pestaña.

### Validación de importes

Se comparan contra una **línea base** capturada de la pantalla, no contra una
fórmula reimplementada. El sistema encadena cuatro markups (mercado de la agencia,
markup del usuario, del servicio y de ProductSetting), conversión de moneda y
redondeo hacia arriba; replicar eso en el test sería reescribir su lógica con
riesgo de equivocarse.

Se captura **una tabla por solapa de idioma**, porque el precio cambia entre ellas:
en Cena Show la tarifa Regular pasa de **USD 137 (Español) a USD 152 (Inglés)** por
el recargo por idioma. También se cuenta la marca TARIFA EXTENDIDA.

| Pestaña | Solapas idioma | TARIFA EXTENDIDA | Filas |
|---|---|---|---|
| Cena Show | 3 | 5 | 18 |
| Excursiones | 3 | 6 | 21 |
| Traslados | 3 | 0 | 30 |
| Hoteles | — | 189 | 105 |
| Cruceros | — | 0 | 136 |
| Paquetes | — | 0 | 19 |
| Ofertas | — | 0 | 19 |

**Cena Show tiene además validación con fórmula** contra `ServiceRate`:
`ceil(TotalRate / markup)`. Es el caso de control: detecta un cálculo mal hecho hoy,
no sólo un cambio respecto de ayer.

Regenerar la línea base cuando se cambien datos a propósito:

```powershell
npm run lineabase
```

El capturador vive en `tools/`, fuera de `tests/`, para que no corra con la suite
ni aparezca en el reporte: no es un test de regresión, es una herramienta.

### Resaltado de fallos

Cuando una validación falla, la captura del reporte marca el elemento con un
recuadro rojo y hace scroll hasta centrarlo. En diferencias de importes se señala
la fila exacta y se vuelve a la solapa de idioma donde ocurrió.

---

## Datos de prueba en QA

Marcados con el prefijo **`AUTO-QA NO TOCAR - `** y con una imagen propia con las
siglas QA (`assets/auto-qa-no-tocar.jpg`).

| Pestaña | ID | Ítem |
|---|---|---|
| Paquetes | 5059 | Paquete Buenos Aires y Ushuaia (6 días / 5 noches) |
| Excursiones | 5 | Tigre y Delta |
| Hoteles | 5003 | Park Hyatt Palacio Duhau |
| Traslados | 1223 | Aeropuerto Internacional / Hotel céntrico con guía |
| Cena Show | 163 | Café de los Angelitos |
| Cruceros | 14 | Fiordos de Tierra del Fuego - Ventus Australis |
| Ofertas | 5060 | Oferta Buenos Aires y Ushuaia (6 días / 5 noches) |

Hotel secundario: **12581 Arakur Resort & Spa** (Ushuaia), usado dentro del paquete.

Tarifas cargadas hasta 2031/2032. Datos esperados en `data/candidatos.json`;
importes en `data/importes-lineabase.json`.

### Lo que hubo que cargar porque no venía

- Amenities (incluye / no incluye), idiomas, política de cancelación y badge de duración
- Observaciones destacadas (`ServiceObservation.IsPriority`)
- Tooltips de amenity (`ServiceAmenityObservation`)
- Imágenes, subidas por WebAdmin (no alcanza con poner el nombre por SQL)
- El paquete 5059 y la oferta 5060 se crearon desde cero, compuestos por los
  propios ítems candidatos, para que sean autocontenidos

### Precondiciones que hay que respetar

- **La oferta necesita la agencia AMV. TRAVEL asignada** en su pestaña Agencias.
  Sin eso no se lista en el tarifario.
- **Cruceros y Ofertas se filtran por Ushuaia**, no por Buenos Aires.
- **El front muestra el nombre traducido**, no el de la tabla maestra: el prefijo
  tuvo que aplicarse también en `ServiceDetail`, `CruiseDetail` y `ReceptiveTourDetail`.
- **Sólo las amenities marcadas como Prioritario** se muestran como icono con
  tooltip en la card (WebAdmin → Tipos → Amenities de servicio, columna Prioritario).

---

## Hallazgos abiertos

No están redactados como bug porque no hay US contra la cual citarlos.

### 1. Cruceros: el botón "Ver detalle" no abre nada

`Online/Module/CruiseTariffControl.ascx`, línea 48. El `onclick` tiene las comillas
mal cerradas y queda como JavaScript inválido:

```
onclick="$('#modal-<%=current%>').modal('show'); style="color: var(--primary-color);""
```

El modal existe en el DOM pero nunca se muestra. **Presente también en la rama
preprod**, así que no es una regresión reciente. Es el único control con ese patrón;
el botón por cabina (línea 99) está bien escrito.

**Por eso el test de Cruceros está en rojo.** Cuando lo corrijan, pasa a verde solo.

### 2. Cruceros: el botón nunca cambia a "Cerrar Tarifario"

Las otras cinco pestañas cargan su detalle por AJAX desde un `*TariffDetailControl.ascx`
que inyecta el botón con el recurso `Advisor.Tariff.Service.Hide`. Cruceros no tiene
ese control porque su tabla ya viene renderizada, así que el texto queda fijo.
Está documentado como esperado en `candidatos.json`: si lo arreglan, el test avisa.

### 3. El tarifario muestra amenities con `Published = 0`

Detectado con "Pick up y drop off en hotel" en el Café de los Angelitos. Se
publicaron las que quedaban para que el dato sea coherente, pero conviene consultarlo.

---

## Lo que queda por hacer

### Bloque A — pendientes menores

- **Importes con fórmula** en las otras seis pestañas. Hoy sólo Cena Show valida
  contra la base; el resto compara contra la línea base, que detecta cambios pero no
  un error de cálculo actual. Para Paquetes y Ofertas hace falta **permiso de
  `EXECUTE` sobre `sp_TourRates`**, que el usuario `herrera_qa` no tiene.
- **Tooltips de operatividad**: salen de `ServiceCalendar` (campos `Monday`…`Sunday`
  más rango de fechas). Falta armar el texto esperado y compararlo.
- **Popup de detalle en Paquetes, Hoteles, Ofertas y Cruceros**: hoy sólo se valida
  título y descripción. Los tres servicios sí validan las cinco solapas.
- **Leyenda "Más observaciones disponibles en el detalle"**: depende de
  `op.HasMoreObservations`, cuyo criterio vive en `ServiceOperativityData`, que no
  está en el repo del WEB. Se adjunta al reporte pero no se exige.

### BLOQUE B — Reservas (no empezado)

Cuatro tipos: **multidestino, sólo hotel, sólo servicio y sólo oferta**. En todos hay
que guardar los datos con los que se generó la reserva y validar que **en el BO se
conserven todos, idénticos**.

- Multidestino vive en `Online/CustomTours/` (en el código se llama CustomTours).
- La reserva emitida cae en la bandeja del BO: `booking/files/inbox`.
- Hoteles de integración: `HotelWithIntegration.aspx`. El matching contra el hotel
  AMV está en `IntegrationHotelMatch` y **no se valida mirando la UI**: hay que ir a
  la base. Si el match está mal, la reserva se emite con el hotel equivocado y en
  pantalla se ve perfecta.

### BLOQUE C — Cobranzas (no empezado)

Cadena completa: factura de proveedor → orden de pago → factura de cliente → orden
de cobro → caja diaria con sus movimientos.

| Paso | Ruta en el BO | Estado |
|---|---|---|
| Factura de proveedor | `administration/supplierinvoice` | no existe |
| Orden de pago | `administration/payorder` | existe en la suite vieja, sin asserts |
| Factura de cliente | `invoice-management/invoicing/newinvoice` | no existe |
| Orden de cobro | `administration/chargeorder` | existe en la suite vieja, sin asserts |
| Caja diaria | `administration/movements/daily-cash/{id}` | no existe |

**Es una cadena, no cinco tests sueltos**: cada eslabón necesita el anterior. Se
decidió que cada flujo genere su propia precondición en vez de depender de datos
preexistentes, que es lo que hace fallar hoy a `bo_crear_op.py` de la suite vieja.

Lo que el PM no pidió y conviene sumar:

1. **Conciliación de importes punta a punta**: que el precio que vio el pasajero sea
   el mismo del file, la factura, la orden de cobro y el movimiento de caja. Ojo con
   `BO_SupplierInvoice.CurrencyID`, que guarda el `Identifier` de `BO_Currency` y no
   el `ID` de `Currency`: hay riesgo real de cruce de monedas.
2. **Cierre de caja**, no sólo la apertura. La pantalla tiene botones Apertura y
   Pre-cierre; el bug aparece cuando la caja tiene que cuadrar.
3. **Anulación** de una reserva emitida, y que revierta bien.
4. **Liquidación del file** (`FileLiq.aspx`).
5. **Bandejas de no asignados** (`UnassignedInvoices`, `UnassignedPayorders`) como
   validación negativa.

### Dato útil para el bloque C

En la suite vieja de Selenium, `bo_payorder_page.py` usa `lnkAsignarTotal`, que es
**incorrecto**: ese es de órdenes de **cobro**. El de órdenes de **pago** es
`lnkMassiveAllocate` (`Module/PayOrderAllocationControl.ascx`). El de cobro
(`bo_chargeorder_page.py`) sí está bien.

---

## Estructura del proyecto

```
qa-e2e/
├── assets/auto-qa-no-tocar.jpg           imagen de los ítems de prueba
├── data/
│   ├── candidatos.json                   datos esperados de cada ítem
│   └── importes-lineabase.json           línea base de importes por solapa
├── pages/
│   ├── login.page.ts
│   └── tarifario.page.ts
├── tests/
│   ├── auth.setup.ts                     login único, reusado por storageState
│   └── bloque-a/tarifario.spec.ts        los 7 tests
├── tools/capturar-lineabase.spec.ts      regenera la línea base (npm run lineabase)
├── utils/pasos.ts                        pasos, esperas, resaltado, formato
└── .github/workflows/qa-e2e.yml          CI con Allure en GitHub Pages
```

## Convenciones

- **Sin deep links**: se navega como un usuario real, entrando por el menú.
- **Sin esperas fijas**: `esperarFinDeCarga()` espera fin de PostBack ASP.NET y
  `jQuery.active === 0`. Nada de `waitForTimeout`.
- **Fechas de búsqueda**: siempre hoy + 7 días.
- **Capturas de página completa** en cada paso.
- **Un test por caso**, para que un fallo no tape a los demás.
- **Los selectores salen del código fuente** (`WEB/src/AMV.Travel/Web`), nunca se
  inventan. Si hace falta uno que no está en el código, se pide el `outerHTML`.
