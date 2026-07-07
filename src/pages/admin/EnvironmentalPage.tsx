import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { reportLoadError } from '@/lib/errors';
import { checkStatusLabel, riskLevelLabel, label } from '@/lib/statusLabels';
import { AlertTriangle, CheckCircle2, Leaf, Plus, ShieldAlert } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  createEnvironmentalCheck,
  createSanitaryCheck,
  getSciExecutiveSnapshot,
  listEnvironmentalChecks,
  listSanitaryChecks,
  updateSCIRecord,
  SciExecutiveSnapshot
} from '@/services/sciService';

type TabMode = 'sanitary' | 'environmental' | 'risk';

export default function EnvironmentalPage() {
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();

  const [tab, setTab] = useState<TabMode>('sanitary');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sanitaryChecks, setSanitaryChecks] = useState<any[]>([]);
  const [environmentalChecks, setEnvironmentalChecks] = useState<any[]>([]);
  const [snapshot, setSnapshot] = useState<SciExecutiveSnapshot | null>(null);

  const [sanitaryForm, setSanitaryForm] = useState({
    area: '',
    indicator: '',
    riskLevel: 'low',
    findings: '',
    recommendation: '',
    inspector: ''
  });

  const [environmentForm, setEnvironmentForm] = useState({
    area: '',
    indicator: '',
    riskLevel: 'low',
    findings: '',
    recommendation: '',
    inspector: ''
  });

  const scopedSanitaryChecks = useMemo(
    () => sanitaryChecks.filter((item) => selectedCemeteryId === 'all' || item.cemeteryId === selectedCemeteryId),
    [sanitaryChecks, selectedCemeteryId]
  );

  const scopedEnvironmentalChecks = useMemo(
    () => environmentalChecks.filter((item) => selectedCemeteryId === 'all' || item.cemeteryId === selectedCemeteryId),
    [environmentalChecks, selectedCemeteryId]
  );

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [sanitary, environmental, executive] = await Promise.all([
        listSanitaryChecks(tenantId),
        listEnvironmentalChecks(tenantId),
        getSciExecutiveSnapshot(tenantId, selectedCemeteryId)
      ]);
      setSanitaryChecks(sanitary);
      setEnvironmentalChecks(environmental);
      setSnapshot(executive);
    } catch (error) {
      reportLoadError('EnvironmentalPage.load', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, selectedCemeteryId]);

  const handleCreateSanitaryCheck = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId) return;
    if (selectedCemeteryId === 'all') {
      toast.error('Selecione um cemitério específico antes de criar um registro.');
      return;
    }
    setSaving(true);
    try {
      await createSanitaryCheck(tenantId, {
        cemeteryId: selectedCemeteryId,
        area: sanitaryForm.area,
        indicator: sanitaryForm.indicator,
        riskLevel: sanitaryForm.riskLevel as any,
        findings: sanitaryForm.findings,
        recommendation: sanitaryForm.recommendation,
        status: 'open',
        inspectedAt: new Date().toISOString().slice(0, 10),
        inspector: sanitaryForm.inspector
      });
      toast.success('Checklist sanitário registrado.');
      setSanitaryForm({ area: '', indicator: '', riskLevel: 'low', findings: '', recommendation: '', inspector: '' });
      await loadData();
    } catch (error: any) {
      const msg = error?.code === 'permission-denied'
        ? 'Sem permissão para esta operação.'
        : error?.message || 'Erro ao salvar. Tente novamente.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEnvironmentalCheck = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId) return;
    if (selectedCemeteryId === 'all') {
      toast.error('Selecione um cemitério específico antes de criar um registro.');
      return;
    }
    setSaving(true);
    try {
      await createEnvironmentalCheck(tenantId, {
        cemeteryId: selectedCemeteryId,
        area: environmentForm.area,
        indicator: environmentForm.indicator,
        riskLevel: environmentForm.riskLevel as any,
        findings: environmentForm.findings,
        recommendation: environmentForm.recommendation,
        status: 'open',
        inspectedAt: new Date().toISOString().slice(0, 10),
        inspector: environmentForm.inspector
      });
      toast.success('Checklist ambiental registrado.');
      setEnvironmentForm({ area: '', indicator: '', riskLevel: 'low', findings: '', recommendation: '', inspector: '' });
      await loadData();
    } catch (error: any) {
      const msg = error?.code === 'permission-denied'
        ? 'Sem permissão para esta operação.'
        : error?.message || 'Erro ao salvar. Tente novamente.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (collectionName: string, id: string, status: string) => {
    if (!tenantId) return;
    try {
      await updateSCIRecord(tenantId, collectionName, id, 'UPDATE_CHECK_STATUS', { status });
      toast.success('Status atualizado.');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar status de risco.');
    }
  };

  const riskCards = [
    {
      title: 'Risco sanitário',
      value: snapshot?.sanitaryAlerts || 0,
      detail: 'Alertas em aberto com impacto em saúde pública',
      tone: 'bg-amber-50 border-amber-200 text-amber-800'
    },
    {
      title: 'Risco ambiental',
      value: snapshot?.environmentalAlerts || 0,
      detail: 'Eventos ambientais exigindo mitigação',
      tone: 'bg-emerald-50 border-emerald-200 text-emerald-800'
    },
    {
      title: 'Falhas estruturais',
      value: snapshot?.structuralFailures || 0,
      detail: 'Ocorrências com prioridade de intervenção',
      tone: 'bg-rose-50 border-rose-200 text-rose-800'
    },
    {
      title: 'Pendências documentais',
      value: snapshot?.pendingDocuments || 0,
      detail: 'Sepulturas/documentos sem validação completa',
      tone: 'bg-slate-100 border-slate-200 text-slate-700'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Controle sanitário e ambiental</h1>
          <p className="text-sm text-slate-500">Monitoramento de riscos, conformidade e prioridades de intervenção.</p>
        </div>
        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
          <button onClick={() => setTab('sanitary')} className={`px-4 py-2 rounded-md text-sm font-medium ${tab === 'sanitary' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>Sanitário</button>
          <button onClick={() => setTab('environmental')} className={`px-4 py-2 rounded-md text-sm font-medium ${tab === 'environmental' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>Ambiental</button>
          <button onClick={() => setTab('risk')} className={`px-4 py-2 rounded-md text-sm font-medium ${tab === 'risk' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>Indicadores</button>
        </div>
      </div>

      {tab === 'sanitary' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateSanitaryCheck} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <Plus size={16} /> Novo registro sanitário
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input value={sanitaryForm.area} onChange={(e) => setSanitaryForm((prev) => ({ ...prev, area: e.target.value }))} className="border border-slate-300 rounded-lg p-2.5 text-sm" placeholder="Área / quadra" aria-label="Área / quadra" required />
              <input value={sanitaryForm.indicator} onChange={(e) => setSanitaryForm((prev) => ({ ...prev, indicator: e.target.value }))} className="border border-slate-300 rounded-lg p-2.5 text-sm" placeholder="Indicador inspecionado" aria-label="Indicador inspecionado" required />
              <select aria-label="Nível de risco" value={sanitaryForm.riskLevel} onChange={(e) => setSanitaryForm((prev) => ({ ...prev, riskLevel: e.target.value }))} className="border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
                <option value="low">Risco baixo</option>
                <option value="medium">Risco médio</option>
                <option value="high">Risco alto</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <textarea value={sanitaryForm.findings} onChange={(e) => setSanitaryForm((prev) => ({ ...prev, findings: e.target.value }))} className="border border-slate-300 rounded-lg p-2.5 text-sm h-24" placeholder="Achados da vistoria" aria-label="Achados da vistoria" required />
              <textarea value={sanitaryForm.recommendation} onChange={(e) => setSanitaryForm((prev) => ({ ...prev, recommendation: e.target.value }))} className="border border-slate-300 rounded-lg p-2.5 text-sm h-24" placeholder="Recomendação e ação imediata" aria-label="Recomendação e ação imediata" required />
            </div>
            <div className="flex gap-3">
              <input value={sanitaryForm.inspector} onChange={(e) => setSanitaryForm((prev) => ({ ...prev, inspector: e.target.value }))} className="border border-slate-300 rounded-lg p-2.5 text-sm flex-1" placeholder="Responsável técnico" aria-label="Responsável técnico" required />
              <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60">Salvar</button>
            </div>
          </form>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3">Indicador</th>
                  <th className="px-4 py-3">Risco</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopedSanitaryChecks.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.area}</td>
                    <td className="px-4 py-3 text-slate-600">{item.indicator}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs border ${
                        item.riskLevel === 'high' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                        item.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        'bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}>
                        {label(riskLevelLabel, item.riskLevel)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{label(checkStatusLabel, item.status)}</td>
                    <td className="px-4 py-3">
                      <select value={item.status} onChange={(e) => handleUpdateStatus('sci_sanitary_checks', item.id, e.target.value)} aria-label="Status da verificação" className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                        {Object.entries(checkStatusLabel).map(([value, text]) => (
                          <option key={value} value={value}>{text}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {!loading && scopedSanitaryChecks.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhum checklist sanitário cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'environmental' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateEnvironmentalCheck} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <Leaf size={16} /> Novo registro ambiental
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input value={environmentForm.area} onChange={(e) => setEnvironmentForm((prev) => ({ ...prev, area: e.target.value }))} className="border border-slate-300 rounded-lg p-2.5 text-sm" placeholder="Área / quadra" aria-label="Área / quadra" required />
              <input value={environmentForm.indicator} onChange={(e) => setEnvironmentForm((prev) => ({ ...prev, indicator: e.target.value }))} className="border border-slate-300 rounded-lg p-2.5 text-sm" placeholder="Indicador ambiental" aria-label="Indicador ambiental" required />
              <select aria-label="Nível de risco" value={environmentForm.riskLevel} onChange={(e) => setEnvironmentForm((prev) => ({ ...prev, riskLevel: e.target.value }))} className="border border-slate-300 rounded-lg p-2.5 text-sm bg-white">
                <option value="low">Risco baixo</option>
                <option value="medium">Risco médio</option>
                <option value="high">Risco alto</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <textarea value={environmentForm.findings} onChange={(e) => setEnvironmentForm((prev) => ({ ...prev, findings: e.target.value }))} className="border border-slate-300 rounded-lg p-2.5 text-sm h-24" placeholder="Achados da vistoria" aria-label="Achados da vistoria" required />
              <textarea value={environmentForm.recommendation} onChange={(e) => setEnvironmentForm((prev) => ({ ...prev, recommendation: e.target.value }))} className="border border-slate-300 rounded-lg p-2.5 text-sm h-24" placeholder="Recomendação e ação imediata" aria-label="Recomendação e ação imediata" required />
            </div>
            <div className="flex gap-3">
              <input value={environmentForm.inspector} onChange={(e) => setEnvironmentForm((prev) => ({ ...prev, inspector: e.target.value }))} className="border border-slate-300 rounded-lg p-2.5 text-sm flex-1" placeholder="Responsável técnico" aria-label="Responsável técnico" required />
              <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60">Salvar</button>
            </div>
          </form>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3">Indicador</th>
                  <th className="px-4 py-3">Risco</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopedEnvironmentalChecks.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.area}</td>
                    <td className="px-4 py-3 text-slate-600">{item.indicator}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs border ${
                        item.riskLevel === 'high' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                        item.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        'bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}>
                        {label(riskLevelLabel, item.riskLevel)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{label(checkStatusLabel, item.status)}</td>
                    <td className="px-4 py-3">
                      <select value={item.status} onChange={(e) => handleUpdateStatus('sci_environmental_checks', item.id, e.target.value)} aria-label="Status da verificação" className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                        {Object.entries(checkStatusLabel).map(([value, text]) => (
                          <option key={value} value={value}>{text}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {!loading && scopedEnvironmentalChecks.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhum checklist ambiental cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'risk' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {riskCards.map((card) => (
              <div key={card.title} className={`border rounded-xl p-4 ${card.tone}`}>
                <p className="text-xs uppercase tracking-wider">{card.title}</p>
                <p className="text-3xl font-bold mt-2">{card.value}</p>
                <p className="text-xs mt-2 opacity-80">{card.detail}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert size={16} className="text-rose-600" /> Prioridades de intervenção identificadas pela IA
            </h2>
            <div className="space-y-3 mt-4">
              {snapshot?.priorities?.length ? (
                snapshot.priorities.map((priority: any) => (
                  <div key={priority.code} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-800">{priority.title}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-700">{priority.level}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{priority.details}</p>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} /> Nenhuma prioridade critica detectada no momento.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-600">
            <p className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5" />
              O SCI cruza alertas sanitários, ambientais, saturação de quadras, falhas estruturais e pendências documentais para definir fila de intervenção.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
