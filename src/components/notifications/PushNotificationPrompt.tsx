import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Info, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { 
  isPushSupported, 
  isIOS, 
  isRunningAsPWA, 
  getPushPermissionStatus,
  enablePushNotifications
} from '../../services/pushNotifications';

export function PushNotificationPrompt() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const [status, setStatus] = useState<string>('loading'); // loading, unsupported, ios-not-pwa, default, granted, denied, error
  const [isEnabling, setIsEnabling] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = () => {
    if (!isPushSupported()) {
      setStatus('unsupported');
      return;
    }

    if (isIOS() && !isRunningAsPWA()) {
      setStatus('ios-not-pwa');
      return;
    }

    const permission = getPushPermissionStatus();
    setStatus(permission); // 'default', 'granted', 'denied'
  };

  const handleEnable = async () => {
    if (!user) return;
    setIsEnabling(true);
    setErrorMessage('');
    
    try {
      await enablePushNotifications(user, permissions.role);
      setStatus('granted');
    } catch (err: any) {
      if (err.message === 'denied') {
        setStatus('denied');
      } else if (err.message === 'ios-not-pwa') {
        setStatus('ios-not-pwa');
      } else {
        setStatus('error');
        setErrorMessage('Não foi possível ativar as notificações. Tente novamente.');
      }
    } finally {
      setIsEnabling(false);
    }
  };

  if (status === 'loading') return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4 md:p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-full shrink-0 ${status === 'granted' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
          {status === 'granted' ? <CheckCircle className="w-6 h-6" /> : status === 'denied' ? <BellOff className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
        </div>
        
        <div className="flex-1">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1 uppercase tracking-wider">
            Notificações de Vendas
          </h3>
          
          {status === 'unsupported' && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Este navegador não suporta notificações push.
            </p>
          )}

          {status === 'ios-not-pwa' && (
            <div className="text-sm text-slate-500 dark:text-slate-400 space-y-2">
              <p>Para receber notificações no iPhone, abra este site no Safari, toque em compartilhar e adicione à Tela de Início.</p>
              <p>Depois abra pelo ícone instalado e ative as notificações.</p>
            </div>
          )}

          {status === 'default' && (
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Receba alertas instantâneos no seu dispositivo quando um novo pedido for pago.
              </p>
              <button 
                onClick={handleEnable}
                disabled={isEnabling}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
              >
                {isEnabling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                Ativar notificações
              </button>
            </div>
          )}

          {status === 'granted' && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              Este dispositivo já está cadastrado para receber notificações.
            </p>
          )}

          {status === 'denied' && (
            <p className="text-sm text-rose-500 dark:text-rose-400">
              As notificações foram bloqueadas. Para ativar novamente, altere a permissão nas configurações do navegador ou do sistema.
            </p>
          )}

          {status === 'error' && (
            <div>
              <p className="text-sm text-rose-500 dark:text-rose-400 mb-3">
                {errorMessage}
              </p>
              <button 
                onClick={handleEnable}
                disabled={isEnabling}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
              >
                {isEnabling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tentar novamente'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
