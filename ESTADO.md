# Estado de la suite E2E — AMV Travel (QA)

Documento de traspaso. Última actualización: **2026-09-04**.

> **Para retomar en otra conversación:** leer este archivo entero y el `CLAUDE.md`
> de la carpeta padre. El **Bloque A está terminado**. Del **Bloque B — Reservas**
> están terminados **los cuatro flujos**; el de Servicio queda en rojo por el
> hallazgo 7. Del **Bloque C — Cobranzas** está hecha la auditoría del ambiente y
> el mapa de las cinco pantallas, y ya están creadas las **cajas propias** (187
> USD y 188 ARS, categoría 18) para no tocar los saldos reales de QA. El
> **Bloque C está terminado**: los cinco eslabones en verde, de la factura de
> proveedor a la caja diaria. El cierre definitivo de caja quedó afuera a
> propósito y es la única consulta abierta del bloque.
>
> Antes de arrancar, mirar las dos secciones marcadas con ⚠️: los datos de QA que
> hay que restaurar y los hallazgos abiertos que explican por qué la suite no está
> toda en verde.

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
npm run test:bloque-a
npm run test:bloque-b
npm run test:bloque-c
npm test                  # los tres bloques
npm run report
```

Los Bloques B y C y la corrida completa van con **un solo worker** a proposito:
ver "Por que los cuatro flujos van en un solo archivo".

En **GitHub Actions** la corrida manual abre un desplegable para elegir que
correr: `bloque-a`, `bloque-b`, `bloque-c` o `todas`, mas un filtro opcional. El
push a main sigue corriendo solo el Bloque A, como antes.

En Allure quedan separados sin configurar nada: el arbol es proyecto > archivo >
describe, asi que el Bloque B aparece como
`Climbs - Suite de pruebas automatizadas > bloque-b/reservas.spec.ts` y el C como
`bloque-c/cobranzas.spec.ts`, hermanos del A y dentro del mismo nodo. El nombre del nodo sale del proyecto de Playwright,
en `playwright.config.ts`.

Usuario de prueba: `Pablo@amv.travel` — WebUserID 332, AgencyID 1 (AMV. TRAVEL),
CityID 5000, CurrencyID 1 (USD), markup del header **M 0.50**.

---

## BLOQUE A — Tarifario: terminado

7 tests, uno por pestaña. **Terminado.**

Con los datos de QA en su estado original, el resultado esperado es **3 en verde y
4 en rojo**, y los cuatro rojos son defectos reales de la aplicación (ver
Hallazgos): Cruceros arrastra dos, y las tres pestañas de servicios fallan en la
descarga del PDF de la ficha.

| Pestaña | Estado esperado | Motivo |
|---|---|---|
| Paquetes | verde | |
| Hoteles | verde | |
| Ofertas | verde | |
| Excursiones | rojo | hallazgo 3 (PDF) |
| Traslados | rojo | hallazgo 3 (PDF) |
| Cena Show | rojo | hallazgo 3 (PDF) |
| Cruceros | rojo | hallazgos 1 y 2 |

> **Un fallo no corta el test.** Las comparaciones se registran con `expect.soft`,
> así una corrida muestra todos los hallazgos juntos en vez de frenar en el
> primero. El fallo duro se reserva para lo que impide continuar de verdad: que no
> abra un modal, que no cargue una pestaña.

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

La comparación va **en los dos sentidos**: cada línea de la base tiene que estar en
pantalla, y cada línea de la pantalla tiene que estar en la base. No se compara la
cadena entera porque el campo guarda HTML y el navegador lo renderiza con sus
propios saltos y espacios, así que una igualdad estricta daría rojo por diferencias
de formato que no le importan a nadie.

> **El sentido inverso es el que detecta los agregados**, y faltaba. Con sólo
> "cada línea de la base está en pantalla", anteponer una palabra a un párrafo no
> se detectaba: la línea original seguía contenida y la comparación pasaba. Se
> descubrió en una prueba de escritorio, agregando la palabra "editado" delante de
> la descripción del hotel 5003: el test seguía en verde. Los borrados y las
> modificaciones en el medio sí los detectaba desde el principio.

### Barra de operatividad de la card

`RenderOperativityIcons` (`ServiceTariffControl.ascx.cs:99`) arma hasta tres ítems,
y se validan los tres por separado en vez de contar cuántos hay:

| Ítem | Qué se valida | Fuente |
|---|---|---|
| Duración (`ph-clock`) | el texto es la duración de la modalidad Regular | `ServiceDuration` con `RateTypeID = 6` |
| Idiomas (`ph-translate`) | el tooltip lista **exactamente** los idiomas de la base | los idiomas del servicio |
| Amenities destacadas | nombre y observación **exactos, y sin que sobre ninguna** | `ServiceAmenity.IsPriority = 1` + `ServiceAmenityObservation` |
| Operatividad (`.tariff-op-calendar`) | el resumen de temporada **no nombra un mes que la base no opera** | `ServiceMonth` |

Del resumen de temporada no se compara la cadena entera: el control la abrevia en
rangos (`Ene–Mar, May–Jul, Oct–Dic`) y reconstruir ese formato sería reimplementar
su lógica. Se valida por la negativa, que es lo que detecta un error real, y la
comparación exacta de meses ya la hace la solapa Salidas contra `ServiceMonth`.

> El tag **RECOMENDADO** de la card de hoteles sale de `Hotel.Great = 1`,
> verificado en QA sobre el hotel 5003. Antes el esperado estaba escrito a mano
> sin trazabilidad.

### Descripción de la card

La card muestra el mismo campo que el modal pero **recortado**: `TruncateDetail`
corta en 250 o 400 caracteres y agrega `...` (`ServiceTariffControl.ascx.cs:206`).
Por eso no se compara por igualdad sino **por prefijo**: el texto de la card tiene
que ser el comienzo exacto del de la base. Detecta lo mismo — una palabra agregada
adelante deja de ser el comienzo, un cambio en el medio deja de coincidir — sin
depender de dónde corta.

**Hay dos estructuras distintas y hay que tratarlas por separado:**

| Control | Markup | Dónde está la descripción |
|---|---|---|
| Servicios | `<p class="tariff-service-description">` | todo el párrafo; el link "Ver Detalle" vive **afuera**, en la barra de operatividad |
| Hoteles, Paquetes, Ofertas, Cruceros | `<p>[etiquetas/ciudades]<br />Detalle<a>Ver detalle</a></p>` | lo que va después del último `<br>`, sin el link |

> La primera versión buscaba "el párrafo que contiene un `<a>`". En servicios ese
> párrafo **no tiene link**, así que caía al `.tariff-detail` entero y se traía las
> observaciones y la barra de operatividad: fallaba en las siete pestañas. La
> estructura estaba en el markup de cada control desde el principio; el error fue
> suponerla en vez de leerla.

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

Está aplicado en **todas** las comparaciones, no sólo en los componentes de la
card y en los importes: nombre del ítem, observaciones destacadas, barra de
operatividad y sus tooltips, tag, cuerpo del detalle, ficha técnica, políticas y
tabla de proveedores. Se resuelve con el helper `conResaltado`, que corre la
comparación y, si falla, marca la zona antes de propagar el error.

> **Los tooltips se fuerzan a visible antes de capturar.** Sólo se muestran al
> pasar el mouse, así que en una captura no salían nunca: el reporte marcaba en
> rojo un icono y no se veía el texto que estaba mal. `resaltarYCapturar` los
> despliega cuando están dentro del elemento resaltado.

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

Tarifas de **venta** cargadas hasta 2031/2032. Datos esperados en
`data/candidatos.json`; importes en `data/importes-lineabase.json`.

**Tarifas de costo por proveedor (2026-09-02).** El Bloque A nunca las necesito
—el tarifario no las muestra— y estaban todas vencidas: la mas nueva terminaba en
2023, asi que el file se generaba con costo cero. Se cargaron **8 filas** en
`BO_ServiceCostBySupplier` para los servicios 5, 163 y 1223, una por modalidad,
replicando la fila mas reciente de cada combinacion para no inventar importes ni
proveedores, con vigencia `20260101`–`20321231` y `Detail` marcado con el prefijo
`AUTO-QA NO TOCAR`. Las cinco que estaban en ARS se pasaron a USD y se les
convirtio el importe con la cotizacion publicada del sistema (2.001), para que
costo y venta queden en la misma moneda que el file.

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

### Cajas propias para el Bloque C — creadas el 2026-09-04

Las cajas de QA tienen saldos reales (CAJA CHICA $AR arrastra 5.905.359). Para que
la suite no los mueva se creó **una categoría propia con dos cajas**, siguiendo el
mismo criterio que el resto de los datos de prueba:

| Qué | ID | Código | Moneda | Saldo inicial |
|---|---|---|---|---|
| Categoría `AUTO-QA NO TOCAR - CAJAS DE REGRESION` (sucursal 1) | 18 | 00099 | — | — |
| Caja `AUTO-QA NO TOCAR - CAJA USD` | 187 | 00001 | 10 (USD) | 0,00 |
| Caja `AUTO-QA NO TOCAR - CAJA ARS` | 188 | 00002 | 20 (ARS) | 0,00 |

Dos cajas y no una porque la cadena cruza monedas: la sucursal es ARS y el file
USD, así que el pago al proveedor y el cobro al cliente pueden caer en monedas
distintas. Categoría propia para que la limpieza sea de un saque.

Los valores no son arbitrarios, salen del código:

- `ExchangeRateId = 3` — no es un tipo de cambio sino un **tipo de tasa** 1..4
  (`ExchangeRateTypeEnum`; el 4, "Moneda primaria", dispara otra rama). Es el que
  usa CAJA GRANDE U$D: se copia una caja real en vez de inventar una configuración
  que no existe en producción.
- `CashFlowClass = 1` (Caja Real) — el combo de la pantalla no tiene opción vacía,
  así que toda caja creada hoy queda en 1 o en 2. Los NULL son filas viejas.
- `CashFlowType = 10` (CF) y `LedgerAccountID = 1`, igual que las cajas de efectivo.
- Nombre en mayúscula porque **la pantalla lo fuerza** (`CashFlows/Detail.aspx.cs:247`).

Se verificó que crearlas por SQL es equivalente a crearlas por pantalla: el
guardado es un INSERT pelado más una fila de auditoría, sin tablas laterales ni
movimiento inicial. Y **no están cacheadas** (`WebCache.cs` no las menciona), así
que aparecen en el desplegable en la carga siguiente.

Aparecen en la orden de pago/cobro si se cumple
`Published && !Deleted && Currency == moneda de la orden && categoría publicada &&
categoría.BranchID == sucursal`, ordenadas **por nombre**
(`CashFlowSvc.LoadPublishedByBranch`, línea 75). El prefijo AUTO-QA las deja
arriba del desplegable.

**Limpieza**, cuando el Bloque C se dé de baja:

```sql
DELETE FROM qa.dbo.BO_CashFlow WHERE CashFlowCategoryID = 18;
DELETE FROM qa.dbo.BO_CashFlowCategory WHERE ID = 18;
```

Ojo: si ya hubo movimientos de caja imputados a las cajas 187 o 188, el DELETE va
a chocar con la FK. En ese caso marcarlas `Deleted = 1, Published = 0` en lugar de
borrarlas.

---

## ⚠️ Datos de QA modificados a propósito — hay que restaurarlos

El 2026-09-01 se editaron datos en QA **a propósito**, para comprobar que la suite
detecta los cambios. Sirvió: encontró varios huecos reales de las comparaciones.
Pero **hasta que se restauren, esas pestañas van a seguir en rojo por un motivo
que no es un defecto de la aplicación.**

| Ítem | Qué se cambió | Valor original |
|---|---|---|
| Hotel 5003 | `HotelDetail.Detail` con `editado!` antepuesto | el texto sin ese prefijo |
| Excursión 5 | observación de la amenity **Bebidas** con `EDITADO!` antepuesto | `Bebidas a cargo del pasajero durante la navegación` |
| Cena Show 163 | primera observación destacada con `editado!` antepuesto | `No aplica para cenas de Navidad y Año Nuevo` |
| Paquete 5059 | nombre con `EDITADO!` antepuesto | `AUTO-QA NO TOCAR - Paquete Buenos Aires y Ushuaia (6 días / 5 noches)` |
| Traslado 1223 | recargo por idioma llevado al **200%** | **10%** |

Los valores originales están en `data/candidatos.json` y en
`data/importes-lineabase.json`, así que **la propia suite es la verificación**:
cuando esas pestañas dejen de fallar por estos motivos, el dato quedó restaurado.
Ojo con el paquete: el prefijo se aplicó también en `ReceptiveTourDetail`, así que
el nombre hay que revisarlo en los dos lugares.

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

Confirmado también sobre la tabla maestra: `ServiceAmenity` ID 140,
**"Pick up y drop off en hotel", tiene `Published = 0`** y se sigue mostrando en la
ficha de Cena Show. Las otras diez amenities de los ítems de prueba están en 1.

Detectado con "Pick up y drop off en hotel" en el Café de los Angelitos. Se
publicaron las que quedaban para que el dato sea coherente, pero conviene consultarlo.

---

### 7. El servicio suelto llega al file oculto para SIX

En la grilla **Destinos & Servicios** del file, cada ítem de servicio muestra un
ojito que indica si se ve en SIX (`ManageFile.aspx:697`):

```
fa-eye text-info          Show = true    "Ocultar en SIX"     <- habilitado
fa-eye-slash text-danger  Show = false   "Mostrar en SIX"     <- oculto
fa-eye-slash text-muted   la agencia no tiene SIX habilitado
```

Una reserva de **servicio suelto** genera su ítem con el ojito **oculto**; los
servicios que entran dentro de una **oferta** llegan habilitados.

La causa está en las dos ramas que crean los ítems del file:

- `CreateServices(BO_File file)` — la de CustomTours — asigna `Show = true` en
  las nueve ramas, entre las líneas 2277 y 3051.
- `CreateServices(BO_File file, List<FileInboxItemObj> all)` — la de servicios y
  hoteles — **no asigna `Show` en ningún lado**, así que queda en `false`, el
  valor por defecto de un `bool`.

El hotel no lo evidencia porque el ojito sólo se renderiza en las filas de
servicio (`FileItemType == 10`).

Lo marca en rojo el test de Servicio del Bloque B, nombrando el ítem. El paso
queda escrito como corresponde —el ojito tiene que venir habilitado— y se acepta
el rojo hasta que se corrija.

## Lo que queda por hacer

### Auditoría de cobertura de la pantalla (2026-09-01)

Barrido del markup del tarifario contra lo que valida la suite. De acá salieron
las validaciones de proveedores, las cinco solapas del detalle, la barra de
operatividad y la descripción de la card, que ya están hechas. **Esto es lo que
quedó sin cubrir**, ordenado por dónde está en la pantalla — es el material para
una futura ampliación del Bloque A, no algo que bloquee el Bloque B:

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

## BLOQUE B — Reservas: terminado

Cuatro flujos: **sólo servicio, sólo hotel, sólo oferta y multidestino**. En todos
se guardan los datos con los que se generó la reserva y se valida que el BO los
conserve idénticos, **y que sigan idénticos después de generar el file**.

**Terminado: los cuatro flujos.**

Con los datos de QA en su estado actual, el resultado esperado es **3 en verde y
1 en rojo**: el de Servicio marca el hallazgo 7, que su ítem llega al file oculto
para SIX. No es una regresión de la suite.

| Flujo | Riel | Entrada | Estado esperado |
|---|---|---|---|
| Servicio | clásico | solapa SERVICIOS | rojo — hallazgo 7 |
| Hotel | clásico | solapa HOTELES | verde |
| Oferta | CustomTours | solapa OFERTAS, Ushuaia | verde |
| Multidestino | CustomTours | solapa MULTIDESTINO, Buenos Aires | verde |

Los dos flujos de CustomTours comparten el recorrido del portal entero
(`armarCircuitoYEmitir`): cambian la solapa, la ciudad y el combo donde se elige
el viaje, no lo que hay que hacer después. El paquete y la oferta se componen de
los mismos cuatro candidatos AUTO-QA, con tarifas distintas — Tigre y Delta entra
a USD 42 en el paquete y a USD 418 en la oferta, porque cambia la modalidad.

### Los cuatro flujos entran por INICIO

No es una preferencia, es la única puerta que da el sistema. El buscador de la
pantalla de inicio tiene una solapa por flujo y cada una manda a otro lado:

| Solapa de INICIO | A dónde lleva | Flujo |
|---|---|---|
| SERVICIOS | `serviceall.aspx` | sólo servicio |
| HOTELES | `HotelWithIntegration.aspx` | sólo hotel |
| OFERTAS | `customtours/main.aspx?tour={id}` | sólo oferta |
| MULTIDESTINO | `customtours/main.aspx?tour={id}` | multidestino |

En OFERTAS y MULTIDESTINO el combo del ítem decide: con "Todos" se va al listado,
eligiendo uno se entra directo a la pantalla de armado.

> **No son cuatro flujos paralelos, son dos rieles.** Servicio y hotel van por
> `ShoppingCartPage.aspx` → `CheckOut.aspx`. Oferta, paquete y multidestino van
> por el módulo CustomTours, que tiene su propio carrito-checkout en una sola
> pantalla (`ShoppingCartCustomTour.aspx`). Los dos terminan en
> `BookingHistory.aspx`. Son dos page objects, no uno.

> Corrección al traspaso anterior: "Cotizar y reservar" del tarifario **no**
> navega a `ShoppingCartPage.aspx`, va a `customtours/main.aspx`
> (`NewTourTariffControl.ascx.cs:150`).

### Los 17 pasos de cada flujo

```
 1. Vaciar el carrito y abrir la solapa SERVICIOS de INICIO
 2. Buscar excursiones en Buenos Aires para la fecha elegida
 3. Ubicar el servicio por nombre y entrar a su ficha
 4. Elegir la modalidad Regular con la cantidad minima de pax y reservar
 5. Revisar la fila del carrito y pasar a los datos de la reserva
 6. Cargar los pasajeros y los datos de la reserva en el checkout
 7. Confirmar la reserva y tomar su codigo del historial
 8. Abrir el detalle de la reserva en el portal y verificar los comentarios
 9. Entrar al BackOffice y abrir la bandeja de Reservas
