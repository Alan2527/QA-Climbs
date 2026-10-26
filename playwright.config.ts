import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const ARCHIVO_SESION = 'playwright/.auth/front.json';
// App nueva (ClimbsApp): Backoffice en la raiz y portal de agencias en /site.
const URL_APP_NUEVA = process.env.CLIMBS_URL ?? 'https://climbs-qa.amv.travel';
const SESION_APP_NUEVA = 'playwright/.auth/app-nueva.json';

/**
 * Suite E2E de AMV Travel — ambiente QA.
 *
 * Las credenciales se leen del entorno (.env local, secrets en CI).
 * Nunca se hardcodean en el codigo.
 */
export default defineConfig({
  testDir: './tests',
  // Los flujos E2E tocan datos reales: sin paralelismo dentro de un mismo archivo.
  fullyParallel: false,
  // **Un solo worker siempre**, tambien local. Todos los tests usan el mismo
  // usuario (pablo1) y el carrito es del usuario, no de la sesion: con 2 workers,
  // dos archivos que reservan corren a la vez y se pisan el carrito. El 2026-10-10
  // asi salio una reserva con dos Tigre y Delta (25432, uno de cada test) y varios
  // contadores en 2. En el CI ya era 1.
  workers: 1,
  forbidOnly: !!process.env.CI,
  /**
   * **Cero reintentos por defecto.**
   *
   * Un reintento sirve para absorber la intermitencia del ambiente, pero solo se
   * lo puede permitir un test que no escriba nada: los Bloques B y C **emiten**.
   * Reintentar el flujo de una reserva emite una segunda reserva de verdad y
   * consume dos cupos mas de la serie; reintentar un eslabon de cobranzas deja una
   * factura o una orden duplicada en QA.
   *
   * El Bloque A solo lee, asi que ahi si se reintenta: se configura en su propio
   * proyecto, mas abajo.
   */
  retries: 0,
  // El BO y el tarifario tienen PostBacks lentos: timeouts holgados.
  timeout: 180_000,
  expect: { timeout: 30_000 },

  reporter: [
    ['list'],
    // Reporte local sin dependencias: Allure necesita Java, este no.
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    // Resumen para el tablero de pruebas: `tools/resumen-corrida.mjs` lo lee en CI.
    ['json', { outputFile: 'resultados/playwright.json' }],
    // En la corrida "todas" cada maquina de CI deja un blob con nombre propio, y el paso de
    // publicar los junta con `playwright merge-reports` en un solo JSON y un solo HTML.
    ...(process.env.PW_CARRIL
      ? [['blob', { outputDir: 'blob-report', fileName: `${process.env.PW_CARRIL}.zip` }] as const]
      : []),
    ['allure-playwright', {
      resultsDir: 'allure-results',
      environmentInfo: {
        Entorno: 'QA',
        URL_Front: process.env.AMV_BASE_URL ?? 'https://qa.amv.travel',
        URL_BackOffice: process.env.AMV_BO_URL ?? 'https://qa.bo.amv.travel',
        Framework: 'Playwright + Allure',
      },
    }],
  ],

  use: {
    baseURL: process.env.AMV_BASE_URL ?? 'https://qa.amv.travel',
    // Captura de cada paso: el helper `paso()` adjunta screenshot por bloque.
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  },

  /**
   * Un proyecto por bloque.
   *
   * Antes eran uno solo. Se partio para poder darle reintentos al Bloque A sin
   * darselos a los que emiten: `retries` no se puede definir por archivo, solo por
   * proyecto. De paso el arbol de Allure queda agrupado por bloque, que es como se
   * mira el reporte.
   *
   * Cada uno declara su `testDir`, asi que `playwright test tests/bloque-a` sigue
   * funcionando igual: el filtro por ruta deja fuera a los otros dos.
   */
  projects: [
    {
      // El login a veces flaquea por lentitud del QA (fill/goto timeout) y, al ser la
      // dependencia de todo, un flake ahi se lleva la corrida ENTERA. Un par de
      // reintentos en CI lo absorben: el login no emite nada, reintentarlo es inocuo.
      name: 'Login',
      testMatch: /auth\.setup\.ts/,
      retries: process.env.CI ? 2 : 0,
    },
    /**
     * Precondiciones: una por bloque, sobre el mismo archivo.
     *
     * Verifican que esten los datos AUTO-QA antes de correr nada: si falta un
     * candidato, la corrida corta diciendo cual, en vez de fallar diez pasos adentro
     * con un timeout de locator que no explica nada.
     *
     * Hasta el 2026-09-14 era una sola para los tres bloques, y un tropiezo al
     * verificar el crucero frenaba tambien al Bloque C, que no lo usa. Ahora cada una
     * mira solo lo que su bloque usa, y la `metadata` le dice que.
     */
    {
      name: 'Precondiciones - Bloque A',
      testMatch: /precondiciones\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: ARCHIVO_SESION },
      dependencies: ['Login'],
      metadata: {
        tarifario: ['paquetes', 'excursiones', 'hoteles', 'traslados', 'cenaShow', 'cruceros', 'ofertas'],
      },
    },
    {
      name: 'Precondiciones - Bloque B',
      testMatch: /precondiciones\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: ARCHIVO_SESION },
      dependencies: ['Login'],
      // Lo que reserva: el servicio, el hotel, el paquete, la oferta y la serie.
      metadata: { tarifario: ['excursiones', 'hoteles', 'paquetes', 'ofertas'], series: true },
    },
    {
      name: 'Precondiciones - Bloque C',
      testMatch: /precondiciones\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: ARCHIVO_SESION },
      dependencies: ['Login'],
      // Lo unico que usa del portal: el servicio que reserva para armar el file.
      metadata: { tarifario: ['excursiones'] },
    },
    {
      name: 'Climbs - Bloque A: Tarifario',
      testDir: './tests/bloque-a',
      // Solo lee: un reintento no deja rastro en QA.
      retries: process.env.CI ? 1 : 0,
      use: { ...devices['Desktop Chrome'], storageState: ARCHIVO_SESION },
      dependencies: ['Precondiciones - Bloque A'],
    },
    {
      name: 'Climbs - Bloque B: Reservas',
      testDir: './tests/bloque-b',
      use: { ...devices['Desktop Chrome'], storageState: ARCHIVO_SESION },
      dependencies: ['Precondiciones - Bloque B'],
    },
    {
      // Escribe en el WebAdmin (solo sobre datos AUTO-QA propios) y verifica en el
      // portal: sin reintentos, igual que los bloques que emiten.
      name: 'Climbs - WebAdmin',
      testDir: './tests/webadmin',
      use: { ...devices['Desktop Chrome'], storageState: ARCHIVO_SESION },
      dependencies: ['Precondiciones - Bloque A'],
    },
    {
      // La app del pasajero: no usa la sesion del portal (entra con el link de autologin
      // de AMV_SIX_AUTOLOGIN_URL) y es mobile. Solo lee, asi que admite un reintento. Sin
      // trace: registra las URLs de la red y el link lleva el token del pasajero.
      name: 'Climbs - SIX',
      testDir: './tests/six',
      retries: process.env.CI ? 1 : 0,
      use: { ...devices['Pixel 7'], storageState: { cookies: [], origins: [] }, trace: 'off' },
    },
    {
      name: 'Climbs - Bloque C: Cobranzas',
      testDir: './tests/bloque-c',
      // Cobranzas corre al final y emite pesado: el BO queda saturado y sus PostBacks
      // responden lento. Con el actionTimeout global de 30s, clicks y esperas flaquean
      // en la ventana lenta (y no hay reintentos porque emite). Se le da mas margen.
      use: { ...devices['Desktop Chrome'], storageState: ARCHIVO_SESION, actionTimeout: 60_000 },
      dependencies: ['Precondiciones - Bloque C'],
    },
    {
      // Acceso por URL a reservas y cotizaciones ajenas o sin sesion. Solo lee (no
      // emite nada), asi que admite un reintento para absorber intermitencia. No
      // necesita precondiciones de tarifario: toma una reserva y una cotizacion que
      // pablo1 ya tenga en su historial.
      name: 'Climbs - Bloque Seguridad',
      testDir: './tests/seguridad',
      retries: process.env.CI ? 1 : 0,
      use: { ...devices['Desktop Chrome'], storageState: ARCHIVO_SESION },
      dependencies: ['Login'],
    },

    // --- App nueva (ClimbsApp) ------------------------------------------------------
    // La suite que acompaña la migracion: los mismos flujos, contra la app nueva, que
    // usa la misma base de QA. Vive en tests/climbs hasta que tenga su carpeta en el
    // repo de ClimbsApp. El personal (pablo) entra al portal nuevo con su usuario del
    // backoffice desde el 25/10/2026, asi que una sola cuenta abre las dos apps.
    {
      name: 'App nueva - Login',
      testDir: './tests/climbs',
      testMatch: /ingreso\.setup\.ts/,
      // La app nueva toma el idioma del navegador: sin esto sale en ingles. Y la misma
      // pantalla que la suite actual: el perfil "Desktop Chrome" trae 1280x720, donde las
      // grillas de Finanzas no entran y dejan las acciones fuera de la vista.
      use: { ...devices['Desktop Chrome'], baseURL: URL_APP_NUEVA, locale: 'es-AR', viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'App nueva - Cobranzas',
      testDir: './tests/climbs/cobranzas',
      use: {
        ...devices['Desktop Chrome'], baseURL: URL_APP_NUEVA, locale: 'es-AR', viewport: { width: 1920, height: 1080 },
        storageState: SESION_APP_NUEVA, actionTimeout: 60_000,
      },
      dependencies: ['App nueva - Login'],
    },
    {
      name: 'App nueva - Tarifario',
      testDir: './tests/climbs/tarifario',
      use: {
        ...devices['Desktop Chrome'], baseURL: URL_APP_NUEVA, locale: 'es-AR', viewport: { width: 1920, height: 1080 },
        storageState: SESION_APP_NUEVA, actionTimeout: 60_000,
      },
      dependencies: ['App nueva - Login'],
    },
    {
      name: 'App nueva - Reservas',
      testDir: './tests/climbs/reservas',
      use: {
        ...devices['Desktop Chrome'], baseURL: URL_APP_NUEVA, locale: 'es-AR', viewport: { width: 1920, height: 1080 },
        storageState: SESION_APP_NUEVA, actionTimeout: 60_000,
      },
      dependencies: ['App nueva - Login'],
    },
  ],
});
