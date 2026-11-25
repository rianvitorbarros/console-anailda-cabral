import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";

export type OperationState = "loading" | "success" | "error";

export interface OperationFeedbackDialogProps {
  open: boolean;
  state: OperationState;
  loadingTitle: string;
  loadingDescription: string;
  loadingDetail?: string;
  successTitle: string;
  successDescription: string;
  successDetail?: string;
  errorTitle?: string;
  errorDescription?: string;
  onClose?: () => void;
  onRetry?: () => void;
}

export function OperationFeedbackDialog({
  open,
  state,
  loadingTitle,
  loadingDescription,
  loadingDetail,
  successTitle,
  successDescription,
  successDetail,
  errorTitle = "Não foi possível concluir",
  errorDescription = "Ocorreu um erro ao processar a requisição.",
  onClose,
  onRetry,
}: OperationFeedbackDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={state !== "loading" ? onClose : undefined}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden"
          >
            {state !== "loading" && onClose && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="flex flex-col items-center text-center space-y-6">
              {/* Icon */}
              <div className="relative">
                {state === "loading" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 rounded-full flex items-center justify-center relative shadow-inner"
                  >
                     <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, ease: "linear", duration: 1.5 }}
                        className="absolute inset-0 border-4 border-blue-500/20 dark:border-blue-400/20 rounded-full border-t-blue-500 dark:border-t-blue-400"
                     />
                  </motion.div>
                )}
                {state === "success" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400 rounded-full flex items-center justify-center relative shadow-inner"
                  >
                     <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.1, stiffness: 200, damping: 15 }}
                        className="absolute inset-0 bg-emerald-100/50 dark:bg-emerald-900/30 rounded-full"
                     />
                    <CheckCircle2 className="w-10 h-10 relative z-10" />
                  </motion.div>
                )}
                {state === "error" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center relative shadow-inner"
                  >
                     <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.1, stiffness: 200, damping: 15 }}
                        className="absolute inset-0 bg-red-100/50 dark:bg-red-900/30 rounded-full"
                     />
                    <AlertTriangle className="w-10 h-10 relative z-10" />
                  </motion.div>
                )}
              </div>

              {/* Texts */}
              <div className="space-y-2">
                <motion.h3 
                  key={`title-${state}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
                >
                  {state === "loading" && loadingTitle}
                  {state === "success" && successTitle}
                  {state === "error" && errorTitle}
                </motion.h3>
                <motion.p 
                  key={`desc-${state}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="text-slate-500 dark:text-slate-400"
                >
                  {state === "loading" && loadingDescription}
                  {state === "success" && successDescription}
                  {state === "error" && errorDescription}
                </motion.p>
              </div>

              {/* Inner Card Details */}
              {((state === "loading" && loadingDetail) || (state === "success" && successDetail)) && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`w-full p-4 rounded-2xl flex items-center gap-3 text-left ${state === "loading" ? 'bg-slate-50 dark:bg-slate-800/50' : 'bg-emerald-50/50 dark:bg-emerald-900/10'}`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${state === "loading" ? 'bg-white dark:bg-slate-800 text-blue-500 dark:text-blue-400 shadow-sm' : 'bg-white dark:bg-slate-800 text-emerald-500 dark:text-emerald-400 shadow-sm'}`}>
                     {state === "loading" ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                     ) : (
                        <CheckCircle2 className="w-5 h-5" />
                     )}
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className={`text-sm font-medium ${state === "loading" ? 'text-slate-700 dark:text-slate-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        {state === "loading" ? loadingDetail : successDetail}
                     </p>
                     {state === "loading" && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                           Não feche esta janela enquanto a operação termina.
                        </p>
                     )}
                  </div>
                  {state === "loading" && (
                     <div className="flex items-center gap-1 shrink-0 ml-2">
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 1 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                     </div>
                  )}
                </motion.div>
              )}

              {/* Action Buttons for Error */}
              {state === "error" && (
                <div className="w-full space-y-3 pt-2">
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold py-3.5 px-4 rounded-xl transition-colors"
                    >
                      Tentar novamente
                    </button>
                  )}
                  {onClose && (
                    <button
                      onClick={onClose}
                      className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-3.5 px-4 rounded-xl transition-colors"
                    >
                      Fechar
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
