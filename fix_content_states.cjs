const fs = require('fs');
let code = fs.readFileSync('src/pages/Products.tsx', 'utf8');

// Replace the empty state and form rendering logic to handle loading, error, etc
code = code.replace(
  `      </div>

      {!mainProductExists && products.length === 0 && (`,
  `      </div>

      {(authLoading || loading) && (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
          <p className="text-slate-500 font-medium">Carregando produtos...</p>
        </div>
      )}

      {!authLoading && !loading && error && (
        <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-4">
          <AlertCircle className="w-8 h-8" />
          <p>{error}</p>
        </div>
      )}

      {!authLoading && !loading && !error && !user && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-4">
          <AlertCircle className="w-8 h-8" />
          <p>Acesso restrito. Faça login para gerenciar produtos.</p>
        </div>
      )}

      {!authLoading && !loading && !error && user && !mainProductExists && products.length === 0 && !editingProduct && (`
);

code = code.replace(
  `      {/* Editing Form */}
      {editingProduct && (`,
  `      {/* Editing Form */}
      {!authLoading && !loading && !error && user && editingProduct && (`
);

code = code.replace(
  `      {/* Product List */}
      {!editingProduct && products.length === 0 && (`,
  `      {/* Product List */}
      {!authLoading && !loading && !error && user && !editingProduct && products.length === 0 && (`
);

code = code.replace(
  `      {!editingProduct && products.length > 0 && (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">`,
  `      {!authLoading && !loading && !error && user && !editingProduct && products.length > 0 && (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">`
);


fs.writeFileSync('src/pages/Products.tsx', code);
