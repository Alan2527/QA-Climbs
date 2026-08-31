const { chromium } = require('@playwright/test');
require('dotenv').config();
const C = require('./data/candidatos.json').tarifario;
const esperar = async (p) => {
  await p.waitForLoadState('domcontentloaded');
  await p.waitForFunction(() => {
    const w = window;
    const a = !w.Sys?.WebForms?.PageRequestManager?.getInstance ||
              w.Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack() === false;
    const b = typeof w.jQuery === 'undefined' || w.jQuery.active === 0;
    return a && b;
  }, undefined, { timeout: 60000 });
};
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.goto('https://qa.amv.travel/login.aspx', { waitUntil: 'domcontentloaded' });
  await p.locator('#txtUser').fill(process.env.AMV_USER);
  await p.locator('#txtPassword').fill(process.env.AMV_PASS);
  await p.locator('#btnLogin').click();
  await p.waitForURL(u => !u.pathname.toLowerCase().includes('login'), { timeout: 60000 });
  await esperar(p);

  for (const clave of ['excursiones','traslados']) {
    const cfg = C[clave];
    await p.goto('https://qa.amv.travel/online/', { waitUntil: 'domcontentloaded' });
    if (await p.locator('#imageModal').isVisible().catch(()=>false)) await p.keyboard.press('Escape');
    await p.getByRole('link', { name: 'Tarifario' }).first().click(); await esperar(p);
    await p.locator("[id$='ddCountry']").selectOption({ label: 'Argentina' }); await esperar(p);
    await p.locator("[id$='ddCity']").selectOption({ label: 'Buenos Aires' }); await esperar(p);
    await p.locator("[id$='lnkView']").click(); await esperar(p);
    await p.locator('#' + cfg.tab).click(); await esperar(p);
    await p.locator('.tariff-name-box .ts-control').click();
    await p.locator('#tariffSearchSelect-ts-control').pressSequentially(cfg.terminoBusqueda, { delay: 25 });
    await p.locator("[id^='tariffSearchSelect-opt-']").first().waitFor({ state:'visible', timeout:20000 });
    await p.locator("[id^='tariffSearchSelect-opt-']").filter({ hasText: cfg.nombre }).first().click();
    await esperar(p);
    const btn = p.locator('#' + cfg.container + " a[onclick*='load']").first();
    await btn.click(); await esperar(p); await p.waitForTimeout(2500);
    const filas = await p.$$eval('#' + cfg.container + ' table tr', trs =>
      trs.map(tr => Array.from(tr.querySelectorAll('th,td'))
        .map(c => c.innerText.replace(/\s+/g,' ').trim()).filter(Boolean)).filter(f => f.length));
    console.log('\n######## ' + clave.toUpperCase() + ' (id ' + cfg.id + ') ########');
    filas.forEach(f => console.log('  ' + f.join(' | ').slice(0, 130)));
  }
  await b.close();
})();
