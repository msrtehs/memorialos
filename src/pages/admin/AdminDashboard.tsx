import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bot, CheckCircle, Droplets, FileText, Leaf, RefreshCw, ShieldAlert, TrendingUp } from 'lucide-react';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { createSanitaryCheck, getSciExecutiveSnapshot, SciExecutiveSnapshot } from '@/services/sciService';

const cardClass = 'bg-white p-6 rounded-xl shadow-sm border border-slate-200';

const defaultSnapshot: SciExecutiveSnapshot = {
  cemeteryId: 'all',
  totalPlots: 0,
  availablePlots: 0,
  occupiedPlots: 0,
  reservedPlots: 0,
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
  priorities: []
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();

  const [snapshot, setSnapshot] = useState<SciExecutiveSnapshot>(defaultSnapshot);
  const [loading, setLoading] = useState(true);
  const [showChecklist, setShowChecklist] = useState(false);
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
      const data = await getSciExecutiveSnapshot(tenantId, selectedCemeteryId);
      setSnapshot(data);
    } catch (error) {
      console.error('Erro ao carregar dashboard executivo:', error);
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
      { name: 'Disponivel', value: snapshot.availablePlots, color: '#22c55e' },
      { name: 'Reservado', value: snapshot.reservedPlots, color: '#f59e0b' }
    ],
    [snapshot]
  );

  const handleSaveChecklist = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !checklist.area || !checklist.indicator || !checklist.findings || !checklist.recommendation || !checklist.inspector) {
      return;
    }
    setSavingChecklist(true);
    try {
      await createSanitaryCheck(tenantId, {
        cemeteryId: selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
        area: checklist.area,
        indicator: checklist.indicator,
        riskLevel: checklist.riskLevel,
        findings: checklist.findings,
        recommendation: checklist.recommendation,
        status: 'open',
        inspectedAt: new Date().toISOString().slice(0, 10),
        inspector: checklist.inspector
      });
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
    } catch (error) {
      console.error('Falha ao salvar checklist sanitario:', error);
    } finally {
      setSavingChecklist(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Executivo SCI</h1>
          <p className="text-sm text-slate-500">
            Unidade: <span className="font-medium text-slate-700">{selectedCemeteryId === 'all' ? 'Todas as unidades' : selectedCemeteryId}</span>
          </p>
        </div>
        <button
          onClick={loadSnapshot}
          className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm flex items-center gap-2"
        >
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <button onClick={() => navigate('/admin/inventario')} className={`${cardClass} text-left hover:shadow-md transition-shadow`}>
          <p className="text-sm text-slate-500">Taxa de ocupacao</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{snapshot.occupancyRate}%</p>
          <p className="text-xs text-slate-500 mt-2">{snapshot.occupiedPlots} ocupados de {snapshot.totalPlots} jazigos</p>
        </button>

        <button onClick={() => navigate('/admin/operacional')} className={`${cardClass} text-left hover:shadow-md transition-shadow`}>
          <p className="text-sm text-slate-500">Fluxo operacional</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{snapshot.totalBurials + snapshot.totalExhumations}</p>
          <p className="text-xs text-slate-500 mt-2">{snapshot.totalBurials} sepultamentos e {snapshot.totalExhumations} exumacoes</p>
        </button>

        <button onClick={() => navigate('/admin/documentos')} className={`${cardClass} text-left hover:shadow-md transition-shadow`}>
          <p className="text-sm text-slate-500">Pendencias documentais</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{snapshot.pendingDocuments}</p>
          <p className="text-xs text-slate-500 mt-2">Digitalizacao, validacao e rastreabilidade</p>
        </button>

        <button onClick={() => navigate('/admin/seguranca')} className={`${cardClass} text-left hover:shadow-md transition-shadow`}>
          <p className="text-sm text-slate-500">Ocorrencias abertas</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{snapshot.openOccurrences}</p>
          <p className="text-xs text-slate-500 mt-2">Monitoramento de risco e conformidade</p>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className={`${cardClass} xl:col-span-2`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Mapa de ocupacao</h2>
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
              <p className="text-slate-300">Alertas sanitarios</p>
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
              <p className="text-slate-300">Pendencias docs</p>
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
              <p className="text-2xl font-bold text-emerald-800 mt-1">R$ {snapshot.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-4">
              <p className="text-sm text-rose-700">Despesas</p>
              <p className="text-2xl font-bold text-rose-800 mt-1">R$ {snapshot.totalExpenses.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-lg font-bold text-slate-800 mb-3">Checklist sanitario</h2>
          <p className="text-sm text-slate-500 mb-4">
            Registre verificacoes ambientais e sanitarias para alimentar os indicadores de risco automaticamente.
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Droplets size={18} className="text-blue-600" /> Novo Checklist Sanitario
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
                    placeholder="Setor ou quadra"
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
                  <label className="block text-sm text-slate-600 mb-1">Nivel de risco</label>
                  <select
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
                  <label className="block text-sm text-slate-600 mb-1">Inspetor responsavel</label>
                  <input
                    value={checklist.inspector}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, inspector: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2.5"
                    placeholder="Nome do responsavel"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Achados</label>
                <textarea
                  value={checklist.findings}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, findings: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 h-24"
                  placeholder="Descreva riscos, anomalias e condicoes observadas"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Recomendacao</label>
                <textarea
                  value={checklist.recommendation}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, recommendation: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 h-24"
                  placeholder="Acao recomendada e prazo"
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
          A IA detectou prioridades de intervencao. Revise os detalhes no painel de agentes e relatorios.
          <button onClick={() => navigate('/admin/relatorios')} className="ml-2 text-amber-900 font-semibold underline">
            Abrir relatorios
          </button>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-slate-500" />
          IA aplicada a gestao sanitaria, ambiental e operacional ativa.
        </div>
        <button onClick={() => navigate('/admin/agentes')} className="text-blue-700 font-medium hover:underline">
          Configurar agentes
        </button>
      </div>
    </div>
  );
}
