import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router";
import { Loader2, CheckCircle2, User, Eye, EyeOff, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  
  const { user, panelUser, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && panelUser) {
      let targetRoute = "/";
      if (panelUser.role === 'publisher_operator') {
        targetRoute = "/orders";
      } else if (panelUser.role === 'admin') {
        targetRoute = "/";
      } else if (panelUser.role === 'viewer') {
        targetRoute = "/orders";
      }
      navigate(targetRoute, { replace: true });
    }
  }, [user, panelUser, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    console.log("[login-start]", {
      identifier,
      isEmail: identifier.includes("@")
    });

    try {
      // Ensure local persistence is set before login (for PWA)
      await setPersistence(auth, browserLocalPersistence);

      let emailToLogin = identifier;

      // Se não for email, buscar por username
      if (!identifier.includes('@')) {
        const usernameLower = identifier.toLowerCase();
        const usernameDocRef = doc(db, 'usernames', usernameLower);
        const usernameDoc = await getDoc(usernameDocRef);
        
        if (usernameDoc.exists()) {
          const data = usernameDoc.data();
          
          if (data.active === false) {
             throw new Error('user-disabled');
          }
          emailToLogin = data.email;
        } else {
          throw new Error('user-not-found');
        }
      }

      const userCred = await signInWithEmailAndPassword(auth, emailToLogin, password);
      
      const userDocRef = doc(db, 'users', userCred.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      let targetRoute = "/";
      
      if (!userDoc.exists()) {
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
        throw new Error('user-not-configured');
      }

      const userData = userDoc.data();

      if (userData.active === false) {
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
        throw new Error('user-disabled-explicit');
      }

      if (userData.role === 'publisher_operator') {
        targetRoute = "/orders";
      } else if (userData.role === 'admin') {
        targetRoute = "/";
      } else if (userData.role === 'viewer') {
        targetRoute = "/orders";
      } else {
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
        throw new Error('user-role-invalid');
      }

      setSuccess(true);
      setTimeout(() => {
        navigate(targetRoute, { replace: true });
      }, 700);
      
    } catch (err: any) {
      console.error("[login-flow-error]", {
        code: err.code,
        message: err.message,
        details: err.details
      });

      if (err.message === 'user-disabled' || err.message === 'user-disabled-explicit') {
         setError("Este usuário está inativo. Peça ao administrador para ativar seu acesso.");
      } else if (err.message === 'user-not-configured') {
         setError("Seu usuário ainda não foi configurado no painel.");
      } else if (err.message === 'user-role-invalid') {
         setError("Perfil de acesso inválido. Contate o administrador.");
      } else if (err.message === 'user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
         setError("E-mail, usuário ou senha inválidos.");
      } else if (err.code === 'auth/network-request-failed') {
         setError("Sem conexão com a internet. Verifique sua rede.");
      } else {
         setError("Não foi possível conectar. Tente novamente.");
      }
      setSuccess(false);
      setLoading(false);
    }
  };

  if (authLoading || (user && panelUser && !success)) {
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

  return (
    <div className="min-h-screen bg-[#FDF8F9] dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 inset-x-0 h-[40vh] bg-gradient-to-b from-[#D3265B]/10 dark:from-[#D3265B]/20 to-transparent"></div>
      
      {/* Large watermark icon */}
      <img 
        src="/cabral-hub-logo.svg" 
        alt="" 
        className="absolute w-[600px] md:w-[800px] opacity-[0.04] dark:opacity-[0.06] pointer-events-none mix-blend-luminosity dark:invert rotate-[-10deg] right-[-150px] bottom-[-100px] md:right-[-200px] md:bottom-[-200px]" 
      />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[420px] w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(211,38,91,0.06)] overflow-hidden border border-white dark:border-slate-800 relative z-10"
      >
        <div className="p-8 md:p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-[#D3265B] rounded-2xl flex items-center justify-center shadow-lg shadow-[#D3265B]/20 mb-6">
              <User className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white tracking-tight">
              Cabral Hub
            </h2>
            <p className="text-center text-[11px] font-bold text-[#D3265B] uppercase tracking-widest mt-1">
              Produtos e Entregas
            </p>
          </div>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-8 space-y-4"
              >
                <div className="w-16 h-16 bg-[#D3265B]/10 dark:bg-[#D3265B]/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-[#D3265B] dark:text-[#D3265B]" />
                </div>
                <p className="font-bold text-[#D3265B] dark:text-[#D3265B] text-sm uppercase tracking-wider">
                  Acesso Autorizado
                </p>
              </motion.div>
            ) : (
              <motion.form 
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleLogin} 
                className="space-y-5"
              >
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-xs font-medium text-center border border-red-100 dark:border-red-900/30 flex items-center gap-3 text-left">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
                    E-mail ou usuário
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="seu@email.com ou username"
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D3265B]/20 focus:bg-white dark:focus:bg-slate-900 focus:border-[#D3265B] dark:focus:border-[#D3265B] transition-all outline-none text-sm placeholder:text-slate-400"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3.5 pr-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#D3265B]/20 focus:bg-white dark:focus:bg-slate-900 focus:border-[#D3265B] dark:focus:border-[#D3265B] transition-all outline-none text-sm placeholder:text-slate-400"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center h-14 bg-[#D3265B] hover:bg-[#B31D4A] text-white font-bold text-sm uppercase tracking-wider rounded-2xl transition-all disabled:opacity-70 mt-6 shadow-[0_8px_20px_0_rgb(211,38,91,0.25)] hover:shadow-[0_8px_25px_0_rgb(211,38,91,0.35)]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Validando acesso...
                    </span>
                  ) : (
                    "Acessar Painel"
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

