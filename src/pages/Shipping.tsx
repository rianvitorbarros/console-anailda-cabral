import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency, formatDate } from "../lib/utils";
import { Eye, Search, Truck, Filter, MapPin, Package, AlertTriangle, CheckCircle, X } from "lucide-react";
import { subscribeToOrders, Order } from "../services/ordersService";
import { useNotifications } from "../context/NotificationsContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase";
import { OperationFeedbackDialog, OperationState } from "../components/OperationFeedbackDialog";

export function Shipping() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const { clearUnread } = useNotifications();
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    clearUnread();
    const unsubscribe = subscribeToOrders('anailda-book', (newOrders) => {
      // Only show paid/approved orders for logistics
      const paidOrders = newOrders.filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'approved' || o.status === 'paid' || o.status === 'approved');
      setOrders(paidOrders);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [clearUnread]);

  const getShippingStatusColor = (status?: string) => {
    switch (status) {
      case 'delivered': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
      case 'out_for_delivery': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border border-teal-200 dark:border-teal-800';
      case 'shipped': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
      case 'preparing': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
      case 'returned': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800';
      case 'issue': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800';
      case 'not_started': 
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700';
    }
  };

  const getShippingStatusLabel = (status?: string) => {
    switch (status) {
      case 'delivered': return 'Entregue';
      case 'out_for_delivery': return 'Saiu para entrega';
      case 'shipped': return 'Enviado';
      case 'preparing': return 'Em Separação';
      case 'returned': return 'Devolvido';
      case 'issue': return 'Problema';
      case 'not_started': 
      default: return 'Aguardando envio';
    }
  };

  const formatOrderDate = (date: any) => {
    if (!date) return 'N/A';
    if (typeof date.toDate === 'function') {
      return formatDate(date.toDate().toISOString());
    }
    return formatDate(date);
  };

  const filteredOrders = orders.filter(order => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = order.orderCode?.toLowerCase().includes(q) ||
        order.customerName?.toLowerCase().includes(q) ||
        order.customerEmail?.toLowerCase().includes(q) ||
        order.shipping?.trackingCode?.toLowerCase().includes(q);
      if (!match) return false;
    }

    const st = order.shipping?.status || 'not_started';
    switch (filter) {
      case 'aguardando': return st === 'not_started';
      case 'separacao': return st === 'preparing';
      case 'enviados': return st === 'shipped' || st === 'out_for_delivery';
      case 'entregues': return st === 'delivered';
      case 'problemas': return st === 'issue' || st === 'returned';
      default: return true;
    }
  });

  const getActionButton = (order: Order) => {
    const st = order.shipping?.status || 'not_started';
    
    let label = "";
    let color = "";
    
    switch (st) {
      case 'not_started': 
        label = "Iniciar separação";
        color = "bg-rose-600 hover:bg-rose-700 text-white";
        break;
      case 'preparing':
        label = "Adicionar rastreio";
        color = "bg-amber-500 hover:bg-amber-600 text-white";
        break;
      case 'shipped':
      case 'out_for_delivery':
        label = "Ver rastreio";
        color = "bg-blue-500 hover:bg-blue-600 text-white";
        break;
      case 'delivered':
        label = "Ver detalhes";
        color = "bg-emerald-500 hover:bg-emerald-600 text-white";
        break;
      case 'issue':
      case 'returned':
        label = "Resolver problema";
        color = "bg-red-500 hover:bg-red-600 text-white";
        break;
      default:
        label = "Detalhes";
        color = "bg-slate-200 text-slate-800";
    }

    return (
      <button 
        onClick={() => setSelectedOrder(order)}
        className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-sm ${color}`}
      >
        {label}
      </button>
    );
  };

  const getOrderAddress = (order: Order) => {
    const address = order.shipping?.address || (order.customer as any)?.address;
    if (!address) return "Endereço não informado";
    const cityState = [address.city, address.state].filter(Boolean).join(" - ");
    const zip = address.zipCode || "";
    return `${cityState} ${zip ? `(${zip})` : ''}`.trim();
  };

  const filterTabs = [
    { id: 'all', label: 'Todos' },
    { id: 'aguardando', label: 'Aguardando envio' },
    { id: 'separacao', label: 'Em separação' },
    { id: 'enviados', label: 'Enviados' },
    { id: 'entregues', label: 'Entregues' },
    { id: 'problemas', label: 'Problemas' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
      
      {/* Mobile Header */}
      <div className="md:hidden">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Truck className="w-5 h-5 text-rose-500" />
          Envios
        </h1>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Truck className="w-6 h-6 text-rose-500" />
            Envios e Logística
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Gerencie a separação, envio e rastreamento dos pedidos.</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código, cliente ou rastreio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-rose-500 transition-colors shadow-sm text-sm"
          />
        </div>
        
        <div className="overflow-x-auto pb-2 custom-scrollbar">
          <div className="flex items-center gap-2 w-max">
            {filterTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                  filter === tab.id 
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800 border' 
                    : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {loading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full p-8 text-center text-slate-500">
              Carregando envios...
            </motion.div>
          ) : filteredOrders.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full p-12 text-center text-slate-500 flex flex-col items-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <Truck className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
              <p>Nenhum pedido encontrado nesta categoria.</p>
            </motion.div>
          ) : (
            filteredOrders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{order.customerName || 'Cliente'}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{order.orderCode || order.id.substring(0,8)}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getShippingStatusColor(order.shipping?.status)}`}>
                    {getShippingStatusLabel(order.shipping?.status)}
                  </span>
                </div>

                <div className="space-y-2 mb-6 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>Pago em {formatOrderDate(order.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Package className="w-4 h-4 text-slate-400" />
                    <span>{order.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 1} livro(s)</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <span className="leading-tight">{getOrderAddress(order)}</span>
                  </div>
                  {order.shipping?.trackingCode && (
                    <div className="flex items-center gap-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 p-2 rounded-lg mt-2 text-slate-700 dark:text-slate-300">
                      <Truck className="w-4 h-4" />
                      {order.shipping.carrier ? `${order.shipping.carrier}: ` : ''}{order.shipping.trackingCode}
                    </div>
                  )}
                </div>

                <div className="mt-auto">
                  {getActionButton(order)}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {selectedOrder && (
        <ShippingModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
          onSuccess={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}

function ShippingModal({ order, onClose, onSuccess }: { order: Order, onClose: () => void, onSuccess: () => void }) {
  const functions = getFunctions(app);
  
  const [status, setStatus] = useState(order.shipping?.status || 'not_started');
  const [carrier, setCarrier] = useState(order.shipping?.carrier || '');
  const [method, setMethod] = useState(order.shipping?.method || '');
  const [trackingCode, setTrackingCode] = useState(order.shipping?.trackingCode || '');
  const [trackingUrl, setTrackingUrl] = useState(order.shipping?.trackingUrl || '');
  const [notes, setNotes] = useState(order.shipping?.notes || '');
  
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackState, setFeedbackState] = useState<OperationState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Auto generate correios link
  useEffect(() => {
    if (carrier === 'Correios' && trackingCode && !trackingUrl) {
      setTrackingUrl(`https://rastreamento.correios.com.br/app/index.php`);
    }
  }, [carrier, trackingCode, trackingUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (status === 'shipped' && (carrier === 'Correios' || carrier === 'Transportadora') && !trackingCode) {
      setFeedbackState("error");
      setErrorMsg("Você ainda não informou o código de rastreio.");
      setFeedbackOpen(true);
      return;
    }

    setFeedbackState("loading");
    setFeedbackOpen(true);

    try {
      // Create minimum 2s delay for visual feedback
      const minDelay = new Promise(resolve => setTimeout(resolve, 2000));
      
      const updateOrderShipping = httpsCallable(functions, 'updateOrderShipping');
      const req = updateOrderShipping({
        orderId: order.id,
        shippingData: {
          status,
          carrier,
          method,
          trackingCode,
          trackingUrl,
          notes
        }
      });
      
      await Promise.all([req, minDelay]);

      setFeedbackState("success");
      
      setTimeout(() => {
         setFeedbackOpen(false);
         onSuccess();
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erro ao atualizar logística");
      setFeedbackState("error");
    }
  };

  const getAddressText = () => {
    const a = order.shipping?.address || (order.customer as any)?.address;
    if (!a) return "Não informado";
    return `${a.street || ''}, ${a.number || ''} ${a.complement ? `(${a.complement})` : ''} - ${a.neighborhood || ''}, ${a.city || ''}/${a.state || ''} - CEP: ${a.zipCode || ''}`;
  };

  const getFeedbackConfig = () => {
     switch (status) {
        case 'preparing':
           return {
              loadingTitle: "Iniciando separação",
              loadingDescription: "Registrando o início da separação do pedido.",
              loadingDetail: "Sincronizando status...",
              successTitle: "Separação iniciada",
              successDescription: "O pedido foi movido para a fila de separação.",
              successDetail: "As alterações foram aplicadas ao pedido."
           };
        case 'shipped':
           return {
              loadingTitle: "Marcando como enviado",
              loadingDescription: "Salvando rastreio e status de envio.",
              loadingDetail: "Sincronizando rastreamento...",
              successTitle: "Pedido enviado",
              successDescription: "As informações de envio foram salvas.",
              successDetail: "Rastreamento atualizado com sucesso."
           };
        case 'out_for_delivery':
           return {
              loadingTitle: "Atualizando entrega",
              loadingDescription: "Registrando que o pedido saiu para entrega.",
              loadingDetail: "Notificando acompanhamento...",
              successTitle: "Saiu para entrega",
              successDescription: "O pedido foi atualizado com sucesso.",
              successDetail: "As alterações foram aplicadas ao pedido."
           };
        case 'delivered':
           return {
              loadingTitle: "Finalizando entrega",
              loadingDescription: "Registrando a conclusão da entrega.",
              loadingDetail: "Baixando pedido no sistema...",
              successTitle: "Pedido entregue",
              successDescription: "A entrega foi marcada como concluída.",
              successDetail: "As alterações foram aplicadas ao pedido."
           };
        case 'issue':
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

  const config = getFeedbackConfig();

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-xl flex flex-col h-[85vh] sm:h-auto sm:max-h-[85vh]"
        >
          <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-rose-500" />
              Atualizar Envios
            </h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
            {/* Resumo */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-6 text-sm">
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Cliente</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{order.customerName}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Pedido</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{order.orderCode || order.id.substring(0,8)}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Endereço de Entrega</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{getAddressText()}</span>
                </div>
              </div>
            </div>

            <form id="shipping-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Status de envio
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all outline-none text-sm font-medium"
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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Transportadora
                  </label>
                  <select
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all outline-none text-sm"
                  >
                    <option value="">Selecione...</option>
                    <option value="Correios">Correios</option>
                    <option value="Transportadora">Transportadora</option>
                    <option value="Retirada/Entrega manual">Retirada/Entrega manual</option>
                    <option value="Outra">Outra</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Modalidade (Opcional)
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all outline-none text-sm"
                  >
                    <option value="">Selecione...</option>
                    <option value="SEDEX">SEDEX</option>
                    <option value="PAC">PAC</option>
                    <option value="Transportadora">Transportadora</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Código de Rastreio
                </label>
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="Ex: QA123456789BR"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all outline-none text-sm font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Link de Rastreio
                </label>
                <input
                  type="text"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all outline-none text-sm text-blue-600 dark:text-blue-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Observação interna
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Deixado na portaria..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all outline-none text-sm min-h-[80px]"
                />
              </div>
            </form>
          </div>

          <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900/50 shrink-0 pb-[calc(20px+env(safe-area-inset-bottom))]">
            <button 
              onClick={onClose}
              type="button"
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              form="shipping-form"
              className="px-6 py-2.5 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors flex items-center gap-2"
            >
              Salvar logística
            </button>
          </div>
        </motion.div>
      </div>
      
      <OperationFeedbackDialog 
         open={feedbackOpen}
         state={feedbackState}
         errorDescription={errorMsg}
         onClose={() => setFeedbackOpen(false)}
         onRetry={() => {
            setFeedbackOpen(false);
            if(feedbackState === "error" && errorMsg !== "Você ainda não informou o código de rastreio.") {
               // Try again automatically or just let user click save again
            }
         }}
         {...config}
      />
    </>
  );
}
