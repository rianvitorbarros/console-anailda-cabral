const fs = require('fs');
let code = fs.readFileSync('src/pages/Products.tsx', 'utf8');

const regex = /\{\(formData\.comboItems \|\| \[\]\)\.map\(\(item, index\) => \([\s\S]*?<\/motion\.div>\s*\)\)\}/;
const replacement = `{(formData.comboItems || []).map((item, index) => {
  const isManual = item.sourceType === 'manual' || !item.productId;
  
  return (
    <motion.div 
      key={item.id || index} 
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-950 flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow relative group"
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
          title="Remover item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 w-full pr-8 md:pr-0">
        <div className="md:col-span-3">
          <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Tipo de Item</label>
          <select 
            value={isManual ? 'manual' : 'linkedProduct'}
            onChange={(e) => {
              const newItems = [...(formData.comboItems || [])];
              const t = e.target.value;
              newItems[index] = { 
                ...item, 
                sourceType: t as any,
                productId: t === 'manual' ? '' : item.productId,
                title: t === 'manual' ? item.title : '', 
                priceMode: 'fixed',
                unitPrice: 0
              };
              setFormData(prev => ({ ...prev, comboItems: newItems }));
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
          >
            <option value="manual">Item Manual</option>
            <option value="linkedProduct">Produto Existente</option>
          </select>
        </div>
        
        {!isManual ? (
          <>
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Selecionar Produto</label>
              <select 
                value={item.productId || item.linkedProductId || ''}
                onChange={(e) => {
                  const selected = products.find(p => p.id === e.target.value);
                  const newItems = [...(formData.comboItems || [])];
                  newItems[index] = { 
                    ...item, 
                    productId: e.target.value,
                    linkedProductId: e.target.value,
                    title: selected ? selected.title : '',
                    name: selected ? selected.title : '',
                    unitPrice: selected ? selected.promotionalPrice : 0,
                    fixedUnitPrice: selected ? selected.promotionalPrice : 0,
                    priceMode: 'dynamic',
                    unitPriceMode: 'dynamic'
                  };
                  setFormData(prev => ({ ...prev, comboItems: newItems }));
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
              >
                <option value="" disabled>Escolha um produto...</option>
                {products.filter(p => p.id !== editingProduct?.id && p.productType !== 'combo').map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Preço (Modo)</label>
              <select 
                value={item.priceMode || item.unitPriceMode || 'dynamic'}
                onChange={(e) => {
                  const newItems = [...(formData.comboItems || [])];
                  newItems[index] = { ...item, priceMode: e.target.value as any, unitPriceMode: e.target.value as any };
                  setFormData(prev => ({ ...prev, comboItems: newItems }));
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
              >
                <option value="dynamic">Dinâmico (Auto)</option>
                <option value="manual">Fixo (Manual)</option>
              </select>
            </div>
          </>
        ) : (
          <div className="md:col-span-6">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Nome do Item</label>
            <input 
              type="text"
              value={item.title || item.name || ''}
              onChange={(e) => {
                const newItems = [...(formData.comboItems || [])];
                newItems[index] = { ...item, title: e.target.value, name: e.target.value };
                setFormData(prev => ({ ...prev, comboItems: newItems }));
              }}
              placeholder="Ex: Caixa Personalizada"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
            />
          </div>
        )}
        <div className="md:col-span-3 lg:col-span-1">
          <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Qtd</label>
          <input 
            type="number" 
            min="1"
            value={item.quantity}
            onChange={(e) => {
              const newItems = [...(formData.comboItems || [])];
              newItems[index] = { ...item, quantity: parseInt(e.target.value) || 1 };
              setFormData(prev => ({ ...prev, comboItems: newItems }));
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
          />
        </div>
        
        {(isManual || item.priceMode === 'manual' || item.unitPriceMode === 'fixed') && (
          <div className="md:col-span-3 lg:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Valor Un. (R$)</label>
            <input 
              type="number" 
              step="0.01"
              value={item.unitPrice ?? item.fixedUnitPrice ?? 0}
              onChange={(e) => {
                const newItems = [...(formData.comboItems || [])];
                newItems[index] = { ...item, unitPrice: parseFloat(e.target.value) || 0, fixedUnitPrice: parseFloat(e.target.value) || 0 };
                setFormData(prev => ({ ...prev, comboItems: newItems }));
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
})}`;

fs.writeFileSync('src/pages/Products.tsx', code.replace(regex, replacement));
