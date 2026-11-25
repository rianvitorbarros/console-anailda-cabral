import React, { useState, useEffect, useRef } from "react";
import { formatCurrency } from "../lib/utils";
import { 
  Package, 
  Edit2, 
  Loader2, 
  Plus, 
  X, 
  AlertCircle, 
  Trash2, 
  Layers, 
  Book, 
  Heart, 
  Gift, 
  Box,
  Eye,
  CheckCircle2,
  Tag,
  ShoppingBag,
  Link,
  Type
} from "lucide-react";
import { getProducts, updateProduct, createProduct, ProductData, ComboItemData } from "../services/productService";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import { OperationFeedbackDialog } from "../components/OperationFeedbackDialog";
import { ErrorBoundary } from "../components/ErrorBoundary";

const PROJECT_ID = "anailda-book";

const PRODUCT_TYPES = [
  { id: 'simple', label: 'Produto Simples', desc: 'Vendido individualmente', icon: Box },
  { id: 'book', label: 'Livro', desc: 'Livro físico da coleção', icon: Book },
  { id: 'devotional', label: 'Devocional', desc: 'Devocional físico', icon: Heart },
  { id: 'accessory', label: 'Acessório', desc: 'Item complementar ou brinde', icon: Gift },
  { id: 'combo', label: 'Combo / Kit', desc: 'Pacote com múltiplos itens', icon: Layers },
];

