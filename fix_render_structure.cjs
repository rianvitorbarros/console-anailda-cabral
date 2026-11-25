const fs = require('fs');
let code = fs.readFileSync('src/pages/Products.tsx', 'utf8');

// Remove early returns
code = code.replace(
  `  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }`,
  ``
);

code = code.replace(
  `  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-4">
        <AlertCircle className="w-8 h-8" />
        <p>{error}</p>
      </div>
    );
  }`,
  ``
);

code = code.replace(
  `  if (!user) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Acesso restrito. Faça login para gerenciar produtos.
      </div>
    );
  }`,
  ``
);

// Now update the main return statement to handle these conditions INSIDE the layout
code = code.replace(
  `  return (
    <div className="space-y-6">
      
      {/* Feedback Modal */}`,
  `  return (
    <div className="space-y-6">
      
      {/* Feedback Modal */}`
);

fs.writeFileSync('src/pages/Products.tsx', code);