10. Ubicar la reserva en la bandeja y comparar la fila
11. Abrir el detalle y comparar los datos de la reserva
12. Comparar la grilla de pasajeros y el item reservado
13. Elegir la sucursal y generar el file desde el detalle
14. Comparar los datos del file contra los cargados en el portal
15. Abrir el Rooming del file y comparar los pasajeros
16. Comparar el servicio en Destinos & Servicios del file
17. Conciliar los importes de punta a punta
```

El puente entre las dos aplicaciones es el código **`BOxxxxxxxx`**, que las dos
arman igual (`AdvisorHelper.SetBookCode` y `CodeHelper.OnlineBookingCode`). El
test lo lee del historial después de emitir y con eso busca la fila en el BO.

### Mapeo portal → BO → file

Los mismos ids estáticos sirven en el detalle de la bandeja y en el file, así que
la comparación se corre **dos veces con la misma exigencia**: si un dato se pierde
al generar el file, el paso 13 lo marca contra el valor que cargó el portal.

| Cargado en el portal | Guardado en | Mostrado en el BO |
|---|---|---|
| `txtPaxQuantity` | `WholesalerBook.PaxQuantity` | `txtQuantity` |
| `txtReference` | `WholesalerBook.Reference` | `txtCustomerReference` |
| `txtComment` | `WholesalerBook.Comment` | `txtComment` |
| pasajero 1 | `Passenger.Name` / `Surname` / `Nationality` | `txtPaxName` / `txtPaxLastName` / `txtPaxNationality` |
| — | compuesto | `txtMainName` = `NOMBRE/APELLIDO x cantidad` |
| todos los pasajeros | `Passenger` | grilla `#tblPassenger`, y `#tblRooming` en el file |

