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

7 tests, uno por pestaña. **3 en verde y 4 en rojo**, todos los rojos por defectos
reales de la aplicación (ver Hallazgos): Cruceros arrastra dos, y las tres pestañas
de servicios fallan en la descarga del PDF de la ficha.

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
| 9+ | Texto del detalle contra la base, línea por línea |
| 9+ | Descarga Word: que el archivo baje de verdad (sólo Paquetes y Ofertas) |
| 9+ | Descarga PDF de la ficha (sólo las tres pestañas de servicios) |
| 9+ | Modal de Proveedores: la tabla completa contra la base |

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
| Botón Copiar | si | si | si | si | si |
| Botón Copiar solapa | si | — | — | — | — |
| Botón Descargar PDF | si | — | — | — | — |
| Tag RECOMENDADO | — | si | — | — | — |
| Observaciones destacadas | si | — | — | — | — |
| Iconos + tooltips | si | — | — | — | — |

> **El botón de Proveedores lleva la clase `.btn-download-word`** en
> `ServiceTariffControl.ascx:57`, la misma del botón de descarga Word de Paquetes
> y Ofertas. Por eso `locatorBotonWord` apunta por `[onclick*='downloadWord']` y no
> por la clase: si fuera por clase, en un servicio se le haría clic a Proveedores
> creyendo que se descarga un Word.

> **"Cotizar y reservar" se verifica por presencia y jamás se clickea**: navega a
> `ShoppingCartPage.aspx` y saca al test del tarifario. Fue la causa de varios
> fallos hasta que se acotaron los selectores al contenedor de la pestaña.

> **La descarga Word sí se ejecuta.** El botón llama a `downloadWord()`
> (`ExportWordModal.ascx`), que abre el modal de elección de agencia sólo si el
> usuario es admin y está simulando; para el resto baja directo pidiendo
> `/advisorws/downloadWordTourTariff/`. El test captura la descarga y verifica
> nombre `.docx`, tamaño mayor a cero y que el archivo empiece con `PK`: un
> `.docx` es un ZIP, así que un endpoint que devolviera una página de error con
> nombre `.docx` no pasaría. Hoy bajan ~139 KB en las dos pestañas.

### Validación de importes

Se comparan contra una **línea base** capturada de la pantalla, no contra una
fórmula reimplementada. El sistema encadena cuatro markups (mercado de la agencia,
markup del usuario, del servicio y de ProductSetting), conversión de moneda y
redondeo hacia arriba; replicar eso en el test sería reescribir su lógica con
riesgo de equivocarse.

Se captura **una tabla por solapa de idioma**, porque el precio cambia entre ellas:
en Cena Show la tarifa Regular pasa de **USD 137 (Español) a USD 152 (Inglés)** por
el recargo por idioma. También se cuenta la marca TARIFA EXTENDIDA.

Hay **dos controles que muestran solapas y cada uno usa su propio prefijo de clase**:
`srl-lang-tabs-` en `ServiceTariffDetailControl.ascx` (servicios) y `trl-lang-tabs-`
en `NewTourTariffDetailControl.ascx` (paquetes). El selector matchea los dos. Cuando
sólo miraba `srl-`, Paquetes caía al caso sin solapas y se validaba únicamente la
tabla en Español: 38 de sus 57 filas quedaban sin comparar, y el recargo por idioma
del paquete es real — en Inglés está USD 30 a 32 por encima en 17 de las 19 filas.

| Pestaña | Solapas idioma | TARIFA EXTENDIDA | Filas |
|---|---|---|---|
| Cena Show | 3 | 5 | 18 |
| Excursiones | 3 | 6 | 21 |
| Traslados | 3 | 0 | 30 |
| Hoteles | — | 189 | 105 |
| Cruceros | — | 0 | 136 |
| Paquetes | 3 | 0 | 57 |
| Ofertas | — | 0 | 19 |

**Cena Show tiene además validación con fórmula** contra `ServiceRate`:
`ceil(TotalRate / markup)`. Es el caso de control: detecta un cálculo mal hecho hoy,
no sólo un cambio respecto de ayer.

