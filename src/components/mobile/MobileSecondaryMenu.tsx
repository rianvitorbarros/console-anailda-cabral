import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Truck, Tag, BarChart2, MousePointerClick, MonitorSmartphone, Megaphone, Settings, Shield, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

interface MobileSecondaryMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

type NavItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  requiredPermission?: keyof ReturnType<typeof usePermissions>;
};

const ALL_SECONDARY_LINKS: NavItem[] = [
  { title: "Clientes", href: "/customers", icon: Users, requiredPermission: 'canManageUsers' },
  { title: "Acompanhar envios", href: "/shipping", icon: Truck },
  { title: "Ofertas", href: "/offers", icon: Tag, requiredPermission: 'canEditProducts' },
  { title: "Métricas", href: "/metrics", icon: BarChart2, requiredPermission: 'canViewMetrics' },
  { title: "Funil de conversão", href: "/funnel", icon: MousePointerClick, requiredPermission: 'canViewMetrics' },
  { title: "Sessões", href: "/sessions", icon: MonitorSmartphone, requiredPermission: 'canViewMetrics' },
  { title: "Campanhas UTM", href: "/campaigns", icon: Megaphone, requiredPermission: 'canViewMetrics' },
  { title: "Configurações", href: "/settings", icon: Settings, requiredPermission: 'canAccessSettings' },
  { title: "Segurança", href: "/security", icon: Shield, requiredPermission: 'canAccessSettings' },
];

export function MobileSecondaryMenu({ isOpen, onClose }: MobileSecondaryMenuProps) {
  const { user, panelUser, logout } = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      onClose();
      navigate('/login');
    } catch (error) {
      console.error("Logout error", error);
    } finally {
      setIsLoggingOut(false);
      setShowConfirm(false);
    }
  };

  const SECONDARY_LINKS = ALL_SECONDARY_LINKS.filter(link => {
    if (!link.requiredPermission) return true;
    return permissions[link.requiredPermission];
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 z-[60] backdrop-blur-sm md:hidden"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl md:hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="font-bold text-lg">Menu</h3>
              <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-4 flex-1 pb-safe space-y-2 pb-24">
              <div className="mb-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl flex items-center gap-3">
                <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                  {user?.displayName ? user.displayName.substring(0,2).toUpperCase() : 'US'}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{user?.displayName || 'Usuário Logado'}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded-full">
                      {panelUser?.roleLabel || (panelUser?.role === 'admin' ? 'Administrador' : 'Editora')}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                      anailda-book
                    </span>
                  </div>
                </div>
              </div>

              {SECONDARY_LINKS.map((link) => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  onClick={onClose}
                  className={({ isActive }) => cn(
                    "flex items-center gap-4 px-4 py-3 rounded-xl transition-colors",
                    isActive ? "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-semibold"
                             : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <link.icon className="w-5 h-5 opacity-70" />
                  <span>{link.title}</span>
                </NavLink>
              ))}
              
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-4" />
              
              <AnimatePresence mode="wait">
                {!showConfirm ? (
                  <motion.button 
                    key="logout-btn"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onClick={() => setShowConfirm(true)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
                  >
                    <LogOut className="w-5 h-5 opacity-70" />
                    <span>Sair da conta</span>
                  </motion.button>
                ) : (
                  <motion.div
                    key="logout-confirm"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 flex flex-col gap-3"
                  >
                    <p className="text-sm text-red-800 dark:text-red-300 font-medium text-center">
                      Deseja realmente sair?
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowConfirm(false)}
                        disabled={isLoggingOut}
                        className="flex-1 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex-1 flex justify-center items-center py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        {isLoggingOut ? (
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : "Sair"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
