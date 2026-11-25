import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { Package, Truck, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { subscribeToOrders, Order } from "../services/ordersService";

export function EditoraDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToOrders('anailda-book', (newOrders) => {
      setOrders(newOrders);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const stats = {
    aguardando: orders.filter(o => (o.paymentStatus === 'paid' || o.paymentStatus === 'approved') && (!o.shipping?.status || o.shipping.status === 'not_started')).length,
    separacao: orders.filter(o => o.shipping?.status === 'preparing').length,
    enviados: orders.filter(o => o.shipping?.status === 'shipped').length,
    entregues: orders.filter(o => o.shipping?.status === 'delivered').length,
    problemas: orders.filter(o => o.shipping?.status === 'issue' || o.shipping?.status === 'returned').length,
    totalVendido: orders.filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'approved').length,
  };

  const statCards = [
    { title: "Aguardando Envio", value: stats.aguardando, icon: Clock, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30", borderColor: "border-amber-200 dark:border-amber-800" },
    { title: "Em Separação", value: stats.separacao, icon: Package, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", borderColor: "border-blue-200 dark:border-blue-800" },
    { title: "Enviados", value: stats.enviados, icon: Truck, color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/30", borderColor: "border-indigo-200 dark:border-indigo-800" },
    { title: "Entregues", value: stats.entregues, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", borderColor: "border-emerald-200 dark:border-emerald-800" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Resumo</h1>
        <p className="text-slate-500 dark:text-slate-400">Controle dos envios do livro.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`p-4 rounded-2xl border ${stat.borderColor} bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{stat.title}</span>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? "-" : stat.value}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-red-700 dark:text-red-400">Problemas no Envio</h3>
          </div>
          <p className="text-sm text-red-600 dark:text-red-300 mb-4">
            Você tem {loading ? "..." : stats.problemas} pedidos com problemas logísticos ou devolvidos.
          </p>
          <Link to="/shipping?filter=problemas" className="text-xs font-bold bg-white dark:bg-slate-800 text-red-600 px-4 py-2 rounded-lg shadow-sm border border-red-100 dark:border-red-800 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors inline-block">
            Ver problemas
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
        >
          <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4">Próximas ações</h3>
          <ul className="space-y-3 mb-6">
            <li className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Pedidos aguardando envio:</span>
              <span className="font-bold text-slate-900 dark:text-white">{stats.aguardando}</span>
            </li>
            <li className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Pedidos em separação:</span>
              <span className="font-bold text-slate-900 dark:text-white">{stats.separacao}</span>
            </li>
            <li className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Total de livros vendidos:</span>
              <span className="font-bold text-slate-900 dark:text-white">{stats.totalVendido}</span>
            </li>
          </ul>
          <Link to="/shipping" className="w-full flex items-center justify-center bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-3 rounded-xl uppercase tracking-wider transition-colors shadow-sm">
            Ver envios pendentes
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