#### Por qué no se extiende la fórmula a las otras pestañas

Estuvo anotado como pendiente y **se decidió no hacerlo**. La fórmula agrega valor
sólo si el sistema ya estuviera calculando mal en el momento de capturar: en ese
caso la línea base guardaría el valor incorrecto como bueno y no lo detectaría
nunca. Verificado que **hoy el cálculo es correcto**, la línea base quedó con
valores correctos y alcanza para detectar cualquier regresión posterior.

En Paquetes y Ofertas además estaba bloqueado: `sp_TourRates` llena la tabla
`TempRates`, que es de donde lee la aplicación, y el login `herrera_qa` no tiene
`EXECUTE` sobre el SP — entra a la base como `guest`, sin usuario propio.

> **La contrapartida está en la regeneración.** `npm run lineabase` vuelve a tomar
> como buenos los importes que la pantalla muestre en ese momento. Si se regenera
> con un cálculo ya roto, el error queda consagrado como línea base. Por eso el
> consolidador imprime un resumen y marca las pestañas cuyas solapas o filas
> cambiaron: **hay que mirar ese resumen antes de commitear una línea base nueva**,
> no regenerarla a ciegas.

Regenerar la línea base cuando se cambien datos a propósito:

```powershell
npm run lineabase
```

Son **dos pasos encadenados**: `capturar-lineabase.spec.ts` deja un archivo por
pestaña en `lineabase/`, y `consolidar-lineabase.mjs` los vuelca a
`data/importes-lineabase.json`, que es lo que leen los tests. Antes el script
corría sólo el primero: dejaba las siete capturas nuevas y la suite seguía
comparando contra la línea base vieja. El consolidador imprime un resumen y marca
la pestaña cuyas solapas o filas cambiaron respecto de la anterior.

> **La fecha de hoy se guarda como `<HOY>`.** La vigencia de la primera fila del
> tarifario arranca en la fecha del día, así que una línea base capturada un día
> fallaba al siguiente: cambiaba la fecha aunque los importes fueran idénticos.
> No se había detectado porque se capturaba y se corría el mismo día. Se
> normaliza de los dos lados (`normalizarFechaDeHoy` en `utils/pasos.ts`), así la
> comparación no depende del día en que se corre y sigue detectando cualquier
> cambio real de fechas o de importes.

El capturador vive en `tools/`, fuera de `tests/`, para que no corra con la suite
ni aparezca en el reporte: no es un test de regresión, es una herramienta.

### Validación del texto del detalle

El cuerpo del detalle se compara contra la base, no contra una captura de pantalla:
es la única forma de detectar que el front muestre un texto distinto del que está
cargado. Los datos esperados viven en `detalleEsperado` dentro de `candidatos.json`,
con su origen anotado en `_fuente`.

| Ítem | Superficie | Campo de la base |
|---|---|---|
| Paquetes 5059 | modal | `ReceptiveTourDetail.Detail` |
| Ofertas 5060 | modal | `ReceptiveTourDetail.Detail` |
| Cruceros 14 | modal | `CruiseDetail.Detail` |
| Hoteles 5003 | modal, dos solapas | `HotelDetail.Detail` + `HotelTechnicalSheet.Content` |
| Excursiones 5, Traslados 1223, Cena Show 163 | ficha | `ServiceDetail.Detail` |

Todos filtran por `LanguageID = 1` (Español). Hoteles es el único que necesita dos
tablas: `HotelDetail` **no tiene** las columnas `Name` ni `TechnicalSheet` — el
título sale de la tabla `Hotel` y la ficha técnica de `HotelTechnicalSheet.Content`,
filtrada además por `Status = 1`.

Se exige que **cada línea de la base esté presente** en pantalla, en vez de comparar
la cadena entera: el campo guarda HTML y el navegador lo renderiza con sus propios
saltos y espacios, así que una igualdad estricta daría rojo por diferencias de
formato que no le importan a nadie. Con este criterio, un párrafo que falta o que
cambió sí falla.

