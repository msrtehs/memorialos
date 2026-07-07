import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { createOccurrenceRecord, listOccurrenceRecords, updateSCIRecord } from '@/services/sciService';
import { severityLabel, label } from '@/lib/statusLabels';

// Permissões EFETIVAS desta versão — espelho fiel das rules pós-Onda 2 (validado em W2-11).
const effectivePermissions = [
  { module: 'Módulos SCI (operacional, financeiro, ambiental...)', manager: true, operator: true },
  { module: 'Cadastro e exclusão de falecidos', manager: true, operator: true },
  { module: 'Trilha de auditoria (audit_logs)', manager: true, operator: false },
  { module: 'Gestão de prefeituras e logins (superadmin)', manager: false, operator: false }
];

export default function SecurityPage() {
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    severity: 'medium',
    location: '',
    description: ''
  });

  const scopedEvents = useMemo(
    () =>
      events.filter(
        (item) =>
          item.category === 'security' &&
          (selectedCemeteryId === 'all' || item.cemeteryId === selectedCemeteryId)
      ),
    [events, selectedCemeteryId]
  );

  const loadEvents = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await listOccurrenceRecords(tenantId);
      setEvents(data);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar eventos de segurança.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [tenantId, selectedCemeteryId]);

  const handleCreateEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !form.title) return;
    if (selectedCemeteryId === 'all') {
      toast.error('Selecione um cemitério específico antes de registrar um incidente.');
      return;
    }
    setSaving(true);
    try {
      await createOccurrenceRecord(tenantId, {
        cemeteryId: selectedCemeteryId,
        category: 'security',
        severity: form.severity as any,
        status: 'open',
        title: form.title,
        description: form.description,
        location: form.location,
        openedAt: new Date().toISOString().slice(0, 16)
      });
      toast.success('Incidente de segurança registrado.');
      setForm({ title: '', severity: 'medium', location: '', description: '' });
      await loadEvents();
    } catch (error: any) {
      const msg = error?.code === 'permission-denied'
        ? 'Sem permissão para esta operação.'
        : error?.message || 'Erro ao registrar o incidente. Tente novamente.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (!tenantId) return;
    try {
      await updateSCIRecord(tenantId, 'sci_occurrences', id, 'UPDATE_SECURITY_EVENT', { status });
      toast.success('Incidente atualizado.');
      await loadEvents();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar o incidente.');
    }
  };

  const activeCount = scopedEvents.filter((item) => item.status !== 'resolved').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Segurança e acesso</h1>
        <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full border ${activeCount === 0 ? 'text-green-600 bg-green-50 border-green-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
          <span className={`w-2 h-2 rounded-full ${activeCount === 0 ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
          {activeCount === 0 ? 'Sem incidentes ativos' : `${activeCount} incidente(s) ativo(s)`}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Shield size={18} className="text-blue-600" /> Incidentes
            </h3>
            <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{activeCount} ativos</span>
          </div>
          <div className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
            {loading && (
              <div className="p-3 text-center text-xs text-slate-500">Carregando...</div>
            )}
            {!loading && scopedEvents.map((item) => (
              <div key={item.id} className={`p-3 rounded-lg border ${item.status === 'resolved' ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-100'}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-xs font-bold uppercase ${item.status === 'resolved' ? 'text-slate-600' : 'text-red-700'}`}>{label(severityLabel, item.severity)}</span>
                  <span className="text-[10px] text-slate-400">{item.openedAt || ''}</span>
                </div>
                <p className="text-sm font-medium text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-500 mt-1">{item.location || 'Local nao informado'}</p>
                {item.status !== 'resolved' ? (
                  <button onClick={() => updateStatus(item.id, 'resolved')} className="mt-2 text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded">
                    Resolver incidente
                  </button>
                ) : (
                  <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700">
                    <CheckCircle size={12} /> Resolvido
                  </div>
                )}
              </div>
            ))}
            {!loading && scopedEvents.length === 0 && (
              <div className="p-3 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-500">
                Sem incidentes de segurança no período.
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleCreateEvent} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Novo alerta / incidente" aria-label="Novo alerta / incidente" required />
        <input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Local" aria-label="Local" />
        <select aria-label="Severidade" value={form.severity} onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
          <option value="critical">Crítica</option>
        </select>
        <button type="submit" disabled={saving || selectedCemeteryId === 'all'} title={selectedCemeteryId === 'all' ? 'Selecione uma unidade' : undefined} className="bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">
          Registrar evento
        </button>
        <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="md:col-span-5 border border-slate-300 rounded-lg px-3 py-2 text-sm h-20" placeholder="Descrição detalhada do evento (opcional)" aria-label="Descrição detalhada do evento (opcional)" />
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-bold text-slate-800 mb-1">Permissões efetivas</h2>
        <p className="text-xs text-slate-500 mb-3">
          Espelho fiel das regras vigentes. A diferenciação fina gestor/operador está no roadmap.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-slate-700 border border-slate-200">
              <tr>
                <th className="text-left px-3 py-2">Recurso</th>
                <th className="text-center px-3 py-2">Gestor</th>
                <th className="text-center px-3 py-2">Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border border-slate-200 border-t-0">
              {effectivePermissions.map((row) => (
                <tr key={row.module} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700">{row.module}</td>
                  <td className="px-3 py-2 text-center">{row.manager ? 'OK' : '—'}</td>
                  <td className="px-3 py-2 text-center">{row.operator ? 'OK' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 text-slate-100 rounded-xl p-4 text-sm">
        <p className="flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-300 mt-0.5" />
          Acesso seguro habilitado com isolamento por tenant, criptografia em transito e trilha de auditoria em `audit_logs`.
        </p>
      </div>
    </div>
  );
}
