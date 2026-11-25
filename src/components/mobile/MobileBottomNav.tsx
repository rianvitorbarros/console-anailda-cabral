import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { LayoutDashboard, ShoppingCart, Package, CreditCard, Plus, X, Search, RefreshCw, Copy, Activity, Settings, Users, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../../context/NotificationsContext';
import { usePermissions } from '../../hooks/usePermissions';
import { cn } from '../../lib/utils';

export function MobileBottomNav() {
  const [isFabOpen, setIsFabOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const permissions = usePermissions();
  const navigate = useNavigate();

  const toggleFab = () => setIsFabOpen(!isFabOpen);

  // We need exactly 4 links for the balanced layout (2 left, FAB, 2 right)
  const mainLinks = [
    { name: 'Resumo', href: '/', icon: LayoutDashboard },
    { name: 'Pedidos', href: '/orders', icon: ShoppingCart, badge: unreadCount },
    // Center is FAB
    { name: 'Produtos', href: '/products', icon: Package },
    permissions.canAccessMercadoPago 
      ? { name: 'Mercado P.', href: '/mercadopago', icon: CreditCard }
      : { name: 'Envios', href: '/shipping', icon: Truck },
  ];

  const fabActions = permissions.isAdmin ? [
    { name: 'Novo Produto', icon: Package, href: '/products', onClick: () => navigate('/products') },
    { name: 'Buscar Pedido', icon: Search, href: '/orders', onClick: () => navigate('/orders') },
    { name: 'Usuários', icon: Users, href: '/users', onClick: () => navigate('/users') },
    { name: 'Configurações', icon: Settings, href: '/settings', onClick: () => navigate('/settings') },
  ] : [
    { name: 'Buscar Pedido', icon: Search, href: '/orders', onClick: () => navigate('/orders') },
    { name: 'Atualizar Envios', icon: Truck, href: '/shipping', onClick: () => navigate('/shipping') },
  ];

  return (
    <>
      <AnimatePresence>
        {isFabOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 z-40 backdrop-blur-sm"
            onClick={() => setIsFabOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] rounded-t-2xl">
        <div className="flex items-center justify-around h-16 px-2 relative">
          {mainLinks.slice(0, 2).map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              onClick={() => setIsFabOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors relative",
                  isActive ? "text-rose-600 dark:text-rose-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                )
              }
            >
              <div className="relative">
                <link.icon className="w-6 h-6" />
                {link.badge !== undefined && link.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-white dark:border-slate-900">
                    {link.badge > 99 ? '99+' : link.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{link.name}</span>
            </NavLink>
          ))}

          {/* Center FAB */}
          <div className="relative w-16 flex justify-center">
            <div className="absolute -top-6">
              <button
                onClick={toggleFab}
                className={cn(
                  "flex items-center justify-center w-14 h-14 rounded-full shadow-lg text-white transition-transform duration-300 z-50",
                  isFabOpen ? "bg-slate-800 dark:bg-slate-700 rotate-45" : "bg-rose-600 hover:bg-rose-700"
                )}
              >
                <Plus className="w-7 h-7" />
              </button>
            </div>

            {/* FAB Menu Items */}
            <AnimatePresence>
              {isFabOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-4 mb-4"
                >
                  {fabActions.map((action, index) => (
                    <motion.div
                      key={action.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 w-max"
                    >
                      <span className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md">
                        {action.name}
                      </span>
                      <button
                        onClick={() => {
                          action.onClick();
                          setIsFabOpen(false);
                        }}
                        className="w-12 h-12 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 rounded-full shadow-md flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <action.icon className="w-5 h-5" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {mainLinks.slice(2, 4).map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              onClick={() => setIsFabOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors relative",
                  isActive ? "text-rose-600 dark:text-rose-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                )
              }
            >
              <link.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{link.name}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
}
