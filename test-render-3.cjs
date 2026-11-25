const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/products', { waitUntil: 'networkidle0' });
  
  const html = await page.content();
  if (html.includes('Produtos') && html.includes('Gerencie os produtos')) {
    console.log('SUCCESS: Page rendered.');
    const cards = await page.$$eval('h3.line-clamp-1', els => els.map(el => el.textContent));
    console.log('Products found:', cards);
  } else {
    console.log('FAILURE: Page did not render correctly.');
    console.log('Current URL:', page.url());
  }
  
  await browser.close();
})();