export function Products() {
  const { user, loading: authLoading } = useAuth();
  const permissions = usePermissions();

  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [editingProduct, setEditingProduct] = useState<ProductData | null>(null);
  
  const [savingState, setSavingState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [savingError, setSavingError] = useState("");
  const [savingType, setSavingType] = useState<"create" | "update" | "initial">("create");
  
  const [formData, setFormData] = useState<Partial<ProductData>>({});
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchProducts();
  }, [user, authLoading]);

  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const data = await getProducts(PROJECT_ID);
      setProducts(data || []);
    } catch (err: any) {
      setError("Não foi possível carregar os produtos agora.");
    } finally {
      setLoading(false);
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleEdit = (product: ProductData) => {
    // Normalize comboItems data for the UI
    let normalizedComboItems = product.comboItems?.map(item => {
      return {
        ...item,
        sourceType: item.sourceType || (item.productId ? 'linkedProduct' : 'manual'),
        priceMode: item.priceMode || item.unitPriceMode || 'dynamic',
        productId: item.productId || item.linkedProductId,
        unitPrice: item.unitPrice !== undefined ? item.unitPrice : (item.fixedUnitPrice || 0)
      };
    });

    setEditingProduct(product);
    setFormData({
      ...product,
      comboItems: normalizedComboItems
    });
  };

  const handleNew = () => {
    setEditingProduct({
      projectId: PROJECT_ID,
      title: "",
      slug: "",
      productType: "simple",
      status: "draft",
      originalPrice: 0,
      promotionalPrice: 0,
      currency: "BRL"
    } as any);
    setFormData({
      projectId: PROJECT_ID,
      title: "",
      slug: "",
      productType: "simple",
      status: "draft",
      originalPrice: 0,
      promotionalPrice: 0,
      currency: "BRL"
    });
  };

  const handleCancel = () => {
    setEditingProduct(null);
    setFormData({});
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    let parsedValue: any = value;
    if (type === 'number') {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) parsedValue = 0;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: parsedValue
    }));

    if (name === 'title' && !editingProduct?.id) {
      const slug = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      
      setFormData(prev => ({
        ...prev,
        slug
      }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSavingType(editingProduct?.id ? "update" : "create");
    
    if (!user) {
      setSavingError("Sessão expirada. Faça login novamente.");
      setSavingState("error");
      return;
    }

    if (formData.productType === 'combo' && (!formData.comboItems || formData.comboItems.length === 0)) {
      setSavingError("Um combo deve ter pelo menos um item.");
      setSavingState("error");
      return;
    }
    
    setSavingState("loading");
    
    try {
      let savedId = editingProduct?.id;
      
      // Clean up comboItems before saving
      const cleanedComboItems = (formData.comboItems || []).map((item: any) => {
        return {
          productId: item.sourceType === 'linkedProduct' ? item.productId : null,
          title: item.sourceType === 'manual' ? item.title : (products.find(p => p.id === item.productId)?.title || item.title),
          quantity: item.quantity || 1,
          priceMode: item.priceMode || 'dynamic',
          unitPrice: item.unitPrice || 0
        };
      });

      const productDataToSave = {
        ...formData,
        projectId: PROJECT_ID,
        comboItems: formData.productType === 'combo' ? cleanedComboItems : []
      } as ProductData;

      if (savedId) {
        await updateProduct(savedId, productDataToSave, user.uid);
      } else {
        await createProduct(productDataToSave, user.uid);
      }
      
      setSavingState("success");
      
      await fetchProducts();
      setEditingProduct(null);
      setFormData({});
      
    } catch (err: any) {
      console.error("Error saving product:", err);
      setSavingState("error");
      setSavingError(err.message || "Erro ao salvar o produto.");
    }
  };

  const handleToggleStatus = async (product: ProductData) => {
    if (!user || !product.id) return;
    try {
      const newStatus = product.status === 'active' ? 'draft' : 'active';
      if (product.id === 'anailda-book-main' && newStatus === 'draft') {
        const confirm = window.confirm("Aviso: Desativar o produto principal pode tirar o site do ar. Tem certeza?");
        if (!confirm) return;
      }
      
      await updateProduct(product.id, { status: newStatus }, user.uid);
      await fetchProducts();
    } catch (err) {
      console.error("Error toggling status:", err);
      alert("Erro ao alterar status do produto.");
    }
  };

  const isSaving = savingState === "loading" || savingState === "success";

  const originalValue = Number(formData.originalPrice) || 0;
  const promoValue = Number(formData.promotionalPrice) || 0;
  const economy = originalValue > promoValue ? originalValue - promoValue : 0;
  
  // Calculate Combo metrics
  let comboTotalValue = 0;
  if (formData.productType === 'combo' && formData.comboItems) {
    formData.comboItems.forEach((item: any) => {
      let unitPrice = item.unitPrice || 0;
      if (item.sourceType === 'linkedProduct' && item.priceMode === 'dynamic' && item.productId) {
        const linkedP = products.find(p => p.id === item.productId);
        if (linkedP) {
          unitPrice = linkedP.promotionalPrice || linkedP.originalPrice || 0;
        }
      }
      comboTotalValue += unitPrice * (item.quantity || 1);
    });
  }
  const comboEconomy = comboTotalValue > promoValue ? comboTotalValue - promoValue : 0;

  function renderPreview() {
    const title = formData.title || "Nome do Produto";
    const subtitle = formData.subtitle || "Subtítulo do produto aparecerá aqui";
    const typeLabel = PRODUCT_TYPES.find(t => t.id === formData.productType)?.label || "Produto";
    const isActive = formData.status === "active";
    const isCombo = formData.productType === 'combo';
    
    return (
      <div className="sticky top-6">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <Eye className="w-4 h-4 text-slate-400" />
          Prévia do Produto
        </h3>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden relative group">
          
          <div className={`h-24 flex items-center justify-center border-b ${isCombo ? 'bg-gradient-to-br from-purple-100 to-fuchsia-100 dark:from-purple-900/30 dark:to-fuchsia-900/30 border-purple-200 dark:border-purple-800/50' : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-800/50 border-slate-200 dark:border-slate-800'}`}>
            {isCombo ? <Layers className="w-10 h-10 text-purple-300 dark:text-purple-600" /> : <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />}
          </div>

          <div className="p-5">
            {formData.badge && (
              <span className="inline-block px-2 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] font-bold uppercase tracking-wider rounded-md mb-3">
                {formData.badge}
              </span>
            )}
            
            <h4 className="font-bold text-lg text-slate-900 dark:text-slate-100 leading-tight mb-1">{title}</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{subtitle}</p>

            <div className="space-y-1 mb-5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Tag className="w-3.5 h-3.5" />
                {typeLabel}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                {isActive ? 'Status: Ativo' : 'Status: Rascunho/Inativo'}
              </div>
            </div>
            
            {isCombo && formData.comboItems && formData.comboItems.length > 0 && (
              <div className="mb-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Inclui:</span>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {formData.comboItems.slice(0, 4).map((item: any, idx: number) => {
                    const itemName = item.sourceType === 'linkedProduct' 
                      ? (products.find(p => p.id === item.productId)?.title || 'Produto não selecionado')
                      : (item.title || 'Item sem nome');
                    return (
                      <li key={idx} className="flex items-center gap-1.5 truncate">
                        <div className="w-1 h-1 rounded-full bg-slate-400 shrink-0"></div>
                        <span className="truncate">{item.quantity > 1 ? `${item.quantity}x ` : ''}{itemName}</span>
                      </li>
                    );
                  })}
                  {formData.comboItems.length > 4 && (
                    <li className="text-slate-400 text-[10px] pl-2.5 mt-1">+ {formData.comboItems.length - 4} outros itens</li>
                  )}
                </ul>
              </div>
            )}

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-auto">
               <div className="flex flex-col">
                  {isCombo ? (
                     comboTotalValue > promoValue && (
                        <span className="text-xs text-slate-400 line-through mb-0.5">
                          {formatCurrency(comboTotalValue)}
                        </span>
                     )
                  ) : (
                     originalValue > promoValue && (
                        <span className="text-xs text-slate-400 line-through mb-0.5">
                          {formatCurrency(originalValue)}
                        </span>
                     )
                  )}
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(promoValue)}
                  </span>
                  {(isCombo ? comboEconomy : economy) > 0 && (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                      Economia de {formatCurrency(isCombo ? comboEconomy : economy)}
                    </span>
                  )}
               </div>
            </div>
            
            <div className="mt-5">
              <button disabled className="w-full py-2.5 bg-rose-600/10 text-rose-600 dark:text-rose-400 font-bold text-sm rounded-xl border border-rose-600/20">
                Visualização
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderContent() {
    if (authLoading || loading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
          <p className="text-slate-500 font-medium">Carregando produtos...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-red-500 gap-4 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Ops! Ocorreu um problema.</h3>
            <p className="text-slate-500">{error}</p>
          </div>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-500 gap-4">
          <AlertCircle className="w-8 h-8" />
          <p>Acesso restrito. Faça login para gerenciar produtos.</p>
        </div>
      );
    }

    if (products.length === 0 && !editingProduct) {
      return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center mt-8">
          <div className="w-16 h-16 bg-rose-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-rose-500 dark:text-slate-400" />
          </div>
          <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-slate-100">Nenhum produto cadastrado</h3>
          <p className="text-slate-500 mb-6 max-w-sm">Comece a vender adicionando seu primeiro produto, livro ou devocional ao painel.</p>
          <button 
            onClick={handleNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-rose-600/20"
          >
            <Plus className="w-4 h-4" />
            Criar meu primeiro produto
          </button>
        </div>
      );
    }

    if (editingProduct) {
      return (
        <div className="mt-8 relative pb-24">
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Form Area */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Header do form */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                      {editingProduct.id ? "Editar Produto" : "Novo Produto"}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {editingProduct.id ? "Atualize as informações do seu produto." : "Cadastre um produto simples, devocional, acessório ou combo para venda."}
                    </p>
                  </div>
                  <button type="button" onClick={handleCancel} className="self-start sm:self-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-full hover:bg-slate-100 dark:bg-slate-800 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Tipo de Produto */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">Tipo de Produto</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {PRODUCT_TYPES.map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          productType: type.id as any, 
                          comboItems: type.id === 'combo' ? (prev.comboItems || []) : [] 
                        }))}
                        className={`text-left p-4 rounded-xl border transition-all relative overflow-hidden ${
                          formData.productType === type.id 
                            ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-900/10 ring-1 ring-rose-500/50' 
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-950'
                        }`}
                      >
                        {formData.productType === type.id && (
                          <div className="absolute top-3 right-3 text-rose-500">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                        <type.icon className={`w-6 h-6 mb-3 ${formData.productType === type.id ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        <div className={`font-bold text-sm mb-1 ${formData.productType === type.id ? 'text-rose-900 dark:text-rose-100' : 'text-slate-700 dark:text-slate-300'}`}>{type.label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-500 leading-tight">{type.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info Básicas */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Informações Básicas</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Título do produto <span className="text-rose-500">*</span></label>
                      <input required type="text" name="title" value={formData.title || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all placeholder:text-slate-400" placeholder="Ex: Devocional A Mulher" />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Slug (URL)</label>
                      <input required type="text" name="slug" value={formData.slug || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all text-slate-500" placeholder="ex: devocional-a-mulher" />
                      <p className="text-[10px] text-slate-400 mt-1.5">Identificador único na URL.</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Badge (Destaque)</label>
                      <input type="text" name="badge" value={formData.badge || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all" placeholder="Ex: Oferta Especial" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Subtítulo</label>
                      <input type="text" name="subtitle" value={formData.subtitle || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all" placeholder="Um breve resumo do produto..." />
                    </div>
                  </div>
                </div>

                {/* Preços */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Preços e Vendas</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Preço Original</label>
                      <div className="relative">
                        <span className="absolute left-4 top-2.5 text-slate-400 font-medium">R$</span>
                        <input required type="number" step="0.01" min="0" name="originalPrice" value={formData.originalPrice || 0} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none transition-all font-medium" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Preço Promocional</label>
                      <div className="relative">
                        <span className="absolute left-4 top-2.5 text-emerald-600 dark:text-emerald-500 font-bold">R$</span>
                        <input required type="number" step="0.01" min="0" name="promotionalPrice" value={formData.promotionalPrice || 0} onChange={handleChange} className="w-full pl-12 pr-4 py-2.5 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all font-bold text-emerald-700 dark:text-emerald-400" />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
                      <select name="status" value={formData.status || 'draft'} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none transition-all font-medium">
                        <option value="draft">Rascunho (Oculto)</option>
                        <option value="active">Ativo (Visível para compra)</option>
                        <option value="archived">Arquivado</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      {formData.productType !== 'combo' && economy > 0 && (
                        <div className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">Economia para o cliente:</span>
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(economy)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Combos */}
                {formData.productType === 'combo' && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-purple-200 dark:border-purple-900/50 p-6 shadow-sm shadow-purple-100/50 dark:shadow-none">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-base font-bold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                          <Layers className="w-5 h-5" />
                          Itens do Combo / Kit
                        </h3>
                        <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-1">Adicione os produtos que farão parte deste pacote.</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          const newItems = [...(formData.comboItems || [])];
                          newItems.push({ 
                            quantity: 1, 
                            priceMode: 'dynamic', 
                            unitPrice: 0,
                            sourceType: 'linkedProduct',
                            title: ''
                          });
                          setFormData(prev => ({ ...prev, comboItems: newItems }));
                          
                          showToast("Item adicionado ao combo.");
                          
                          setTimeout(() => {
                            const els = document.querySelectorAll('.combo-item-card');
                            if (els.length > 0) {
                              const lastEl = els[els.length - 1];
                              lastEl.scrollIntoView({ behavior: "smooth", block: "center" });
                              const select = lastEl.querySelector('select') as HTMLElement;
                              if (select) select.focus();
                            }
                          }, 100);
                        }}
                        className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-4 py-2 rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" /> Adicionar Item
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {(formData.comboItems || []).length === 0 ? (
                        <div className="text-center py-10 bg-purple-50/50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-800/50 border-dashed">
                          <ShoppingBag className="w-10 h-10 text-purple-200 dark:text-purple-800 mx-auto mb-3" />
                          <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Nenhum produto adicionado ao combo.</p>
                          <p className="text-xs text-purple-400 dark:text-purple-500 mt-1">Clique no botão acima para adicionar o primeiro item.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {(formData.comboItems || []).map((item: any, index: number) => {
                            
                            // Compute dynamic unit price if applicable
                            let calculatedUnitPrice = item.unitPrice || 0;
                            if (item.sourceType === 'linkedProduct' && item.priceMode === 'dynamic' && item.productId) {
                               const linkedP = products.find(p => p.id === item.productId);
                               if (linkedP) {
                                 calculatedUnitPrice = linkedP.promotionalPrice || linkedP.originalPrice || 0;
                               }
                            }
                            
                            const subtotal = calculatedUnitPrice * (item.quantity || 1);

                            return (
                              <div 
                                key={index} 
                                className="combo-item-card p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-950 flex flex-col gap-4 relative group shadow-sm transition-all"
                              >
                                <div className="absolute top-4 right-4">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const newItems = [...(formData.comboItems || [])];
                                      newItems.splice(index, 1);
                                      setFormData(prev => ({ ...prev, comboItems: newItems }));
                                    }}
                                    className="px-2 py-1 flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Remover
                                  </button>
                                </div>
                                
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500">{index + 1}</span>
                                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                    {item.sourceType === 'manual' ? 'Item Manual' : 'Produto Existente'}
                                  </h4>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                  <div className="md:col-span-3">
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Tipo de Item</label>
                                    <select 
                                      value={item.sourceType || 'linkedProduct'}
                                      onChange={(e) => {
                                        const newItems = [...(formData.comboItems || [])];
                                        const val = e.target.value;
                                        newItems[index] = { 
                                          ...item, 
                                          sourceType: val,
                                          priceMode: val === 'linkedProduct' ? 'dynamic' : 'manual'
                                        };
                                        setFormData(prev => ({ ...prev, comboItems: newItems }));
                                      }}
                                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                      <option value="linkedProduct">Produto Existente</option>
                                      <option value="manual">Item Manual</option>
                                    </select>
                                  </div>

                                  <div className="md:col-span-9">
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                                      {item.sourceType === 'manual' ? 'Nome do Item' : 'Selecione o Produto'}
                                    </label>
                                    {item.sourceType === 'manual' ? (
                                      <div className="relative">
                                        <div className="absolute left-3 top-2.5 text-slate-400"><Type className="w-4 h-4" /></div>
                                        <input 
                                          type="text"
                                          value={item.title || ''}
                                          placeholder="Ex: Caixa personalizada"
                                          onChange={(e) => {
                                            const newItems = [...(formData.comboItems || [])];
                                            newItems[index] = { ...item, title: e.target.value };
                                            setFormData(prev => ({ ...prev, comboItems: newItems }));
                                          }}
                                          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-purple-500 outline-none"
                                        />
                                      </div>
                                    ) : (
                                      <div className="relative">
                                        <div className="absolute left-3 top-2.5 text-slate-400"><Link className="w-4 h-4" /></div>
                                        <select 
                                          value={item.productId || ''}
                                          onChange={(e) => {
                                            const newItems = [...(formData.comboItems || [])];
                                            newItems[index] = { ...item, productId: e.target.value };
                                            setFormData(prev => ({ ...prev, comboItems: newItems }));
                                          }}
                                          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-purple-500 outline-none"
                                        >
                                          <option value="" disabled>-- Selecione um produto --</option>
                                          {products.filter(p => p.id !== editingProduct?.id).map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Modo Preço</label>
                                    <select 
                                      value={item.priceMode || 'dynamic'}
                                      disabled={item.sourceType === 'manual'}
                                      onChange={(e) => {
                                        const newItems = [...(formData.comboItems || [])];
                                        newItems[index] = { ...item, priceMode: e.target.value };
                                        setFormData(prev => ({ ...prev, comboItems: newItems }));
                                      }}
                                      className="w-full px-2 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 disabled:opacity-50 focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                      <option value="dynamic">Dinâmico</option>
                                      <option value="manual">Manual</option>
                                    </select>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Qtd</label>
                                    <input 
                                      type="number"
                                      min="1"
                                      value={item.quantity || 1}
                                      onChange={(e) => {
                                        const newItems = [...(formData.comboItems || [])];
                                        newItems[index] = { ...item, quantity: parseInt(e.target.value) || 1 };
                                        setFormData(prev => ({ ...prev, comboItems: newItems }));
                                      }}
                                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-purple-500 outline-none text-center"
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Valor Unit.</label>
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">R$</span>
                                      <input 
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={item.priceMode === 'dynamic' ? calculatedUnitPrice : (item.unitPrice || 0)}
                                        readOnly={item.priceMode === 'dynamic'}
                                        onChange={(e) => {
                                          if (item.priceMode !== 'dynamic') {
                                            const newItems = [...(formData.comboItems || [])];
                                            newItems[index] = { ...item, unitPrice: parseFloat(e.target.value) || 0 };
                                            setFormData(prev => ({ ...prev, comboItems: newItems }));
                                          }
                                        }}
                                        className={`w-full pl-7 pr-2 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none ${item.priceMode === 'dynamic' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-white dark:bg-slate-900 font-medium'}`}
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Subtotal</label>
                                    <div className="w-full px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl border border-transparent flex items-center">
                                      {formatCurrency(subtotal)}
                                    </div>
                                  </div>

                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    {/* Financial Summary */}
                    {(formData.comboItems || []).length > 0 && (
                      <div className="mt-6 p-5 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800/50">
                         <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                           <ShoppingBag className="w-4 h-4" /> Resumo Financeiro do Combo
                         </h4>
                         <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                              <span>Soma individual dos itens:</span>
                              <span className="font-medium">{formatCurrency(comboTotalValue)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                              <span>Preço promocional do combo:</span>
                              <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(promoValue)}</span>
                            </div>
                            <div className="pt-2 border-t border-purple-200/50 dark:border-purple-800/50 flex justify-between">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">Economia real do cliente:</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(comboEconomy > 0 ? comboEconomy : 0)}</span>
                            </div>
                         </div>
                         {comboEconomy <= 0 && promoValue > 0 && (
                           <div className="mt-3 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-2">
                             <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                             <p>O preço do combo ({formatCurrency(promoValue)}) é maior ou igual à soma dos itens individuais ({formatCurrency(comboTotalValue)}). O cliente não terá economia real.</p>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                )}
                
              </div>

              {/* Preview Area */}
              <div className="lg:col-span-4 hidden lg:block">
                {renderPreview()}
              </div>
            </div>
          </form>
          
          {/* Submit actions outside form container strictly to prevent overlap issues in absolute context, using fixed instead */}
          <div className="fixed bottom-0 left-0 right-0 sm:left-64 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] flex items-center justify-end gap-3 px-6 lg:px-12">
            <button 
              type="button" 
              onClick={handleCancel}
              className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-bold transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {savingType === "update" ? "Salvando..." : "Criando..."}
                </>
              ) : (
                savingType === "update" ? "Salvar alterações" : "Criar Produto"
              )}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8 pb-20">
        {products.map((p) => {
          const title = p.title || "Produto sem título";
          const id = p.id || "sem-id";
          const status = p.status || "draft";
          const typeId = p.productType || p.type || "simple";
          const originalPrice = Number(p.originalPrice) || 0;
          const promotionalPrice = Number(p.promotionalPrice) || 0;
          const economy = originalPrice > promotionalPrice ? originalPrice - promotionalPrice : 0;
          const isMain = id === 'anailda-book-main' || p.slug === 'anailda-book-main';
          const isCombo = typeId === 'combo';
          
          const TypeIcon = PRODUCT_TYPES.find(t => t.id === typeId)?.icon || Box;
          const typeLabel = PRODUCT_TYPES.find(t => t.id === typeId)?.label || "Simples";

          return (
            <div key={id} className={`bg-white dark:bg-slate-900 rounded-3xl border ${isMain ? 'border-rose-300 dark:border-rose-800 shadow-md ring-1 ring-rose-500/10' : 'border-slate-200 dark:border-slate-800'} shadow-sm flex flex-col relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1 group`}>
              {/* Header Cover */}
              <div className={`h-16 w-full flex items-center px-5 border-b border-slate-100 dark:border-slate-800/50 ${isCombo ? 'bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20' : 'bg-slate-50 dark:bg-slate-800/20'}`}>
                 <div className="flex w-full items-center justify-between">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg ${isCombo ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
                      <TypeIcon className="w-3 h-3" />
                      {typeLabel}
                    </span>
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg ${
                      status === 'active' ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      status === 'draft' ? 'bg-slate-200/80 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400' :
                      'bg-red-100/80 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {status === 'active' ? 'Ativo' : status === 'draft' ? 'Rascunho' : 'Arquivado'}
                    </span>
                 </div>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                {isMain && (
                   <span className="inline-block text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-2">
                     ★ Produto Principal
                   </span>
                )}
                {p.badge && !isMain && (
                   <span className="inline-block text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-2">
                     {p.badge}
                   </span>
                )}
                
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 line-clamp-1 mb-1">{title}</h3>
                <p className="text-xs text-slate-400 font-mono mb-4">{p.slug}</p>
                
                <div className="mt-auto space-y-1">
                  {originalPrice > promotionalPrice && !isCombo && (
                    <div className="text-sm text-slate-400 line-through">
                      {formatCurrency(originalPrice)}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(promotionalPrice)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleToggleStatus(p)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 uppercase tracking-wider"
                >
                  {status === 'active' ? 'Arquivar' : 'Ativar'}
                </button>
                <button 
                  onClick={() => handleEdit(p)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm hover:shadow active:scale-95"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto space-y-8 relative">
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

        {toastMessage && (
          <div className="fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
            <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium text-sm">{toastMessage}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mb-2">Produtos</h1>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl">Gerencie os produtos, preços, combos e ofertas do projeto.</p>
          </div>
          <div className="flex shrink-0">
            {permissions.canEditProducts && !editingProduct && (
              <button 
                onClick={handleNew}
                className="flex items-center justify-center w-full md:w-auto gap-2 px-6 py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-rose-600/20"
              >
                <Plus className="w-5 h-5" />
                Novo produto
              </button>
            )}
          </div>
        </div>

        {renderContent()}
      </div>
    </ErrorBoundary>
  );
}
