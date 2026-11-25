import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, Plus, X, Search, Shield, Loader2, MoreVertical, Edit2, Lock, UserCheck, UserX } from "lucide-react";
import { collection, query, getDocs, doc, setDoc, deleteDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { PanelUser, UserRole } from "../types";

export function UsersManagement() {
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    uid: '',
    name: '',
    email: '',
    username: '',
    password: '', // only for create
    role: 'publisher_operator' as UserRole,
    active: true
  });
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  
  const PROJECT_ID = "anailda-book";

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const fetchedUsers: PanelUser[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.projectId === PROJECT_ID || !data.projectId) {
          fetchedUsers.push({ ...data, uid: doc.id } as PanelUser);
        }
      });
      setUsers(fetchedUsers);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setModalMode('create');
    setFormData({
      uid: '',
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'publisher_operator',
      active: true
    });
    setErrorMsg('');
    setSuccessMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: PanelUser) => {
    setModalMode('edit');
    setFormData({
      uid: user.uid,
      name: user.name || '',
      email: user.email || '',
      username: user.username || '',
      password: '',
      role: user.role || 'publisher_operator',
      active: user.active !== false
    });
    setErrorMsg('');
    setSuccessMsg('');
    setIsModalOpen(true);
    setOpenDropdown(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (!formData.name || !formData.email || !formData.username) {
        throw new Error('Preencha todos os campos obrigatórios.');
      }
      if (formData.username.includes(' ') || formData.username.toLowerCase() !== formData.username) {
        throw new Error('O usuário (username) deve ser minúsculo e sem espaços.');
      }

      const usernameLower = formData.username.toLowerCase();
      
      let roleLabel = 'Visualizador';
      if (formData.role === 'admin') roleLabel = 'Administrador';
      if (formData.role === 'publisher_operator') roleLabel = 'Editora';

      if (modalMode === 'create') {
        if (!formData.password) {
           throw new Error('A senha é obrigatória para novos usuários.');
        }

        // Check if username already exists
        const usernameDocRef = doc(db, 'usernames', usernameLower);
        const usernameDoc = await getDoc(usernameDocRef);
        if (usernameDoc.exists()) {
          throw new Error('Este nome de usuário já está em uso.');
        }

        const createPanelUser = httpsCallable(functions, 'createPanelUser');
        const result = await createPanelUser({
          email: formData.email,
          password: formData.password,
          displayName: formData.name,
          role: formData.role,
          projectId: PROJECT_ID
        });

        const newUserId = (result.data as any).uid;

        // update the user name and roleLabel locally, since the function created the base fields
        await setDoc(doc(db, 'users', newUserId), {
          uid: newUserId,
          name: formData.name, // adding name which is specific to our model
          username: usernameLower,
          roleLabel,
          projectId: PROJECT_ID,
          active: formData.active,
          role: formData.role
        }, { merge: true });

        await setDoc(doc(db, 'usernames', usernameLower), {
          uid: newUserId,
          email: formData.email,
          username: usernameLower,
          projectId: PROJECT_ID,
          active: formData.active
        });
        
        setSuccessMsg('Usuário criado com sucesso no Firebase Auth e Firestore!');
      } else {
        // Edit mode
        const existingUser = users.find(u => u.uid === formData.uid);
        if (!existingUser) throw new Error("Usuário não encontrado.");

        const updatePanelUser = httpsCallable(functions, 'updatePanelUser');
        await updatePanelUser({
          uid: formData.uid,
          email: formData.email !== existingUser.email ? formData.email : undefined,
          displayName: formData.name !== existingUser.name ? formData.name : undefined,
          role: formData.role !== existingUser.role ? formData.role : undefined,
          status: formData.active ? 'active' : 'inactive'
        });

        const updates: any = {
          name: formData.name,
          roleLabel,
        };

        // If username changed, check availability and update mapping
        if (existingUser.username !== usernameLower) {
          const usernameDocRef = doc(db, 'usernames', usernameLower);
          const usernameDoc = await getDoc(usernameDocRef);
          if (usernameDoc.exists()) {
            throw new Error('Este novo nome de usuário já está em uso.');
          }

          // Create new mapping
          await setDoc(usernameDocRef, {
            uid: formData.uid,
            email: formData.email,
            username: usernameLower,
            projectId: PROJECT_ID,
            active: formData.active
          });

          // Delete old mapping if exists
          if (existingUser.username) {
            await deleteDoc(doc(db, 'usernames', existingUser.username));
          }
          
          updates.username = usernameLower;
        }

        await setDoc(doc(db, 'users', formData.uid), updates, { merge: true });
        
        // Ensure username doc matches active status if username didn't change
        if (existingUser.username === usernameLower) {
           await setDoc(doc(db, 'usernames', usernameLower), { active: formData.active }, { merge: true });
        }

        setSuccessMsg('Usuário atualizado com sucesso!');
      }

      setTimeout(() => {
        setIsModalOpen(false);
        fetchUsers();
      }, 2000);

    } catch (err: any) {
      console.error("[create-user-error]", {
        code: err.code,
        message: err.message,
        details: err.details,
        functionName: modalMode === 'create' ? "createPanelUser" : "updatePanelUser",
        projectId: PROJECT_ID
      });
      let errorText = err.message || 'Erro ao salvar usuário.';
      if (err.message === 'INTERNAL') {
        errorText = "Não foi possível criar o usuário. Verifique os logs da função no backend (pode estar ausente ou com erro).";
      }
      setErrorMsg(errorText);
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (user: PanelUser) => {
    try {
      const newStatus = !user.active;
      const updatePanelUser = httpsCallable(functions, 'updatePanelUser');
      await updatePanelUser({
        uid: user.uid,
        status: newStatus ? 'active' : 'inactive'
      });

      await setDoc(doc(db, 'users', user.uid), { active: newStatus }, { merge: true });
      if (user.username) {
        await setDoc(doc(db, 'usernames', user.username), { active: newStatus }, { merge: true });
      }
      fetchUsers();
    } catch (e) {
      console.error(e);
      alert('Erro ao alterar status.');
    }
    setOpenDropdown(null);
  };

  const handleResetPassword = async (user: PanelUser) => {
    try {
      const resetAuth = httpsCallable(functions, 'sendPasswordResetToPanelUser');
      await resetAuth({ email: user.email });
      alert(`O link de redefinição de senha para ${user.email} foi gerado e está registrado nos logs da function (e seria enviado por email).`);
    } catch (e) {
      console.error(e);
      alert('Erro ao tentar redefinir senha.');
    }
    setOpenDropdown(null);
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-md">Administrador</span>;
      case 'publisher_operator':
        return <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md">Editora</span>;
      default:
        return <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">Visualizador</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Equipe</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie os acessos ao painel da editora.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition-colors w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text"
          placeholder="Buscar usuário por nome, email ou @username..."
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-rose-500 dark:focus:border-rose-500 transition-colors shadow-sm text-sm"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin mb-4" />
          <p className="text-sm text-slate-500 font-medium animate-pulse">Carregando usuários...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <motion.div
              key={user.uid}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white dark:bg-slate-900 rounded-2xl border ${user.active ? 'border-slate-200 dark:border-slate-800 shadow-sm' : 'border-dashed border-slate-300 dark:border-slate-700 opacity-60'} p-5 relative`}
            >
              <div className="absolute top-4 right-4">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === user.uid ? null : user.uid)}
                  className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                
                <AnimatePresence>
                  {openDropdown === user.uid && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 top-8 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-10 py-1 overflow-hidden"
                    >
                      <button 
                        onClick={() => handleOpenEdit(user)}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" /> Editar usuário
                      </button>
                      <button 
                        onClick={() => handleResetPassword(user)}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Lock className="w-4 h-4" /> Redefinir Senha
                      </button>
                      <button 
                        onClick={() => toggleUserStatus(user)}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        {user.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />} 
                        {user.active ? 'Desativar acesso' : 'Ativar acesso'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${user.active ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                  {user.name ? user.name.substring(0,2).toUpperCase() : 'US'}
                </div>
                <div className="min-w-0 pr-6">
                  <h3 className="font-bold text-slate-900 dark:text-white truncate">{user.name || 'Sem nome'}</h3>
                  <p className="text-xs text-slate-500 truncate mb-1">{user.email}</p>
                  <p className="text-[11px] text-slate-400 font-mono mb-3">@{user.username || 'username'}</p>
                  
                  <div className="flex items-center gap-2">
                    {getRoleBadge(user.role)}
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${user.active ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {user.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {users.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="font-bold text-slate-700 dark:text-slate-300">Nenhum usuário encontrado</p>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit User Modal / Bottom Sheet */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 z-[100] backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 md:top-1/2 md:bottom-auto md:-translate-y-1/2 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[100] bg-white dark:bg-slate-900 md:rounded-3xl rounded-t-3xl shadow-2xl w-full md:w-[500px] max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <h3 className="font-bold text-lg">{modalMode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-6 pb-[calc(24px+env(safe-area-inset-bottom))] space-y-5">
                {errorMsg && (
                  <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-bold uppercase tracking-wider border border-red-100 dark:border-red-900/50">
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl text-xs font-bold uppercase tracking-wider border border-emerald-100 dark:border-emerald-900/50">
                    {successMsg}
                  </div>
                )}
                
                {modalMode === 'edit' && (
                   <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 p-3 rounded-xl text-xs border border-rose-200 dark:border-rose-900/50 flex items-start gap-2">
                     <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                     <p>Para redefinir a senha do usuário, utilize a opção "Redefinir Senha" no menu de opções da lista de usuários.</p>
                   </div>
                )}

                <form onSubmit={handleSaveUser} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">E-mail</label>
                    <input
                      type="email"
                      required
                      disabled={modalMode === 'edit'}
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-rose-500 outline-none disabled:opacity-50"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Username (sem espaços)</label>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono focus:ring-2 focus:ring-rose-500 outline-none"
                      placeholder="exemplo123"
                    />
                  </div>
                  
                  {modalMode === 'create' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Senha Inicial</label>
                      <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Perfil de Acesso</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, role: 'admin'})}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-colors border ${formData.role === 'admin' ? 'bg-rose-50 border-rose-600 text-rose-700 dark:bg-rose-900/30 dark:border-rose-500 dark:text-rose-400' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}
                      >
                        Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, role: 'publisher_operator'})}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-colors border ${formData.role === 'publisher_operator' ? 'bg-emerald-50 border-emerald-600 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-500 dark:text-emerald-400' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}
                      >
                        Editora
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, role: 'viewer'})}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-colors border ${formData.role === 'viewer' ? 'bg-rose-50 border-rose-600 text-rose-700 dark:bg-rose-900/30 dark:border-rose-500 dark:text-rose-400' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}
                      >
                        Visualizador
                      </button>
                    </div>
                  </div>

                  {modalMode === 'edit' && (
                    <div className="flex items-center gap-3 pt-2">
                      <input 
                        type="checkbox" 
                        id="activeStatus" 
                        checked={formData.active}
                        onChange={(e) => setFormData({...formData, active: e.target.checked})}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                      />
                      <label htmlFor="activeStatus" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Conta Ativa (pode acessar o painel)
                      </label>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full mt-4 flex items-center justify-center gap-2 h-12 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-70 active:scale-95"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {saving ? "Salvando..." : (modalMode === 'create' ? "Criar Usuário" : "Salvar Alterações")}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
