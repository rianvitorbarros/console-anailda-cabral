const fs = require('fs');
let code = fs.readFileSync('src/pages/Products.tsx', 'utf8');

// Undo the wrong replacement
code = code.replace(
  `    if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-4">
        <AlertCircle className="w-8 h-8" />
        <p>{error}</p>
      </div>
    );
  }

  if (!user) {
      setSavingError("Sessão expirada. Faça login novamente.");`,
  `    if (!user) {
      setSavingError("Sessão expirada. Faça login novamente.");`
);

// Add it to the correct place
code = code.replace(
  `  if (!user) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Acesso restrito. Faça login para gerenciar produtos.
      </div>
    );
  }`,
  `  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-4">
        <AlertCircle className="w-8 h-8" />
        <p>{error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Acesso restrito. Faça login para gerenciar produtos.
      </div>
    );
  }`
);

fs.writeFileSync('src/pages/Products.tsx', code);
