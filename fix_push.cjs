const fs = require('fs');
let code = fs.readFileSync('functions/src/pushNotifications.ts', 'utf8');

const regex = /function getOrderDetails\([\s\S]*?async function sendPushNotification/m;

const replacement = `function getOrderDetails(data: any, orderId: string) {
  const orderCode = data.orderCode || orderId.substring(0, 8);
  const isCombo = data.productSnapshot?.productType === 'combo' || data.productId === 'combo-a-mulher' || (data.productTitle && data.productTitle.toLowerCase().includes('combo'));
  
  let productTitle = data.productTitle || data.productSnapshot?.title || 'Produto indefinido';
  let isMultiple = false;
  let itemsCount = 0;

  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
    itemsCount = data.items.length;
    if (itemsCount === 1) {
      productTitle = data.items[0].title;
    } else {
      isMultiple = true;
      if (isCombo) {
        productTitle = data.productTitle || 'Combo completo A Mulher';
      } else {
        productTitle = \`\${itemsCount} itens\`;
      }
    }
  }

  const amountStr = formatCurrencyBRL(data.amount);
  const customerName = data.customerName || 'Cliente';
  const trackingCode = data.trackingCode || data.trackingNumber || null;
  return { orderCode, productTitle, isCombo, isMultiple, itemsCount, amountStr, customerName, trackingCode };
}

async function sendPushNotification`;

code = code.replace(regex, replacement);

const regex2 = /const title = \`🛒 Novo pedido — \$\{amountStr\}\`;\s*const body = \`\$\{productTitle\} para \$\{customerName\}. Aguardando pagamento via Pix.\`;/;

const replacement2 = `const title = \`🛒 Novo pedido — \$\{amountStr\}\`;
    const body = \`Produto: \$\{productTitle\} • Cliente: \$\{customerName\} • Pedido: \$\{orderCode\} • Pendente\`;`;

code = code.replace(regex2, replacement2);

const regex3 = /const title = isCombo \? \`💰 Combo vendido — \$\{amountStr\}\` : \`💰 Venda confirmada — \$\{amountStr\}\`;\s*const body = \`\$\{isCombo \? 'Combo ' \+ productTitle : productTitle\} foi comprado por \$\{customerName\}. Pedido \$\{orderCode\} aguardando envio.\`;/;

const replacement3 = `const title = isCombo ? \`💰 Combo vendido — \$\{amountStr\}\` : \`💰 Venda confirmada — \$\{amountStr\}\`;
        const body = \`Produto: \$\{productTitle\} • Cliente: \$\{customerName\} • Pedido: \$\{orderCode\} • Pago\`;`;

code = code.replace(regex3, replacement3);

const regex4 = /let title = \`📦 Pedido enviado — \$\{orderCode\}\`;\s*let body = \`\$\{productTitle\} para \$\{customerName\} foi marcado como enviado.\`;\s*if \(trackingCode\) \{\s*title = \`📦 Pedido enviado com rastreio\`;\s*body = \`\$\{orderCode\} • \$\{customerName\} • Código: \$\{trackingCode\}\`;\s*\}/;

const replacement4 = `let title = \`📦 Pedido enviado — \$\{amountStr\}\`;
        let body = \`Produto: \$\{productTitle\} • Cliente: \$\{customerName\} • Pedido: \$\{orderCode\} • Enviado\`;
        if (trackingCode) {
          title = \`📦 Rastreio disponível — \$\{amountStr\}\`;
          body = \`Código: \$\{trackingCode\} • Produto: \$\{productTitle\} • Cliente: \$\{customerName\} • Pedido: \$\{orderCode\}\`;
        }`;

code = code.replace(regex4, replacement4);

fs.writeFileSync('functions/src/pushNotifications.ts', code);
