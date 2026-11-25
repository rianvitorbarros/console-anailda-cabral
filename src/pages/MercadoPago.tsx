import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { CreditCard, Save, CheckCircle, AlertTriangle, Loader2, Copy, RefreshCw, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getMercadoPagoSettings,
  saveMercadoPagoSettings,
  MercadoPagoSettings
} from "../services/mercadoPagoIntegrationService";
import {
  testMercadoPagoConnection,
  CallableSyncError,
  DEPLOY_MP_FUNCTIONS_CMD,
  MercadoPagoConnectionResult
} from "../services/ordersService";

export function MercadoPago() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<MercadoPagoSettings | null>(null);

  const [publicKey, setPublicKey] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production');

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [connectionResult, setConnectionResult] = useState<MercadoPagoConnectionResult | null>(null);
  const [needsDeploy, setNeedsDeploy] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const webhookUrl = "https://us-central1-console-anailda.cloudfunctions.net/mercadoPagoWebhook";
  const projectId = "anailda-book";

  useEffect(() => {
    async function loadSettings() {
      if (!user) return;
      try {
        const data = await getMercadoPagoSettings(projectId);

        if (data) {
          setSettings(data);
          setPublicKey(data.publicKey || "");
          setEnvironment(data.environment || "production");
        }
      } catch (err: any) {
        console.error("Erro ao carregar configurações:", err);
        setErrorMsg(`Erro ao carregar configurações: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    setNeedsDeploy(false);

    try {
      const updatedData: Partial<MercadoPagoSettings> = {
        publicKey,
        environment,
        status: publicKey ? 'connected' : 'pending',
        webhookUrl
      };

      await saveMercadoPagoSettings(projectId, updatedData, accessToken, user?.uid);

      const newData = await getMercadoPagoSettings(projectId);
      setSettings(newData);

      setSuccessMsg("Configurações salvas com sucesso!");
      setAccessToken("");
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        setErrorMsg("Sem permissão para salvar no Firestore.");
      } else if (err.message && err.message.includes('invalid data')) {
        setErrorMsg("Dados inválidos para salvar. Verifique os campos obrigatórios.");
      } else {
        setErrorMsg("Erro ao salvar configurações do Mercado Pago.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setErrorMsg("");
    setSuccessMsg("");
    setConnectionResult(null);
    setNeedsDeploy(false);

    try {
      const result = await testMercadoPagoConnection();
      setConnectionResult(result);
      setSuccessMsg(`Conexão validada com sucesso na conta ${result.nickname || result.userId} (ID ${result.userId}).`);
    } catch (err: any) {
      if (err instanceof CallableSyncError) {
        setErrorMsg(err.message);
        setNeedsDeploy(err.needsDeploy);
      } else {
        setErrorMsg(err?.message || "Erro ao testar conexão com o Mercado Pago.");
      }
    } finally {
      setTesting(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setSuccessMsg("Webhook URL copiada!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleCopyDeployCmd = () => {
    navigator.clipboard.writeText(DEPLOY_MP_FUNCTIONS_CMD);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="md:hidden">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Mercado Pago</h1>
      </div>

      <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Mercado Pago</h1>
          <p className="text-slate-500 dark:text-slate-400">Configurações de integração de pagamento e webhook.</p>
        </div>
      </div>

      {/* Connection Status Card for Mobile */}
      <div className="md:hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Status</span>
        {settings?.status === 'connected' ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" />
            Conectado
          </span>
        ) : (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Não configurado
          </span>
        )}
      </div>

      {/* Security Warning */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start gap-3 md:gap-4">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
        </div>
        <div className="text-xs md:text-sm text-amber-900 dark:text-amber-300">
          <p className="font-semibold mb-1">Segurança das credenciais</p>
          <p className="leading-relaxed text-amber-800 dark:text-amber-400">
            O Access Token permanece protegido exclusivamente nas Cloud Functions do servidor e nunca é exposto no navegador.
            Certifique-se de que a URL de Webhook abaixo esteja cadastrada no painel do Mercado Pago com os eventos de Pagamentos e Pedidos ativos.
          </p>
        </div>
      </div>

      {/* Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        <div className="hidden md:flex p-6 border-b border-slate-200 dark:border-slate-800 items-center justify-between">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-400" />
            Credenciais da API
          </h3>
          {settings?.status === 'connected' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              Conectado
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Não configurado
            </span>
          )}
        </div>

        <div className="p-4 md:p-6 space-y-5 md:space-y-6">

          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-xl text-sm border border-red-200 dark:border-red-900/50 space-y-3">
              <p className="font-medium">{errorMsg}</p>
              {needsDeploy && (
                <div className="bg-white dark:bg-slate-950 border border-red-200 dark:border-red-900/40 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Execute este comando no terminal do projeto (Cloud Shell ou local) para publicar as funções:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto py-1">
                      {DEPLOY_MP_FUNCTIONS_CMD}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyDeployCmd}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 transition-colors"
                    >
                      {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCmd ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl text-sm border border-emerald-200 dark:border-emerald-900/50 space-y-1">
              <p className="font-medium">{successMsg}</p>
              {connectionResult && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                  Conta: {connectionResult.nickname || 'N/A'} · User ID: {connectionResult.userId} · Site: {connectionResult.siteId || 'MLB'}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                Public Key (Frontend)
              </label>
              <input
                type="text"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="APP_USR-..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-shadow"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                Access Token (Backend)
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={settings?.accessTokenMasked ? `Salvo: ${settings.accessTokenMasked}` : "APP_USR-..."}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-shadow"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                {settings?.accessTokenMasked ? "Deixe em branco para manter o token atual." : "Insira o token privado da conta Mercado Pago."}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
              Ambiente de Execução
            </label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as 'sandbox' | 'production')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-rose-500 outline-none"
            >
              <option value="production">Produção (Real)</option>
              <option value="sandbox">Sandbox (Testes Simulado)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Webhook URL Recebedora (Projeto console-anailda)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 font-mono text-xs md:text-sm"
              />
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors active:scale-95"
              >
                <Copy className="w-4 h-4" />
                <span>Copiar URL</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cadastre exatamente esta URL no painel do Mercado Pago em Webhooks &gt; Modo de produção (eventos: Pagamentos e Pedidos).
            </p>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 active:scale-95"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {testing ? "Testando..." : "Testar Conexão"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || testing}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 active:scale-95"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
