const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    timeout: 180000,
  });
  const page = await browser.newPage();
  // Test the auth UI directly to avoid the redirector page
  const url = process.env.URL || 'http://localhost:3001/auth?redirect=%2Fdashboard';
  console.log('Testing', url);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.warn('goto timed out, falling back to waitForSelector');
  }

  // dump a bit of the HTML for debugging when playright can't find nodes
  const html = await page.content();
  console.log('Page HTML length:', html.length);
  // console.log(html.slice(0, 2000));

  try {
    await page.waitForSelector('div.min-h-screen', { timeout: 60000 });
  } catch (e) {
    console.warn('waitForSelector timed out — will continue to collect diagnostics');
  }

  // Helper to log focusable elements
  const focusables = await page.evaluate(() => {
    const root = document.body;
    const nodes = Array.from(root.querySelectorAll('a,button,input,select,textarea,[tabindex]'));
    return nodes.map(n => ({ tag: n.tagName, role: n.getAttribute('role'), tabindex: n.getAttribute('tabindex'), ariaHidden: n.closest('[data-aria-hidden]') ? true : false, disabled: n.disabled }));
  });
  console.log('Focusable elements snapshot:', focusables.slice(0, 30));

  // Test tab navigation for first 20 tabs
  const focusSequence = [];
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => {
      const a = document.activeElement;
      return a ? { tag: a.tagName, id: a.id, class: a.className, tabindex: a.getAttribute('tabindex'), ariaHidden: a.closest('[data-aria-hidden]') ? true : false } : null;
    });
    focusSequence.push(active);
  }
  console.log('Tab focus sequence:', focusSequence.filter(x => x));

  // Check if container or any ancestor has data-aria-hidden
  const hiddenAncestor = await page.evaluate(() => {
    const el = document.querySelector('.min-h-screen');
    if (!el) return null;
    const anc = el.closest('[data-aria-hidden="true"]');
    return anc ? { tag: anc.tagName, class: anc.className } : null;
  });
  console.log('Auth container hidden ancestor:', hiddenAncestor);

  // Try to focus email input programmatically
  const focusResult = await page.evaluate(() => {
    const input = document.querySelector('input[type="email"]');
    if (!input) return 'no-input';
    try { input.focus(); return document.activeElement === input; } catch (e) { return 'error'; }
  });
  console.log('Programmatic focus on email input ok?', focusResult);

  await browser.close();
})();