### Barra de operatividad de la card

`RenderOperativityIcons` (`ServiceTariffControl.ascx.cs:99`) arma hasta tres ítems,
y se validan los tres por separado en vez de contar cuántos hay:

| Ítem | Qué se valida | Fuente |
|---|---|---|
| Duración (`ph-clock`) | el texto es la duración de la modalidad Regular | `ServiceDuration` con `RateTypeID = 6` |
| Idiomas (`ph-translate`) | el tooltip trae los nombres completos, no los códigos | los idiomas del servicio |
| Operatividad (`.tariff-op-calendar`) | el resumen de temporada **no nombra un mes que la base no opera** | `ServiceMonth` |

Del resumen de temporada no se compara la cadena entera: el control la abrevia en
rangos (`Ene–Mar, May–Jul, Oct–Dic`) y reconstruir ese formato sería reimplementar
su lógica. Se valida por la negativa, que es lo que detecta un error real, y la
comparación exacta de meses ya la hace la solapa Salidas contra `ServiceMonth`.

> El tag **RECOMENDADO** de la card de hoteles sale de `Hotel.Great = 1`,
> verificado en QA sobre el hotel 5003. Antes el esperado estaba escrito a mano
> sin trazabilidad.

### Modal de Proveedores

Lo tienen los tres servicios y Hoteles. Se abre y se compara **la tabla entera**,
fila por fila y en orden: la aplicación las ordena por `DisplayOrder`, así que un
cambio de orden también falla.

| Ítem | Tabla de origen | Filas |
|---|---|---|
| Excursiones 5 | `BO_ServiceSupplier` | 1 |
| Cena Show 163 | `BO_ServiceSupplier` | 1 |
| Traslados 1223 | `BO_ServiceSupplier` | 3 |
| Hoteles 5003 | `BO_HotelSupplier` | 1 |

Unidas a `BO_Supplier` y `BO_Operator`, filtrando `Published = 1` y `Deleted = 0`.
Las cuatro columnas del modal son `DisplayOrder`, `Supplier.Name`, `Operator.Name`
y `Comment`.

> **El endpoint devuelve `[]` si el usuario no es `WebUserTypeID = 1`**
> (`AdvisorHelperService.LoadServiceSuppliers`). Pablo lo es, así que la tabla trae
> datos; con otro usuario el modal se vería vacío y la comparación fallaría por un
> motivo que no es el que se está buscando.

### Resaltado de fallos

Cuando una validación falla, la captura del reporte marca el elemento con un
recuadro rojo y hace scroll hasta centrarlo. En diferencias de importes se señala
la fila exacta y se vuelve a la solapa de idioma donde ocurrió.

---

## Notas sobre la base de QA

- **Las tablas no comparten intercalación.** Un `UNION` o un `JOIN` por texto entre
  tablas de módulos distintos falla con el error 451 (`No se puede resolver el
  conflicto de intercalación entre 'SQL_Latin1_General_CP1_CI_AS' y
  'Modern_Spanish_CI_AS'`). Se resuelve agregando `COLLATE DATABASE_DEFAULT` a las
  columnas de texto. Va a volver a aparecer en el Bloque C, que cruza bastante
  texto entre módulos.
- **`OBJECT_NAME()` necesita el segundo parámetro** cuando se consulta otra base:
  `OBJECT_NAME(c.object_id, DB_ID('qa'))`. Sin él devuelve NULL aunque
  `OBJECT_ID('qa.dbo.Tabla')` sí resuelva.
- **El login `herrera_qa` entra como `guest`**: no tiene usuario propio en `qa`.
  Por eso no puede ejecutar procedimientos (`HAS_PERMS_BY_NAME` sobre
  `sp_TourRates` devuelve 0). Si alguna vez se pide el permiso, conviene avisar que
  crear el usuario le haría **perder** lo que hoy le da `guest`.
- **Hay idiomas cargados que el portal no ofrece**: además de ES/EN/PT (1, 2, 3)
  existen filas con `LanguageID` 4 (italiano) y 6. En Paquetes y Ofertas el italiano
  está incluso **publicado**. También hay filas vacías o en NULL, como
  `HotelDetail` del hotel 5003 en idioma 4.

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