### Qué se compara y qué no

Auditado dato por dato contra lo que la reserva y el file contienen:

| Dato | Bandeja | Detalle | File |
|---|---|---|---|
| Servicio, modalidad y fecha | — | sí | sí |
| Cantidad de pax | — | sí | sí |
| Referencia | sí | sí | sí |
| Observaciones | — | sí | sí |
| Nombre, apellido y nacionalidad del pax principal | sí | sí | sí |
| Todos los pasajeros: nombre, apellido, documento, nacionalidad y fecha de nacimiento | — | sí | sí (rooming) |
| Nom. File compuesto | — | sí | sí |
| Agencia, usuario, mail, ciudad y país | sí | — | — |
| Importes y moneda | sí | sí | sí |
| Comentario del ítem — Fecha(s) / Vuelo | — | — | — |

**El comentario del ítem no se puede comparar en el BO.** Va a
`WholesalerBookItemDetail` y **ninguna pantalla del BO ni del WebAdmin lo lee**:
sus únicos consumidores son `BookingHistoryDetail.aspx` y las plantillas de mail
(`Web/Mailing/CustomerBookingTemplate.aspx` y las de cancelación), que es como le
llega al proveedor. **Se compara en el portal**, y por eso el paso 8 entra al detalle
de la reserva recién emitida: ahí se imprime en `p.pdiscl`. Buscarlo sólo en el BO
habría dejado un hueco permanente.

**No queda ningún dato cargado por el test sin comparar.**

El **Costo** del file no se compara a propósito: no es un dato que el portal
cargue. Se adjunta al reporte.

### Por qué ninguna comparación puede pasar en falso

Un `toContain` con un esperado no vacío no puede pasar sin comparar: si el
localizador no resuelve nada, el texto obtenido queda vacío y la comparación
falla. Y referencia, observaciones, comentario del ítem, apellido y pasaporte
llevan un **sello de tiempo por corrida**, así que una coincidencia no puede venir
de datos de una corrida anterior.

Quedaban **dos caminos** que podían saltear una comparación, y los dos están
cubiertos:

- `if (!i.moneda) continue` en la conciliación: es legítimo, porque la Venta del
  file se escribe sin código de moneda. **Probado por inyección.**
- El de los datos de contexto de la bandeja **se eliminó**: ahora exige que el
  esperado exista antes de comparar.

### Trampas verificadas contra QA

Ninguna se ve leyendo el código. Todas costaron una corrida:

| Dónde | Qué pasa |
|---|---|
| Fecha del buscador | Es un daterangepicker: **si se tipea, el widget reescribe el campo con su fecha de inicio** y la búsqueda sale con la del día. Hay que abrir el calendario y clickear el día. El paso 2 exige que la fecha viaje en la URL |
| Listado de servicios | Pagina de a 10 con scroll infinito. Se usa el buscador por nombre de la pantalla (`#svcNameSearch`), igual que el tarifario |
| Nombre del ítem | El `h4` corta a 27 caracteres. Y buscar "Tigre y Delta" trae **otra** excursión: hay que exigir el nombre completo |
| Cantidad de pax | La ficha declara "Mínimo N pasajeros" pero el combo ofrece menos. Se lee el mínimo de la pantalla |
| Carrito vacío | Con el contador en cero el ícono **no navega**. Se mira el contador antes de entrar |
| Checkout | Arranca con un solo bloque de pasajero: hay que presionar "Añadir Pasajero". Y el ListView **no numera de corrido**, así que el prefijo del id se deriva del DOM |
| Historial | Dos solapas, y la del código puede no ser la activa |
| **Generar file** | Corta con *"Se debe seleccionar una sucursal"* si `ddBranch` está en -1. Es un paso del flujo, no un detalle |
| Mayúsculas | El detalle de la bandeja pasa a mayúscula nombre, apellido y nacionalidad; **el file no**. Mismo id, dos formatos |
| Fecha de nacimiento | El BO la arma `dia/mes/anio` sin ceros a la izquierda: `05/03/1990` se muestra `5/3/1990` |
| Rooming | Se llena **por AJAX después** de mostrarse el modal, y sus celdas son campos editables: hay que leer los valores, no el texto |
| Grilla del file | ListView anidado. La fila del servicio se ubica por `a.fileitemdetail`, y la columna Venta va **sin código de moneda** |

### Conciliación de importes

Va en **dos cadenas**, porque el sistema maneja dos números distintos y los dos
tienen que conservarse:

```
Precio de venta   ->  ficha = carrito = V. Markup del detalle
Costo neto        ->  historial = bandeja = item del file = Totales del file
```

**No se recalcula nada**: el total no es cantidad por precio unitario — 2 pax a
USD 10 dan USD 19, porque el redondeo hacia arriba va sobre el total. Se captura
el número que mostró el portal y se exige ese mismo aguas abajo. Se compara el
**número, no el texto**: el portal escribe `USD 19` y el BO `USD 19,000`.

También se compara **la moneda en todos los puntos**, que es donde aparecería un
cruce que mirando sólo el importe no se ve.

> **Consulta abierta para producto.** `WholesalerBookItem.TotalRate` es el precio
> de venta (19) y `NetTotalCost` el neto (10). Para las reservas posteriores al
> 20/10/2025 `LoadWholesalerData` se queda con el neto — el código lo firma como
> *HU 2839* — y ése es el que llega al file. **El precio que pagó la agencia no
> queda guardado en ninguna parte del file**: sólo se calcula al vuelo para la
> columna V. Markup del detalle. Y el file toma su markup del Market de la
> agencia, no de la reserva, así que tampoco se puede recomponer desde ahí.
> Es decisión de negocio, no de QA.

### Por qué los cuatro flujos van en un solo archivo

**El carrito es del lado del servidor y está atado a la cookie de sesión.**
`ShoppingCartManager` filtra por `CustomerSessionGUID`, que sale de
`Advisor.WebUserSessionGUIDCookie` (`AdvisorContext.cs:402`). Como todos los tests
reusan el mismo `storageState`, dos flujos en paralelo se pisarían el carrito.
Por eso van juntos y con **un solo worker**, y por eso el paso 1 vacía el carrito:
lo que quede de una corrida aparece en la siguiente.

### La fecha de la reserva y la operatividad

La fecha sigue siendo **hoy + 7**, y es a propósito. Se evaluó elegir el primer
día operable y **no se puede sin salirse del flujo**: la ficha de reserva
(`ServiceDetail.aspx`) no muestra la operatividad. Ese calendario con `data-days`
lo arma `ServiceSheetCalendarHtml`, que es la ficha del **tarifario**.
La persona que reserva tampoco la ve: elige el día en un calendario común.
Hacer que el test la consultara sería hacerle hacer algo que la pantalla no ofrece.

