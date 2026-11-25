const fs = require('fs');
let code = fs.readFileSync('src/pages/Products.tsx', 'utf8');

code = code.replace(
  `      {/* Product List */}
      {!authLoading && !loading && !error && user && !editingProduct && products.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center mt-6">
          <Package className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-slate-100">Nenhum produto cadastrado para este projeto.</h3>
          <p className="text-slate-500 mb-6 max-w-md">Os produtos criados aparecerão aqui.</p>
        </div>
      )}`,
  `      {/* Product List */}`
);

fs.writeFileSync('src/pages/Products.tsx', code);
