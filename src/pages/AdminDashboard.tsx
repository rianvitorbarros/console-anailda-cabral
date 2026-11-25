import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { formatCurrency } from "../lib/utils";
import { 
  TrendingUp, 
  Users, 
  ShoppingCart, 
  DollarSign, 
  ArrowUpRight,
  ArrowDownRight,
  Filter
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { collection, query, orderBy, getDocs, where } from "firebase/firestore";
import { db } from "../firebase";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import { Order } from "../types";

export function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const permissions = usePermissions();
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalOrders: 0,
    totalRevenue: 0,
    conversionRate: 0,
    funnel: {
      sessions: 0,
      buyClick: 0,
      checkoutStart: 0,
      dataSubmitted: 0,
      shippingFilled: 0,
      paymentSelected: 0,
      pixGenerated: 0,
      orderCreated: 0,
      orderPaid: 0
    }
  });

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [hasLocationData, setHasLocationData] = useState(false);
  
  const projectId = "anailda-book";

  useEffect(() => {
    if (authLoading || !user) return;

    async function fetchDashboardData() {
      try {
        setLoading(true);
        
        // 7 days ago date
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // Fetch Sessions
        const sessionsQuery = query(
          collection(db, "projects", projectId, "sessions"),
          where("startedAt", ">=", sevenDaysAgo)
        );
        const sessionsSnap = await getDocs(sessionsQuery);
        console.log("[DASHBOARD_METRICS] período selecionado: Últimos 7 dias");
        console.log(`[DASHBOARD_METRICS] sessões carregadas: ${sessionsSnap.size}`);
        const sessionsCount = sessionsSnap.size;
        
        // Check for location data
        let foundLocation = false;
        sessionsSnap.forEach(doc => {
          const data = doc.data();
          if (data.location && data.location.country) {
            foundLocation = true;
          }
        });
        setHasLocationData(foundLocation);

        // Fetch Analytics Events
        const eventsQuery = query(
          collection(db, "projects", projectId, "analyticsEvents"),
          where("createdAt", ">=", sevenDaysAgo)
        );
        const eventsSnap = await getDocs(eventsQuery);
        console.log(`[DASHBOARD_METRICS] eventos carregados: ${eventsSnap.size}`);
        
        const uniqueEventsBySession = {
          cta_buy_click: new Set(),
          checkout_started: new Set(),
          customer_data_submitted: new Set(),
          checkout_shipping_filled: new Set(),
          payment_method_selected: new Set(),
          pix_generated: new Set()
        };

        eventsSnap.forEach(doc => {
          const data = doc.data();
          const evName = data.eventName;
          const identifier = data.sessionId || data.visitorId || doc.id;
          
          if (uniqueEventsBySession[evName as keyof typeof uniqueEventsBySession]) {
            uniqueEventsBySession[evName as keyof typeof uniqueEventsBySession].add(identifier);
          }
        });

        // Fetch Orders
        const ordersQuery = query(
          collection(db, "projects", projectId, "orders"),
          where("createdAt", ">=", sevenDaysAgo),
          orderBy("createdAt", "desc")
        );
        const ordersSnap = await getDocs(ordersQuery);
        console.log(`[DASHBOARD_METRICS] pedidos carregados: ${ordersSnap.size}`);
        
        const orders: Order[] = [];
        let totalRevenue = 0;
        let paidOrdersCount = 0;
        
        // Map to group revenue by day for chart
        const revenueByDay = new Map<string, number>();
        
        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
          const dateStr = d.toISOString().split('T')[0];
          revenueByDay.set(dateStr, 0);
        }

        ordersSnap.forEach(doc => {
          const data = doc.data() as Order;
          data.id = doc.id;
          orders.push(data);
          
          const isPaid = data.paymentStatus === 'paid' || data.paymentStatus === 'approved';
          
          if (isPaid) {
            totalRevenue += (Number(data.amount) || 0);
            paidOrdersCount++;
            
            if (data.createdAt && data.createdAt.toDate) {
              const dateStr = data.createdAt.toDate().toISOString().split('T')[0];
              if (revenueByDay.has(dateStr)) {
                revenueByDay.set(dateStr, revenueByDay.get(dateStr)! + (Number(data.amount) || 0));
              }
            }
          }
        });

        const totalOrders = orders.length;
        const conversionRate = sessionsCount > 0 ? ((totalOrders / sessionsCount) * 100).toFixed(1) : "0";
        
        // Prepare chart data
        const finalChartData = Array.from(revenueByDay.entries()).map(([dateStr, amount]) => {
          const d = new Date(dateStr + "T12:00:00Z"); // middle of day to avoid timezone shift
          return {
            name: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
            fullDate: d.toLocaleDateString('pt-BR'),
            faturamento: amount
          };
        });

        setRecentOrders(orders.slice(0, 5));
        setChartData(finalChartData);

        setStats({
          totalSessions: sessionsCount,
          totalOrders,
          totalRevenue,
          conversionRate: Number(conversionRate),
          funnel: {
            sessions: sessionsCount,
            buyClick: uniqueEventsBySession.cta_buy_click.size,
            checkoutStart: uniqueEventsBySession.checkout_started.size,
            dataSubmitted: uniqueEventsBySession.customer_data_submitted.size,
            shippingFilled: uniqueEventsBySession.checkout_shipping_filled.size,
            paymentSelected: uniqueEventsBySession.payment_method_selected.size,
            pixGenerated: uniqueEventsBySession.pix_generated.size,
            orderCreated: totalOrders,
            orderPaid: paidOrdersCount
          }
        });

        console.log(`[DASHBOARD_METRICS] faturamento calculado: ${totalRevenue}`);
        console.log("[DASHBOARD_METRICS] funil calculado", {
          sessions: sessionsCount,
          buyClick: uniqueEventsBySession.cta_buy_click.size,
          checkoutStart: uniqueEventsBySession.checkout_started.size,
          dataSubmitted: uniqueEventsBySession.customer_data_submitted.size,
          shippingFilled: uniqueEventsBySession.checkout_shipping_filled.size,
          paymentSelected: uniqueEventsBySession.payment_method_selected.size,
          pixGenerated: uniqueEventsBySession.pix_generated.size,
          orderCreated: totalOrders,
          orderPaid: paidOrdersCount
        });
        setLoading(false);
        
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [user, authLoading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
        <p className="text-slate-500 font-medium">Carregando métricas...</p>
      </div>
    );
  }

  const renderFunnelItem = (label: string, count: number, total: number, colorClass: string) => {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div className="mb-3 last:mb-0">
        <div className="flex justify-between text-[11px] font-bold mb-1 text-slate-700 dark:text-slate-300">
          <span>{label}</span>
          <span>{count} ({percentage}%)</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div className={`${colorClass} h-full`} style={{ width: `${percentage}%` }}></div>
        </div>
      </div>
    );
  };

  const getProductSummary = (order: Order) => {
    if (order.items && order.items.length > 0) {
      if (order.items.length === 1) return order.items[0].title;
      return `${order.items.length} itens comprados`;
    }
    if (order.productTitle && order.productTitle.toLowerCase().includes('combo')) {
      return 'Kit completo A Mulher';
    }
    return order.productTitle || (order.productSnapshot && order.productSnapshot.title) || 'Produto';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Visão Geral</h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Acompanhe as métricas principais do projeto.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-sm">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Últimos 7 dias</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400"><Users className="w-4 h-4" /></div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sessões</p>
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{stats.totalSessions}</h3>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400"><TrendingUp className="w-4 h-4" /></div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Conversão de Pedidos</p>
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{stats.conversionRate}%</h3>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400"><ShoppingCart className="w-4 h-4" /></div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pedidos</p>
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{stats.totalOrders}</h3>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br  pointer-events-none" />
          <div className="flex items-center gap-3 mb-2 relative">
            <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400"><DollarSign className="w-4 h-4" /></div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Faturamento Pago</p>
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight relative">{formatCurrency(stats.totalRevenue)}</h3>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
        
        {/* Gráfico */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="md:col-span-8 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight">Performance Semanal — Faturamento Pago</h4>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `R$ ${val}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                  formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                />
                <Area type="monotone" dataKey="faturamento" stroke="#e11d48" strokeWidth={3} fillOpacity={1} fill="url(#colorFaturamento)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Funil */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="md:col-span-4 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col"
        >
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-4">Funil de Vendas</h4>
          
          <div className="space-y-1 flex-1">
            {renderFunnelItem("Sessões", stats.funnel.sessions, stats.funnel.sessions, "bg-rose-200")}
            <div className="pl-2 border-l-2 border-slate-100 dark:border-slate-800">
              {renderFunnelItem("Clique em comprar", stats.funnel.buyClick, stats.funnel.sessions, "bg-rose-300")}
            </div>
            <div className="pl-4 border-l-2 border-slate-100 dark:border-slate-800">
              {renderFunnelItem("Checkout iniciado", stats.funnel.checkoutStart, stats.funnel.sessions, "bg-rose-700")}
            </div>
            <div className="pl-6 border-l-2 border-slate-100 dark:border-slate-800">
              {renderFunnelItem("Dados preenchidos", stats.funnel.dataSubmitted, stats.funnel.sessions, "bg-rose-500")}
            </div>
            <div className="pl-6 border-l-2 border-slate-100 dark:border-slate-800">
              {renderFunnelItem("Frete preenchido", stats.funnel.shippingFilled, stats.funnel.sessions, "bg-rose-600")}
            </div>
            <div className="pl-6 border-l-2 border-slate-100 dark:border-slate-800">
              {renderFunnelItem("Pagamento selecionado", stats.funnel.paymentSelected, stats.funnel.sessions, "bg-rose-700")}
            </div>
            <div className="pl-8 border-l-2 border-slate-100 dark:border-slate-800">
              {renderFunnelItem("Pedido criado", stats.funnel.orderCreated, stats.funnel.sessions, "bg-rose-800")}
            </div>
            <div className="pl-10 border-l-2 border-slate-100 dark:border-slate-800">
              {renderFunnelItem("Venda paga", stats.funnel.orderPaid, stats.funnel.sessions, "bg-rose-900")}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Localização & Pedidos */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
        
        {/* Localização */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="md:col-span-4 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col"
        >
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-4">Localização (Aproximada)</h4>
          
          {!hasLocationData ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Dados de localização ainda não disponíveis. Ative o tracking enriquecido para visualizar cidades e estados.</p>
            </div>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Em breve: Top cidades e estados com base nas sessões recentes.</p>
            </div>
          )}
        </motion.div>

        {/* Últimos Pedidos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="md:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col"
        >
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight">Últimos Pedidos</h4>
            <Link to="/orders" className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase hover:underline bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-lg">Ver Todos</Link>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/20">
                  <th className="px-6 py-3 whitespace-nowrap">Pedido</th>
                  <th className="px-6 py-3">Cliente</th>
                  <th className="px-6 py-3">Produto(s)</th>
                  <th className="px-6 py-3 whitespace-nowrap">Status</th>
                  <th className="px-6 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Ainda não há pedidos neste período.</td>
                  </tr>
                ) : (
                  recentOrders.map((order) => {
                    const isPaid = order.paymentStatus === 'paid' || order.paymentStatus === 'approved';
                    const isPending = order.paymentStatus === 'pending';
                    
                    return (
                      <tr key={order.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold">
                          <Link to={`/orders/${order.id}`} className="hover:text-rose-600 transition-colors">
                            {order.orderCode || order.id.substring(0,8)}
                          </Link>
                          <div className="text-[9px] text-slate-400 font-sans font-normal mt-1">
                            {order.createdAt && order.createdAt.toDate ? order.createdAt.toDate().toLocaleDateString('pt-BR') : ''}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">{order.customerName || 'Sem nome'}</p>
                          <p className="text-[10px] text-slate-500 line-clamp-1">{order.customerEmail || ''}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                            {getProductSummary(order)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full font-bold text-[9px] uppercase tracking-wider whitespace-nowrap ${
                            isPaid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            isPending ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {isPaid ? 'Pago' : isPending ? 'Pendente' : order.paymentStatus || 'Pendente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(order.amount || 0)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
