import React, { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  createManagerAccount,
  toggleManagerStatus,
  deleteManagerAccount,
} from '@/services/superadminService';
import { Building2, Plus, LogOut, Trash2, ToggleLeft, ToggleRight, Shield } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  active: boolean;
  managerEmail: string;
  managerUid: string;
  createdAt: any;
}

export default function SuperAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    prefectureName: '',
    managerEmail: '',
    temporaryPassword: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  useEffect(() => {
    loadTenants();
  }, []);

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await createManagerAccount(formData);
      setFormData({ prefectureName: '', managerEmail: '', temporaryPassword: '' });
      setShowForm(false);
      await loadTenants();
    } catch (error: any) {
      setFormError(error?.message || 'Erro ao criar prefeitura. Verifique os dados e tente novamente.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    setActionLoading(tenant.id);
    try {
      await toggleManagerStatus({ managerUid: tenant.managerUid, disabled: tenant.active });
      await loadTenants();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (tenant: Tenant) => {
    if (!window.confirm(`Excluir a prefeitura "${tenant.name}"?\n\nEsta ação removerá o gestor e todos os dados do tenant. Não pode ser desfeita.`)) return;
    setActionLoading(tenant.id);
    try {
      await deleteManagerAccount({ managerUid: tenant.managerUid, tenantId: tenant.id });
      await loadTenants();
    } catch (error: any) {
      console.error('Erro ao excluir prefeitura:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
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
        {/* Page title + action */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Prefeituras</h2>
            <p className="text-slate-500 text-sm mt-1">Gerencie gestores e prefeituras do sistema</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setFormError(''); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus size={16} />
            Nova Prefeitura
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Criar Nova Prefeitura</h3>
            <form onSubmit={handleCreateManager} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nome da Prefeitura
                  </label>
                  <input
                    type="text"
                    value={formData.prefectureName}
                    onChange={(e) => setFormData((p) => ({ ...p, prefectureName: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Ex: Prefeitura de São Paulo"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email do Gestor
                  </label>
                  <input
                    type="email"
                    value={formData.managerEmail}
                    onChange={(e) => setFormData((p) => ({ ...p, managerEmail: e.target.value }))}
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
                    value={formData.temporaryPassword}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, temporaryPassword: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{formError}</div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formLoading ? 'Criando...' : 'Criar Prefeitura'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormError(''); }}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-600"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tenants list */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
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
                <div
                  key={tenant.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                >
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
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        tenant.active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {tenant.active ? 'Ativo' : 'Inativo'}
                    </span>

                    <button
                      onClick={() => handleToggleStatus(tenant)}
                      disabled={actionLoading === tenant.id}
                      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-40"
                      title={tenant.active ? 'Desativar gestor' : 'Ativar gestor'}
                    >
                      {tenant.active ? (
                        <ToggleRight size={16} />
                      ) : (
                        <ToggleLeft size={16} />
                      )}
                      <span className="hidden sm:inline">
                        {tenant.active ? 'Desativar' : 'Ativar'}
                      </span>
                    </button>

                    <button
                      onClick={() => handleDelete(tenant)}
                      disabled={actionLoading === tenant.id}
                      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                      title="Excluir prefeitura"
                    >
                      <Trash2 size={16} />
                      <span className="hidden sm:inline">Excluir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
