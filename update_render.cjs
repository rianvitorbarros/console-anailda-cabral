const fs = require('fs');
let code = fs.readFileSync('src/pages/Products.tsx', 'utf8');

const regex = /\{p\.productType === 'combo' && \([\s\S]*?<\/span>\s*\)\}/;
const replacement = `{p.productType === 'combo' ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mt-2 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full mr-2">
                      Combo / Kit ({p.comboItems?.length || 0} itens)
                    </span>
                  ) : p.productType ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mt-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full mr-2">
                      {p.productType === 'book' ? 'Livro' : p.productType === 'devotional' ? 'Devocional' : p.productType === 'accessory' ? 'Acessório' : 'Simples'}
                    </span>
                  ) : null}`;

fs.writeFileSync('src/pages/Products.tsx', code.replace(regex, replacement));