Lo que sí se hace es que, si la fecha no tiene tarifas, **el paso 3 corte con el
motivo escrito** — "revisar la operatividad del servicio y la vigencia de sus
tarifas de venta" — en vez de morir después en un timeout que parece un defecto
de la aplicación.

### Las comparaciones están probadas contra un fallo real

Un assert que nunca se puso en rojo no está probado: puede estar comparando
contra nada y pasar igual. Las de pasajeros, importes, mayúsculas, rooming y la
grilla del file se vieron fallar durante el armado. Las dos que nunca habían
fallado se verificaron **inyectándoles el defecto que existen para atrapar**:

| Guarda | Defecto inyectado | Resultado |
|---|---|---|
| Paso 2, la fecha viaja en la URL | tipear la fecha en vez de elegirla en el calendario | rojo: esperaba `checkin=09/09/2026`, recibió `02/09/2026` |
| Paso 16, la moneda es la misma en todo el recorrido | forzar `ARS` en la captura de la bandeja | rojo: esperaba `USD`, recibió `ARS`, nombrando el punto de la cadena |

Las dos se revirtieron después de comprobarlas. **Conviene repetir este ejercicio
con cada comparación nueva que se agregue** y no darla por buena porque pase.

### Lo que queda del Bloque B

- Nada de los cuatro flujos. Lo que sigue es el **Bloque C**.
- **Auditar los costos del candidato antes de escribir cada flujo.** Hotel 5003,
  oferta 5060 y paquete 5059 tienen sus propias tablas. Encontrar el hueco antes
  de escribir el test y no a mitad de la corrida, como pasó con el servicio.
- Las reservas y los files quedan en QA. Se identifican por la referencia
  `AUTO-QA <sello>`, que viaja intacta del portal al BO.


## BLOQUE C — Cobranzas: terminado

Cadena completa: **factura de proveedor → orden de pago → factura de cliente →
orden de cobro → caja diaria con sus movimientos**.

**Es una cadena, no cinco tests sueltos**: cada eslabón necesita el anterior. Se
decidió que cada flujo genere su propia precondición en vez de depender de datos
preexistentes, que es lo que hace fallar hoy a `bo_crear_op.py` de la suite vieja.

El punto de partida es el file que deja el Bloque B: la reserva emitida en el
portal se identifica por `Referencia = AUTO-QA <sello>` y su file se genera desde
el detalle de la bandeja.

### Las rutas reales

Salen de `Global.asax.cs`, no del menú:

| Paso | Ruta | Página |
|---|---|---|
| Bandeja de facturas de proveedor | `administration/supplierinvoices` | `SupplierInvoices/Default.aspx` |
| Factura de proveedor | `administration/supplierinvoice/{id}` | `SupplierInvoices/Detail.aspx` |
| Bandeja de órdenes de pago | `administration/payorders` | `PayOrders/Default.aspx` |
| Orden de pago | `administration/payorder/{id}` | `PayOrders/Detail.aspx` |
| Factura de cliente | `invoice-management/invoicing/newinvoice` | `Invoicing/NewInvoice.aspx` |
| Bandeja de órdenes de cobro | `administration/chargeorders` | `ChargeOrders/Default.aspx` |
| Orden de cobro | `administration/chargeorder/{id}` | `ChargeOrders/Detail.aspx` |
| Caja diaria | `administration/movements/daily-cash/{id}` | `Movements/DailyCash.aspx` |

Dos rutas puente que valen oro para encadenar sin adivinar:

```
administration/payorder/payorder-cash/{id}/{dailycashid}
administration/chargeorder/chargeorder-cash/{id}/{dailycashid}
```

Abren la orden **dentro del contexto de una caja diaria**. Es el camino que ata la
orden con el movimiento de caja.

En `daily-cash/{id}`, el `{id}` es el de la **caja diaria** (el día), no el de la
caja (`DailyCash.aspx.cs:73`). Con `0` se abre una nueva.

### Auditoría del ambiente — 2026-09-04

Seis consultas contra `qa.dbo`, ejecutadas antes de escribir una línea:

| Qué se verificó | Resultado | Consecuencia |
|---|---|---|
| La sucursal | `BO_Branch` 1 = Argentina, `CountryID` 10, `CurrencyID` **20 (ARS)**, `FilePrefix` AMV-AR, publicada | la cadena vive en una sucursal en pesos |
| El usuario del BO | `BO_UserApp` 79 = `pablo@amv.travel`; `BO_UserToBranch` 71 lo ata **sólo** a la sucursal 1 | el combo de sucursal no ofrece otra cosa: `elegirSucursal('Argentina')` no puede errar |
| Categorías de cash flow | 12 en la sucursal 1; publicadas 1-8, 11 y 12; **borradas 9 y 10** | la 1 es EFECTIVO EN OFICINA BUE, "$AR / USD / EU" |
| Cajas | `BO_CashFlow` **no tiene sucursal**: cuelga de `CashFlowCategoryID` | para filtrar por sucursal hay que pasar por la categoría |
| El proveedor | 1047 = GRUPO SUMMA SRL, publicado, disponible, sucursal 1, `CurrencyID` 10 (USD), cuenta corriente, plazo 30 | sirve como proveedor de la factura |
| Facturas existentes | ninguna sobre un file nuestro; las últimas son de Colombia (sucursal 3, proveedor 150, US 4394) | se empieza de cero |

### Las trampas, detectadas antes de escribir nada

**1. La sucursal es ARS y el file es USD.** `BO_Branch` 1 tiene `CurrencyID` 20 y
los files que deja el Bloque B están en moneda 10. La cadena cruza monedas de
entrada, así que el tipo de cambio no es un detalle de la pantalla: es parte del
resultado esperado de cada eslabón.

**2. Las cajas de QA tienen saldos reales — resuelto.** CAJA CHICA $AR arrastra
5.905.359; INGRESOS BRUTOS CABA, 13.342.662. Una suite que confirme órdenes
**movería esos saldos**. Por eso el 2026-09-04 se crearon cajas propias: categoría
**18** con las cajas **187 (USD)** y **188 (ARS)**, las dos en cero. El detalle y
la consulta de limpieza están en "Cajas propias para el Bloque C".

**Ninguna caja preexistente se usa.** Si un test elige otra, es un error del test.

**3. El proveedor tiene la caja equivocada precargada.** `BO_Supplier` 1047 tiene
`CashFlowID = 7`, que es **CAJA CHICA $AR** — la de pesos, la del saldo de 5,9
millones. Un proveedor en dólares con la caja de pesos por defecto. Hay que elegir
la caja explícitamente y, además, **verificar cuál viene propuesta**: si la
pantalla la arrastra sola, es un hallazgo para consultar.

**4. La factura no se ata al file por una columna.** `BO_SupplierInvoice` **no
tiene `FileID`**. El vínculo es una imputación aparte:

```
BO_FileItemToSupplierInvoice
  Amount, FileID, FileItemID, SupplierInvoiceID, FileItemType,
  Comment (máx. 50), IsInternal, CreationDate, Published, Deleted
```

`FileItemType`: **10 y 20** → `BO_FileItem`, **30** → `BO_FileSpecialItem`,
**40** → `BO_Ticket` (`Module/SupplierInvoiceAllocControl.ascx.cs:405-470`).
Verificar la factura no alcanza: hay que verificar la imputación.

**5. El pendiente se calcula sobre `BaseRate`, no sobre `TotalRate`.**
`litPending` muestra `invoice.BaseRate - allocatedAmnt`
(`SupplierInvoiceAllocControl.ascx.cs:213`). Cualquier expectativa escrita contra
el total va a fallar en cuanto la factura tenga impuestos.

**6. La imputación reescribe el file.** Además de crear la fila, suma a
`BO_FileItem.AllocatedAmount` (o `AllocatedAmountInternal` si es interna) el monto
**convertido**: `allocation.Amount.ConvertAmount(CurrencyID, item.CostCurrency,
ExchangeRate)` (línea 419). Ahí es donde se materializa el cruce de monedas del
punto 1, y es lo que hay que verificar en base.

**7. `BalanceAmount` no copia `TotalRate`.** Copia `PayableAmount`, o sea el total
menos retenciones. En la factura 87856 quedó 1.111,50 contra un total de 1.190.

**8. Hay dos pantallas "NewInvoice".** `invoice-management/invoicing/newinvoice`
(`Invoicing/`) es la nuestra. `invoice-management/fiscal/newinvoice` (`Fiscal/`)
es la fiscal, la que se usó en la US 4394 de Colombia. No confundirlas.

**9. Las facturas internas comparten pantalla.** `administration/internalinvoice/
{internal}/{id}` entra a la misma `Detail.aspx` con el flag `IsInternal`, que
cambia qué campo del file se actualiza.

**10. La suite vieja tiene un selector mal.** `bo_payorder_page.py` usa
`lnkAsignarTotal`, que es de órdenes de **cobro**. El de órdenes de **pago** es
`lnkMassiveAllocate` (`Module/PayOrderAllocationControl.ascx`). El de cobro
(`bo_chargeorder_page.py`) sí está bien.

