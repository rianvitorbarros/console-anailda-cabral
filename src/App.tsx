import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { usePermissions } from "./hooks/usePermissions";
import { Layout } from "./components/Layout";
import { GlobalNotificationPermission } from "./components/GlobalNotificationPermission";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Orders } from "./pages/Orders";
import { OrderDetails } from "./pages/OrderDetails";
import { Products } from "./pages/Products";
import { Offers } from "./pages/Offers";
import { Funnel } from "./pages/Funnel";
import { MercadoPago } from "./pages/MercadoPago";
import { Settings } from "./pages/Settings";
import { ShippingSettings } from "./pages/ShippingSettings";
import { DataCleanup } from "./pages/DataCleanup";
import { UsersManagement } from "./pages/UsersManagement";
import { Shipping } from "./pages/Shipping";
import { motion } from "motion/react";

// Placeholder pages for others
function PlaceholderPage({ title, error }: { title: string, error?: boolean }) {
  return (
    <div className="flex items-center justify-center h-full">
      <h2 className={`text-xl font-medium ${error ? 'text-red-500' : 'text-slate-500'}`}>{title}</h2>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDF8F9] dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-[#D3265B]/10 dark:from-[#D3265B]/20 to-transparent"></div>
        <img src="/cabral-hub-logo.svg" alt="" className="absolute w-[600px] opacity-[0.04] dark:opacity-[0.06] pointer-events-none mix-blend-luminosity dark:invert rotate-[-10deg] right-[-150px] bottom-[-150px]" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center z-10"
        >
          <div className="relative mb-6">
             <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex items-center justify-center relative z-10 p-3 border border-slate-100 dark:border-slate-800">
               <img src="/cabral-hub-logo.svg" alt="Logo" className="w-full h-full object-contain dark:invert" />
             </div>
             <div className="absolute inset-0 bg-[#D3265B] rounded-3xl blur-2xl opacity-20 animate-pulse"></div>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Restaurando sessão</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Estamos preparando seu painel.</p>
          <div className="mt-8 flex gap-1.5">
             <div className="w-2 h-2 rounded-full bg-[#D3265B] animate-bounce" style={{ animationDelay: "0ms" }}></div>
             <div className="w-2 h-2 rounded-full bg-[#D3265B] animate-bounce" style={{ animationDelay: "150ms" }}></div>
             <div className="w-2 h-2 rounded-full bg-[#D3265B] animate-bounce" style={{ animationDelay: "300ms" }}></div>
          </div>
        </motion.div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function RequireAdmin() {
  const { isAdmin, loading } = usePermissionsAuth();
  if (loading) return null;
  if (!isAdmin) {
    // Redireciona e a página de destino (Orders) pode ler o state
    return <Navigate to="/orders" state={{ unauthorized: true }} replace />;
  }
  return <Outlet />;
}

// Custom hook to deal with loading state if needed for permissions, 
// though panelUser is loaded with useAuth.
function usePermissionsAuth() {
  const permissions = usePermissions();
  const { loading } = useAuth();
  return { ...permissions, loading };
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<RequireAuth><NotificationsProvider><GlobalNotificationPermission><Layout /></GlobalNotificationPermission></NotificationsProvider></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:id" element={<OrderDetails />} />
              <Route path="shipping" element={<Shipping />} />
              <Route path="products" element={<Products />} />
              <Route path="offers" element={<Offers />} />
              
              <Route element={<RequireAdmin />}>
                <Route path="metrics" element={<PlaceholderPage title="Métricas" />} />
                <Route path="funnel" element={<Funnel />} />
                <Route path="sessions" element={<PlaceholderPage title="Sessões" />} />
                <Route path="mercadopago" element={<MercadoPago />} />
                <Route path="settings" element={<Settings />} />
                <Route path="shipping-settings" element={<ShippingSettings />} />
                <Route path="users" element={<UsersManagement />} />
                <Route path="cleanup" element={<DataCleanup />} />
              </Route>
              
              <Route path="*" element={<PlaceholderPage title="Página não encontrada" />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
