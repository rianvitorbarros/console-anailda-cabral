const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto('http://localhost:3000/products', { waitUntil: 'networkidle0' });
  
  const content = await page.content();
  if (content.includes('DEBUG PRODUCTS PAGE RENDERED')) {
    console.log('SUCCESS: Debug block found in DOM!');
  } else {
    console.log('FAILURE: Debug block NOT found in DOM!');
    // Let's print the main content to see what's actually there
    const mainContent = await page.$eval('main', el => el.innerHTML).catch(e => 'No <main> tag found');
    console.log('Main tag content:', mainContent);
  }
  
  await browser.close();
})();
