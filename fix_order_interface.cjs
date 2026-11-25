const fs = require('fs');
let code = fs.readFileSync('src/services/ordersService.ts', 'utf8');

code = code.replace(
  'export interface Order {',
  `export interface Order {
  productSnapshot?: any;
  items?: any[];
  trackingCode?: string;`
);

fs.writeFileSync('src/services/ordersService.ts', code);