**11. `CashFlowType` no filtra nada.** El enum es `0 = NCF`, `10 = CF`
(`BO.Core/Enum/CashFlowTypeEnum.cs`) y sólo se usa como etiqueta en el reporte de
fondeo. No sirve para distinguir cajas usables de las que no.

### Los ids de cada pantalla

Extraídos de los `.aspx`, para no descubrirlos a mitad de la corrida.

**Factura de proveedor** — `SupplierInvoices/Detail.aspx`:

```
ddBranch  txtDocNumber  txtSupplier / hiddenSupplier  ddPaymentMethod
ddTypeInvoice  txtInvoiceBranch  txtInvoiceNumber  txtInvoiceDate  txtDueDate
ddCurrencyID  txtExchangeRate  txtTotalRate  ddAccountingDate  txtComment
btnSave  btnSaveAndBack  btnApprove  btnCancelar
```

**Orden de pago** — `PayOrders/Detail.aspx`:

```
ddBranch  txtSupplier / hiddenSupplier  ddCurrency  txtExchangeRate  txtDate
txtDueDate  txtCode  txtDetail  txtDocNumber  txtTotalAmount  ddApplyMonth
ddCashFlow1..4  txtAmount1..4  txtAmountDueDate1..4  ddPaymentRefs
txtReceiptNumber  txtReceiptNumberInt  txtReceiptDate
ctrlPayOrderAllocationControl  btnSave  btnApprove  btnGoBack  btnCancelar
litStatus  litAnnulled
```

Cuatro pares caja/importe: una orden puede pagarse desde hasta cuatro cajas.

**Factura de cliente** — `Invoicing/NewInvoice.aspx`:

```
ctrlSearchFileControl  txtFileNumber  hiddenFile  hiddenCustomer  hiddenFileCustomer
ddBusinessInfo  ddTypeInvoice  ddCurrency  ddCurrencyRelated  txtExchange
ddSaleConditionID  txtPaxName  txtServicesDate  txtDueDate  txtTotalRate
txtVoucherNumber  hiddenVoucherNumber  txtDetail  hiddenInvoicingItems
cbxIncluirDatosCuenta  spanName  spanDocument  spanConditionFiscal
btnSave  btnCancelar
```

La factura entra **por el file**: `ctrlSearchFileControl` + `txtFileNumber`. Es el
eslabón que ata la cadena con el Bloque B.

**Orden de cobro** — `ChargeOrders/Detail.aspx`:

```
txtCustomer / hiddenCustomer  ddCurrency  txtExchangeRate  txtDate  txtDueDate
txtCode  txtDetail  txtDocNumber  txtTotalAmount  ddApplyMonth
ddCashFlow1..2  txtAmount1..2  txtAmountDueDate1..2  ddPaymentRefs
txtReceiptNumber  txtReceiptNumberInt  txtReceiptDate
ctrlChargeOrderAllocationControl  btnSave  btnApprove  btnGoBack  btnCancelar
litStatus  litAnnulled
```

Dos pares caja/importe, no cuatro: la de cobro admite la mitad que la de pago.

**Caja diaria** — `Movements/DailyCash.aspx`:

```
ddBranch  txtDate  txtCode  txtDetail  ddCashFlowTotals
lvDailyExpenseItems  lvTotals  lnkAdd  lnkDelete  lnkClose  lnkCopyDailyCash
lnkDailyMovementTmpl  btnSave  btnReview  btnCancel
```

`btnReview` es el pre-cierre y `lnkClose` el cierre. El cuadre es donde aparecen
los bugs, así que el test no puede quedarse en la apertura.

### Modelo de datos del eslabón 1

`BO_SupplierInvoice` — columnas que importan:

```
InvoiceType  InvoiceBranch  InvoiceNumber  InvoiceDate  AccountingDate  DueDate
Related  BaseRate  TotalRate  AssignedAmount  BalanceAmount  PayableAmount
TaxableBase  WithholdingTotal  ExchangeRate  PaymentMethod  Status  Locked
IsInternal  SupplierID  CurrencyID  UserID  BranchID  FiscalCountryID
Published  Deleted  ApproveDate  ApproveUserID  FiscalData (JSON)
```

`Status = 10` con `ApproveDate` en NULL es "cargada sin aprobar". `CurrencyID`
guarda el `Identifier` de `BO_Currency`, no el `ID` de `Currency`.

### Eslabón 1 — Factura de proveedor: terminado, en verde

`tests/bloque-c/cobranzas.spec.ts` + `pages/factura-proveedor.page.ts`.

El test **arma su propia precondición**: reserva el servicio en el portal, lo
emite y genera el file, y recién ahí carga la factura. No es capricho — un ítem
de file **se puede imputar una sola vez**, así que cada corrida necesita un file
nuevo. Depender de uno que ya exista es lo que hace fallar hoy a la suite vieja.

Los helpers de comparación están repetidos a propósito, igual que hizo el Bloque
B con los del A: cada bloque es autocontenido. Lo que sí se comparte son los
**page objects**, que son estables.

```
PRECONDICION
 1. Reservar un servicio en el portal y emitir la reserva
 2. Confirmar la reserva y generar su file en el BackOffice

FACTURA DE PROVEEDOR
 3. Entrar a la bandeja de facturas de proveedor y abrir una nueva
 4. Verificar los valores con los que nace el comprobante
 5. Elegir el proveedor y verificar lo que completa solo
 6. Cargar el tipo, el numero, la moneda y el total del comprobante
 7. Guardar el comprobante y verificar que quedo con los datos cargados
 8. Verificar el pendiente de asignacion contra el total cargado
 9. Buscar el file entre los items pendientes y comparar la fila
10. Abrir la asignacion y comparar los cuatro importes del modal
11. Imputar el comprobante al item y verificar que el pendiente baje a cero
12. Verificar que el item paso a la grilla de asignados
13. Aprobar el comprobante y verificar que quede aprobado
```

#### Lo que el código impone y condiciona el test

**El alta y la imputación no se pueden hacer de una.** En una factura nueva el
control de asignación y el botón Aprobar están ocultos
(`Detail.aspx.cs:697-698`), y aparecen recién cuando el comprobante ya existe.
Guardar redirige a `administration/supplierinvoice/{id}`, y de ahí sale el ID
igual que el del file.

**El número tiene que ser único por corrida.** El guardado rechaza con "Ya existe
un comprobante con el mismo número y el mismo proveedor" si coinciden tipo, punto
de venta, número y proveedor (`Detail.aspx.cs:987`). El test lo deriva del sello
de tiempo como `DDHHmmss`, que entra justo en los **8 dígitos exactos** que exige
la validación de cliente (`supplier.js:249`). Sin esto el test pasa una sola vez.

**El punto de venta admite 4 o 5 dígitos**, sólo números (`supplier.js:244`).

**La moneda arranca en ARS** (`Detail.aspx.cs:452`) y el test la pasa a USD. El
motivo no es que el ítem no aparezca — la grilla lista por proveedor y sucursal,
no por moneda —, sino que la moneda del comprobante es la que **convierte** los
importes: `ConvertAmount(CostCurrency, moneda de la factura, cotización)`
(`PaymentWebService.cs:340`). Con la moneda mal, la imputación queda distorsionada.

**El vencimiento lo calcula el BO**, no la persona: `fecha de factura +
PaymentDeadline del proveedor`, o +10 días si el proveedor no declara plazo
(`Detail.aspx.cs:1022`). El test deja el campo vacío y exige que salga a 30 días,
que es el plazo del proveedor 1047.

**El medio de pago lo precarga el proveedor**, junto con la razón social, el
documento y la cotización (`supplier.js`, `applySupplierInvoiceSupplier`). No se
elige: se verifica.

**El pendiente se calcula sobre `BaseRate`**, que es `TotalRate - IIBB -
percepción` (`Detail.aspx.cs:1044`), y no sobre el total
(`SupplierInvoiceAllocControl.ascx.cs:213`). Sin retenciones tienen que coincidir,
y eso es lo que el test verifica.

**La sucursal no se elige**: el usuario tiene una sola asignada, así que el combo
viene resuelto. Se verifica igual, porque un file y una factura en sucursales
distintas romperían la cadena más adelante.

**El proveedor se elige por un modal**, no escribiendo: el botón `#btnSupplier`
abre `#modalCnt` con la grilla `#dataSuppliers`.

#### La verificación que prueba que la imputación se escribió en el file

Imputado el costo entero, el ítem **deja de aparecer** en la grilla de
pendientes. No es un efecto colateral: el endpoint descarta las filas con saldo
menor a 1 (`PaymentWebService.cs:414`), y el saldo sólo baja si la imputación
escribió `BO_FileItem.AllocatedAmount`
(`SupplierInvoiceAllocControl.ascx.cs:419`). Verificar sólo el comprobante no
alcanzaría: la mitad del efecto vive del lado del file.

