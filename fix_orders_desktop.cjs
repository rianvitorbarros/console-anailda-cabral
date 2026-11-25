const fs = require('fs');
let code = fs.readFileSync('src/pages/Orders.tsx', 'utf8');

const target = `                    <td className="px-6 py-4 font-mono font-bold">{order.orderCode || order.id.substring(0,8)}</td>`;

const replacement = `                    <td className="px-6 py-4">
                      <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{order.orderCode || order.id.substring(0,8)}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                        {order.items && order.items.length > 0 
                          ? (order.items.length === 1 ? order.items[0].title : \`\${order.items.length} itens\`) 
                          : (order.productTitle || 'Produto')}
                      </p>
                    </td>`;

code = code.replace(target, replacement);

fs.writeFileSync('src/pages/Orders.tsx', code);
