import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { formatCurrency } from "../lib/utils";
import { Tag, Edit2, Loader2, Plus, X, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { getOffers, updateOffer, createOffer, archiveOffer } from "../services/offerService";
import { getProducts, ProductData } from "../services/productService";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import { Offer } from "../types";

const PROJECT_ID = "anailda-book";

export function Offers() {
  const { user, loading: authLoading } = useAuth();
  const permissions = usePermissions();
  
  const [offers, setOffers] = useState<Offer[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Offer>>({});

  useEffect(() => {
    if (authLoading || !user) return;
    fetchData();
  }, [user, authLoading]);

  async function fetchData() {
    setLoading(true);
    try {
      const [fetchedOffers, fetchedProducts] = await Promise.all([
        getOffers(PROJECT_ID),
        getProducts(PROJECT_ID)
      ]);
      setOffers(fetchedOffers);
      setProducts(fetchedProducts.filter(p => p.status === 'active')); // only active products can be used
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (offer: Offer) => {
    setEditingOffer(offer);
    setFormData(offer);
  };

  const handleNew = () => {
    const newOffer: Offer = {
      projectId: PROJECT_ID,
      title: "",
      offerType: "checkout_upsell",
      status: "active",
      triggerProductId: "",
      offeredProductId: "",
      priority: 1,
      displayTitle: "",
      displayDescription: "",
      primaryButtonText: "Sim, eu quero",
      secondaryButtonText: "Não, obrigado",
      badgeText: ""
    };
    setEditingOffer(newOffer);
    setFormData(newOffer);
  };

  const handleCancel = () => {
    setEditingOffer(null);
    setFormData({});
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as any;
    
    let parsedValue: any = value;
    if (type === 'number') {
      parsedValue = parseInt(value) || 0;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: parsedValue
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      alert("Sessão expirada. Faça login novamente.");
      return;
    }
    
    if (formData.triggerProductId === formData.offeredProductId) {
      alert("O produto oferecido não pode ser igual ao produto gatilho.");
      return;
    }
    
    setSaving(true);
    try {
      if (editingOffer?.id) {
        await updateOffer(editingOffer.id, formData, user.uid);
      } else {
        await createOffer(formData as Offer, user.uid);
      }
      await fetchData();
      handleCancel();
    } catch (error: any) {
      console.error("Error saving offer:", error);
      alert(`Erro ao salvar oferta: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (offer: Offer) => {
    if (!user || !offer.id) return;
    try {
      const newStatus = offer.status === 'active' ? 'inactive' : 'active';
      await updateOffer(offer.id, { status: newStatus }, user.uid);
      await fetchData();
    } catch (error) {
      console.error("Error toggling status:", error);
      alert("Erro ao alterar o status da oferta.");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Acesso restrito. Faça login para gerenciar ofertas.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Ofertas (Upsell)</h1>
          <p className="text-slate-500 dark:text-slate-400">Configure order bumps e upsells do checkout.</p>
        </div>
        <div className="flex gap-3">
          {permissions.canEditProducts && (
            <button 
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova oferta
            </button>
          )}
        </div>
      </div>

      {offers.length === 0 && !editingOffer && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center">
          <Tag className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="font-bold text-lg mb-2">Nenhuma oferta cadastrada</h3>
          <p className="text-slate-500 mb-6 max-w-md">Crie ofertas de upsell ou order bump para aumentar o ticket médio das suas vendas.</p>
          <button 
            onClick={handleNew}
            className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar primeira oferta
          </button>
        </div>
      )}

      {/* Editing Form */}
      {editingOffer && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-800 shadow-lg overflow-hidden"
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              {editingOffer.id ? "Editar Oferta" : "Nova Oferta"}
            </h3>
            <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSave} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <div className="space-y-6">
                <h4 className="font-bold text-sm border-b pb-2">Configurações Internas</h4>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Título Interno</label>
                  <input required type="text" name="title" value={formData.title || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="Ex: Upsell Combo A Mulher" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Oferta</label>
                    <select name="offerType" value={formData.offerType || 'checkout_upsell'} onChange={handleChange} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700">
                      <option value="checkout_upsell">Upsell no checkout</option>
                      <option value="order_bump">Order Bump</option>
                      <option value="manual">Oferta manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                    <select name="status" value={formData.status || 'active'} onChange={handleChange} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700">
                      <option value="active">Ativa</option>
                      <option value="inactive">Inativa</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Produto Gatilho (Quando o cliente comprar...)</label>
                  <select required name="triggerProductId" value={formData.triggerProductId || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700">
                    <option value="">Selecione um produto</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Produto Oferecido (Oferecer este...)</label>
                  <select required name="offeredProductId" value={formData.offeredProductId || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700">
                    <option value="">Selecione um produto</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.title} {p.productType === 'combo' ? '(COMBO)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Prioridade</label>
                  <input type="number" name="priority" value={formData.priority || 1} onChange={handleChange} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700" />
                  <p className="text-[10px] text-slate-400 mt-1">Ofertas com menor número aparecem primeiro se houver conflito.</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <h4 className="font-bold text-sm border-b pb-2">Exibição para o Cliente</h4>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Título da Oferta</label>
                  <input required type="text" name="displayTitle" value={formData.displayTitle || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="Ex: Leve o combo completo!" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Descrição</label>
                  <textarea name="displayDescription" value={formData.displayDescription || ''} onChange={handleChange} rows={3} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="Ex: Receba o livro com caixa personalizada e marca-página..." />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Botão Principal</label>
                    <input required type="text" name="primaryButtonText" value={formData.primaryButtonText || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="Ex: Quero o combo completo" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Botão Secundário</label>
                    <input type="text" name="secondaryButtonText" value={formData.secondaryButtonText || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="Ex: Continuar apenas com o livro" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Badge (Opcional)</label>
                  <input type="text" name="badgeText" value={formData.badgeText || ''} onChange={handleChange} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700" placeholder="Ex: Oferta Especial" />
                </div>
              </div>
              
            </div>
            
            <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button type="button" onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar Oferta
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Offers List */}
      <div className="space-y-4">
        {offers.map((offer) => {
          const triggerP = products.find(p => p.id === offer.triggerProductId);
          const offeredP = products.find(p => p.id === offer.offeredProductId);
          
          return (
            <motion.div
              key={offer.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row gap-6 md:items-center justify-between shadow-sm"
            >
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{offer.displayTitle || offer.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    offer.offerType === 'checkout_upsell' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    offer.offerType === 'order_bump' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {offer.offerType === 'checkout_upsell' ? 'Upsell no Checkout' : offer.offerType === 'order_bump' ? 'Order Bump' : 'Manual'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    offer.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {offer.status === 'active' ? 'Ativa' : 'Inativa'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    Prioridade: {offer.priority || 1}
                  </span>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  Interno: {offer.title}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Produto Gatilho</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {triggerP ? triggerP.title : <span className="text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Produto removido ou inativo</span>}
                    </span>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-900/10 p-3 rounded-lg border border-rose-100 dark:border-rose-900/30">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-rose-400 mb-1">Produto Oferecido</span>
                    <span className="font-medium text-rose-700 dark:text-rose-300">
                      {offeredP ? offeredP.title : <span className="text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Produto removido ou inativo</span>}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 md:pl-6 md:border-l border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => handleToggleStatus(offer)}
                  className={`p-2 rounded-lg transition-colors ${
                    offer.status === 'active' 
                      ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40' 
                      : 'text-slate-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700'
                  }`}
                  title={offer.status === 'active' ? 'Desativar oferta' : 'Ativar oferta'}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleEdit(offer)}
                  className="p-2 text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Editar oferta"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