Los dos primeros los marca en rojo el test de Cruceros. Ninguno está dado por
esperado en `candidatos.json`: el paso se deja escrito como corresponde y falla
hasta que se corrija.

### 1. Cruceros: el botón "Ver detalle" no abre nada

`Online/Module/CruiseTariffControl.ascx`, línea 48. El `onclick` tiene las comillas
mal cerradas y queda como JavaScript inválido:

```
onclick="$('#modal-<%=current%>').modal('show'); style="color: var(--primary-color);""
```

El modal existe en el DOM pero nunca se muestra. **Presente también en la rama
preprod**, así que no es una regresión reciente. Es el único control con ese patrón;
el botón por cabina (línea 99) está bien escrito.

Falla el paso 9 del test. La captura del reporte resalta el botón "Ver detalle"
sobre el que se hizo clic.

### 2. Cruceros: el botón nunca cambia a "Cerrar Tarifario"

Las otras cinco pestañas cargan su detalle por AJAX desde un `*TariffDetailControl.ascx`
que inyecta el botón con el recurso `Advisor.Tariff.Service.Hide`. Cruceros no tiene
ese control porque su tabla ya viene renderizada, así que el texto queda fijo.

Falla el paso 7 del test, con el botón resaltado en la captura. La comparación va
contra `textoDesplegado` de `candidatos.json`, que dice **"Cerrar Tarifario"** en las
siete pestañas: lo que la aplicación hace hoy no define el resultado esperado. El
contexto queda en `_hallazgoConocido`, que se adjunta al reporte como nota.

El assert es **soft**: el tarifario ya quedó desplegado y con filas en el paso 6, así
que el test sigue y valida los importes y el modal en la misma corrida. Con un assert
duro cortaba en el paso 7 y tapaba el hallazgo 1.

### 3. La ficha de servicios nunca descarga el PDF

Clic en **Descargar PDF** en la ficha de cualquier servicio: el archivo no baja
nunca y el botón queda clavado en **"Generando..." y deshabilitado**. Hay que
recargar la página para poder reintentar.

`Online/js/service-sheet.js`, `downloadServiceSheetPdf()`, pide el PDF con:

```js
$.ajax({ type: 'GET', url: '/advisorws/createservicesheetpdf/?service=' + id,
         xhrFields: { responseType: 'blob' }, success: ..., error: ... })
```

**El sitio usa jQuery 1.12.4, que no soporta `xhrFields.responseType = 'blob'`.**
Al terminar la petición, el transporte de jQuery intenta leer `responseText`, que
con `responseType='blob'` lanza excepción, y no dispara `success` ni `error`: el
deferred no se resuelve nunca y por eso el botón queda a medias.

Verificado en la página de QA, sobre el servicio 5:

```
jquery: 1.12.4
ajax:   NINGUN CALLBACK a los 25s
fetch:  ok http=200 tipo=application/pdf size=98578
```

**El endpoint está perfecto**: responde 200 con un PDF válido de 98.578 bytes. Con
`fetch` baja sin problema — que es exactamente lo que usa la descarga Word de
Paquetes y Ofertas, y por eso ésa sí funciona, en el mismo navegador y la misma
página. Afecta a Excursiones, Traslados y Cena Show.

### 4. El modal de Proveedores está duplicado en el DOM

`ViewSuppliersModal.ascx` está incluido por `ServiceTariffControl.ascx` **y** por
`HotelTariffControl.ascx`, y tiene sus ids escritos a mano. Como el tarifario
renderiza los dos controles en la misma página, quedan **dos elementos con el mismo
`id`**: `#modalViewSuppliers`, `#suppliersTableBody` y `#suppliersLoading`.

Hoy funciona de casualidad: `openSuppliersModal` usa `document.getElementById` y
jQuery resuelve `$('#id')` igual, y ambos devuelven **el primero** del documento.
Así que los botones de Servicios y los de Hoteles terminan manejando la misma
instancia, y la segunda es markup muerto. Es HTML inválido y queda a merced del
orden de renderizado.

