import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Truck, 
  Package, 
  Tag, 
  BarChart2, 
  MousePointerClick, 
  MonitorSmartphone, 
  Megaphone, 
  CreditCard,
  Settings,
  Shield,
  Moon,
  Sun,
  LogOut,
  Bell
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNotifications } from "../context/NotificationsContext";
import { usePermissions } from "../hooks/usePermissions";
import { cn } from "../lib/utils";
import { MobileBottomNav } from "./mobile/MobileBottomNav";
import { MobileSecondaryMenu } from "./mobile/MobileSecondaryMenu";
import { MobileNotificationsMenu } from "./mobile/MobileNotificationsMenu";

type NavItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  requiredPermission?: keyof ReturnType<typeof usePermissions>;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const ALL_NAV_GROUPS: NavGroup[] = [
  {
    title: "VISÃO GERAL",
    items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    title: "OPERAÇÃO",
    items: [
      { title: "Pedidos", href: "/orders", icon: ShoppingCart },
      { title: "Clientes", href: "/customers", icon: Users, requiredPermission: 'canManageUsers' },
      { title: "Acompanhar envios", href: "/shipping", icon: Truck },
    ],
  },
  {
    title: "PRODUTOS",
    items: [
      { title: "Produtos", href: "/products", icon: Package },
      { title: "Ofertas", href: "/offers", icon: Tag, requiredPermission: 'canEditProducts' },
    ],
  },
  {
    title: "MARKETING",
    items: [
      { title: "Métricas", href: "/metrics", icon: BarChart2, requiredPermission: 'canViewMetrics' },
      { title: "Funil de conversão", href: "/funnel", icon: MousePointerClick, requiredPermission: 'canViewMetrics' },
      { title: "Sessões", href: "/sessions", icon: MonitorSmartphone, requiredPermission: 'canViewMetrics' },
      { title: "Campanhas UTM", href: "/campaigns", icon: Megaphone, requiredPermission: 'canViewMetrics' },
    ],
  },
  {
    title: "INTEGRAÇÕES",
    items: [
      { title: "Mercado Pago", href: "/mercadopago", icon: CreditCard, requiredPermission: 'canAccessMercadoPago' },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { title: "Configurações", href: "/settings", icon: Settings, requiredPermission: 'canAccessSettings' },
      { title: "Frete", href: "/shipping-settings", icon: Truck, requiredPermission: 'canAccessSettings' },
      { title: "Segurança", href: "/security", icon: Shield, requiredPermission: 'canAccessSettings' },
      { title: "Limpeza de Dados", href: "/cleanup", icon: Shield, requiredPermission: 'canAccessSettings' },
      { title: "Equipe", href: "/users", icon: Users, requiredPermission: 'canManageUsers' },
    ],
  },
];

export function Layout() {
  const { user, panelUser, logout } = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { unreadCount, clearUnread } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const NAV_GROUPS = ALL_NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (!item.requiredPermission) return true;
      return permissions[item.requiredPermission];
    })
  })).filter(group => group.items.length > 0);

  useEffect(() => {
    if (!user) return;
    const bootstrapUser = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          const email = user.email || '';
          const name = user.displayName || email.split('@')[0];
          const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          
          await setDoc(userRef, {
            uid: user.uid,
            name,
            email,
            username,
            role: 'admin',
            active: true,
            projectId: 'anailda-book',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            bootstrap: true
          });

          if (username) {
            const usernameRef = doc(db, 'usernames', username);
            await setDoc(usernameRef, {
              uid: user.uid,
              email,
              username,
              projectId: 'anailda-book',
              active: true
            });
          }
        }
      } catch (e) {
        console.error('[bootstrap]', e);
      }
    };
    bootstrapUser();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleItemClick = (itemHref: string) => {
    if (itemHref === '/orders') {
      clearUnread();
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row font-sans text-slate-900 dark:text-slate-100">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 pt-safe">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#D3265B] flex items-center justify-center shrink-0 shadow-sm shadow-[#D3265B]/20">
            <img 
              src="/cabral-hub-logo-white.svg" 
              alt="Cabral Hub" 
              className="w-6 h-6 object-contain" 
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                if (target.nextElementSibling) {
                  (target.nextElementSibling as HTMLElement).style.display = 'block';
                }
              }}
            />
            <span className="text-white text-xs font-bold hidden">CH</span>
          </div>
          <div className="leading-tight">
            <span className="font-bold text-lg tracking-tight text-slate-800 dark:text-slate-100">Cabral Hub</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setNotificationsOpen(true)}
            className="p-2 relative text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded-full"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-slate-100 dark:border-slate-800"></span>
            )}
          </button>
          <button 
            onClick={toggleTheme}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded-full"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button onClick={() => setMobileMenuOpen(true)} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-xs shadow-sm border border-slate-300 dark:border-slate-700">
            {user?.displayName ? user.displayName.substring(0,2).toUpperCase() : 'AC'}
          </button>
        </div>
      </div>

      <MobileSecondaryMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <MobileNotificationsMenu isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#D3265B] flex items-center justify-center shrink-0 shadow-sm shadow-[#D3265B]/20">
              <img 
                src="/cabral-hub-logo-white.svg" 
                alt="Cabral Hub" 
                className="w-6 h-6 object-contain" 
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  if (target.nextElementSibling) {
                    (target.nextElementSibling as HTMLElement).style.display = 'block';
                  }
                }}
              />
              <span className="text-white text-xs font-bold hidden">CH</span>
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm tracking-tight">Cabral Hub</div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-slate-500 font-bold">PRODUTOS E ENTREGAS</div>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-3">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={() => handleItemClick(item.href)}
                    className={({ isActive }) => cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4" />
                      {item.title}
                    </div>
                    {item.href === '/orders' && unreadCount > 0 && (
                      <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header (Desktop only) */}
        <header className="hidden md:flex h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Painel</h2>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500 font-medium border border-slate-200 dark:border-slate-700">Projeto: anailda-book</span>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setNotificationsOpen(true)}
              className="p-2 relative text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>
              )}
            </button>
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-3 border-l border-slate-200 dark:border-slate-800 pl-6">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-medium leading-none mb-1">{user?.displayName || 'Anailda Cabral'}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">{panelUser?.roleLabel || (panelUser?.role === 'admin' ? 'Administrador' : 'Editora')}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-xs border border-white dark:border-slate-700 shadow-sm">
                AC
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-600 transition-colors ml-2"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <Outlet />
        </main>
        
        <MobileBottomNav />
      </div>
    </div>
  );
}
