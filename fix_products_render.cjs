const fs = require('fs');
let code = fs.readFileSync('src/pages/Products.tsx', 'utf8');

// The file has a single main return at the end
code = code.replace(
  /return \(\s*<div className="space-y-6">[\s\S]*\}\s*<\/div>\s*\);\s*\}\s*$/m,
  `
  function renderContent() {
    if (authLoading || loading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
          <p className="text-slate-500 font-medium">Carregando produtos...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-red-500 gap-4">
          <AlertCircle className="w-8 h-8" />
          <p>{error}</p>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-4">
          <AlertCircle className="w-8 h-8" />
          <p>Acesso restrito. Faça login para gerenciar produtos.</p>
        </div>
      );
    }

    if (!mainProductExists && products.length === 0 && !editingProduct) {
      return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center mt-6">
          <Package className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-slate-100">Nenhum produto cadastrado</h3>
          <p className="text-slate-500 mb-6 max-w-md">O produto inicial (anailda-book-main) ainda não foi criado no banco de dados.</p>
          <button 
            onClick={handleCreateInitial}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {isSaving ? "Criando..." : "Criar produto inicial"}
          </button>
        </div>
      );
    }

    if (products.length === 0 && !editingProduct) {
      return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center mt-6">
          <Package className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-slate-100">Nenhum produto cadastrado para este projeto.</h3>
          <p className="text-slate-500 mb-6 max-w-md">Os produtos criados aparecerão aqui.</p>
        </div>
      );
    }

    if (editingProduct) {
      return (
        <div className="mt-6 border border-rose-500 bg-rose-50 p-6 rounded-xl">
           <h3 className="text-xl font-bold">Modo Edição (Temporariamente Oculto para Diagnóstico)</h3>
           <button onClick={handleCancel} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg">Cancelar</button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
        {products.map((p) => (
          <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">{p.title || "Produto sem título"}</h3>
              <p className="text-xs text-slate-500 font-mono mt-1">{p.id || "sem-id"}</p>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-1 bg-slate-100 text-xs rounded-full">{p.status || "draft"}</span>
                <span className="px-2 py-1 bg-slate-100 text-xs rounded-full">{p.productType || p.type || "simple"}</span>
              </div>
            </div>
            
            <div className="space-y-2 text-sm mt-4">
              <div className="flex justify-between text-slate-500">
                <span>Original</span>
                <span className="line-through">{formatCurrency(Number(p.originalPrice) || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-600">
                <span>Promoção</span>
                <span>{formatCurrency(Number(p.promotionalPrice) || 0)}</span>
              </div>
            </div>

            <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100">
              <button 
                onClick={() => handleToggleStatus(p)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                {p.status === 'active' ? 'Arquivar' : 'Ativar'}
              </button>
              <button 
                onClick={() => handleEdit(p)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Feedback Modal */}
      <OperationFeedbackDialog
        open={savingState !== "idle"}
        state={savingState}
        onClose={() => setSavingState("idle")}
        onRetry={() => setSavingState("idle")}
        loadingTitle={savingType === "update" ? "Salvando alterações" : "Criando produto"}
        loadingDescription={savingType === "update" ? "Atualizando as informações do produto." : "Salvando informações e preparando a listagem."}
        loadingDetail={savingType === "update" ? "Aplicando mudanças e sincronizando a listagem." : "Validando dados e registrando o produto no painel."}
        successTitle={savingType === "update" ? "Produto atualizado com sucesso" : "Produto criado com sucesso"}
        successDescription={savingType === "update" ? "As alterações foram aplicadas." : "O produto foi adicionado ao painel."}
        errorTitle="Erro ao salvar produto"
        errorDescription={savingError}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Produtos</h1>
          <p className="text-slate-500 dark:text-slate-400">Gerencie os produtos do projeto.</p>
        </div>
        <div className="flex gap-3">
          {permissions.canEditProducts && !editingProduct && (
            <button 
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md shadow-rose-600/20"
            >
              <Plus className="w-4 h-4" />
              Novo produto
            </button>
          )}
        </div>
      </div>

      {renderContent()}
    </div>
  );
}
`
);

fs.writeFileSync('src/pages/Products.tsx', code);