Se detectó porque Playwright falla con *strict mode violation* al resolver el id a
dos elementos. El test toma `.first()` a propósito, para hacer lo mismo que hace la
aplicación.

### 5. El tarifario no respeta `Published` en las tablas de detalle

Cena Show y Traslados tienen `ServiceDetail.Published = 0` en los tres idiomas y
sin embargo el texto se muestra en pantalla.

No es un problema de esos dos ítems: **el flag no se consulta en ningún lado**.

- `ServiceSheetBuilder.cs:54` → `Where(o => o.ServiceID == serviceId && !o.Deleted)`
- `ServiceDetailManager.cs:10` y `:31` → sólo `Deleted == false`
- `ReceptiveTourDetailManager.LoadByTourAndLanguage` → sólo `LanguageID` y el ID

Que Paquetes, Ofertas, Cruceros y Hoteles no lo evidencien es sólo porque están
en `Published = 1`. Es el mismo patrón del hallazgo 5.

### 6. El tarifario muestra amenities con `Published = 0`

Detectado con "Pick up y drop off en hotel" en el Café de los Angelitos. Se
publicaron las que quedaban para que el dato sea coherente, pero conviene consultarlo.

---

## Lo que queda por hacer

### Auditoría de cobertura de la pantalla (2026-09-01)

Barrido del markup del tarifario contra lo que valida la suite. Lo que quedó sin
cubrir, ordenado por dónde está en la pantalla:

**Filtros y cabecera** (`TariffFilterControl.ascx`)

- `#tariffResultCount` — el contador *"90 paquetes en Buenos Aires"*. Está
  declarado en el page object como `contadorResultados` y **nunca se usa**.
- `#tariffClearFilters` — el botón Limpiar. Idem, declarado como
  `btnLimpiarFiltros` y sin usar.
- `#tariffCategoryTags` — los chips de categoría de Hoteles (Lujo, 5*, 4* Superior,
  4*, 3* Superior, 3*, Boutique, Apart Hotel).
- `#tsfFilterToggle` — el filtro Proveedor.
- `ddResident` — un tercer filtro del control, con `Visible="false"` por defecto.

**Pestañas**

- Hay **ocho, no siete**: existe `phTravelSaleTab` / `#travel-sale`, también con
  `Visible="false"`. Sin cobertura.
- `.tariff-update-btn` (`arefresh-*`) — el botón de refresco de cada pestaña, uno
  por cada una. Sin cobertura.

**Card**

- **El carrusel de imágenes.** Es un `Repeater` de `WebImageDTO`, así que una card
  puede tener varias imágenes. Se valida sólo el `src` de la primera: ni la
  cantidad ni la navegación.

**Ficha y modal de detalle** — las cinco solapas quedaron cubiertas:

| Solapa | Qué se valida | Fuente |
|---|---|---|
| Descripción | texto completo | `ServiceDetail.Detail` |
| Ficha Técnica | idiomas, punto de encuentro, drop-off, observaciones y duración por modalidad | `ServiceInfo`, `ServiceObservation` + `ServiceObservationDetail`, `ServiceDuration` |
| Salidas | meses con salida y cantidad de subsolapas de modalidad | `ServiceMonth` y `ServiceCalendar` |
| Incluye / No incluye | nombre **y** descripción de cada ítem | `ServiceToServiceAmenity` + `ServiceAmenityDetail` + `ServiceAmenityObservation` |
| Políticas | texto completo | `ServiceInfo.CancellationPolicy` |

El calendario de Salidas **no se navega**: `.svc-calendar` trae `data-start`,
`data-months` y `data-days` con un código por día (`-1` fuera de operatividad,
`-2` cierre por excepción, `>= 0` día con salida), así que los doce meses se leen
de una sola vez. Lo que queda pendiente ahí es el detalle fino de cada regla:
horarios por día y excepciones puntuales.