El checkbox "Incluir saldos menores a 1" destapa esas filas. El test no lo usa,
pero conviene saber que existe cuando algo "no aparece".

#### Datos que usa

| Qué | Valor |
|---|---|
| Servicio de la precondición | `AUTO-QA NO TOCAR - Tigre y Delta` |
| Proveedor | 1047, GRUPO SUMMA SRL, CUIT 30-71422246-1 |
| Sucursal | Argentina (1) |
| Tipo | Factura A |
| Moneda | USD, la del costo del ítem |
| Total | el costo del ítem del file, leído de la pantalla |

El total no está fijado en el test: se lee el costo del ítem del file y se
factura eso. Si el costo cambia, el test sigue siendo válido; si el costo viene
en cero, corta con el motivo apuntando a `BO_ServiceCostBySupplier`.

#### Lo que sólo se supo ejecutando

Seis cosas que el código no dejaba ver y que costaron una corrida cada una. Están
acá para que el eslabón 2 no las repita:

| Síntoma | Causa real |
|---|---|
| El carrito muere esperando su ícono | faltaba el `beforeEach` que entra al portal, como el del Bloque B |
| La sucursal viene en "Seleccione..." | el usuario del BO **ve más de una sucursal**: hay que elegirla, no verificarla |
| `txtTotalRate` está `disabled` | el total **no se escribe**: se carga en Exento y lo calcula el JS |
| El modal de asignación se lee vacío | lo llena un postback asincrónico de ASP.NET que **no pasa por `jQuery.active`** |
| El buscador de pendientes resuelve a dos inputs | el JS inyecta el checkbox de saldos chicos en el mismo contenedor |
| `#lnkConfirmAllocate` no existe | es el único control del modal **sin `ClientIDMode="Static"`** |

La lección transversal para los eslabones que siguen: **en este módulo hay
postbacks parciales de ASP.NET que `esperarFinDeCarga` no detecta**. Donde un
UpdatePanel se repinta, hay que esperar al dato y no al fin de carga.

Y una corrección a la auditoría: la consulta que decía que el usuario tiene una
sola sucursal miró `BO_UserApp` 79, que es el usuario del **portal**. El del BO se
resuelve por otro lado y ve varias.

#### Lo que deja en QA cada corrida

Una reserva, un file y una factura de proveedor aprobada e imputada. Ni la
factura ni el ítem del file se pueden reusar: por eso cada corrida arma su propia
precondición. Las de las corridas de ajuste quedaron en QA (files 31920 a 31924 y
sus comprobantes del punto de venta 0001).

### Eslabón 2 — Orden de pago: terminado, en verde

`tests/bloque-c/cobranzas.spec.ts` + `pages/orden-de-pago.page.ts`.

Su precondición es la cadena entera del eslabón 1: reserva, file, factura de
proveedor imputada y aprobada. Está en `armarFacturaAprobada()`, que repite
mecánicamente lo que el test del eslabón 1 verifica paso por paso. No comparten
código porque allá cada paso lleva su comparación intercalada: extraer una
función común obligaría a parametrizar qué se verifica y qué no, y ese test
dejaría de leerse.

```
PRECONDICION
 1. Reservar un servicio en el portal y emitir la reserva
 2. Confirmar la reserva y generar su file en el BackOffice
 3. Cargar la factura del proveedor, imputarla al file y aprobarla

ORDEN DE PAGO
 4. Entrar a la bandeja de ordenes de pago y abrir una nueva
 5. Verificar la sucursal y elegir el proveedor y la moneda
 6. Verificar que la caja de regresion se ofrezca y elegirla
 7. Cargar el importe y verificar el total que calcula el BO
 8. Guardar la orden y verificar que conserve los datos cargados
 9. Verificar el pendiente de asignacion contra el total de la orden
10. Ubicar la factura entre las pendientes y comparar la fila
11. Abrir la asignacion y comparar los importes del modal
12. Imputar la factura y verificar que el pendiente baje a cero
13. Aprobar la orden aplicando el recibo y verificar el estado
```

**El paso 6 es el que cuida las cajas propias.** Verifica que
`AUTO-QA NO TOCAR - CAJA USD` siga apareciendo en el combo para la moneda de la
orden. Si alguien la despublica, la borra o le cambia la categoría, ese paso lo
dice con el motivo en vez de fallar más adelante sin explicación.

#### Lo que sólo se supo ejecutando

| Síntoma | Causa real |
|---|---|
| El menú no llega a Órdenes Pago | Órdenes Pago y Fact. de Proveed. están **en el mismo submenú** (`BOMaster.Master:411-414`): viniendo de la factura el acordeón ya está abierto y clickear el padre lo **cierra**. Hay que abrirlo sólo si hace falta |
| El buscador de proveedores no abre | lo causaba el test al reelegir la sucursal que ya estaba puesta. Ver la nota de abajo |
| `txtTotalAmount` está `disabled` | el Monto Total tampoco se escribe: lo suma el JS a partir de los importes de las cajas (`payment.js:274`) |
| "Debe completar la fecha del Recibo" | `txtReceiptDate` tiene máscara `99/99/9999`: con `fill()` el valor queda en pantalla pero **no viaja en el postback**. Hay que tipear los dígitos |
| El estado se lee vacío | aprobar hace `Response.Redirect` a la misma pantalla y la lectura llegaba antes de que terminara la navegación |
| Se esperaba "PAGADA" | el estado 30 se describe como **"Pago"** (`PayOrderStatusEnum`) |

#### Un falso hallazgo, y por qué conviene tenerlo anotado

Durante el armado del test pareció haber un defecto: al tocar el combo de
sucursal, el botón lupa del campo Proveedor dejaba de responder. Medido con
jQuery, `#btnSupplier` quedaba sin ningún handler de clic. **No es un defecto**,
y no hay que llevarlo a producto.

| Acción | Handler | Modal |
|---|---|---|
| Elegir **otra** sucursal (Chile) | sobrevive | abre |
| Reelegir la **misma** que ya estaba (Argentina) | se pierde, y no vuelve ni a los 20 s | no abre |

Al reelegir el mismo valor, ASP.NET recibe el postback pero **no dispara
`SelectedIndexChanged`**, porque el valor no cambió respecto del ViewState. Nunca
ejecuta entonces el `RunScript(updData, "initPayOrderDetail(false);")` que
reengancha los handlers, pero el UpdatePanel igual se repinta y reemplaza el
botón: queda un botón nuevo sin handler y nada que lo vuelva a atar.

**Una persona no puede provocarlo**: el navegador no dispara `change` al reelegir
la opción ya seleccionada. Sin `change` no hay postback. El único que lo emite
siempre, cambie o no el valor, es `selectOption` de Playwright.

Vale como advertencia para el resto del bloque: **`selectOption` sobre el valor
que ya está elegido no es lo que hace una persona**, y en pantallas con
AutoPostBack dentro de un UpdatePanel puede fabricar un estado que no existe. Si
el valor ya es el que se necesita, se verifica; no se reelige.

#### Ids de esta pantalla

A diferencia de la factura, acá **la mayoría de los ids sí son estáticos**, pero
no todos. Llevan prefijo de ASP.NET —y hay que buscarlos por sufijo—
`ddBranch` y `lnkConfirmAllocate`. `btnSupplier` y `modalPayOrderAllocation` son
HTML plano. `litStatus` es un `asp:Literal` dentro de un PlaceHolder: no deja id,
se lee del `h5.text-uppercase.text-success` que lo contiene.

### Eslabón 3 — Factura al cliente: terminado, en verde

`tests/bloque-c/cobranzas.spec.ts` + `pages/factura-cliente.page.ts`.

**Su precondición es la más corta de la cadena**: apenas la reserva y su file. La
factura al cliente no necesita la factura del proveedor ni la orden de pago —
entra por el file, no por el proveedor. Es el eslabón que vuelve a atar la cadena
con el Bloque B.

```
PRECONDICION
 1. Reservar un servicio en el portal y emitir la reserva
 2. Confirmar la reserva y generar su file en el BackOffice

FACTURA AL CLIENTE
 3. Entrar a Facturacion y abrir un comprobante nuevo
 4. Elegir el destinatario y verificar sus datos
 5. Elegir el file y verificar lo que completa solo
 6. Comparar los conceptos y el total contra el file
 7. Guardar el comprobante y verificarlo en la bandeja de pendientes
```

**El orden no es opcional: primero el destinatario, después el file.** El buscador
de files filtra por el cliente elegido y ni siquiera abre sin uno: avisa "Debe
seleccionar Destinatario / Cliente" (`invoicing.js:305`). El cliente del file lo
precarga la agencia al generarlo — en nuestros files es **MULTIVIAJES ARGENTINA
SRL** —, así que el test lo lee del file en la precondición en vez de fijarlo.

Elegir el file completa solo el pasajero, el número de file, las fechas de los
servicios y la moneda, trae los conceptos desde `loaditemsbyfile` y calcula el
vencimiento en el servidor. El test verifica las cinco cosas: nada de eso se
carga a mano y cualquiera que deje de venir es una regresión.

