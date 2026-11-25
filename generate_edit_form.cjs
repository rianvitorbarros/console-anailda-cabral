const fs = require('fs');

const formContent = `
    if (editingProduct) {
      return (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -20 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden mt-6"
        >
          <div className="p-5 md:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 tracking-tight">
              {editingProduct.id ? "Editar Produto" : "Novo Produto"}
            </h3>
            <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSave} className="flex flex-col">
            <div className="p-5 md:p-8 space-y-10">
              
              {/* Tipo de Produto */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Tipo de Produto</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    name="productType"
                    value={formData.productType || 'simple'}
                    onChange={(e) => setFormData(prev => ({ ...prev, productType: e.target.value, comboItems: e.target.value === 'combo' ? (prev.comboItems || []) : [] }))}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-shadow"
                  >
                    <option value="simple">Produto Simples</option>
                    <option value="book">Livro</option>
                    <option value="devotional">Devocional</option>
                    <option value="accessory">Acessório</option>
                    <option value="combo">Combo / Kit</option>
                  </select>
                </div>
              </div>

              {/* Informações Básicas */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">Informações Básicas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Título <span className="text-red-500">*</span></label>
                      <input required type="text" name="title" value={formData.title || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-shadow" placeholder="Ex: Livro A Mulher" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subtítulo</label>
                      <input type="text" name="subtitle" value={formData.subtitle || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-shadow" placeholder="Ex: Edição Especial" />
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Autor</label>
                      <input type="text" name="author" value={formData.author || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-shadow" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Slug (URL)</label>
                      <input required type="text" name="slug" value={formData.slug || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-shadow" placeholder="livro-a-mulher" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preços */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">Preços e Vendas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Preço Original</label>
                    <div className="relative">
                      <span className="absolute left-4 top-2.5 text-slate-500">R$</span>
                      <input required type="number" step="0.01" min="0" name="originalPrice" value={formData.originalPrice || 0} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-shadow" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Preço Promocional</label>
                    <div className="relative">
                      <span className="absolute left-4 top-2.5 text-slate-500">R$</span>
                      <input required type="number" step="0.01" min="0" name="promotionalPrice" value={formData.promotionalPrice || 0} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-emerald-300 dark:border-emerald-700/50 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow font-bold text-emerald-700 dark:text-emerald-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
                <select name="status" value={formData.status || 'draft'} onChange={handleChange} className="w-full md:w-1/2 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-shadow">
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativo</option>
                  <option value="archived">Arquivado</option>
                </select>
              </div>

              {/* Combo Items */}
              {formData.productType === 'combo' && (
                <div>
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Itens do Kit / Combo</h4>
                    <button 
                      type="button"
                      onClick={() => {
                        const newItems = [...(formData.comboItems || [])];
                        newItems.push({ quantity: 1, priceMode: 'dynamic', unitPrice: 0 });
                        setFormData(prev => ({ ...prev, comboItems: newItems }));
                      }}
                      className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-3 py-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Item
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {(formData.comboItems || []).length === 0 ? (
                      <div className="text-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                        <Layers className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">Nenhum item adicionado a este kit.</p>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {(formData.comboItems || []).map((item, index) => {
                          const isManual = item.sourceType === 'manual' || (item.priceMode === 'manual' && !item.productId);
                          return (
                            <motion.div 
                              key={item.id || index} 
                              initial={{ opacity: 0, y: 10, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                              className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-950 flex gap-4 items-start shadow-sm"
                            >
                              <div className="absolute top-4 right-4 md:static md:ml-auto">
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const newItems = [...(formData.comboItems || [])];
                                    newItems.splice(index, 1);
                                    setFormData(prev => ({ ...prev, comboItems: newItems }));
                                  }}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 w-full pr-8 md:pr-0">
                                <div className="md:col-span-4">
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Produto do Kit</label>
                                  <input 
                                    type="text"
                                    value={item.title || ''}
                                    placeholder="Nome do produto"
                                    onChange={(e) => {
                                      const newItems = [...(formData.comboItems || [])];
                                      newItems[index] = { ...item, title: e.target.value };
                                      setFormData(prev => ({ ...prev, comboItems: newItems }));
                                    }}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Qtd</label>
                                  <input 
                                    type="number"
                                    min="1"
                                    value={item.quantity || 1}
                                    onChange={(e) => {
                                      const newItems = [...(formData.comboItems || [])];
                                      newItems[index] = { ...item, quantity: parseInt(e.target.value) || 1 };
                                      setFormData(prev => ({ ...prev, comboItems: newItems }));
                                    }}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-rose-500 outline-none text-center"
                                  />
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 md:px-8 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-500">Confira as informações antes de salvar.</p>
              <button 
                type="submit" 
                disabled={isSaving}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {savingType === "update" ? "Salvando..." : "Criando..."}
                  </>
                ) : (
                  "Salvar Produto"
                )}
              </button>
            </div>
          </form>
        </motion.div>
      );
    }
`;

let code = fs.readFileSync('src/pages/Products.tsx', 'utf8');

code = code.replace(
  `    if (editingProduct) {
      return (
        <div className="mt-6 border border-rose-500 bg-rose-50 p-6 rounded-xl">
           <h3 className="text-xl font-bold">Modo Edição (Temporariamente Oculto para Diagnóstico)</h3>
           <button onClick={handleCancel} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg">Cancelar</button>
        </div>
      );
    }`,
  formContent
);

fs.writeFileSync('src/pages/Products.tsx', code);
