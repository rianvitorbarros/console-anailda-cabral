import React from "react";
import { motion } from "motion/react";
import { MousePointerClick, Filter } from "lucide-react";

export function Funnel() {
  const steps = [
    { name: "Sessões (Visitou o site)", count: 1000, percentage: "100%", color: "bg-rose-400" },
    { name: "Click Checkout", count: 320, percentage: "32%", color: "bg-rose-500" },
    { name: "Iniciou Checkout", count: 180, percentage: "18%", color: "bg-rose-600" },
    { name: "Pagamento Gerado", count: 120, percentage: "12%", color: "bg-emerald-400" },
    { name: "Aprovados", count: 75, percentage: "7.5%", color: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Funil de Conversão</h1>
          <p className="text-slate-500 dark:text-slate-400">Analise a jornada de compra dos visitantes.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <Filter className="w-4 h-4" />
          Últimos 7 dias
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8"
      >
        <div className="space-y-8">
          {steps.map((step, index) => {
            const width = Math.max((step.count / steps[0].count) * 100, 5); // min width 5% for visibility
            return (
              <div key={step.name} className="relative">
                <div className="flex items-end justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{step.name}</span>
                  <div className="text-right flex items-baseline gap-2">
                    <span className="font-bold text-lg text-slate-900 dark:text-white">{step.count}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{step.percentage}</span>
                  </div>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                    className={`h-full ${step.color} rounded-full`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <MousePointerClick className="w-4 h-4" />
            Insights de Conversão
          </h4>
          <ul className="space-y-2 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed uppercase tracking-wide font-medium">
            <li>• Pix está convertendo melhor que cartão neste período.</li>
            <li>• Muitos usuários iniciam o checkout, mas abandonam na etapa de pagamento.</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
