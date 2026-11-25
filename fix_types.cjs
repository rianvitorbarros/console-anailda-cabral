const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

const target = `export interface Order {
  id: string;
  projectId: string;
  productId: string;
  productTitle?: string;
  productSnapshot?: any;
  code: string;
  orderCode?: string;
  publicStatusToken: string;
  status: PaymentStatus; // legacy/alias
  paymentStatus: PaymentStatus;
  items?: OrderItem[];
  trackingCode?: string;
  customerName?: string;
  customerEmail?: string;
  customer?: any;
  amount?: number;
  paymentMethod?: string;
  createdAt?: any;`;

const replacement = `export interface Order {
  id: string;
  projectId: string;
  productId: string;
  productTitle?: string;
  productSnapshot?: any;
  code: string;
  orderCode?: string;
  publicStatusToken: string;
  status: PaymentStatus; // legacy/alias
  paymentStatus: PaymentStatus;
  items?: OrderItem[];
  trackingCode?: string;
  customerName?: string;
  customerEmail?: string;
  amount?: number;
  paymentMethod?: string;`;

code = code.replace(target, replacement);

fs.writeFileSync('src/types.ts', code);
