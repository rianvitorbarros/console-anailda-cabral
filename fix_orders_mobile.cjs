const fs = require('fs');
let code = fs.readFileSync('src/pages/Orders.tsx', 'utf8');

const target = `                      <p className="font-mono text-[10px] text-slate-500">
                        {order.orderCode || order.id.substring(0,8)}
                      </p>
                    </div>`;

const replacement = `                      <p className="font-mono text-[10px] text-slate-500">
                        {order.orderCode || order.id.substring(0,8)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        {order.items && order.items.length > 0 
                          ? (order.items.length === 1 ? order.items[0].title : \`\${order.items.length} itens\`) 
                          : (order.productTitle || 'Produto')}
                      </p>
                    </div>`;

code = code.replace(target, replacement);

fs.writeFileSync('src/pages/Orders.tsx', code);
