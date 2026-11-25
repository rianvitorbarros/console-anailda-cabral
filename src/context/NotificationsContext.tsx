import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { subscribeToEvents, OrderEvent } from '../services/notificationsService';
import { getOrder, Order } from '../services/ordersService';
import { useAuth } from './AuthContext';
import { listenForegroundMessages } from '../services/pushNotifications';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  orderId?: string;
  read: boolean;
  createdAt: string;
  metadata?: any;
}

interface NotificationsContextType {
  unreadCount: number;
  clearUnread: () => void;
  activeToast: ToastData | null;
  dismissToast: () => void;
  notifications: NotificationItem[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

interface ToastData {
  id: string;
  title: string;
  description: string;
  orderCode?: string;
  amount?: number;
  amountStr?: string;
  customerName?: string;
  status?: string;
  orderId: string;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  
  const notifiedEventIds = useRef<Set<string>>(new Set());
  const soundEnabled = useRef(false);

  useEffect(() => {
    const savedCount = localStorage.getItem('eyecode:anailda-book:unreadNotificationsCount');
    if (savedCount) setUnreadCount(parseInt(savedCount, 10));

    try {
      const savedIds = localStorage.getItem('eyecode:anailda-book:notifiedEventIds');
      if (savedIds) notifiedEventIds.current = new Set(JSON.parse(savedIds));
      
      const savedNotifs = localStorage.getItem('eyecode:anailda-book:notificationsList');
      if (savedNotifs) {
        setNotifications(JSON.parse(savedNotifs));
      }
    } catch (e) {
      console.error(e);
    }

    const enableAudio = () => {
      soundEnabled.current = true;
      document.removeEventListener('click', enableAudio);
    };
    document.addEventListener('click', enableAudio);

    const playBeep = () => {
      if (!soundEnabled.current) return;
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
        }
      } catch (e) {
        console.error("Audio play failed", e);
      }
    };

    if (!user) return;

    const unsubscribe = subscribeToEvents('anailda-book', async (events, type, isInitial) => {
      if (type === 'added') {
        if (isInitial) {
           events.forEach(event => notifiedEventIds.current.add(event.id));
           localStorage.setItem('eyecode:anailda-book:notifiedEventIds', JSON.stringify(Array.from(notifiedEventIds.current).slice(-200)));
           return;
        }

        for (const event of events) {
          if (notifiedEventIds.current.has(event.id)) continue;
          notifiedEventIds.current.add(event.id);
          localStorage.setItem('eyecode:anailda-book:notifiedEventIds', JSON.stringify(Array.from(notifiedEventIds.current).slice(-200)));

          const eventTime = event.createdAt?.toDate?.()?.getTime?.() || Date.now();
          const lastSeenOrdersAt = parseInt(localStorage.getItem('eyecode:anailda-book:lastSeenOrdersAt') || '0', 10);
          
          if (eventTime <= lastSeenOrdersAt) continue;

          let order: Order | null = null;
          if (event.orderId) {
            try { order = await getOrder('anailda-book', event.orderId); } 
            catch (e) { console.error("Error fetching order", e); }
          }

          let toast: ToastData | null = null;
          let notifItem: NotificationItem | null = null;

          if (event.eventName === 'order_created') {
             playBeep();
             const amountStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order?.amount || 0);
             const title = `🛒 Novo pedido — ${amountStr}`;
             toast = { id: event.id, title, description: order?.productTitle || "Produto", orderCode: order?.orderCode || order?.id?.substring(0,8), amountStr, amount: order?.amount, customerName: order?.customerName || "Cliente", status: "Aguardando pagamento", orderId: event.orderId! };
             notifItem = { id: event.id, type: 'order_created', title, message: `Pedido ${toast.orderCode} criado e aguardando pagamento.`, orderId: event.orderId, read: false, createdAt: new Date(eventTime).toISOString() };
          } else if (event.eventName === 'payment_approved') {
             playBeep();
             const amountStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order?.amount || 0);
             const isCombo = order?.productSnapshot?.productType === 'combo' || order?.productId === 'combo-a-mulher';
             const title = isCombo ? `💰 Combo vendido — ${amountStr}` : `💰 Venda confirmada — ${amountStr}`;
             toast = { id: event.id, title, description: order?.productTitle || "Produto", orderCode: order?.orderCode || order?.id?.substring(0,8), amountStr, amount: order?.amount, customerName: order?.customerName || "Cliente", status: "Pago", orderId: event.orderId! };
             notifItem = { id: event.id, type: 'payment_status_paid', title, message: `Pedido ${toast.orderCode} de ${toast.customerName} foi pago.`, orderId: event.orderId, read: false, createdAt: new Date(eventTime).toISOString(), metadata: { status: 'paid' } };
          } else if (event.eventName === 'shipping_preparing') {
             playBeep();
             const title = "Pedido em separação";
             toast = { id: event.id, title, description: order?.productTitle || "Produto", orderCode: order?.orderCode || order?.id?.substring(0,8), amount: order?.amount, customerName: order?.customerName || "Cliente", status: "Em separação", orderId: event.orderId! };
             notifItem = { id: event.id, type: 'shipping_preparing', title, message: `O pedido ${toast.orderCode} de ${toast.customerName} entrou em separação.`, orderId: event.orderId, read: false, createdAt: new Date(eventTime).toISOString() };
          } else if (event.eventName === 'shipping_shipped') {
             playBeep();
             const orderCode = order?.orderCode || order?.id?.substring(0,8);
             const hasTracking = !!order?.trackingCode;
             const title = hasTracking ? `📦 Pedido enviado com rastreio` : `📦 Pedido enviado — ${orderCode}`;
             toast = { id: event.id, title, description: order?.productTitle || "Produto", orderCode, amount: order?.amount, customerName: order?.customerName || "Cliente", status: "Enviado", orderId: event.orderId! };
             notifItem = { id: event.id, type: 'shipping_shipped', title, message: hasTracking ? `O pedido ${orderCode} foi enviado (Rastreio: ${order?.trackingCode}).` : `O pedido ${orderCode} foi marcado como enviado.`, orderId: event.orderId, read: false, createdAt: new Date(eventTime).toISOString() };
          } else if (event.eventName === 'shipping_out_for_delivery') {
             playBeep();
             const title = "Saiu para entrega";
             toast = { id: event.id, title, description: order?.productTitle || "Produto", orderCode: order?.orderCode || order?.id?.substring(0,8), amount: order?.amount, customerName: order?.customerName || "Cliente", status: "Saiu para entrega", orderId: event.orderId! };
             notifItem = { id: event.id, type: 'shipping_out_for_delivery', title, message: `O pedido ${toast.orderCode} saiu para entrega.`, orderId: event.orderId, read: false, createdAt: new Date(eventTime).toISOString() };
          } else if (event.eventName === 'shipping_delivered') {
             playBeep();
             const title = "Pedido entregue";
             toast = { id: event.id, title, description: order?.productTitle || "Produto", orderCode: order?.orderCode || order?.id?.substring(0,8), amount: order?.amount, customerName: order?.customerName || "Cliente", status: "Entregue", orderId: event.orderId! };
             notifItem = { id: event.id, type: 'shipping_delivered', title, message: `A entrega do pedido ${toast.orderCode} foi concluída.`, orderId: event.orderId, read: false, createdAt: new Date(eventTime).toISOString() };
          } else if (event.eventName === 'shipping_issue') {
             playBeep();
             const title = "Problema no envio";
             toast = { id: event.id, title, description: order?.productTitle || "Produto", orderCode: order?.orderCode || order?.id?.substring(0,8), amount: order?.amount, customerName: order?.customerName || "Cliente", status: "Problema", orderId: event.orderId! };
             notifItem = { id: event.id, type: 'shipping_issue', title, message: `Um problema foi relatado no envio do pedido ${toast.orderCode}.`, orderId: event.orderId, read: false, createdAt: new Date(eventTime).toISOString() };
          }

          if (toast) {
            setToasts(prev => [toast!, ...prev].slice(0, 3));
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== event.id)), 6000);
          }
          
          if (notifItem) {
            setNotifications(prev => {
              const newList = [notifItem!, ...prev].slice(0, 30);
              localStorage.setItem('eyecode:anailda-book:notificationsList', JSON.stringify(newList));
              return newList;
            });
            setUnreadCount(prev => {
              const newCount = prev + 1;
              localStorage.setItem('eyecode:anailda-book:unreadNotificationsCount', newCount.toString());
              return newCount;
            });
          }
        }
      }
    });

    const unsubscribePush = listenForegroundMessages((payload) => {
      // Just play a beep and show toast if it's a new push. The internal events listener might also fire, 
      // but this guarantees we show a notification if the app is open.
      const type = payload?.data?.type;
      if (type === 'order_paid' || type === 'order_created' || type === 'order_shipped') {
        playBeep();
        
        // Show a generic toast from the push payload directly
        const title = payload?.data?.title || 'Notificação';
        const description = payload?.data?.productTitle || 'Pedido atualizado';
        const orderCode = payload?.data?.orderCode || '----';
        
        // Convert amountStr back to number or just pass string?
        // Our ToastData expects `amount?: number`. Let's just use string if we must, but we can't change the type easily without modifying it.
        // I will add amountStr to ToastData.
        
        const newToast: ToastData = {
          id: `push-${Date.now()}`,
          title,
          description,
          orderCode,
          customerName: payload?.data?.customerName || 'Cliente',
          status: type === 'order_paid' ? 'Pago' : type === 'order_created' ? 'Aguardando pagamento' : 'Enviado',
          orderId: payload?.data?.orderId || '',
          amountStr: payload?.data?.amountStr
        };
        
        setToasts(prev => [newToast, ...prev].slice(0, 3));
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== newToast.id)), 6000);
      }
    });

    return () => {
      document.removeEventListener('click', enableAudio);
      unsubscribe();
      unsubscribePush();
    };
  }, [user?.uid]);

  const clearUnread = React.useCallback(() => {
    setUnreadCount(0);
    localStorage.setItem('eyecode:anailda-book:unreadNotificationsCount', '0');
    localStorage.setItem('eyecode:anailda-book:lastSeenOrdersAt', Date.now().toString());
  }, []);

  const markAsRead = React.useCallback((id: string) => {
    setNotifications(prev => {
      const newList = prev.map(n => n.id === id ? { ...n, read: true } : n);
      localStorage.setItem('eyecode:anailda-book:notificationsList', JSON.stringify(newList));
      
      const unread = newList.filter(n => !n.read).length;
      setUnreadCount(unread);
      localStorage.setItem('eyecode:anailda-book:unreadNotificationsCount', unread.toString());
      
      return newList;
    });
  }, []);

  const markAllAsRead = React.useCallback(() => {
    setNotifications(prev => {
      const newList = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('eyecode:anailda-book:notificationsList', JSON.stringify(newList));
      return newList;
    });
    setUnreadCount(0);
    localStorage.setItem('eyecode:anailda-book:unreadNotificationsCount', '0');
  }, []);

  const dismissToast = React.useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  return (
    <NotificationsContext.Provider value={{ 
      unreadCount, clearUnread, activeToast: null, dismissToast,
      notifications, markAsRead, markAllAsRead
    }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => <NotificationToast key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />)}
      </div>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) throw new Error('useNotifications must be used within a NotificationsProvider');
  return context;
}

const NotificationToast: React.FC<{ toast: ToastData, onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const formatCurrency = (value?: number, amountStr?: string) => amountStr ? amountStr : (value === undefined ? '' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value));
  
  const isSuccess = toast.title.includes('Venda confirmada') || toast.title.includes('Combo vendido') || toast.title === 'Pagamento confirmado';
  const isPending = toast.title.includes('Novo pedido');
  const isShipped = toast.title.includes('Pedido enviado');

  return (
    <div className="w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-4 pointer-events-auto flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          {isSuccess && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
          {isPending && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
          {isShipped && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
          {toast.title}
        </h4>
        <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600">&times;</button>
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-300">
        <p className="font-medium">{toast.description}</p>
        <div className="flex justify-between mt-1 text-xs">
          <span>{toast.customerName}</span>
          <span className="font-bold">{formatCurrency(toast.amount, toast.amountStr)}</span>
        </div>
        <div className="flex justify-between mt-1 text-xs">
          <span className="text-slate-500">Pedido {toast.orderCode}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${isSuccess ? 'bg-emerald-100 text-emerald-700' : isShipped ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
            {toast.status}
          </span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-right">
        <a href={`/orders`} className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline">Ver pedido &rarr;</a>
      </div>
    </div>
  );
}
