const fs = require('fs');
let code = fs.readFileSync('functions/src/index.ts', 'utf8');

const target1 = `    if (productData.status !== 'active') {
      res.status(400).json({ success: false, message: 'Produto inativo', code: 'PRODUCT_INACTIVE' });
      return;
    }

    const amount = productData.promotionalPrice || productData.originalPrice;`;

const replacement1 = `    if (productData.status !== 'active') {
      res.status(400).json({ success: false, message: 'Produto inativo', code: 'PRODUCT_INACTIVE' });
      return;
    }

    const amount = orderData.amount || productData.promotionalPrice || productData.originalPrice;`;

const target2 = `    const mpPayload = JSON.stringify({
      transaction_amount: amount,
      description: productData.title || 'A Mulher — Anailda Cabral',`;

const replacement2 = `    let description = productData.title || 'A Mulher — Anailda Cabral';
    if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
      if (orderData.items.length === 1) {
        description = orderData.items[0].title;
      } else {
        if (productData.productType === 'combo' || productData.id === 'combo-a-mulher') {
          description = productData.title || 'Combo completo A Mulher';
        } else {
          description = \`Kit A Mulher - \${orderData.items.length} itens\`;
        }
      }
    }

    const mpPayload = JSON.stringify({
      transaction_amount: amount,
      description: description,`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);

fs.writeFileSync('functions/src/index.ts', code);