Las modalidades del calendario **salen de `ServiceCalendar`, no de
`ServiceDuration`**: son los `RateTypeID` distintos y no nulos. Y con una sola
modalidad el control renderiza el contenido pelado, sin subsolapas
(`RenderModalities`), así que Cena Show espera cero botones y los otros dos
esperan dos. Derivarlo de la base y no de la pantalla es lo que evita dar por
bueno lo que la aplicación hace.

**Transversales**

- **Modo oscuro**: no hay ninguna validación, y el `CLAUDE.md` lo pide para el
  portal online.

### Bloque A — pendientes menores

- **Leyenda "Más observaciones disponibles en el detalle"**: depende de
  `op.HasMoreObservations`, cuyo criterio vive en `ServiceOperativityData`, que no
  está en el repo del WEB. Se adjunta al reporte pero no se exige.

### Multiidioma del portal: diferido a propósito

Los siete tests corren en **Español** y así quedan por ahora. No es un olvido:
se decidió esperar a tener Bloques B y C armados y recién ahí evaluar si conviene
recorrer los tres idiomas dentro de los tests que ya existen, en vez de sumar un
test aparte que después habría que rehacer.

Conviene no confundir dos mecanismos que se llaman igual:

- **Solapas del tarifario** (`srl-lang-tabs-` / `trl-lang-tabs-`): cambian **sólo
  los importes**. `setTourLanguage` reconstruye el `tbody` de las tablas desde
  `langRates` y no toca el modal, el título ni la descripción. **Esto ya se valida
  en los tres idiomas** en las cuatro pestañas que tienen solapas.
- **Toggle del encabezado** (`a.header-flug`, dice ES): cambia
  `AdvisorContext.Current.WorkingLanguage`, que es de donde sale el texto del modal
  y de la card. **Esto es lo que queda sin validar.**

Cuando se encare, hay dos cosas para medir antes de escribir el test:

1. Si al cambiar el idioma se pierden los resultados de la búsqueda del tarifario.
   Si el toggle hace postback y los conserva, no hay que rehacer filtros y buscador
   en cada vuelta.
2. **Si el idioma queda persistido del lado del servidor para el usuario.** Los
   siete tests comparten `Pablo@amv.travel` y el mismo `storageState`: si el idioma
   persiste, el test que lo cambie rompe a los demás y hay que restaurar Español al
   terminar y correrlo al final.

Lo que hay que exigir no es sólo que el texto coincida con el de la base para ese
idioma, sino que **no sea el español**: el defecto típico es que el filtro por
idioma no aplique y el modal caiga al texto por defecto.

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
- **Los pasos se numeran solos**: `paso()` lleva el contador y lo reinicia en el
  `beforeEach`. El título va sin número. Antes venía escrito a mano y bastaba con
  intercalar un bloque de validación para que se repitiera un número.
- **Un paso que falla también adjunta captura**, no sólo los que pasan.
- **Lo que la aplicación hace no define lo esperado**: un defecto conocido no se
  invierte en el assert para que el paso salga en verde. Se deja el paso escrito
  como corresponde, se anota el contexto en `_hallazgoConocido` y se acepta el rojo.
- **Los selectores salen del código fuente** (`WEB/src/AMV.Travel/Web`), nunca se
  inventan. Si hace falta uno que no está en el código, se pide el `outerHTML`.
- **Un selector que sirve para una pestaña no sirve para todas**: hay componentes
  compartidos con prefijos de clase distintos por control. Antes de dar por buena
  una cobertura, verificar en el markup de cada `*TariffControl.ascx` que el
  selector matchee, y contrastar contra lo que la línea base capturó.
- **Las esperas de cierre no se tragan el error.** Cerrar un modal con `Escape` y
  un `.catch(() => {})` dejaba el modal a medias — `aria-hidden="true"` pero con
  la clase `in` puesta — tapando la pantalla y haciendo fallar el paso siguiente
  por un motivo que no tenía nada que ver. Se cierra con el botón que trae el
  markup (`data-dismiss="modal"`) y se exige que quede oculto.
