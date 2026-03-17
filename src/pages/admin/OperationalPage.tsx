import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, CalendarDays, ClipboardList, Clock, FileCheck2, Layers3, Plus, Shuffle, TriangleAlert, UserRoundCheck } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  createInternalNotification,
  createOccurrenceRecord,
  createOperationalRecord,
  ExhumationAlert,
  getExhumationAlerts,
  listInternalNotifications,
  listOccurrenceRecords,
  listOperationalRecords,
  updateSCIRecord
} from '@/services/sciService';

type OperationalTab =
  | 'burial'
  | 'exhumation'
  | 'schedule'
  | 'flow'
  | 'maintenance'
  | 'document_issue'
  | 'notifications'
  | 'occurrences'
  | 'exhumation_deadlines';

const tabConfig: { key: OperationalTab; label: string; icon: any }[] = [
  { key: 'burial', label: 'Sepultamentos', icon: UserRoundCheck },
  { key: 'exhumation', label: 'Exumacoes', icon: Layers3 },
  { key: 'schedule', label: 'Agendamentos', icon: CalendarDays },
  { key: 'flow', label: 'Fluxo', icon: Shuffle },
  { key: 'maintenance', label: 'Manutencao', icon: ClipboardList },
  { key: 'document_issue', label: 'Emissao docs', icon: FileCheck2 },
  { key: 'notifications', label: 'Notificacoes', icon: BellRing },
  { key: 'occurrences', label: 'Ocorrencias', icon: TriangleAlert },
  { key: 'exhumation_deadlines', label: 'Prazos exumacao', icon: Clock }
];

