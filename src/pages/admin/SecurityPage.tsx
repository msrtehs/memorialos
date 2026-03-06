import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Eye, Shield, Video } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { createOccurrenceRecord, listOccurrenceRecords, updateSCIRecord } from '@/services/sciService';

const permissionMatrix = [
  { module: 'Dashboard executivo', gestor: true, operador: true, auditor: true },
  { module: 'Cadastro de falecidos', gestor: true, operador: true, auditor: false },
  { module: 'Inventario georreferenciado', gestor: true, operador: true, auditor: true },
  { module: 'Financeiro', gestor: true, operador: false, auditor: true },
  { module: 'Relatorios juridicos', gestor: true, operador: false, auditor: true },
  { module: 'Gestao de usuarios', gestor: true, operador: false, auditor: false }
];

export default function SecurityPage() {
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();
  const [events, setEvents] = useState<any[]>([]);
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
    try {
      const data = await listOccurrenceRecords(tenantId);
      setEvents(data);
    } catch (error) {
      console.error('Erro ao carregar eventos de seguranca:', error);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [tenantId, selectedCemeteryId]);

  const handleCreateEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !form.title) return;
    setSaving(true);
    try {
      await createOccurrenceRecord(tenantId, {
        cemeteryId: selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
        category: 'security',
        severity: form.severity as any,
        status: 'open',
        title: form.title,
        description: form.description,
        location: form.location,
        openedAt: new Date().toISOString().slice(0, 16)
      });
      setForm({ title: '', severity: 'medium', location: '', description: '' });
      await loadEvents();
    } catch (error) {
      console.error('Erro ao registrar evento de seguranca:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (!tenantId) return;
    try {
      await updateSCIRecord(tenantId, 'sci_occurrences', id, 'UPDATE_SECURITY_EVENT', { status });
      await loadEvents();
    } catch (error) {
      console.error('Erro ao atualizar incidente de seguranca:', error);
    }
  };

  const activeCount = scopedEvents.filter((item) => item.status !== 'resolved').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Seguranca e acesso</h1>
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Ambiente seguro ativo
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-black rounded-xl overflow-hidden shadow-lg relative aspect-video group">
          <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1 z-10">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span> AO VIVO
          </div>
          <div className="absolute top-4 right-4 text-white/70 text-xs font-mono z-10">CAM-SEC-01</div>
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-900">
            <Video size={46} className="mb-2 opacity-50" />
            <p className="text-sm font-mono">Monitoramento central de acesso</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="text-white text-sm font-medium">Portao principal</div>
            <button className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg backdrop-blur-sm transition-colors">
              <Eye size={18} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Shield size={18} className="text-blue-600" /> Incidentes
            </h3>
            <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{activeCount} ativos</span>
          </div>
          <div className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
            {scopedEvents.map((item) => (
              <div key={item.id} className={`p-3 rounded-lg border ${item.status === 'resolved' ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-100'}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-xs font-bold uppercase ${item.status === 'resolved' ? 'text-slate-600' : 'text-red-700'}`}>{item.severity}</span>
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
            {scopedEvents.length === 0 && (
              <div className="p-3 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-500">
                Sem incidentes de seguranca no periodo.
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleCreateEvent} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Novo alerta / incidente" required />
        <input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Local" />
        <select value={form.severity} onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="low">Baixa</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
          <option value="critical">Critica</option>
        </select>
        <button type="submit" disabled={saving} className="bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
          Registrar evento
        </button>
        <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="md:col-span-5 border border-slate-300 rounded-lg px-3 py-2 text-sm h-20" placeholder="Descricao detalhada do evento (opcional)" />
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-bold text-slate-800 mb-3">Controle de permissoes</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-slate-50 text-slate-700 border border-slate-200">
              <tr>
                <th className="text-left px-3 py-2">Modulo</th>
                <th className="text-center px-3 py-2">Gestor</th>
                <th className="text-center px-3 py-2">Operador</th>
                <th className="text-center px-3 py-2">Auditor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border border-slate-200 border-t-0">
              {permissionMatrix.map((row) => (
                <tr key={row.module} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700">{row.module}</td>
                  <td className="px-3 py-2 text-center">{row.gestor ? 'OK' : '-'}</td>
                  <td className="px-3 py-2 text-center">{row.operador ? 'OK' : '-'}</td>
                  <td className="px-3 py-2 text-center">{row.auditor ? 'OK' : '-'}</td>
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
