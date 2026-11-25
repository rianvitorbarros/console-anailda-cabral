import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency, formatDate } from "../lib/utils";
import {
  Eye,
  Search,
  Filter,
  X,
  ShoppingBag,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  subscribeToOrders,
  syncMercadoPagoOrders,
  Order,
  SyncMercadoPagoSummary,
  CallableSyncError,
  DEPLOY_MP_FUNCTIONS_CMD
} from "../services/ordersService";
import { useNotifications } from "../context/NotificationsContext";
import { usePermissions } from "../hooks/usePermissions";

type StatusFilter = "all" | "pending" | "paid" | "cancelled";

function normalizePaymentBucket(order: Order): "paid" | "pending" | "cancelled" {
  const st = String(order.paymentStatus || order.status || "pending").toLowerCase();
  if (st === "paid" || st === "approved") return "paid";
  if (st === "cancelled" || st === "canceled" || st === "rejected" || st === "failed" || st === "refunded") {
    return "cancelled";
  }
  return "pending";
}

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { clearUnread } = useNotifications();
  const permissions = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [unauthorizedMessage, setUnauthorizedMessage] = useState(false);

  // Batch Mercado Pago sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<SyncMercadoPagoSummary | null>(null);
  const [syncError, setSyncError] = useState<{ message: string; needsDeploy: boolean } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const canSyncPayments = permissions.isAdmin || permissions.isPublisher;

  useEffect(() => {
    if (location.state?.unauthorized) {
      setUnauthorizedMessage(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    clearUnread();
    const unsubscribe = subscribeToOrders("anailda-book", (newOrders) => {
      setOrders(newOrders);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clearUnread]);

  const counts = useMemo(() => {
    let pending = 0;
    let paid = 0;
    let cancelled = 0;
    for (const o of orders) {
      const b = normalizePaymentBucket(o);
      if (b === "paid") paid++;
      else if (b === "cancelled") cancelled++;
      else pending++;
    }
    return { all: orders.length, pending, paid, cancelled };
  }, [orders]);

  const handleBatchSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    setSyncSummary(null);

    try {
      const summary = await syncMercadoPagoOrders();
      setSyncSummary(summary);
    } catch (err: any) {
      if (err instanceof CallableSyncError) {
        setSyncError({ message: err.message, needsDeploy: err.needsDeploy });
      } else {
        setSyncError({
          message: err?.message || "Erro ao sincronizar pagamentos com o Mercado Pago.",
          needsDeploy: false
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyDeployCmd = () => {
    navigator.clipboard.writeText(DEPLOY_MP_FUNCTIONS_CMD);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  const getStatusColor = (status: string) => {
    const normalized = String(status || "pending").toLowerCase();
    switch (normalized) {
      case "paid":
      case "approved":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800";
      case "pending":
      case "in_process":
      case "created":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800";
      case "rejected":
      case "failed":
      case "cancelled":
      case "canceled":
      case "refunded":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
    }
  };

  const getStatusLabel = (status: string) => {
    const normalized = String(status || "pending").toLowerCase();
    switch (normalized) {
      case "paid":
      case "approved":
        return "Pago";
      case "pending":
      case "in_process":
      case "created":
        return "Pendente";
      case "rejected":
      case "failed":
        return "Recusado";
      case "cancelled":
      case "canceled":
        return "Cancelado";
      case "refunded":
        return "Estornado";
      default:
        return status || "Pendente";
    }
  };

  const formatOrderDate = (date: any) => {
    if (!date) return "N/A";
    if (typeof date.toDate === "function") {
      return formatDate(date.toDate().toISOString());
    }
    return formatDate(date);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== "all" && normalizePaymentBucket(order) !== statusFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        order.orderCode?.toLowerCase().includes(q) ||
        order.id?.toLowerCase().includes(q) ||
        (order.customerName || order.customer?.name)?.toLowerCase().includes(q) ||
        (order.customerEmail || order.customer?.email)?.toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, searchQuery]);

  const newlyPaidCodes = useMemo(() => {
    if (!syncSummary) return [];
    return syncSummary.results.filter((r) => r.becamePaid).map((r) => r.orderCode);
  }, [syncSummary]);

  const filterTabs: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: "all", label: "Todos", count: counts.all },
    { key: "pending", label: "Pendentes", count: counts.pending },
    { key: "paid", label: "Pagos", count: counts.paid },
    { key: "cancelled", label: "Cancelados", count: counts.cancelled }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
      {unauthorizedMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3 border border-red-100 dark:border-red-900/50"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Você não tem permissão para acessar esta área.</p>
            <p className="text-xs mt-1 opacity-80">
              Seu perfil não autoriza acesso à página solicitada. Você foi redirecionado para seus pedidos.
            </p>
          </div>
          <button onClick={() => setUnauthorizedMessage(false)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Pedidos</h1>
          <p className="hidden md:block text-sm text-slate-500 dark:text-slate-400">
            Acompanhe as vendas e sincronize pagamentos pendentes diretamente com o Mercado Pago.
          </p>
        </div>

        {canSyncPayments && (
          <button
            type="button"
            onClick={handleBatchSync}
            disabled={isSyncing || loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-60 active:scale-[0.98]"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>
              {isSyncing
                ? "Sincronizando..."
                : counts.pending > 0
                  ? `Sincronizar Pagamentos (${counts.pending})`
                  : "Sincronizar Pagamentos"}
            </span>
          </button>
        )}
      </div>

      {/* Sync Result Summary Banner */}
      <AnimatePresence>
        {syncSummary && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`rounded-2xl p-4 border flex items-start gap-3 ${
              syncSummary.updatedToPaid > 0
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200"
                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
            }`}
          >
            <CheckCircle2
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                syncSummary.updatedToPaid > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            />
            <div className="flex-1 min-w-0 space-y-1 text-sm">
              <p className="font-semibold">
                {syncSummary.checked === 0
                  ? "Nenhum pedido pendente para verificar."
                  : syncSummary.updatedToPaid > 0
                    ? `${syncSummary.updatedToPaid} pagamento(s) confirmado(s) e atualizado(s) para Pago.`
                    : `Verificação concluída: nenhum novo pagamento aprovado encontrado no Mercado Pago.`}
              </p>
              {syncSummary.checked > 0 && (
                <p className="text-xs opacity-80 tabular-nums">
                  Verificados: {syncSummary.checked} · Confirmados: {syncSummary.updatedToPaid} · Seguem pendentes:{" "}
                  {syncSummary.stillPending}
                  {syncSummary.notFound > 0 ? ` · Não localizados no MP: ${syncSummary.notFound}` : ""}
                  {syncSummary.errors > 0 ? ` · Erros: ${syncSummary.errors}` : ""}
                </p>
              )}
              {newlyPaidCodes.length > 0 && (
                <p className="text-xs font-mono pt-0.5">
                  Atualizados: {newlyPaidCodes.join(", ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSyncSummary(null)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
              aria-label="Fechar resumo da sincronização"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {syncError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl p-4 border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2 text-sm">
              <p className="font-semibold">{syncError.message}</p>
              {syncError.needsDeploy && (
                <div className="bg-white dark:bg-slate-950 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Para ativar também o webhook automático de novas compras, publique as Cloud Functions pelo Google Cloud Shell:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto py-1">
                      {DEPLOY_MP_FUNCTIONS_CMD}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyDeployCmd}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 transition-colors"
                    >
                      {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCmd ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
              aria-label="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + Segmented Status Filter */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 w-full">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 md:w-5 md:h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código, cliente ou e-mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-shadow text-slate-900 dark:text-slate-100"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="md:hidden flex items-center justify-center w-11 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0 relative"
            aria-label="Filtrar pedidos"
          >
            <Filter className="w-5 h-5" />
            {statusFilter !== "all" && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-600" />
            )}
          </button>
        </div>

        {/* Desktop Interactive Segmented Filter Tabs */}
        <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shrink-0">
          {filterTabs.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                  active
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Orders List */}
      <div className="md:hidden space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-4" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-2" />
              <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/4 mt-4" />
            </div>
          ))
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-100 dark:border-slate-800 flex flex-col items-center">
            <ShoppingBag className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">Nenhum pedido encontrado</p>
            <p className="text-xs text-slate-500">
              {statusFilter !== "all" || searchQuery
                ? "Tente alterar o filtro de status ou a busca."
                : "Quando os clientes comprarem, os pedidos aparecerão aqui."}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <Link to={`/orders/${order.id}`} key={order.id} className="block">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 active:scale-[0.99] transition-transform"
              >
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-[10px] shrink-0">
                      {(order.customerName || order.customer?.name)
                        ? (order.customerName || order.customer?.name).substring(0, 2).toUpperCase()
                        : "SN"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white leading-tight truncate">
                        {(order.customerName || order.customer?.name) || "Sem nome"}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {order.orderCode || order.id?.substring(0, 8)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {order.items && order.items.length > 0
                          ? order.items.length === 1
                            ? order.items[0].title
                            : `${order.items.length} itens`
                          : order.productTitle || "Produto"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider whitespace-nowrap shrink-0 ${getStatusColor(
                      order.paymentStatus || order.status
                    )}`}
                  >
                    {getStatusLabel(order.paymentStatus || order.status)}
                  </span>
                </div>

                <div className="flex justify-between items-end mt-2 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-500 tabular-nums">{formatOrderDate(order.createdAt)}</span>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      {order.paymentMethod === "credit_card" ? "Cartão" : order.paymentMethod || "Outro"}
                    </span>
                  </div>
                  <span className="font-bold text-base text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(order.amount || 0)}
                  </span>
                </div>
              </motion.div>
            </Link>
          ))
        )}
      </div>

      {/* Desktop Orders Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-3.5">Pedido</th>
                <th className="px-6 py-3.5">Cliente</th>
                <th className="px-6 py-3.5">Data</th>
                <th className="px-6 py-3.5 text-right">Total</th>
                <th className="px-6 py-3.5">Pagamento</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Carregando pedidos...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <p className="text-base font-medium mb-1">Nenhum pedido encontrado</p>
                    <p className="text-sm">
                      {statusFilter !== "all" || searchQuery
                        ? "Nenhum pedido corresponde aos filtros selecionados."
                        : "Quando os clientes finalizarem a compra no site, os pedidos aparecerão aqui."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {order.orderCode || order.id?.substring(0, 8)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {order.items && order.items.length > 0
                          ? order.items.length === 1
                            ? order.items[0].title
                            : `${order.items.length} itens`
                          : order.productTitle || "Produto"}
                      </p>
                    </td>
                    <td className="px-6 py-3.5">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {(order.customerName || order.customer?.name) || "Sem nome"}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {(order.customerEmail || order.customer?.email) || "Sem email"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 tabular-nums whitespace-nowrap">
                      {formatOrderDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(order.amount || 0)}
                    </td>
                    <td className="px-6 py-3.5 capitalize text-slate-500 whitespace-nowrap">
                      {order.paymentMethod === "credit_card" ? "Cartão" : order.paymentMethod || "-"}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${getStatusColor(
                          order.paymentStatus || order.status
                        )}`}
                      >
                        {getStatusLabel(order.paymentStatus || order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        to={`/orders/${order.id}`}
                        className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                        title="Ver detalhes do pedido"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Filter Bottom Sheet (Mobile) */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl md:hidden p-6 pb-safe"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Filtros</h3>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-2 block">Status do Pagamento</label>
                  <div className="grid grid-cols-2 gap-2">
                    {filterTabs.map((tab) => {
                      const active = statusFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setStatusFilter(tab.key)}
                          className={`py-2.5 px-4 rounded-xl text-sm font-semibold tabular-nums transition-colors ${
                            active
                              ? "border-2 border-rose-600 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                              : "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {tab.label} ({tab.count})
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="w-full py-3.5 bg-rose-600 text-white rounded-xl font-bold mt-4 active:scale-95 transition-transform"
                >
                  Aplicar Filtros
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
