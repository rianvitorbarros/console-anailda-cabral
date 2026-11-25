import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Truck, Save, Loader2, Info } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export function ShippingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [enabled, setEnabled] = useState(true);
  const [fixedAmount, setFixedAmount] = useState<number>(0);
  const [label, setLabel] = useState("Frete fixo");
  const [description, setDescription] = useState("Frete fixo para entrega");
  const [lastUpdated, setLastUpdated] = useState<any>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);

  const projectId = 'anailda-book';
  const { user } = useAuth();

  useEffect(() => {
    async function loadShippingSettings() {
      try {
        const docRef = doc(db, `projects/${projectId}/settings/shipping`);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setEnabled(data.enabled !== false);
          setFixedAmount(data.fixedAmount || 0);
          setLabel(data.label || "Frete fixo");
          setDescription(data.description || "Frete fixo para entrega");
          setLastUpdated(data.updatedAt);
          setUpdatedBy(data.updatedBy);
        }
      } catch (err: any) {
        console.error("Error loading shipping settings:", err);
        setError("Falha ao carregar configurações de frete.");
      } finally {
        setLoading(false);
      }
    }
    loadShippingSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError(null);
    
    if (fixedAmount < 0) {
      setError("O valor do frete não pode ser negativo.");
      setSaving(false);
      return;
    }

    try {
      const docRef = doc(db, `projects/${projectId}/settings/shipping`);
      await setDoc(docRef, {
        projectId,
        enabled,
        mode: "fixed",
        fixedAmount: Number(fixedAmount),
        currency: "BRL",
        label,
        description,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || "admin"
      }, { merge: true });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Update local lastUpdated
      const newSnap = await getDoc(docRef);
      if (newSnap.exists()) {
        setLastUpdated(newSnap.data().updatedAt);
      }
      
    } catch (err: any) {
      console.error("Error saving shipping settings:", err);
      setError("Falha ao salvar configurações de frete.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Frete e Logística</h1>
          <p className="text-slate-500 dark:text-slate-400">Configure as regras e valores de frete do projeto.</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-slate-400" />
            Configuração de Frete Fixo
          </h3>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-6">
          
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-4 bg-emerald-50 text-emerald-700 rounded-lg text-sm mb-4">
              Configurações salvas com sucesso!
            </div>
          )}

          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="enabled" 
              checked={enabled} 
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <label htmlFor="enabled" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Habilitar cobrança de frete
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-100 transition-opacity" style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Valor Fixo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(parseFloat(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-shadow"
                required
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Rótulo exibido no checkout
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-shadow"
                required
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Descrição
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-shadow"
              />
            </div>
          </div>
          
          {lastUpdated && (
             <div className="flex items-center gap-2 text-xs text-slate-500 mt-4">
                <Info className="w-4 h-4" />
                <span>
                  Última atualização em {new Date(lastUpdated?.seconds * 1000).toLocaleString('pt-BR')} 
                  {updatedBy ? ` (por ${updatedBy})` : ''}
                </span>
             </div>
          )}

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button 
              type="submit" 
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
