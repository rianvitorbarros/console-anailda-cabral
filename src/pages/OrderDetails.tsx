import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { motion } from "motion/react";
import { formatCurrency, formatDate } from "../lib/utils";
import {
  ArrowLeft,
  User,
  MapPin,
  CreditCard,
  Package,
  Truck,
  Save,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check
} from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import {
  subscribeToOrder,
  syncMercadoPagoOrders,
  Order,
  SyncOrderResultItem,
  CallableSyncError,
  DEPLOY_MP_FUNCTIONS_CMD
} from "../services/ordersService";
import { usePermissions } from "../hooks/usePermissions";
import { OperationFeedbackDialog, OperationState } from "../components/OperationFeedbackDialog";

export function OrderDetails() {
  const { id } = useParams();
  const permissions = usePermissions();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // Shipping form state
  const [shippingStatus, setShippingStatus] = useState<string>("unshipped");
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [carrier, setCarrier] = useState("");
  const [savingShipping, setSavingShipping] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackState, setFeedbackState] = useState<OperationState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Individual Mercado Pago verification state
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [checkResult, setCheckResult] = useState<SyncOrderResultItem | null>(null);
  const [checkError, setCheckError] = useState<{ message: string; needsDeploy: boolean } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const canSyncPayment = permissions.isAdmin || permissions.isPublisher;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToOrder("anailda-book", id, (data) => {
      setOrder(data);
      if (data?.shipping) {
        setShippingStatus(data.shipping.status || "unshipped");
        setTrackingCode(data.shipping.trackingCode || "");
        setTrackingUrl(data.shipping.trackingUrl || "");
        setCarrier(data.shipping.carrier || "");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const handleCheckPayment = async () => {
    if (!id || checkingPayment) return;
    setCheckingPayment(true);
    setCheckError(null);
    setCheckResult(null);

    try {
      const summary = await syncMercadoPagoOrders(id);
      const item = summary.results[0] || null;
      if (item?.error) {
        setCheckError({ message: item.error, needsDeploy: false });
      } else {
        setCheckResult(item);
      }
    } catch (err: any) {
      if (err instanceof CallableSyncError) {
        setCheckError({ message: err.message, needsDeploy: err.needsDeploy });
      } else {
        setCheckError({
          message: err?.message || "Erro ao consultar pagamento no Mercado Pago.",
          needsDeploy: false
        });
      }
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleCopyDeployCmd = () => {
    navigator.clipboard.writeText(DEPLOY_MP_FUNCTIONS_CMD);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  const handleSaveShipping = async () => {
    if (!order || !id) return;
    setErrorMsg("");
    setSavingShipping(true);
    setFeedbackState("loading");
    setFeedbackOpen(true);

    try {
      const minDelay = new Promise((resolve) => setTimeout(resolve, 1200));
      const updateOrderShipping = httpsCallable(functions, "updateOrderShipping");
      const req = updateOrderShipping({
        orderId: id,
        shippingData: {
          status: shippingStatus as any,
          trackingCode,
          trackingUrl,
          carrier
        }
      });

      await Promise.all([req, minDelay]);
      setFeedbackState("success");
      setTimeout(() => setFeedbackOpen(false), 1500);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Erro ao salvar. Verifique se você tem permissão.");
      setFeedbackState("error");
    } finally {
      setSavingShipping(false);
    }
  };

  const getFeedbackConfig = () => {
    switch (shippingStatus) {
      case "preparing":
        return {
          loadingTitle: "Iniciando separação",
          loadingDescription: "Registrando o início da separação do pedido.",
          loadingDetail: "Sincronizando status...",
          successTitle: "Separação iniciada",
          successDescription: "O pedido foi movido para a fila de separação.",
          successDetail: "As alterações foram aplicadas ao pedido."
        };
      case "shipped":
        return {
          loadingTitle: "Marcando como enviado",
          loadingDescription: "Salvando rastreio e status de envio.",
          loadingDetail: "Sincronizando rastreamento...",
          successTitle: "Pedido enviado",
          successDescription: "As informações de envio foram salvas.",
          successDetail: "Rastreamento atualizado com sucesso."
        };
      case "out_for_delivery":
        return {
          loadingTitle: "Atualizando entrega",
          loadingDescription: "Registrando que o pedido saiu para entrega.",
          loadingDetail: "Notificando acompanhamento...",
          successTitle: "Saiu para entrega",
          successDescription: "O pedido foi atualizado com sucesso.",
          successDetail: "As alterações foram aplicadas ao pedido."
        };
      case "delivered":
        return {
          loadingTitle: "Finalizando entrega",
          loadingDescription: "Registrando a conclusão da entrega.",
          loadingDetail: "Baixando pedido no sistema...",
          successTitle: "Pedido entregue",
          successDescription: "A entrega foi marcada como concluída.",
          successDetail: "As alterações foram aplicadas ao pedido."
        };
      case "issue":
        return {
          loadingTitle: "Registrando problema",
          loadingDescription: "Salvando os detalhes do problema no envio.",
          loadingDetail: "Sincronizando status...",
          successTitle: "Problema registrado",
          successDescription: "O histórico foi atualizado com o problema.",
          successDetail: "As alterações foram aplicadas ao pedido."
        };
      default:
        return {
          loadingTitle: "Atualizando envio",
          loadingDescription: "Salvando as informações de logística do pedido.",
          loadingDetail: "Sincronizando status e histórico...",
          successTitle: "Envio atualizado",
          successDescription: "As informações de logística foram salvas com sucesso.",
          successDetail: "As alterações foram aplicadas ao pedido."
        };
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Carregando detalhes do pedido...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Pedido não encontrado</h2>
        <Link to="/orders" className="text-rose-600 hover:underline">
          Voltar para pedidos
        </Link>
      </div>
    );
  }

  const formatOrderDate = (date: any) => {
    if (!date) return "N/A";
    if (typeof date.toDate === "function") {
      return formatDate(date.toDate().toISOString());
    }
    return formatDate(date);
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

  const normalizedPayStatus = String(order.paymentStatus || order.status || "pending").toLowerCase();
  const isPaid = normalizedPayStatus === "paid" || normalizedPayStatus === "approved";
  const gatewayStatusDisplay =
    order.mercadoPagoStatus || order.mercadoPagoPaymentStatus || order.mercadoPagoOrderStatus || "N/A";

  const renderCheckFeedback = () => {
    if (checkError) {
      return (
        <div className="mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">{checkError.message}</p>
          </div>
          {checkError.needsDeploy && (
            <div className="bg-white dark:bg-slate-950 border border-amber-200 dark:border-amber-900/40 rounded-lg p-2.5 flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto">
                {DEPLOY_MP_FUNCTIONS_CMD}
              </code>
              <button
                type="button"
                onClick={handleCopyDeployCmd}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
              >
                {copiedCmd ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedCmd ? "Copiado" : "Copiar"}
              </button>
            </div>
          )}
        </div>
      );
    }

    if (checkResult) {
      const confirmed = checkResult.becamePaid || checkResult.newPaymentStatus === "paid";
      return (
        <div
          className={`mt-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            confirmed
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200"
              : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
          }`}
        >
          <CheckCircle2
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              confirmed ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
            }`}
          />
          <div className="space-y-0.5">
            <p className="font-semibold">
              {checkResult.becamePaid
                ? "Pagamento confirmado no Mercado Pago e atualizado para Pago."
                : checkResult.newPaymentStatus === "paid"
                  ? "Pagamento já consta como confirmado no Mercado Pago."
                  : checkResult.mpStatus === "not_found"
                    ? "Nenhuma transação encontrada no Mercado Pago para este pedido."
                    : `Status atual no Mercado Pago: ${checkResult.mpStatus || "pendente"}${
                        checkResult.mpStatusDetail ? ` (${checkResult.mpStatusDetail})` : ""
                      }.`}
            </p>
            {checkResult.sourceMethod !== "not_found" && checkResult.sourceMethod !== "none" && (
              <p className="opacity-75">
                Origem da consulta:{" "}
                {checkResult.sourceMethod === "orders_api"
                  ? "Orders API"
                  : checkResult.sourceMethod === "payments_api"
                    ? "Payments API"
                    : "Busca por referência externa"}
              </p>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  if (permissions.isPublisher) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/shipping" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Detalhes de Envio</h1>
              <p className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Pedido {order.orderCode || order.id?.substring(0, 8)}
              </p>
            </div>
          </div>
          {canSyncPayment && !isPaid && (
            <button
              type="button"
              onClick={handleCheckPayment}
              disabled={checkingPayment}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingPayment ? "animate-spin" : ""}`} />
              {checkingPayment ? "Verificando..." : "Verificar no Mercado Pago"}
            </button>
          )}
        </div>

        {renderCheckFeedback()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-slate-400" />
                Resumo do Pedido
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-500 text-xs mb-1">Cliente</p>
                  <p className="font-medium">{(order.customerName || order.customer?.name) || "Não informado"}</p>
                  <p className="text-slate-500">{(order.customerEmail || order.customer?.email) || "Não informado"}</p>
                  <p className="text-slate-500">{(order.customerPhone || order.customer?.phone) || "Não informado"}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="font-semibold text-slate-500 text-xs mb-1">Pagamento</p>
                  {isPaid ? (
                    <p className="font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                      Pago em {formatOrderDate(order.paidAt || order.approvedAt || order.createdAt)}
                    </p>
                  ) : (
                    <p className="font-medium text-amber-600 dark:text-amber-400">
                      {getStatusLabel(order.paymentStatus || order.status)}
                    </p>
                  )}
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="font-semibold text-slate-500 text-xs mb-1">Produto</p>
                  <p className="font-medium">{order.productTitle || "Livro Padrão"} (Qtd: 1)</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-slate-400" />
                Endereço de Entrega
              </h3>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {order.shippingAddress || (order.customer as any)?.address ? (
                  <>
                    <p>
                      {order.shippingAddress?.street || (order.customer as any)?.address?.street},{" "}
                      {order.shippingAddress?.number || (order.customer as any)?.address?.number}
                    </p>
                    {(order.shippingAddress?.complement || (order.customer as any)?.address?.complement) && (
                      <p>{order.shippingAddress?.complement || (order.customer as any)?.address?.complement}</p>
                    )}
                    <p>{order.shippingAddress?.district || (order.customer as any)?.address?.neighborhood}</p>
                    <p>
                      {order.shippingAddress?.city || (order.customer as any)?.address?.city} -{" "}
                      {order.shippingAddress?.state || (order.customer as any)?.address?.state}
                    </p>
                    <p className="mt-2 font-medium tabular-nums">
                      CEP: {order.shippingAddress?.zipCode || (order.customer as any)?.address?.zipCode}
                    </p>
                  </>
                ) : (
                  <p>Endereço não informado.</p>
                )}
              </div>
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-rose-500" />
                Logística
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Status de Envio</label>
                  <select
                    value={shippingStatus}
                    onChange={(e) => setShippingStatus(e.target.value)}
                    disabled={!isPaid}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-rose-500 outline-none font-medium text-slate-900 dark:text-white disabled:opacity-60"
                  >
                    <option value="not_started">Aguardando envio</option>
                    <option value="preparing">Em separação</option>
                    <option value="shipped">Enviado</option>
                    <option value="out_for_delivery">Saiu para entrega</option>
                    <option value="delivered">Entregue</option>
                    <option value="returned">Devolvido</option>
                    <option value="issue">Problema</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Transportadora</label>
                    <select
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      disabled={!isPaid}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-60"
                    >
                      <option value="">Selecione...</option>
                      <option value="Correios">Correios</option>
                      <option value="Transportadora">Transportadora</option>
                      <option value="Retirada/Entrega manual">Retirada/Entrega manual</option>
                      <option value="Outra">Outra</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Código de Rastreio</label>
                    <input
                      type="text"
                      value={trackingCode}
                      onChange={(e) => setTrackingCode(e.target.value)}
                      disabled={!isPaid}
                      placeholder="Ex: AA123456789BR"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono focus:ring-2 focus:ring-rose-500 outline-none uppercase disabled:opacity-60"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Link de Rastreio</label>
                  <input
                    type="url"
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    disabled={!isPaid}
                    placeholder="https://..."
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-rose-500 outline-none text-blue-600 dark:text-blue-400 disabled:opacity-60"
                  />
                </div>
                {!isPaid && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    A logística será liberada assim que o pagamento for confirmado no Mercado Pago.
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSaveShipping}
                  disabled={savingShipping || !isPaid}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold px-4 py-3 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                >
                  <Save className="w-4 h-4" />
                  {savingShipping ? "Salvando..." : "Salvar Logística"}
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        <OperationFeedbackDialog
          open={feedbackOpen}
          state={feedbackState}
          errorDescription={errorMsg}
          onClose={() => setFeedbackOpen(false)}
          onRetry={() => setFeedbackOpen(false)}
          {...getFeedbackConfig()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/orders"
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight tabular-nums">
                Pedido {order.orderCode || order.id?.substring(0, 8)}
              </h1>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                  order.paymentStatus || order.status
                )}`}
              >
                {getStatusLabel(order.paymentStatus || order.status)}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
              Realizado em {formatOrderDate(order.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-slate-400" />
              Detalhes do Produto
            </h3>
            {order.items && order.items.length > 0 ? (
              <div className="space-y-4 py-4 border-b border-slate-200 dark:border-slate-800">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{item.title || "Item"}</p>
                      <p className="text-sm text-slate-500 tabular-nums">
                        {item.type && (
                          <span className="uppercase text-[10px] font-semibold text-slate-500 dark:text-slate-400 mr-2">
                            {item.type} ·
                          </span>
                        )}
                        Qtd: {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                      {formatCurrency(item.totalPrice || item.unitPrice * item.quantity || 0)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between py-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {order.productTitle || "Produto Padrão"}
                  </p>
                  <p className="text-sm text-slate-500">Qtd: 1</p>
                </div>
                <p className="font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatCurrency(order.amount || 0)}
                </p>
              </div>
            )}

            <div className="py-4 space-y-2 text-sm">
              <div className="flex justify-between font-bold text-base text-slate-900 dark:text-white pt-2 tabular-nums">
                <span>Total</span>
                <span>{formatCurrency(order.amount || 0)}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-slate-400" />
                Pagamento
              </h3>

              {canSyncPayment && (
                <button
                  type="button"
                  onClick={handleCheckPayment}
                  disabled={checkingPayment}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-60 active:scale-[0.98] ${
                    !isPaid
                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingPayment ? "animate-spin" : ""}`} />
                  <span>{checkingPayment ? "Consultando..." : "Verificar no Mercado Pago"}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs mb-1">Método</p>
                <p className="font-medium capitalize">
                  {order.paymentMethod === "credit_card" ? "Cartão de Crédito" : order.paymentMethod || "Não informado"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">
                  ID do Pagamento ({order.paymentProvider || "mercado_pago"})
                </p>
                <p className="font-medium font-mono text-xs break-all tabular-nums">
                  {order.mercadoPagoPaymentId || order.mercadoPagoTransactionId || "N/A"}
                </p>
              </div>
              {order.mercadoPagoOrderId && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">ID da Ordem Mercado Pago</p>
                  <p className="font-medium font-mono text-xs break-all tabular-nums">{order.mercadoPagoOrderId}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500 text-xs mb-1">Status na Integradora</p>
                <p className="font-medium">
                  {gatewayStatusDisplay}
                  {order.mercadoPagoStatusDetail ? ` (${order.mercadoPagoStatusDetail})` : ""}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Data de Aprovação</p>
                <p className="font-medium tabular-nums">{formatOrderDate(order.paidAt || order.approvedAt)}</p>
              </div>
              {order.lastPaymentSyncAt && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Última Verificação</p>
                  <p className="font-medium tabular-nums">{formatOrderDate(order.lastPaymentSyncAt)}</p>
                </div>
              )}
            </div>

            {renderCheckFeedback()}
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-slate-400" />
              Cliente
            </h3>
            <div className="space-y-2 text-sm">
              <p className="font-medium">{(order.customerName || order.customer?.name) || "Não informado"}</p>
              <p className="text-slate-500 break-all">
                {(order.customerEmail || order.customer?.email) || "Não informado"}
              </p>
              <p className="text-slate-500 tabular-nums">
                {(order.customerPhone || order.customer?.phone) || "Não informado"}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-slate-400" />
              Endereço
            </h3>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {order.shippingAddress ? (
                <>
                  <p>
                    {order.shippingAddress.street}, {order.shippingAddress.number}
                  </p>
                  {order.shippingAddress.complement && <p>{order.shippingAddress.complement}</p>}
                  <p>{order.shippingAddress.district}</p>
                  <p>
                    {order.shippingAddress.city} - {order.shippingAddress.state}
                  </p>
                  <p className="mt-2 font-medium tabular-nums">CEP: {order.shippingAddress.zipCode}</p>
                </>
              ) : (
                <p>Nenhum endereço informado (Produto Digital)</p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-slate-400" />
              Logística e Envio
            </h3>

            {!isPaid && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
                A atualização de logística é liberada automaticamente após a confirmação do pagamento no Mercado Pago.
              </div>
            )}

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Status de Envio</label>
                <select
                  value={shippingStatus}
                  onChange={(e) => setShippingStatus(e.target.value)}
                  disabled={!permissions.canUpdateShipping || !isPaid}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-60"
                >
                  <option value="unshipped">Não Enviado</option>
                  <option value="preparing">Em Separação</option>
                  <option value="shipped">Enviado</option>
                  <option value="out_for_delivery">Saiu para entrega</option>
                  <option value="delivered">Entregue</option>
                  <option value="returned">Devolvido</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Transportadora</label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  disabled={!permissions.canUpdateShipping || !isPaid}
                  placeholder="Ex: Correios"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Código de Rastreio</label>
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  disabled={!permissions.canUpdateShipping || !isPaid}
                  placeholder="Ex: AA123456789BR"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Link de Rastreio</label>
                <input
                  type="url"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  disabled={!permissions.canUpdateShipping || !isPaid}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-60"
                />
              </div>

              {permissions.canUpdateShipping && (
                <button
                  type="button"
                  onClick={handleSaveShipping}
                  disabled={savingShipping || !isPaid}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-semibold transition-all hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-60"
                >
                  {savingShipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingShipping ? "Salvando..." : "Salvar Logística"}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <OperationFeedbackDialog
        open={feedbackOpen}
        state={feedbackState}
        errorDescription={errorMsg}
        onClose={() => setFeedbackOpen(false)}
        onRetry={() => setFeedbackOpen(false)}
        {...getFeedbackConfig()}
      />
    </div>
  );
}
