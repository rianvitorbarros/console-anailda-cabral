const fs = require('fs');
let code = fs.readFileSync('src/pages/OrderDetails.tsx', 'utf8');

const target = `<div className="flex items-center justify-between py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <p className="font-medium">{order.productTitle || 'Produto Padrão'}</p>
                <p className="text-sm text-slate-500">Qtd: 1</p>
              </div>
              <p className="font-medium">{formatCurrency(order.amount || 0)}</p>
            </div>`;

const replacement = `{order.items && order.items.length > 0 ? (
              <div className="space-y-4 py-4 border-b border-slate-200 dark:border-slate-800">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{item.title || 'Item'}</p>
                      <p className="text-sm text-slate-500">
                        {item.type && <span className="uppercase text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mr-2">{item.type}</span>}
                        Qtd: {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(item.totalPrice || (item.unitPrice * item.quantity) || 0)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between py-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{order.productTitle || 'Produto Padrão'}</p>
                  <p className="text-sm text-slate-500">Qtd: 1</p>
                </div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(order.amount || 0)}</p>
              </div>
            )}`;

code = code.replace(target, replacement);

fs.writeFileSync('src/pages/OrderDetails.tsx', code);
