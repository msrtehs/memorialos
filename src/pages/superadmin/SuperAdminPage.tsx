import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  createManagerAccount,
  toggleManagerStatus,
  deleteManagerAccount,
  addUserToTenant,
  disableTenantUser,
  deleteTenantUser,
} from '@/services/superadminService';
import {
  Building2,
  Plus,
  LogOut,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Shield,
  Users,
  ChevronDown,
  ChevronUp,
  UserPlus,
  X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  active: boolean;
  managerEmail: string;
  managerUid: string;
  createdAt: any;
}

interface TenantUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  active: boolean;
  createdAt: any;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tenant list state
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Create-tenant form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createData, setCreateData] = useState({
    prefectureName: '',
    managerEmail: '',
    temporaryPassword: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Tenant-level action state (toggle / delete whole tenant)
  const [tenantActionLoading, setTenantActionLoading] = useState<string | null>(null);

  // Per-tenant user management state
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Add-user-to-tenant form state
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [addUserData, setAddUserData] = useState({ email: '', password: '' });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState('');

  // Per-user action loading
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null);

  // ─── Data loading ───────────────────────────────────────────────────────────

  const loadTenants = async () => {
    try {
      const q = query(collection(db, 'tenants'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Tenant[];
      setTenants(data);
    } catch (error) {
      console.error('Erro ao carregar prefeituras:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsersForTenant = async (tenantId: string) => {
    setLoadingUsers(true);
    setTenantUsers([]);
    try {
      const q = query(
        collection(db, 'profiles'),
        where('tenantId', '==', tenantId),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TenantUser[];
      setTenantUsers(data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  // ─── Tenant handlers ────────────────────────────────────────────────────────

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    try {
      await createManagerAccount(createData);
      setCreateData({ prefectureName: '', managerEmail: '', temporaryPassword: '' });
      setShowCreateForm(false);
      await loadTenants();
    } catch (error: any) {
      setCreateError(error?.message || 'Erro ao criar prefeitura. Verifique os dados e tente novamente.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleTenant = async (tenant: Tenant) => {
    setTenantActionLoading(tenant.id);
    try {
      await toggleManagerStatus({ managerUid: tenant.managerUid, disabled: tenant.active });
      await loadTenants();
      // Refresh users if this tenant is expanded
      if (expandedTenantId === tenant.id) {
        await loadUsersForTenant(tenant.id);
      }
    } catch (error: any) {
      console.error('Erro ao alterar status da prefeitura:', error);
    } finally {
      setTenantActionLoading(null);
    }
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (
      !window.confirm(
        `Excluir a prefeitura "${tenant.name}"?\n\nTodos os logins e dados do tenant serão removidos permanentemente.`,
      )
    )
      return;
    setTenantActionLoading(tenant.id);
    try {
      await deleteManagerAccount({ managerUid: tenant.managerUid, tenantId: tenant.id });
      if (expandedTenantId === tenant.id) setExpandedTenantId(null);
      await loadTenants();
    } catch (error: any) {
      console.error('Erro ao excluir prefeitura:', error);
    } finally {
      setTenantActionLoading(null);
    }
  };

  // ─── User expansion handler ─────────────────────────────────────────────────

  const handleToggleExpand = async (tenantId: string) => {
    if (expandedTenantId === tenantId) {
      setExpandedTenantId(null);
      setShowAddUserForm(false);
      setAddUserData({ email: '', password: '' });
      setAddUserError('');
    } else {
      setExpandedTenantId(tenantId);
      setShowAddUserForm(false);
      setAddUserData({ email: '', password: '' });
      setAddUserError('');
      await loadUsersForTenant(tenantId);
    }
  };

  // ─── Per-user handlers ──────────────────────────────────────────────────────

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedTenantId) return;
    setAddUserLoading(true);
    setAddUserError('');
    try {
      await addUserToTenant({
        tenantId: expandedTenantId,
        email: addUserData.email,
        password: addUserData.password,
      });
      setAddUserData({ email: '', password: '' });
      setShowAddUserForm(false);
      await loadUsersForTenant(expandedTenantId);
    } catch (error: any) {
      setAddUserError(error?.message || 'Erro ao adicionar usuário.');
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleToggleUser = async (u: TenantUser) => {
    setUserActionLoading(u.id);
    try {
      await disableTenantUser({ uid: u.id, disabled: u.active });
      if (expandedTenantId) await loadUsersForTenant(expandedTenantId);
    } catch (error: any) {
      console.error('Erro ao alterar status do usuário:', error);
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleDeleteUser = async (u: TenantUser) => {
    if (!window.confirm(`Excluir o login "${u.email}"?\n\nEsta ação não pode ser desfeita.`)) return;
    setUserActionLoading(u.id);
    try {
      await deleteTenantUser({ uid: u.id });
      if (expandedTenantId) await loadUsersForTenant(expandedTenantId);
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
    } finally {
      setUserActionLoading(null);
    }
  };

  // ─── Logout ─────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">MemorialOS</h1>
              <p className="text-xs text-slate-400">Painel SuperAdmin</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:block">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors"
            >
              <LogOut size={15} />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* ── Page title + action ── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Prefeituras</h2>
            <p className="text-slate-500 text-sm mt-1">
              Gerencie prefeituras e logins do sistema
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setCreateError('');
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus size={16} />
            Nova Prefeitura
          </button>
        </div>

        {/* ── Create-tenant form ── */}
        {showCreateForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 mb-4">
              Criar Nova Prefeitura
            </h3>
            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nome da Prefeitura
                  </label>
                  <input
                    type="text"
                    value={createData.prefectureName}
                    onChange={(e) =>
                      setCreateData((p) => ({ ...p, prefectureName: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Ex: Prefeitura de São Paulo"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email do Gestor Principal
                  </label>
                  <input
                    type="email"
                    value={createData.managerEmail}
                    onChange={(e) =>
                      setCreateData((p) => ({ ...p, managerEmail: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="gestor@prefeitura.gov.br"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Senha Provisória
                  </label>
                  <input
                    type="password"
                    value={createData.temporaryPassword}
                    onChange={(e) =>
                      setCreateData((p) => ({ ...p, temporaryPassword: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              {createError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                  {createError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createLoading ? 'Criando...' : 'Criar Prefeitura'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateError('');
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-600"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tenants list ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Carregando...</div>
          ) : tenants.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium">Nenhuma prefeitura cadastrada</p>
              <p className="text-slate-400 text-sm mt-1">
                Clique em &quot;Nova Prefeitura&quot; para começar
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tenants.map((tenant) => (
                <div key={tenant.id}>
                  {/* ── Tenant row ── */}
                  <div className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 size={18} className="text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{tenant.name}</p>
                        <p className="text-sm text-slate-500 truncate">{tenant.managerEmail}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {/* Status badge */}
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          tenant.active
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {tenant.active ? 'Ativo' : 'Inativo'}
                      </span>

                      {/* Show/hide users */}
                      <button
                        onClick={() => handleToggleExpand(tenant.id)}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Ver usuários"
                      >
                        <Users size={15} />
                        <span className="hidden sm:inline">Usuários</span>
                        {expandedTenantId === tenant.id ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>

                      {/* Toggle whole tenant */}
                      <button
                        onClick={() => handleToggleTenant(tenant)}
                        disabled={tenantActionLoading === tenant.id}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-40"
                        title={tenant.active ? 'Desativar prefeitura' : 'Ativar prefeitura'}
                      >
                        {tenant.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        <span className="hidden sm:inline">
                          {tenant.active ? 'Desativar' : 'Ativar'}
                        </span>
                      </button>

                      {/* Delete whole tenant */}
                      <button
                        onClick={() => handleDeleteTenant(tenant)}
                        disabled={tenantActionLoading === tenant.id}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                        title="Excluir prefeitura e todos os logins"
                      >
                        <Trash2 size={16} />
                        <span className="hidden sm:inline">Excluir</span>
                      </button>
                    </div>
                  </div>

                  {/* ── Expanded: users panel ── */}
                  {expandedTenantId === tenant.id && (
                    <div className="bg-slate-50 border-t border-slate-100 px-6 py-4">
                      {/* Users panel header */}
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-slate-700">
                          Logins da Prefeitura
                        </p>
                        <button
                          onClick={() => {
                            setShowAddUserForm(!showAddUserForm);
                            setAddUserError('');
                            setAddUserData({ email: '', password: '' });
                          }}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <UserPlus size={13} />
                          Adicionar Login
                        </button>
                      </div>

                      {/* Add user inline form */}
                      {showAddUserForm && (
                        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-slate-700">
                              Novo login para {tenant.name}
                            </p>
                            <button
                              onClick={() => {
                                setShowAddUserForm(false);
                                setAddUserError('');
                              }}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X size={15} />
                            </button>
                          </div>
                          <form onSubmit={handleAddUser} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                  Email
                                </label>
                                <input
                                  type="email"
                                  value={addUserData.email}
                                  onChange={(e) =>
                                    setAddUserData((p) => ({ ...p, email: e.target.value }))
                                  }
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                  placeholder="gestor2@prefeitura.gov.br"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                  Senha provisória
                                </label>
                                <input
                                  type="password"
                                  value={addUserData.password}
                                  onChange={(e) =>
                                    setAddUserData((p) => ({ ...p, password: e.target.value }))
                                  }
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                  placeholder="Mínimo 6 caracteres"
                                  minLength={6}
                                  required
                                />
                              </div>
                            </div>
                            {addUserError && (
                              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                                {addUserError}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={addUserLoading}
                                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                              >
                                {addUserLoading ? 'Criando...' : 'Criar Login'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAddUserForm(false);
                                  setAddUserError('');
                                }}
                                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {/* Users list */}
                      {loadingUsers ? (
                        <p className="text-sm text-slate-400 py-4 text-center">
                          Carregando usuários...
                        </p>
                      ) : tenantUsers.length === 0 ? (
                        <p className="text-sm text-slate-400 py-4 text-center">
                          Nenhum login encontrado
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {tenantUsers.map((u) => (
                            <div
                              key={u.id}
                              className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Users size={14} className="text-slate-500" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-800 truncate">
                                    {u.email}
                                  </p>
                                  <p className="text-xs text-slate-400">{u.role}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <span
                                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                    u.active
                                      ? 'bg-green-50 text-green-700'
                                      : 'bg-red-50 text-red-600'
                                  }`}
                                >
                                  {u.active ? 'Ativo' : 'Inativo'}
                                </span>

                                <button
                                  onClick={() => handleToggleUser(u)}
                                  disabled={userActionLoading === u.id}
                                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-40"
                                  title={u.active ? 'Desativar login' : 'Ativar login'}
                                >
                                  {u.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                  <span className="hidden sm:inline">
                                    {u.active ? 'Desativar' : 'Ativar'}
                                  </span>
                                </button>

                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  disabled={userActionLoading === u.id}
                                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                                  title="Excluir este login"
                                >
                                  <Trash2 size={14} />
                                  <span className="hidden sm:inline">Excluir</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
