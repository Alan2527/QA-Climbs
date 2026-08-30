# AMV Travel — Suite E2E (QA)

Automatizacion de flujos completos de AMV Travel sobre el ambiente **QA**,
con **Playwright** y reportes **Allure**.

Cubre lo que las historias de usuario no alcanzan: los flujos punta a punta
que atraviesan front, BackOffice y base de datos.

## Ambiente

| | URL |
|---|---|
| Front | https://qa.amv.travel |
| WebAdmin | https://qa.amv.travel/administration/ |
| BackOffice | https://qa.bo.amv.travel |

Base de datos: `qa` en `40.74.225.224,1433`.

## Instalacion

```bash
npm install
npx playwright install chromium
cp .env.example .env   # completar las credenciales
```

Las credenciales **nunca** van en el codigo: se leen del entorno
(`.env` local, GitHub Secrets en CI).

## Correr

```bash
npm test                 # toda la suite
npm run test:bloque-a    # solo tarifario
npm run test:headed      # con navegador visible
```

## Reporte

```bash
npm run allure:serve
```

## Datos de prueba

Los items que usan los tests estan marcados en la base con el prefijo
**`AUTO-QA NO TOCAR - `** y tienen tarifas y disponibilidad cargadas hasta
2031/2032. Estan documentados en `data/candidatos.json`.

**No modificar esos registros**: los tests comparan contra sus datos exactos.

| Pestania | ID | Item |
|---|---|---|
| Paquetes | 5059 | Paquete Buenos Aires y Ushuaia (6 dias / 5 noches) |
| Excursiones | 5 | Tigre y Delta |
| Hoteles | 5003 / 12581 | Park Hyatt Palacio Duhau / Arakur Resort & Spa |
| Traslados | 1223 | Aeropuerto Internacional / Hotel Centrico con guia |
| Cena Show | 163 | Cafe de los Angelitos |
| Cruceros | 14 | Fiordos de Tierra del Fuego - Ventus Australis |
| Ofertas | 5060 | Oferta Buenos Aires y Ushuaia (6 dias / 5 noches) |

El paquete y la oferta se armaron con los propios items candidatos, asi que
son autocontenidos: ningun dato de terceros puede romperlos.

### Precondiciones que descubrimos en el camino

- **La oferta (5060) necesita la agencia AMV. TRAVEL asignada** en su pestania
  Agencias del WebAdmin. Sin agencia asignada no se lista en el tarifario.
- **Cruceros y Ofertas se filtran por Ushuaia**, no por Buenos Aires. La pestania
  Ofertas es condicional: si no hay ofertas para la ciudad elegida, no se renderiza.
- **El front muestra el nombre traducido**, no el de la tabla maestra. Por eso el
  prefijo tuvo que aplicarse tambien en `ServiceDetail`, `CruiseDetail` y
  `ReceptiveTourDetail`; si no, el marcador no se ve en pantalla.
- **El tarifario no carga solo**: hay que presionar Buscar. Ese postback
  (`ctrlTariffFilterControl$lnkView`) setea las fechas que despues leen las pestanias.

### Migrar a otro ambiente

Los datos esperados no estan hardcodeados en los tests: viven en
`data/candidatos.json`. Para apuntar a preprod hay que volver a correr las
queries de seleccion contra esa base, regenerar ese archivo y cambiar
`AMV_BASE_URL`.

## Convenciones

- **Fechas de busqueda**: siempre hoy + 7 dias (`fechaDeBusqueda()` en `utils/pasos.ts`).
- **Sin esperas fijas**: se espera fin de PostBack de ASP.NET y `jQuery.active === 0`
  con `esperarFinDeCarga()`. Nada de `waitForTimeout`.
- **Captura por paso**: envolver cada bloque logico en `paso(page, titulo, fn)`,
  que adjunta el screenshot al reporte automaticamente.
- **Un test por caso**, no un test gigante: si falla una pestania, las otras
  siguen dando resultado.
- **Selectores**: salen del codigo fuente del repo (`WEB/src/AMV.Travel/Web`),
  no se inventan.

## Estructura

```
qa-e2e/
├── data/candidatos.json     datos esperados del ambiente
├── pages/                   page objects
├── tests/
│   ├── auth.setup.ts        login unico, reusado por storageState
│   └── bloque-a/            tarifario
└── utils/pasos.ts           helpers de pasos, esperas y formato
```