export default function OperationalPage() {
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();

  const [tab, setTab] = useState<OperationalTab>('burial');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [occurrences, setOccurrences] = useState<any[]>([]);

  const [recordForm, setRecordForm] = useState({
    title: '',
    description: '',
    status: 'planned',
    priority: 'medium',
    scheduledFor: new Date().toISOString().slice(0, 10),
    responsible: '',
    plotId: ''
  });

  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    audience: 'all',
    level: 'info'
  });

  const [occurrenceForm, setOccurrenceForm] = useState({
    title: '',
    category: 'operational',
    severity: 'medium',
    location: '',
    description: '',
    plotId: '',
    sectorId: '',
    slaDeadline: ''
  });
  const [exhumationAlerts, setExhumationAlerts] = useState<{ overdue: ExhumationAlert[]; approaching: ExhumationAlert[] } | null>(null);

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const cemeteryId = selectedCemeteryId === 'all' ? undefined : selectedCemeteryId;
      const [operationalData, notificationData, occurrenceData, alerts] = await Promise.all([
        listOperationalRecords(tenantId),
        listInternalNotifications(tenantId),
        listOccurrenceRecords(tenantId),
        getExhumationAlerts(tenantId, cemeteryId)
      ]);
      setRecords(operationalData);
      setNotifications(notificationData);
      setOccurrences(occurrenceData);
      setExhumationAlerts(alerts);
    } catch (error) {
      console.error('Erro ao carregar gestao operacional:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, selectedCemeteryId]);

  const scopedRecords = useMemo(
    () =>
      records.filter(
        (item) =>
          (selectedCemeteryId === 'all' || item.cemeteryId === selectedCemeteryId) &&
          item.type === tab
      ),
    [records, selectedCemeteryId, tab]
  );

  const scopedNotifications = useMemo(
    () =>
      notifications.filter(
        (item) => selectedCemeteryId === 'all' || item.cemeteryId === selectedCemeteryId
      ),
    [notifications, selectedCemeteryId]
  );

  const scopedOccurrences = useMemo(
    () =>
      occurrences.filter(
        (item) => selectedCemeteryId === 'all' || item.cemeteryId === selectedCemeteryId
      ),
    [occurrences, selectedCemeteryId]
  );

  const handleCreateRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !recordForm.title) return;
    setSaving(true);
    try {
      await createOperationalRecord(tenantId, {
        cemeteryId: selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
        type: tab as any,
        title: recordForm.title,
        description: recordForm.description,
        status: recordForm.status as any,
        priority: recordForm.priority as any,
        scheduledFor: recordForm.scheduledFor,
        responsible: recordForm.responsible,
        plotId: recordForm.plotId
      });
      setRecordForm({
        title: '',
        description: '',
        status: 'planned',
        priority: 'medium',
        scheduledFor: new Date().toISOString().slice(0, 10),
        responsible: '',
        plotId: ''
      });
      await loadData();
    } catch (error) {
      console.error('Erro ao criar registro operacional:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNotification = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !notificationForm.title || !notificationForm.message) return;
    setSaving(true);
    try {
      await createInternalNotification(tenantId, {
        cemeteryId: selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
        title: notificationForm.title,
        message: notificationForm.message,
        audience: notificationForm.audience as any,
        level: notificationForm.level as any,
        status: 'sent'
      });
      setNotificationForm({ title: '', message: '', audience: 'all', level: 'info' });
      await loadData();
    } catch (error) {
      console.error('Erro ao publicar notificacao interna:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOccurrence = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !occurrenceForm.title) return;
    setSaving(true);
    try {
      await createOccurrenceRecord(tenantId, {
        cemeteryId: selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
        category: occurrenceForm.category as any,
        severity: occurrenceForm.severity as any,
        status: 'open',
        title: occurrenceForm.title,
        description: occurrenceForm.description,
        location: occurrenceForm.location,
        openedAt: new Date().toISOString().slice(0, 16),
        plotId: occurrenceForm.plotId || undefined,
        sectorId: occurrenceForm.sectorId || undefined,
        slaDeadline: occurrenceForm.slaDeadline || undefined
      });
      setOccurrenceForm({
        title: '',
        category: 'operational',
        severity: 'medium',
        location: '',
        description: '',
        plotId: '',
        sectorId: '',
        slaDeadline: ''
      });
      await loadData();
    } catch (error) {
      console.error('Erro ao registrar ocorrencia:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (collectionName: string, id: string, status: string) => {
    if (!tenantId) return;
    try {
      await updateSCIRecord(tenantId, collectionName, id, 'UPDATE_OPERATIONAL_STATUS', { status });
      await loadData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const showOperationalForms = !['notifications', 'occurrences', 'exhumation_deadlines'].includes(tab);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gestao operacional completa</h1>
        <p className="text-sm text-slate-500">Sepultamentos, exumacoes, agendamentos, fluxo, notificacoes internas e ocorrencias.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-2 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabConfig.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${tab === item.key ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Icon size={15} /> {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {showOperationalForms && (
        <form onSubmit={handleCreateRecord} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-7 gap-3">
          <input value={recordForm.title} onChange={(e) => setRecordForm((prev) => ({ ...prev, title: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Titulo da atividade" required />
          <input value={recordForm.description} onChange={(e) => setRecordForm((prev) => ({ ...prev, description: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Descricao" />
          <input value={recordForm.responsible} onChange={(e) => setRecordForm((prev) => ({ ...prev, responsible: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Responsavel" />
          <input type="date" value={recordForm.scheduledFor} onChange={(e) => setRecordForm((prev) => ({ ...prev, scheduledFor: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <select value={recordForm.priority} onChange={(e) => setRecordForm((prev) => ({ ...prev, priority: e.target.value }))} className="border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white">
              <option value="low">Baixa</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Critica</option>
            </select>
            <button type="submit" disabled={saving} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1">
              <Plus size={14} /> Add
            </button>
          </div>
        </form>
      )}

      {tab === 'notifications' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateNotification} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <input value={notificationForm.title} onChange={(e) => setNotificationForm((prev) => ({ ...prev, title: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Titulo da notificacao" required />
            <select value={notificationForm.audience} onChange={(e) => setNotificationForm((prev) => ({ ...prev, audience: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="all">Todos</option>
              <option value="operators">Operadores</option>
              <option value="environmental">Equipe ambiental</option>
              <option value="security">Seguranca</option>
              <option value="management">Gestao</option>
            </select>
            <select value={notificationForm.level} onChange={(e) => setNotificationForm((prev) => ({ ...prev, level: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <button type="submit" disabled={saving} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              Publicar
            </button>
            <textarea value={notificationForm.message} onChange={(e) => setNotificationForm((prev) => ({ ...prev, message: e.target.value }))} className="md:col-span-6 border border-slate-300 rounded-lg px-3 py-2 text-sm h-24" placeholder="Mensagem interna" required />
          </form>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Titulo</th>
                  <th className="px-4 py-3">Publico</th>
                  <th className="px-4 py-3">Nivel</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopedNotifications.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                    <td className="px-4 py-3 text-slate-600">{item.audience}</td>
                    <td className="px-4 py-3 text-slate-600">{item.level}</td>
                    <td className="px-4 py-3">
                      <select value={item.status} onChange={(e) => handleStatusUpdate('sci_internal_notifications', item.id, e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                        <option value="draft">draft</option>
                        <option value="sent">sent</option>
                        <option value="archived">archived</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {!loading && scopedNotifications.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Sem notificacoes internas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'occurrences' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateOccurrence} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <input value={occurrenceForm.title} onChange={(e) => setOccurrenceForm((prev) => ({ ...prev, title: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Titulo da ocorrencia" required />
            <select value={occurrenceForm.category} onChange={(e) => setOccurrenceForm((prev) => ({ ...prev, category: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="operational">Operacional</option>
              <option value="structural">Estrutural</option>
              <option value="sanitary">Sanitario</option>
              <option value="environmental">Ambiental</option>
              <option value="security">Seguranca</option>
              <option value="cleaning">Limpeza</option>
              <option value="lighting">Iluminacao</option>
              <option value="vegetation">Vegetacao</option>
            </select>
            <select value={occurrenceForm.severity} onChange={(e) => setOccurrenceForm((prev) => ({ ...prev, severity: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="low">Baixa</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Critica</option>
            </select>
            <input value={occurrenceForm.location} onChange={(e) => setOccurrenceForm((prev) => ({ ...prev, location: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Local" />
            <button type="submit" disabled={saving} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              Registrar
            </button>
            <input value={occurrenceForm.plotId} onChange={(e) => setOccurrenceForm((prev) => ({ ...prev, plotId: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="ID do jazigo (opcional)" />
            <input value={occurrenceForm.sectorId} onChange={(e) => setOccurrenceForm((prev) => ({ ...prev, sectorId: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Setor (opcional)" />
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Prazo SLA</label>
              <input type="date" value={occurrenceForm.slaDeadline} onChange={(e) => setOccurrenceForm((prev) => ({ ...prev, slaDeadline: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <textarea value={occurrenceForm.description} onChange={(e) => setOccurrenceForm((prev) => ({ ...prev, description: e.target.value }))} className="md:col-span-6 border border-slate-300 rounded-lg px-3 py-2 text-sm h-24" placeholder="Descricao detalhada" />
          </form>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Titulo</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Severidade</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Prazo SLA</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopedOccurrences.map((item) => {
                  const sla = item.slaDeadline;
                  const slaClass = !sla ? '' : sla < today ? 'bg-rose-100 text-rose-700 border-rose-200' : (new Date(sla).getTime() - Date.now()) / 86400000 <= 3 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200';
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                      <td className="px-4 py-3 text-slate-600">{item.category}</td>
                      <td className="px-4 py-3 text-slate-600">{item.severity}</td>
                      <td className="px-4 py-3 text-slate-600">{item.location || '-'}</td>
                      <td className="px-4 py-3 text-xs">
                        {sla ? (
                          <span className={`px-2 py-1 rounded-full border ${slaClass}`}>{sla}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <select value={item.status} onChange={(e) => handleStatusUpdate('sci_occurrences', item.id, e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                          <option value="open">open</option>
                          <option value="in_analysis">in_analysis</option>
                          <option value="resolved">resolved</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
                {!loading && scopedOccurrences.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Sem ocorrencias registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'exhumation_deadlines' && (
        <div className="space-y-6">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <h3 className="font-semibold text-rose-800 mb-3 flex items-center gap-2"><Clock size={16} /> Prazos vencidos</h3>
            {exhumationAlerts?.overdue.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm text-left">
                  <thead className="text-rose-700">
                    <tr>
                      <th className="px-3 py-2">Jazigo</th>
                      <th className="px-3 py-2">Setor</th>
                      <th className="px-3 py-2">Sepultamento</th>
                      <th className="px-3 py-2">Prazo limite</th>
                      <th className="px-3 py-2">Dias em atraso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100">
                    {exhumationAlerts.overdue.map((a) => (
                      <tr key={a.plotId}>
                        <td className="px-3 py-2 font-medium text-slate-900">{a.plotCode}</td>
                        <td className="px-3 py-2 text-slate-600">{a.sectorName}</td>
                        <td className="px-3 py-2 text-slate-600">{a.burialDate}</td>
                        <td className="px-3 py-2 text-slate-600">{a.deadlineDate}</td>
                        <td className="px-3 py-2 font-semibold text-rose-700">{Math.abs(a.daysRemaining)} dias</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-rose-700">Nenhum prazo vencido.</p>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2"><Clock size={16} /> Proximos 6 meses</h3>
            {exhumationAlerts?.approaching.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm text-left">
                  <thead className="text-amber-700">
                    <tr>
                      <th className="px-3 py-2">Jazigo</th>
                      <th className="px-3 py-2">Setor</th>
                      <th className="px-3 py-2">Sepultamento</th>
                      <th className="px-3 py-2">Prazo limite</th>
                      <th className="px-3 py-2">Dias restantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {exhumationAlerts.approaching.map((a) => (
                      <tr key={a.plotId}>
                        <td className="px-3 py-2 font-medium text-slate-900">{a.plotCode}</td>
                        <td className="px-3 py-2 text-slate-600">{a.sectorName}</td>
                        <td className="px-3 py-2 text-slate-600">{a.burialDate}</td>
                        <td className="px-3 py-2 text-slate-600">{a.deadlineDate}</td>
                        <td className="px-3 py-2 font-semibold text-amber-700">{a.daysRemaining} dias</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-amber-700">Nenhuma exumacao proxima do prazo nos proximos 6 meses.</p>
            )}
          </div>
        </div>
      )}

      {showOperationalForms && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
              <tr>
                <th className="px-4 py-3">Titulo</th>
                <th className="px-4 py-3">Responsavel</th>
                <th className="px-4 py-3">Agendado</th>
                <th className="px-4 py-3">Prioridade</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scopedRecords.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                  <td className="px-4 py-3 text-slate-600">{item.responsible || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.scheduledFor || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.priority}</td>
                  <td className="px-4 py-3">
                    <select value={item.status} onChange={(e) => handleStatusUpdate('sci_operational_records', item.id, e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                      <option value="planned">planned</option>
                      <option value="in_progress">in_progress</option>
                      <option value="done">done</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
              {!loading && scopedRecords.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Sem registros para esta etapa operacional.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
