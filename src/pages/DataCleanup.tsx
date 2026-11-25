import React, { useState } from "react";
import { motion } from "motion/react";
import { Trash2, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { collection, getDocs, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

export function DataCleanup() {
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [isCleaning, setIsCleaning] = useState(false);
  const [results, setResults] = useState<{ collection: string; count: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const projectId = 'anailda-book';
  const targetPhrase = "LIMPAR ANAILDA";

  const collectionsToClean = [
    "orders",
    "orderEvents",
    "publicCheckoutStatus",
    "sessions",
    "analyticsEvents",
    "metrics",
    "funnelEvents",
    "utmEvents",
    "shipments"
  ];

  const handleCleanup = async () => {
    if (confirmationPhrase !== targetPhrase) {
      setError("Frase de confirmação incorreta.");
      return;
    }

    setIsCleaning(true);
    setError(null);
    setResults([]);

    try {
      const newResults = [];
      
      for (const colName of collectionsToClean) {
        const colRef = collection(db, `projects/${projectId}/${colName}`);
        const snapshot = await getDocs(colRef);
        
        let count = 0;
        
        // Use batch to delete in chunks of 500 (Firestore limit)
        // For simplicity in UI, we'll delete one by one or in small batches
        const batches = [];
        let currentBatch = writeBatch(db);
        let operationCount = 0;

        snapshot.docs.forEach((docSnap) => {
          currentBatch.delete(docSnap.ref);
          operationCount++;
          count++;

          if (operationCount === 450) {
            batches.push(currentBatch);
            currentBatch = writeBatch(db);
            operationCount = 0;
          }
        });

        if (operationCount > 0) {
          batches.push(currentBatch);
        }

        for (const batch of batches) {
          await batch.commit();
        }

        newResults.push({ collection: colName, count });
      }

      setResults(newResults);
      setIsDone(true);
      setConfirmationPhrase("");
    } catch (err: any) {
      console.error("Erro durante a limpeza:", err);
      setError(`Erro durante a limpeza: ${err.message || 'Desconhecido'}. Verifique se você tem permissão.`);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-red-500" />
            Limpeza de Dados de Teste
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Remova dados operacionais antes do lançamento oficial.</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-red-50/50 dark:bg-red-900/10">
          <div className="flex gap-4 items-start">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-sm text-red-800 dark:text-red-400 uppercase tracking-tight">
                Atenção: Ação Irreversível
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Esta ação apagará permanentemente todos os dados de testes do projeto <strong>{projectId}</strong>. 
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Coleções que serão limpas:</h4>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 grid grid-cols-1 md:grid-cols-2 gap-1">
              {collectionsToClean.map(col => (
                <li key={col}>projects/{projectId}/<strong>{col}</strong></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">O que será PRESERVADO:</h4>
            <ul className="list-disc list-inside text-sm text-emerald-600 dark:text-emerald-400">
              <li>Produtos e Ofertas</li>
              <li>Usuários, Equipe e Permissões</li>
              <li>Credenciais (Mercado Pago, etc.)</li>
              <li>Configurações do Projeto (incluindo Frete)</li>
            </ul>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
              {error}
            </div>
          )}

          {isDone ? (
            <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300">Limpeza Concluída</h4>
              </div>
              <ul className="space-y-2">
                {results.map(r => (
                  <li key={r.collection} className="text-sm text-emerald-700 dark:text-emerald-400 flex justify-between">
                    <span>{r.collection}</span>
                    <span className="font-bold">{r.count} apagados</span>
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => setIsDone(false)}
                className="mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors"
              >
                Nova Limpeza
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Para confirmar a exclusão dos dados operacionais, digite <span className="font-mono text-red-600 select-all">{targetPhrase}</span>:
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                  placeholder={targetPhrase}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  disabled={isCleaning}
                />
                <button 
                  onClick={handleCleanup}
                  disabled={isCleaning || confirmationPhrase !== targetPhrase}
                  className="flex items-center justify-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCleaning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  {isCleaning ? "Limpando..." : "Apagar Dados"}
                </button>
              </div>
            </div>
          )}
          
        </div>
      </motion.div>
    </div>
  );
}