El comprobante sale como **Carta de Cobranza**, que es el tipo que el BO deja
elegido por defecto (`NewInvoice.aspx.cs:50`), y queda numerado `CC00010-…`. Sirve
igual para el eslabón 4: la orden de cobro imputa cualquier `BO_Invoicing` con
saldo, sin mirar el tipo (`InvoicingSvc.LoadByCustomerForAllocation`).

#### La conciliación que cierra con el Bloque B

El total del comprobante da **10**, que es exactamente la venta del ítem en el
file. Es el primer punto de la cadena donde el precio que pagó la agencia
reaparece del lado del cliente, y el test lo exige.

La pantalla puede aplicar un **descuento por reserva online** (`HiddenDiscount`),
y en ese caso el total queda por debajo de la venta. El test contempla las dos
situaciones: sin aviso de descuento exige la igualdad; con aviso exige que el
total sea menor y adjunta el aviso. No reimplementa el porcentaje.

#### Lo que sólo se supo ejecutando

| Síntoma | Causa real |
|---|---|
| El menú no llega a Nuevo Compr. | hay **dos** enlaces a esa ruta: el acceso rápido "Nuevo Inv." del lanzador, que vive oculto, y el ítem "Nuevo Compr.". Hay que distinguirlos por texto |
| El ítem es "visible" pero el clic lo intercepta el encabezado | el acordeón deja el ítem con tamaño aunque esté colapsado, así que `isVisible()` devuelve `true`. Se intenta el clic y, si lo tapan, se abre el padre y se reintenta: sirve venga el menú abierto o cerrado |
| El número de file no coincidía | `txtFileNumber` trae el número **con el sufijo** (`29720-01`). Hay que comparar el primer grupo de dígitos, no todos juntos |

#### Lo que quedó como evidencia y no como resultado esperado

El **documento y la condición fiscal del destinatario vienen vacíos** para
MULTIVIAJES ARGENTINA SRL. El test los adjunta pero no los exige: no hay historia
de usuario que defina que deban venir cargados, y convertirlo en resultado
esperado sería inventarlo. Si en algún momento producto define que un
destinatario tiene que tener documento, ahí se sube la exigencia.

### Eslabón 4 — Orden de cobro: terminado, en verde

`tests/bloque-c/cobranzas.spec.ts` + `pages/orden-de-cobro.page.ts`.

Su precondición es la reserva, el file y la factura al cliente
(`armarFacturaAlCliente`). No necesita la factura del proveedor ni la orden de
pago: son las dos ramas de la cadena y sólo vuelven a juntarse en la caja diaria.

```
PRECONDICION
 1. Reservar un servicio en el portal y emitir la reserva
 2. Confirmar la reserva y generar su file en el BackOffice
 3. Emitir la factura al cliente sobre el file

ORDEN DE COBRO
 4. Entrar a la bandeja de ordenes de cobro y abrir una nueva
 5. Elegir el cliente y la moneda del cobro
 6. Verificar que la caja de regresion se ofrezca y elegirla
 7. Cargar el importe y verificar el total que calcula el BO
 8. Guardar la orden y verificar que conserve los datos cargados
 9. Verificar el pendiente de asignacion contra el total de la orden
10. Ubicar el comprobante entre los pendientes y comparar la fila
11. Abrir la asignacion y comparar los importes del modal
12. Imputar el comprobante y verificar que el pendiente baje a cero
13. Aprobar la orden aplicando el recibo y verificar el estado
```

#### En qué se diferencia de la orden de pago

Es su espejo, pero con tres diferencias que importan:

- va contra un **cliente**, no un proveedor;
- **no tiene combo de sucursal**: las cajas se listan sólo por moneda
  (`CashFlowSvc.LoadPublished`), sin filtrar por sucursal;
- admite **dos** formas de pago, no cuatro.

La sucursal igual existe, pero se deduce: al aprobar, el BO la resuelve **desde
la categoría de la caja elegida** (`DailyExpenseSvc.GetChargeOrderBranchID`). Es
la razón concreta por la que la categoría propia 18 tiene que conservar su
`BranchID`: sin él, aprobar corta con "No se encontró sucursal asociada para la
OC". El mensaje de fallo del test lo dice, para no tener que redescubrirlo.

#### El comprobante no se puede identificar por su número

**Todos los comprobantes que emite el test salen con el mismo número**:
`CC00010-00000000`. Filtrar la grilla por él se queda con el de cualquier corrida
anterior del mismo cliente, y las comparaciones de importe pasan de casualidad
porque todos valen lo mismo. El test ubica la fila **por el código del file**,
que sí es único por corrida.

No es un defecto: la numeración real se asigna al emitir el comprobante, y estos
quedan pendientes de emisión. Pero es una trampa de automatización que vale para
toda la cadena — **si un identificador se repite, el test miente en verde**.

#### La grilla trae los importes en dos monedas

Columnas: Total, Asig. y Saldo en **USD**, y las mismas tres en la moneda de la
sucursal. Tomar "el último importe de la fila" agarra el saldo de la otra moneda.
Encima esas columnas se escriben con **punto decimal** (`10.000` son 10), al
revés que el resto del BO. Con el parser de siempre da un número mil veces mayor.

Por eso el page object tiene `valorDeColumna(fila, encabezado)`: lee por el texto
del encabezado y no por posición.

#### El comprobante sale de los pendientes recién al aprobar

Imputar deja el pendiente de la orden en cero, pero el comprobante **sigue
listado**: su `AssignedAmount` se actualiza cuando la orden se aprueba, no cuando
se imputa. La verificación de que desaparece va después del aprobado.

#### Efectos que no se ven en pantalla

Aprobar la orden llama a `ChargeOrderCashHelper.RecalculateAndAccredit(fileId)`,
que hace dos cosas que ninguna pantalla muestra:

1. Recalcula lo cobrado y lo guarda en **`BO_File.CashedAmount`**. No hay campo
   en el file que lo exhiba, así que el test no lo puede verificar; queda como
   comprobación por SQL si alguna vez hace falta.
2. **Acredita puntos de fidelidad a la agencia** si el file está en USD, tiene
   agencia, quedó totalmente cobrado y viene de una reserva online — que es
   exactamente el caso de los files que arma la suite. Cada corrida de este
   eslabón puede sumar puntos a AMV. TRAVEL en QA. Conviene tenerlo presente.

### Eslabón 5 — Caja diaria: terminado, en verde

`tests/bloque-c/cobranzas.spec.ts` + `pages/caja-diaria.page.ts`.

Es el test más largo de la suite y el único que **arma la cadena entera, las dos
ramas, sobre el mismo file**: la caja diaria es el único punto donde vuelven a
juntarse lo que se le pagó al proveedor y lo que se le cobró al cliente.

```
PRECONDICION (la cadena completa)
 1. Reservar un servicio en el portal y emitir la reserva
 2. Confirmar la reserva y generar su file en el BackOffice
 3. Cargar la factura del proveedor, imputarla al file y aprobarla
 4. Pagar la factura del proveedor desde la caja de regresion
 5. Emitir la factura al cliente sobre el file
 6. Cobrar el comprobante del cliente en la caja de regresion

CAJA DIARIA
 7. Abrir la caja del dia de la sucursal
 8. Filtrar por la caja de regresion y verificar que este disponible
 9. Verificar que el pago y el cobro cayeron solos en la caja
10. Verificar el cuadre de la caja
11. Abrir el pre-cierre y verificar que muestre el cuadre
```

Para poder componer la cadena así, las precondiciones de los eslabones 2 y 4
pasaron a **recibir el file** en vez de crearlo (`armarFacturaAprobada` y
`armarFacturaAlCliente` toman un `Precondicion`). Los tests 2 y 4 siguen igual:
crean el suyo y se lo pasan.

#### Los movimientos no se cargan: caen solos

`PayOrderSvc.LoadForDailyCash(fecha, sucursal)` trae las órdenes con
`Status = 30`, fecha de recibo igual a la de la caja, sucursal coincidente y
**todavía no asignadas a ninguna caja** (`!DailyExpenseID.HasValue`). Lo mismo
las de cobro. El test no agrega nada: verifica que aparezcan donde corresponde,
en la caja AUTO-QA, con sus importes.

Hay **una caja por sucursal y fecha**. El page object abre la del día si ya
existe y sólo la crea si no está: crearla a ciegas dejaría dos en la segunda
corrida del mismo día.

#### El cuadre: por qué no se exige un importe fijo

La caja acumula lo de todas las corridas del día, así que exigir "balance = 4"
fallaría en la segunda. Lo que sí tiene que cerrar siempre es **su propia
aritmética**, que es donde aparecerían los errores de cuadre:

- `Ingreso + Salida = Balance`
- `Saldo Inicial + Balance = Saldo Final`
- el Ingreso incluye la venta cobrada y la Salida (en valor absoluto) el costo
  pagado
- el balance del **pre-cierre** coincide con el de la pantalla

