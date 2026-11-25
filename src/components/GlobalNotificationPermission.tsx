import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  isPushSupported, 
  isIOS, 
  isRunningAsPWA, 
  getPushPermissionStatus, 
  enablePushNotifications,
  syncExistingPushToken
} from '../services/pushNotifications';

export function GlobalNotificationPermission({ children }: { children: React.ReactNode }) {
  const { user, panelUser } = useAuth();
  
  const [status, setStatus] = useState<string>('loading');
  const [isEnabling, setIsEnabling] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!user || !panelUser) return;
    
    // Only request permission if user role is meant to receive notifications
    const allowedRoles = ['admin', 'publisher_operator'];
    if (!allowedRoles.includes(panelUser.role)) {
      setStatus('unauthorized_role');
      return;
    }

    checkStatus();
  }, [user, panelUser]);

  const checkStatus = () => {
    if (!isPushSupported()) {
      setStatus('unsupported');
      return;
    }

    if (isIOS() && !isRunningAsPWA()) {
      setStatus('ios-not-pwa');
      
      // We check if the user previously postponed it
      const dismissed = sessionStorage.getItem('cabral_notif_dismissed');
      if (!dismissed) {
        setShowModal(true);
      }
      return;
    }

    const permission = getPushPermissionStatus();
    setStatus(permission); // 'default', 'granted', 'denied'

    if (permission === 'default' || permission === 'denied') {
      const dismissed = sessionStorage.getItem('cabral_notif_dismissed');
      if (!dismissed) {
        setShowModal(true);
      }
    } else if (permission === 'granted') {
      // Background sync token
      if (user) {
        syncExistingPushToken(user, panelUser?.role).catch(console.error);
      }
    }
  };

  const handleEnable = async () => {
    if (!user) return;
    setIsEnabling(true);
    
    try {
      await enablePushNotifications(user, panelUser?.role);
      setStatus('granted');
      setShowModal(false);
    } catch (err: any) {
      if (err.message === 'denied') {
        setStatus('denied');
      } else if (err.message === 'ios-not-pwa') {
        setStatus('ios-not-pwa');
      } else {
        setStatus('error');
      }
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('cabral_notif_dismissed', 'true');
    setShowModal(false);
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showModal]);

  return (
    <>
      {children}
      
      {showModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6"
          role="dialog" 
          aria-modal="true"
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => status === 'denied' || status === 'ios-not-pwa' ? handleDismiss() : null}
          />
          
          {/* Modal Content */}
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
            <div className="p-6">
              
              {status === 'ios-not-pwa' && (
                <>
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Info className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                    Instale o Cabral Hub para receber notificações
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                    No iPhone e iPad, as notificações funcionam apenas pelo aplicativo instalado na Tela de Início.
                  </p>
                  
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-800">
                    <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-3 font-medium">
                      <li className="flex gap-2">
                        <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">1</span>
                        Toque no ícone de <strong>Compartilhar</strong> na barra do Safari
                      </li>
                      <li className="flex gap-2">
                        <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">2</span>
                        Escolha <strong>"Adicionar à Tela de Início"</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">3</span>
                        Abra o app pelo novo ícone para ativar as notificações
                      </li>
                    </ol>
                  </div>
                  
                  <button 
                    onClick={handleDismiss}
                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl transition-colors"
                  >
                    Entendi
                  </button>
                </>
              )}

              {(status === 'default' || status === 'error') && (
                <>
                  <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-4">
                    <Bell className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                    Ative as notificações de vendas
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-5 leading-relaxed">
                    Receba avisos em tempo real sobre novos pedidos, pagamentos confirmados e atualizações importantes.
                  </p>
                  
                  <ul className="text-sm font-medium text-slate-700 dark:text-slate-300 space-y-2 mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Novos pedidos
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Pagamentos confirmados
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Atualizações de envio
                    </li>
                  </ul>
                  
                  {status === 'error' && (
                    <p className="text-sm text-rose-500 mb-4 font-medium">Não foi possível ativar. Tente novamente.</p>
                  )}

                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={handleEnable}
                      disabled={isEnabling}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#D3265B] hover:bg-[#b01e4a] text-white font-bold rounded-xl transition-colors disabled:opacity-70"
                    >
                      {isEnabling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ativar notificações"}
                    </button>
                    <button 
                      onClick={handleDismiss}
                      disabled={isEnabling}
                      className="w-full py-3 px-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold rounded-xl transition-colors"
                    >
                      Agora não
                    </button>
                  </div>
                </>
              )}

              {status === 'denied' && (
                <>
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <BellOff className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                    Notificações bloqueadas
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                    Você bloqueou as notificações anteriormente. Para receber avisos de vendas, você precisa alterar a permissão nas configurações.
                  </p>
                  
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300">
                    <p className="font-bold mb-2">Como reativar:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Abra as <strong>Configurações</strong> do navegador ou sistema</li>
                      <li>Vá em <strong>Notificações</strong></li>
                      <li>Permita o <strong>Cabral Hub</strong></li>
                    </ol>
                  </div>
                  
                  <button 
                    onClick={handleDismiss}
                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl transition-colors"
                  >
                    Entendi
                  </button>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
