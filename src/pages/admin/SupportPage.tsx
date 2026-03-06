import React, { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, LifeBuoy, Plus } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  createSupportTicket,
  createTrainingSession,
  listSupportTickets,
  listTrainingSessions,
  updateSCIRecord
} from '@/services/sciService';

type Tab = 'support' | 'training';

export default function SupportPage() {
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();
  const [tab, setTab] = useState<Tab>('support');
  const [tickets, setTickets] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [ticketForm, setTicketForm] = useState({
    title: '',
    category: 'support',
    priority: 'medium',
    details: ''
  });

  const [trainingForm, setTrainingForm] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    modality: 'online',
    targetAudience: '',
    notes: ''
  });

  const scopedTickets = useMemo(
    () => tickets.filter((ticket) => selectedCemeteryId === 'all' || ticket.cemeteryId === selectedCemeteryId),
    [tickets, selectedCemeteryId]
  );
  const scopedSessions = useMemo(
    () => sessions.filter((session) => selectedCemeteryId === 'all' || session.cemeteryId === selectedCemeteryId),
    [sessions, selectedCemeteryId]
  );

  const loadData = async () => {
    if (!tenantId) return;
    try {
      const [ticketData, trainingData] = await Promise.all([
        listSupportTickets(tenantId),
        listTrainingSessions(tenantId)
      ]);
      setTickets(ticketData);
      setSessions(trainingData);
    } catch (error) {
      console.error('Erro ao carregar suporte/treinamento:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, selectedCemeteryId]);

  const handleCreateTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !ticketForm.title || !ticketForm.details) return;
    setSaving(true);
    try {
      await createSupportTicket(tenantId, {
        cemeteryId: selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
        title: ticketForm.title,
        category: ticketForm.category as any,
        priority: ticketForm.priority as any,
        status: 'open',
        details: ticketForm.details
      });
      setTicketForm({ title: '', category: 'support', priority: 'medium', details: '' });
      await loadData();
    } catch (error) {
      console.error('Erro ao abrir ticket de suporte:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTraining = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !trainingForm.title || !trainingForm.targetAudience) return;
    setSaving(true);
    try {
      await createTrainingSession(tenantId, {
        cemeteryId: selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
        title: trainingForm.title,
        date: trainingForm.date,
        modality: trainingForm.modality as any,
        targetAudience: trainingForm.targetAudience,
        status: 'planned',
        notes: trainingForm.notes || undefined
      });
      setTrainingForm({
        title: '',
        date: new Date().toISOString().slice(0, 10),
        modality: 'online',
        targetAudience: '',
        notes: ''
      });
      await loadData();
    } catch (error) {
      console.error('Erro ao registrar treinamento:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (collectionName: string, id: string, status: string) => {
    if (!tenantId) return;
    try {
      await updateSCIRecord(tenantId, collectionName, id, 'UPDATE_SUPPORT_STATUS', { status });
      await loadData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Suporte e treinamento</h1>
        <p className="text-sm text-slate-500">Central de chamados e agenda de capacitacao para equipes da prefeitura.</p>
      </div>

      <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1 w-fit">
        <button onClick={() => setTab('support')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${tab === 'support' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
          <LifeBuoy size={15} /> Suporte
        </button>
        <button onClick={() => setTab('training')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${tab === 'training' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
          <BookOpenCheck size={15} /> Treinamento
        </button>
      </div>

      {tab === 'support' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateTicket} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <input value={ticketForm.title} onChange={(e) => setTicketForm((prev) => ({ ...prev, title: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Titulo do chamado" required />
            <select value={ticketForm.category} onChange={(e) => setTicketForm((prev) => ({ ...prev, category: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="support">Suporte tecnico</option>
              <option value="training">Dificuldade de uso</option>
            </select>
            <select value={ticketForm.priority} onChange={(e) => setTicketForm((prev) => ({ ...prev, priority: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="low">Baixa</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Critica</option>
            </select>
            <button type="submit" disabled={saving} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1">
              <Plus size={14} /> Abrir chamado
            </button>
            <textarea value={ticketForm.details} onChange={(e) => setTicketForm((prev) => ({ ...prev, details: e.target.value }))} className="md:col-span-6 border border-slate-300 rounded-lg px-3 py-2 text-sm h-24" placeholder="Descreva o problema ou necessidade de suporte" required />
          </form>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Chamado</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopedTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{ticket.title}</td>
                    <td className="px-4 py-3 text-slate-600">{ticket.category}</td>
                    <td className="px-4 py-3 text-slate-600">{ticket.priority}</td>
                    <td className="px-4 py-3">
                      <select value={ticket.status} onChange={(e) => updateStatus('sci_support_tickets', ticket.id, e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                        <option value="open">open</option>
                        <option value="in_progress">in_progress</option>
                        <option value="done">done</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {scopedTickets.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Nenhum chamado aberto.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'training' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateTraining} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <input value={trainingForm.title} onChange={(e) => setTrainingForm((prev) => ({ ...prev, title: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Titulo do treinamento" required />
            <input type="date" value={trainingForm.date} onChange={(e) => setTrainingForm((prev) => ({ ...prev, date: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <select value={trainingForm.modality} onChange={(e) => setTrainingForm((prev) => ({ ...prev, modality: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="online">Online</option>
              <option value="presencial">Presencial</option>
            </select>
            <input value={trainingForm.targetAudience} onChange={(e) => setTrainingForm((prev) => ({ ...prev, targetAudience: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Publico-alvo" required />
            <button type="submit" disabled={saving} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1">
              <Plus size={14} /> Agendar
            </button>
            <textarea value={trainingForm.notes} onChange={(e) => setTrainingForm((prev) => ({ ...prev, notes: e.target.value }))} className="md:col-span-6 border border-slate-300 rounded-lg px-3 py-2 text-sm h-24" placeholder="Conteudo programatico / observacoes" />
          </form>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Treinamento</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Modalidade</th>
                  <th className="px-4 py-3">Publico</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopedSessions.map((session) => (
                  <tr key={session.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{session.title}</td>
                    <td className="px-4 py-3 text-slate-600">{session.date}</td>
                    <td className="px-4 py-3 text-slate-600">{session.modality}</td>
                    <td className="px-4 py-3 text-slate-600">{session.targetAudience}</td>
                    <td className="px-4 py-3">
                      <select value={session.status} onChange={(e) => updateStatus('sci_training_sessions', session.id, e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                        <option value="planned">planned</option>
                        <option value="completed">completed</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {scopedSessions.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhuma sessao de treinamento cadastrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