**La Salida se muestra negativa.** Una corrida real dio `USD | 0 | 50 | -48 | 2 |
2`: el balance es ingreso **más** salida, no menos. Escribirlo al revés da un
verde falso o un rojo inexplicable.

#### El cierre definitivo no se automatiza, y es una decisión

`lnkClose` deja la caja en estado 20. A partir de ahí **ninguna orden de pago ni
de cobro de esa sucursal y esa fecha se puede aprobar**: los dos handlers cortan
con "La fecha del Recibo inválida. La fecha seleccionada está cerrada en Gastos &
Mov. Diarios" (`DailyExpenseSvc.FindByDate` busca `Status == 20`). Los eslabones
2 y 4 quedarían rojos por el resto del día — verde a la mañana, rojo a la tarde.

Y **no es reversible desde la pantalla**: el Guardar de la caja pone `Status = 10`
incondicionalmente, pero `btnSave.Visible = false` para toda caja existente
(`DailyCash.aspx.cs:166`), así que sólo aparece en el alta.

Se cubre el **pre-cierre** (`btnReview`), que es puramente de cliente, muestra el
mismo cuadre por caja y no toca el estado. Si producto quiere el cierre
definitivo cubierto, hay que definir en qué ambiente o con qué fecha: **queda
como consulta**.

#### Lo que sólo se supo ejecutando

| Síntoma | Causa real |
|---|---|
| Las grillas no existían | `lvDailyExpenseItems` y `lvTotals` son ListView y no dejan id: los ids reales son los de sus tablas, `#tblDailyExpenseItems` y `#tblDailyCashTotals` |
| El balance no cerraba | la Salida viene **negativa** |
| El pre-cierre parecía vacío | su grilla se llena después de mostrarse el modal, y el modal correcto es `#modalDailyCashReviewControl` |

### Decisiones que quedaron tomadas

1. ~~Si la suite puede mover saldos de caja~~ — **decidido el 2026-09-04**: cajas
   propias, 187 (USD) y 188 (ARS), bajo la categoría 18. Verificado además que
   aprobar una orden de pago **no mueve el saldo de la caja**: sólo registra el
   recibo (`PayOrders/Detail.aspx.cs:1163`). El saldo se mueve recién en la caja
   diaria, que es el eslabón 5.
2. **Cómo se limpia.** Las órdenes aprobadas y los movimientos de caja no se
   borran como una reserva: hay que confirmar si el BO permite anular y si la
   anulación revierte el saldo, o si el Bloque C deja residuo por diseño.
3. **En qué moneda se factura**, dado el cruce ARS/USD del punto 1.

### Lo que el PM no pidió y conviene sumar

1. **Conciliación de importes punta a punta**: que el precio que vio el pasajero
   sea el mismo del file, la factura, la orden de cobro y el movimiento de caja.
2. **Cierre de caja**, no sólo la apertura (`btnReview` y `lnkClose`).
3. **Anulación** de una reserva emitida, y que revierta bien.
4. **Liquidación del file** (`FileLiq.aspx`).
5. **Bandejas de no asignados** (`UnassignedInvoices`, `UnassignedPayorders`) como
   validación negativa.


## Temas abiertos fuera del código

- **Mover el repo a Azure Repos.** Lo pidió el PM para que lo use todo el equipo.
  La organización ya existe (`AmvTravel`, se ve en el `azure-pipelines.yml` del
  WEB, que referencia `AmvTravel/TemplatesDevops`). Es Git igual que GitHub, así
  que el repo se mueve con la historia completa. Lo que hay que rehacer es el CI:
  `.github/workflows/qa-e2e.yml` no sirve, hay que traducirlo a
  `azure-pipelines.yml`. Lo único sin equivalente directo es **GitHub Pages**,
  donde hoy se publica el Allure; la alternativa recomendada es agregar el reporter
  `junit` de Playwright y `PublishTestResults@2`, que llena la **solapa Tests** de
  la corrida — nativa, con histórico y detección de flakiness — y dejar el Allure
  como artefacto del pipeline. Antes de avanzar hay que confirmar con DevOps qué
  pool de agentes usan (el del WEB lo define el template) y dónde viven los
  secretos del resto de los pipelines.
  Verificado que el `.env` **nunca se commiteó** y está en `.gitignore` desde el
  principio, así que mover la historia es seguro.
- **Azure Test Plans no se usa y por ahora no conviene.** Es el módulo que se
  vincula a las historias. Asociar cada test automatizado a un caso de prueba
  agrega mantenimiento, y sobre todo **la suite está pensada por pantalla y no por
  historia**: es regresión del tarifario, no la verificación de una US puntual.
  Queda como segundo paso si el PM pide trazabilidad US ↔ automatizados.
- **El permiso de `EXECUTE` sobre `sp_TourRates`** quedó sin pedir, y ya no hace
  falta: se decidió no extender la validación con fórmula (ver Validación de
  importes).

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
│   ├── tarifario.page.ts                 Bloque A
│   ├── inicio.page.ts                    las 4 solapas del buscador de INICIO
│   ├── servicio.page.ts                  busqueda y ficha del servicio
│   ├── carrito.page.ts                   carrito, checkout y codigo de la reserva
│   └── backoffice.page.ts                login BO, bandeja, detalle, file y rooming
├── tests/
│   ├── auth.setup.ts                     login único, reusado por storageState
│   ├── bloque-a/tarifario.spec.ts        los 7 tests del tarifario
│   └── bloque-b/reservas.spec.ts         los flujos de reserva
├── tools/
│   ├── capturar-lineabase.spec.ts        captura los importes de cada pestaña
│   └── consolidar-lineabase.mjs          los vuelca a data/ (los dos: npm run lineabase)
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
- **Una comparación que falla no corta el test.** `conResaltado` marca la zona en
  rojo y registra el fallo con `expect.soft`, así el test sigue validando el resto
  de la pantalla y una sola corrida muestra todos los hallazgos. Se reserva el
  fallo duro para lo que impide continuar de verdad — que no abra un modal, que no
  cargue una pestaña —, no para una diferencia de texto.
- **Una validación nueva no se suma sin haberla corrido.** Se agregó una
  comparación del texto de la card sin poder ejecutarla y falló en las siete
  pestañas, tuvieran o no cambios, dejando además sin ejecutar todos los pasos
  siguientes. Quedó pendiente rehacerla con el dato de lo que la card muestra
  realmente en cada control.
- **Comparar por igualdad, no por contención.** `toContain` detecta que falte o
  que cambie algo, pero **no detecta lo que se agrega**: si a un texto esperado se
  le antepone o se le agrega una palabra, la cadena original sigue estando adentro
  y el assert pasa. Apareció en el detalle del hotel y en los tooltips de la card,
  y se corrigió en toda la suite: comparando en los dos sentidos, o leyendo el
  markup estructurado (`<dt>/<dd>`, `<strong>`, `<li>`, `.svc-observation`) para
  comparar valores y listas exactas en lugar de una cadena concatenada.

  Se compara **por igualdad todo lo que sale de la base**: solapas de la ficha,
  observaciones con su marca de prioridad, idiomas, punto de encuentro, drop-off,
  duraciones, políticas, título del modal, cuerpo del detalle, tooltips, tabla de
  proveedores, importes y observaciones destacadas de la card.

  Quedan **tres contenciones a propósito**, y conviene no "arreglarlas":

  - Buscar las ciudades dentro del texto de la card: es una región compuesta,
    exigir igualdad sería fijar en el test todo el layout.
  - La comprobación negativa de la temporada (`not.toContain` de un mes que no
    opera).
  - El `src` de la imagen, que va anclado al final de la ruta con `endsWith`.
  - La lista de amenities, donde cada ítem se compara exacto y además se exige la
    cantidad, que es equivalente a comparar la lista entera.

  > **El nombre del ítem estuvo mal clasificado como región compuesta.** Se
  > comparaba con `toContain` contra el texto completo de la pestaña, así que
  > anteponerle una palabra al nombre del paquete no se detectaba. El nombre es un
  > campo propio: ahora se lee del `<h2>` de la card, descartando el badge de
  > categoría o duración (`span.tariff-category-tag`), y se compara por igualdad.

  Tampoco se comparan los textos que son **recursos de la aplicación** y no datos
  de la base — el tooltip "Duración estimada del servicio", el título
  "Operatividad", las etiquetas de las columnas: fijarlos en el test sería copiar
  un literal del código y no validar nada.
- **El mensaje del `expect` se escribe como el requisito, no como el fallo.**
  Playwright lo usa como título del paso en el reporte tanto cuando pasa como
  cuando falla, así que un mensaje redactado para el error se lee al revés en
  verde: decía *"Falta el componente imagen en la card"* justamente cuando la
  imagen estaba. Se escriben en forma de exigencia — *"El componente imagen tiene
  que estar en la card"* — que se lee bien en los dos estados. El prefijo `FALLA:`
  queda sólo para los nombres de las capturas resaltadas, que se generan
  únicamente cuando algo falla.
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
