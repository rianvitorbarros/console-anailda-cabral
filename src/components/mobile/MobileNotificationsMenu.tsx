import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, CheckCircle, Clock, XCircle, Package } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useNotifications } from '../../context/NotificationsContext';
import { formatDate } from '../../lib/utils';
import { PushNotificationPrompt } from '../notifications/PushNotificationPrompt';

interface MobileNotificationsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNotificationsMenu({ isOpen, onClose }: MobileNotificationsMenuProps) {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    onClose();
    if (notification.orderId) {
      navigate(`/orders/${notification.orderId}`);
    } else {
      navigate('/orders');
    }
  };

  const getIcon = (type: string, status?: string) => {
    switch (type) {
      case 'order_created': return <ShoppingBag className="w-4 h-4 text-amber-500" />;
      case 'payment_status_paid': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'payment_status_rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Package className="w-4 h-4 text-rose-500" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 z-[60] backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 sm:top-4 sm:right-4 sm:bottom-auto sm:left-auto sm:w-96 sm:rounded-2xl left-0 right-0 z-[60] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[calc(100vh-2rem)] border sm:border-slate-200 dark:sm:border-slate-800"
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">Notificações</h3>
                {unreadCount > 0 && (
                  <span className="bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    Marcar lidas
                  </button>
                )}
                <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto p-4 flex-1 pb-safe">
              <PushNotificationPrompt />

              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300">Nenhuma notificação</h4>
                  <p className="text-xs text-slate-500 mt-1">Você não tem novas notificações no momento.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 rounded-2xl border transition-colors cursor-pointer flex gap-4 ${notification.read ? 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800' : 'bg-white border-rose-100 dark:bg-slate-900 dark:border-rose-900/50 shadow-sm'}`}
                    >
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${notification.read ? 'bg-slate-100 dark:bg-slate-800' : 'bg-rose-50 dark:bg-rose-900/30'}`}>
                        {getIcon(notification.type, notification.metadata?.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm truncate pr-2 ${notification.read ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-bold text-slate-900 dark:text-slate-100'}`}>
                            {notification.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                            {formatDate(notification.createdAt)}
                          </span>
                        </div>
                        <p className={`text-xs line-clamp-2 ${notification.read ? 'text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>
                          {notification.message}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
