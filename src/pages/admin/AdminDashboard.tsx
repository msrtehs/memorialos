import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, Bot, Calendar, CheckCircle, Clock, Droplets, FileText, Leaf, RefreshCw, ShieldAlert, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { createSanitaryCheck, getSciExecutiveSnapshot, SciExecutiveSnapshot } from '@/services/sciService';
import { getTenantNotifications } from '@/services/notificationService';
import { StatCardSkeleton } from '@/components/ui/StatCardSkeleton';
import { formatCurrency } from '@/lib/formatters';
import { reportLoadError } from '@/lib/errors';
import { useModal } from '@/hooks/useModal';

const cardClass = 'bg-white p-6 rounded-xl shadow-sm border border-slate-200';

const defaultSnapshot: SciExecutiveSnapshot = {
  cemeteryId: 'all',
  totalPlots: 0,
  availablePlots: 0,
  occupiedPlots: 0,
  reservedPlots: 0,
  blockedPlots: 0,
  occupancyRate: 0,
  totalBurials: 0,
  totalExhumations: 0,
  openOccurrences: 0,
  pendingDocuments: 0,
  sanitaryAlerts: 0,
  environmentalAlerts: 0,
  structuralFailures: 0,
  totalRevenue: 0,
  totalExpenses: 0,
  averageAnnualBurials: 0,
  saturationProjectionYears: null,
  pendingExhumations: 0,
  approachingExhumations: 0,
  expiringConcessions: 0,
  priorities: [],
  monthlyBurialTrend: []
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const { selectedCemeteryId, selectedCemeteryName } = useAdmin();

  const [snapshot, setSnapshot] = useState<SciExecutiveSnapshot>(defaultSnapshot);
  const [loading, setLoading] = useState(true);
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; count: number }[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<number | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const { containerRef: checklistModalRef } = useModal(showChecklist, () => setShowChecklist(false));
  const [checklist, setChecklist] = useState({
    area: '',
    indicator: '',
    riskLevel: 'low' as 'low' | 'medium' | 'high',
    findings: '',
    recommendation: '',
    inspector: ''
  });
  const [savingChecklist, setSavingChecklist] = useState(false);

  const loadSnapshot = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [data, notifications] = await Promise.all([
        getSciExecutiveSnapshot(tenantId, selectedCemeteryId),
        // TODO(W5-6): migrar para getCountFromServer quando disponível
        getTenantNotifications(tenantId)
      ]);
      setSnapshot(data);
      setMonthlyTrend(data.monthlyBurialTrend); // W5-2: derivado do snapshot, sem leitura extra
      setPendingNotifications(notifications.filter((n) => n.status === 'submitted').length);
    } catch (error) {
      reportLoadError('AdminDashboard.load', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshot();
  }, [tenantId, selectedCemeteryId]);

  const occupancyData = useMemo(
    () => [
      { name: 'Ocupado', value: snapshot.occupiedPlots, color: '#ef4444' },
      { name: 'Disponível', value: snapshot.availablePlots, color: '#22c55e' },
      { name: 'Reservado', value: snapshot.reservedPlots, color: '#f59e0b' }
    ],
    [snapshot]
  );

  const saturationColor = snapshot.saturationProjectionYears === null
    ? 'text-slate-400'
    : snapshot.saturationProjectionYears < 3
      ? 'text-rose-600'
      : snapshot.saturationProjectionYears <= 7
        ? 'text-amber-600'
        : 'text-emerald-600';

  const handleSaveChecklist = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !checklist.area || !checklist.indicator || !checklist.findings || !checklist.recommendation || !checklist.inspector) {
      return;
    }
    if (selectedCemeteryId === 'all') {
      toast.error('Selecione um cemitério específico antes de criar um registro.');
      return;
    }
    setSavingChecklist(true);
    try {
      await createSanitaryCheck(tenantId, {
        cemeteryId: selectedCemeteryId,
        area: checklist.area,
        indicator: checklist.indicator,
        riskLevel: checklist.riskLevel,
        findings: checklist.findings,
        recommendation: checklist.recommendation,
        status: 'open',
        inspectedAt: new Date().toISOString().slice(0, 10),
        inspector: checklist.inspector
      });
      toast.success('Checklist sanitário registrado.');
      setShowChecklist(false);
      setChecklist({
        area: '',
        indicator: '',
        riskLevel: 'low',
        findings: '',
        recommendation: '',
        inspector: ''
      });
      await loadSnapshot();
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao salvar checklist sanitário.');
    } finally {
      setSavingChecklist(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Executivo SCI</h1>
          <p className="text-sm text-slate-500">
            Unidade: <span className="font-medium text-slate-700">{selectedCemeteryName}</span>
          </p>
        </div>
        <button
          onClick={loadSnapshot}
          className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm flex items-center gap-2"
        >
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      {/* Óbitos aguardando análise — tarefa nº 1 do gestor (W3-11) */}
      <button
        onClick={() => navigate('/admin/obitos-comunicados')}
        className={`${cardClass} text-left w-full transition-colors ${
          (pendingNotifications ?? 0) > 0 ? 'ring-2 ring-amber-400 bg-amber-50' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">Óbitos aguardando análise</span>
          <Bell size={18} className={(pendingNotifications ?? 0) > 0 ? 'text-amber-500' : 'text-slate-300'} />
        </div>
        <div className="text-3xl font-bold text-slate-900">{pendingNotifications ?? '—'}</div>
        <p className="text-xs text-slate-500 mt-1">
          {(pendingNotifications ?? 0) > 0
            ? 'Famílias aguardando resposta — analisar agora'
            : 'Nenhuma solicitação pendente'}
        </p>
      </button>

      {/* Row 1: Occupancy, Available, Saturation, Occurrences */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <button onClick={() => navigate('/admin/inventario')} className={`${cardClass} text-left hover:shadow-md transition-shadow`}>
          <p className="text-sm text-slate-500">Taxa de ocupação</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{snapshot.occupancyRate}%</p>
          <p className="text-xs text-slate-500 mt-2">{snapshot.occupiedPlots} ocupados de {snapshot.totalPlots} jazigos</p>
          <div className="w-full bg-slate-200 rounded-full h-2 mt-3">
            <div
              className={`h-2 rounded-full ${snapshot.occupancyRate > 85 ? 'bg-rose-500' : snapshot.occupancyRate > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(snapshot.occupancyRate, 100)}%` }}
            />
          </div>
        </button>

        <button onClick={() => navigate('/admin/inventario')} className={`${cardClass} text-left hover:shadow-md transition-shadow`}>
          <p className="text-sm text-slate-500">Jazigos disponíveis</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{snapshot.availablePlots}</p>
          <p className="text-xs text-slate-500 mt-2">de {snapshot.totalPlots} total ({snapshot.blockedPlots} bloqueados)</p>
        </button>

        <div className={`${cardClass}`}>
          <p className="text-sm text-slate-500 flex items-center gap-1"><Clock size={14} /> Projeção de saturação</p>
          <p className={`text-3xl font-bold mt-2 ${saturationColor}`}>
            {snapshot.saturationProjectionYears !== null
              ? `${snapshot.saturationProjectionYears.toFixed(1)} anos`
              : 'Sem dados'}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {snapshot.averageAnnualBurials > 0
              ? `Média: ${snapshot.averageAnnualBurials.toFixed(1)} sepultamentos/ano`
              : 'Sem histórico de sepultamentos'}
          </p>
        </div>

        <button onClick={() => navigate('/admin/seguranca')} className={`${cardClass} text-left hover:shadow-md transition-shadow`}>
          <p className="text-sm text-slate-500">Ocorrências abertas</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{snapshot.openOccurrences}</p>
          <p className="text-xs text-slate-500 mt-2">Monitoramento de risco e conformidade</p>
        </button>
      </div>

      {/* Row 2: Burials, Exhumations, Documents, Operational Flow */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <button onClick={() => navigate('/admin/operacional')} className={`${cardClass} text-left hover:shadow-md transition-shadow`}>
          <p className="text-sm text-slate-500 flex items-center gap-1"><Calendar size={14} /> Sepultamentos</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{snapshot.totalBurials}</p>
          <p className="text-xs text-slate-500 mt-2">Registros de sepultamento no período</p>
        </button>

        <button onClick={() => navigate('/admin/operacional')} className={`${cardClass} text-left hover:shadow-md transition-shadow`}>
          <p className="text-sm text-slate-500">Exumações pendentes</p>
          <p className={`text-3xl font-bold mt-2 ${snapshot.pendingExhumations > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {snapshot.pendingExhumations}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {snapshot.approachingExhumations > 0
              ? `+ ${snapshot.approachingExhumations} nos próximos 6 meses`
              : 'Nenhuma exumação próxima do prazo'}
          </p>
        </button>

        <button onClick={() => navigate('/admin/documentos')} className={`${cardClass} text-left hover:shadow-md transition-shadow`}>
          <p className="text-sm text-slate-500">Pendências documentais</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{snapshot.pendingDocuments}</p>
          <p className="text-xs text-slate-500 mt-2">Digitalização, validação e rastreabilidade</p>
        </button>

        <button onClick={() => navigate('/admin/operacional')} className={`${cardClass} text-left hover:shadow-md transition-shadow`}>
          <p className="text-sm text-slate-500">Fluxo operacional</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{snapshot.totalBurials + snapshot.totalExhumations}</p>
          <p className="text-xs text-slate-500 mt-2">{snapshot.totalBurials} sepultamentos e {snapshot.totalExhumations} exumações</p>
        </button>
      </div>

      {/* Monthly Burial Trend BarChart */}
      {monthlyTrend.length > 0 && (
        <div className={cardClass}>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Tendência mensal de sepultamentos</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Sepultamentos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className={`${cardClass} xl:col-span-2`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Mapa de ocupação</h2>
            <button
              onClick={() => navigate('/admin/inventario')}
              className="text-sm text-blue-700 font-medium hover:underline"
            >
              Ir para georreferenciamento
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={occupancyData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={5}>
                  {occupancyData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-300" /> Prioridades IA
            </h2>
            <button
              onClick={() => navigate('/admin/agentes')}
              className="text-xs bg-white/10 border border-white/20 px-2 py-1 rounded"
            >
              Agentes
            </button>
          </div>

          <div className="space-y-3">
            {snapshot.priorities.length === 0 && (
              <div className="bg-white/10 border border-white/15 rounded-lg p-3 text-sm text-slate-200">
                Nenhuma prioridade critica detectada no momento.
              </div>
            )}
            {snapshot.priorities.slice(0, 5).map((item) => (
              <div key={item.code} className="bg-white/10 border border-white/15 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <span className="text-xs px-2 py-1 rounded bg-white/20">{item.level.toUpperCase()}</span>
                </div>
                <p className="text-xs text-slate-200 mt-1">{item.details}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 text-xs">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-slate-300">Alertas sanitários</p>
              <p className="text-xl font-bold flex items-center gap-1"><Droplets size={15} /> {snapshot.sanitaryAlerts}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-slate-300">Alertas ambientais</p>
              <p className="text-xl font-bold flex items-center gap-1"><Leaf size={15} /> {snapshot.environmentalAlerts}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-slate-300">Falhas estruturais</p>
              <p className="text-xl font-bold flex items-center gap-1"><ShieldAlert size={15} /> {snapshot.structuralFailures}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-slate-300">Pendências docs</p>
              <p className="text-xl font-bold flex items-center gap-1"><FileText size={15} /> {snapshot.pendingDocuments}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={`${cardClass} xl:col-span-2`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Financeiro consolidado</h2>
            <button onClick={() => navigate('/admin/financeiro')} className="text-sm text-blue-700 font-medium hover:underline">
              Ver lancamentos
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">Receitas</p>
              <p className="text-2xl font-bold text-emerald-800 mt-1">{formatCurrency(snapshot.totalRevenue)}</p>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-4">
              <p className="text-sm text-rose-700">Despesas</p>
              <p className="text-2xl font-bold text-rose-800 mt-1">{formatCurrency(snapshot.totalExpenses)}</p>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-lg font-bold text-slate-800 mb-3">Checklist sanitário</h2>
          <p className="text-sm text-slate-500 mb-4">
            Registre verificações ambientais e sanitárias para alimentar os indicadores de risco automaticamente.
          </p>
          <button
            onClick={() => setShowChecklist(true)}
            className="w-full bg-slate-900 text-white rounded-lg py-2.5 font-medium hover:bg-slate-800"
          >
            Novo checklist
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500 flex items-center gap-2">
          <RefreshCw size={16} className="animate-spin" /> Carregando indicadores do SCI...
        </div>
      )}

      {showChecklist && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div ref={checklistModalRef} role="dialog" aria-modal="true" aria-labelledby="checklist-modal-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 id="checklist-modal-title" className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Droplets size={18} className="text-blue-600" /> Novo Checklist Sanitário
              </h3>
              <button onClick={() => setShowChecklist(false)} className="text-slate-500 hover:text-slate-700">Fechar</button>
            </div>

            <form onSubmit={handleSaveChecklist} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Area</label>
                  <input
                    value={checklist.area}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, area: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2.5"
                    placeholder="Setor ou quadra" aria-label="Setor ou quadra"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Indicador</label>
                  <input
                    value={checklist.indicator}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, indicator: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2.5"
                    placeholder="Ex: drenagem, necrochorume"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Nível de risco</label>
                  <select aria-label="Nível de risco"
                    value={checklist.riskLevel}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, riskLevel: e.target.value as any }))}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                  >
                    <option value="low">Baixo</option>
                    <option value="medium">Medio</option>
                    <option value="high">Alto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Inspetor responsável</label>
                  <input
                    value={checklist.inspector}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, inspector: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2.5"
                    placeholder="Nome do responsável" aria-label="Nome do responsável"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Achados</label>
                <textarea
                  value={checklist.findings}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, findings: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 h-24"
                  placeholder="Descreva riscos, anomalias e condições observadas" aria-label="Descreva riscos, anomalias e condições observadas"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Recomendação</label>
                <textarea
                  value={checklist.recommendation}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, recommendation: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 h-24"
                  placeholder="Ação recomendada e prazo" aria-label="Ação recomendada e prazo"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowChecklist(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingChecklist}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingChecklist ? 'Salvando...' : 'Salvar checklist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!loading && snapshot.priorities.length === 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 text-green-800 p-4 text-sm flex items-center gap-2">
          <CheckCircle size={16} /> Nenhum risco critico foi identificado nas ultimas leituras do SCI.
        </div>
      )}

      {!loading && snapshot.priorities.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 p-4 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" />
          A IA detectou prioridades de intervenção. Revise os detalhes no painel de agentes e relatórios.
          <button onClick={() => navigate('/admin/relatorios')} className="ml-2 text-amber-900 font-semibold underline">
            Abrir relatórios
          </button>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-slate-500" />
          IA aplicada a gestão sanitária, ambiental e operacional ativa.
        </div>
        <button onClick={() => navigate('/admin/agentes')} className="text-blue-700 font-medium hover:underline">
          Configurar agentes
        </button>
      </div>
    </div>
  );
}
