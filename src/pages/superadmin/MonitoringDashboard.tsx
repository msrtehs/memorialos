// ============================================================
// MemorialOS — Dashboard de Monitoramento (SuperAdmin)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Activity, AlertTriangle, CheckCircle, Clock,
  Users, FileText, Wrench, Heart, RefreshCw,
  Wifi, WifiOff, TrendingUp, Shield, Bell,
} from 'lucide-react';

// ── Tipos locais (espelho do types.ts do backend) ────────────
interface Alert {
  id: string;
  module: 'technical' | 'operational' | 'memorial';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  createdAt: string;
}

interface TechnicalSnapshot {
  appStatus: 'online' | 'degraded' | 'offline';
  responseTimeMs: number;
  firestoreLatencyMs: number;
  activeUsers24h: number;
  failedLogins24h: number;
  newSignups24h: number;
  functionsErrors24h: number;
  geminiApiCallsToday: number;
  timestamp: string;
}

interface OperationalSnapshot {
  memoriaisCreados24h: number;
  servicosSolicitados24h: number;
  servicosPendentes: number;
  servicosAtrasados: number;
  planosAtivos: number;
  gestoresAtivos: number;
  comunicadosObitoSemValidar: number;
  acoesSuperAdmin24h: number;
  timestamp: string;
}

interface MemorialSnapshot {
  totalMemoriais: number;
  memoriaisSemAtualizacao30d: number;
  memoriaisSemFoto: number;
  jazigosSemManutencao90d: number;
  planosFunerariosVencendo30d: number;
  visitasHoje: number;
  visitasSemana: number;
  fotosAdicionadas7d: number;
  timestamp: string;
}

interface DashboardMetrics {
  updatedAt: string;
  technical: TechnicalSnapshot;
  operational: OperationalSnapshot;
  memorial: MemorialSnapshot;
  alertsOpen: Alert[];
  systemHealthScore: number;
}

interface HistoryPoint {
  timestamp: string;
  healthScore: number;
  responseTimeMs: number;
  activeUsers24h: number;
  servicosPendentes: number;
  visitasHoje: number;
  alertsCritical: number;
  alertsWarning: number;
}

// ── Utilitarios visuais ──────────────────────────────────────
const STATUS_COLORS = {
  online: '#22c55e',
  degraded: '#f59e0b',
  offline: '#ef4444',
};

const SEVERITY_COLORS = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

const MODULE_LABELS = {
  technical: 'Tecnico',
  operational: 'Operacional',
  memorial: 'Memorial',
};

function healthScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

// ── Componente: Card de Metrica ─────────────────────────────
function MetricCard({
  label, value, icon: Icon, color = '#3b82f6', sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-start gap-3">
      <div
        className="rounded-lg p-2 flex-shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Componente: Badge de Severidade ─────────────────────────
function SeverityBadge({ severity }: { severity: Alert['severity'] }) {
  const labels = { critical: 'Critico', warning: 'Atencao', info: 'Info' };
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
      style={{ backgroundColor: SEVERITY_COLORS[severity] }}
    >
      {labels[severity]}
    </span>
  );
}

// ── Componente: Status do App ────────────────────────────────
function AppStatusBadge({ status }: { status: TechnicalSnapshot['appStatus'] }) {
  const labels = { online: 'Online', degraded: 'Degradado', offline: 'Offline' };
  const icons = { online: Wifi, degraded: Activity, offline: WifiOff };
  const Icon = icons[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full text-white"
      style={{ backgroundColor: STATUS_COLORS[status] }}
    >
      <Icon size={12} />
      {labels[status]}
    </span>
  );
}

// ── Componente Principal ─────────────────────────────────────
export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'operational' | 'memorial' | 'alerts'>('overview');

  const fetchData = useCallback(async () => {
    try {
      const functions = getFunctions(undefined, 'us-central1');
      const getMonitoringData = httpsCallable<{ days: number }, { current: DashboardMetrics; history: HistoryPoint[] }>(
        functions,
        'getMonitoringData'
      );
      const result = await getMonitoringData({ days: 7 });
      setMetrics(result.data.current);
      setHistory(result.data.history ?? []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[MonitoringDashboard] Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh a cada 5 minutos
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="animate-spin mx-auto mb-3 text-blue-600" size={32} />
          <p className="text-gray-500">Carregando dados de monitoramento...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-gray-500">
          <AlertTriangle className="mx-auto mb-3 text-yellow-500" size={32} />
          <p>Nenhuma metrica disponivel. Execute o monitor pela primeira vez.</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const { technical: t, operational: o, memorial: m } = metrics;
  const criticalCount = metrics.alertsOpen.filter(a => a.severity === 'critical').length;
  const warningCount = metrics.alertsOpen.filter(a => a.severity === 'warning').length;

  const chartHistory = history.map(h => ({
    ...h,
    hora: new Date(h.timestamp).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }),
  }));

  const TABS = [
    { key: 'overview', label: 'Visao Geral' },
    { key: 'technical', label: 'Tecnico' },
    { key: 'operational', label: 'Operacional' },
    { key: 'memorial', label: 'Memoriais' },
    { key: 'alerts', label: `Alertas ${metrics.alertsOpen.length > 0 ? `(${metrics.alertsOpen.length})` : ''}` },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-600" size={24} />
            <div>
              <h1 className="text-xl font-bold text-gray-800">Monitoramento MemorialOS</h1>
              <p className="text-xs text-gray-400">
                Atualizado: {formatTimestamp(metrics.updatedAt)}
                {lastRefresh && ` | Consulta: ${lastRefresh.toLocaleTimeString('pt-BR')}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 bg-red-50 text-red-600 text-xs font-bold px-3 py-1 rounded-full border border-red-200">
                <Bell size={12} />
                {criticalCount} critico(s)
              </span>
            )}
            <AppStatusBadge status={t.appStatus} />
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                autoRefresh
                  ? 'bg-green-50 text-green-600 border-green-200'
                  : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}
            >
              {autoRefresh ? 'Auto ON' : 'Auto Off'}
            </button>
            <button
              onClick={fetchData}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={12} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Health Score Banner */}
      <div
        className="px-6 py-4"
        style={{ backgroundColor: `${healthScoreColor(metrics.systemHealthScore)}12` }}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black text-white shadow-md flex-shrink-0"
            style={{ backgroundColor: healthScoreColor(metrics.systemHealthScore) }}
          >
            {metrics.systemHealthScore}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Health Score do Sistema</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${metrics.systemHealthScore}%`,
                    backgroundColor: healthScoreColor(metrics.systemHealthScore),
                  }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {metrics.systemHealthScore >= 80 ? 'Sistema saudavel' :
                 metrics.systemHealthScore >= 50 ? 'Atencao necessaria' :
                 'Problemas criticos detectados'}
              </span>
            </div>
          </div>
          <div className="ml-auto flex gap-4 text-center">
            <div>
              <p className="text-2xl font-bold" style={{ color: '#ef4444' }}>{criticalCount}</p>
              <p className="text-xs text-gray-500">Criticos</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{warningCount}</p>
              <p className="text-xs text-gray-500">Avisos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* VISAO GERAL */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Usuarios ativos/24h" value={t.activeUsers24h} icon={Users} color="#3b82f6" />
              <MetricCard label="Novos cadastros/24h" value={t.newSignups24h} icon={TrendingUp} color="#22c55e" />
              <MetricCard label="Memoriais totais" value={m.totalMemoriais} icon={FileText} color="#8b5cf6" />
              <MetricCard label="Visitas hoje" value={m.visitasHoje} icon={Heart} color="#ec4899" sub={`${m.visitasSemana} na semana`} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Servicos pendentes" value={o.servicosPendentes} icon={Clock} color={o.servicosAtrasados > 0 ? '#f59e0b' : '#6b7280'} sub={o.servicosAtrasados > 0 ? `${o.servicosAtrasados} atrasados` : 'Sem atrasos'} />
              <MetricCard label="Planos funerarios" value={o.planosAtivos} icon={Shield} color="#0891b2" sub={`${m.planosFunerariosVencendo30d} vencem em 30d`} />
              <MetricCard label="Jazigos s/ manutencao" value={m.jazigosSemManutencao90d} icon={Wrench} color={m.jazigosSemManutencao90d > 5 ? '#f59e0b' : '#6b7280'} />
              <MetricCard label="Obitos p/ validar" value={o.comunicadosObitoSemValidar} icon={AlertTriangle} color={o.comunicadosObitoSemValidar > 0 ? '#ef4444' : '#22c55e'} />
            </div>

            {chartHistory.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Health Score — Ultimos 7 dias</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartHistory}>
                    <defs>
                      <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hora" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="healthScore" stroke="#3b82f6" fill="url(#healthGrad)" strokeWidth={2} name="Health Score" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* TECNICO */}
        {activeTab === 'technical' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Tempo de resposta" value={`${t.responseTimeMs}ms`} icon={Activity} color={t.responseTimeMs > 3000 ? '#f59e0b' : '#22c55e'} />
              <MetricCard label="Latencia Firestore" value={t.firestoreLatencyMs === -1 ? 'ERRO' : `${t.firestoreLatencyMs}ms`} icon={Activity} color={t.firestoreLatencyMs === -1 ? '#ef4444' : '#22c55e'} />
              <MetricCard label="Logins com falha/24h" value={t.failedLogins24h} icon={Shield} color={t.failedLogins24h > 10 ? '#ef4444' : '#6b7280'} />
              <MetricCard label="Erros nas Functions" value={t.functionsErrors24h} icon={AlertTriangle} color={t.functionsErrors24h > 0 ? '#f59e0b' : '#22c55e'} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricCard label="Chamadas Gemini hoje" value={t.geminiApiCallsToday} icon={Activity} color={t.geminiApiCallsToday > 800 ? '#f59e0b' : '#8b5cf6'} sub="Limite: ~1000/dia (free tier)" />
              <MetricCard label="Usuarios ativos/24h" value={t.activeUsers24h} icon={Users} color="#3b82f6" />
              <MetricCard label="Novos cadastros/24h" value={t.newSignups24h} icon={TrendingUp} color="#22c55e" />
            </div>

            {chartHistory.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Tempo de Resposta (ms) — Historico</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hora" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="responseTimeMs" stroke="#3b82f6" strokeWidth={2} dot={false} name="Latencia (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* OPERACIONAL */}
        {activeTab === 'operational' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Memoriais criados/24h" value={o.memoriaisCreados24h} icon={FileText} color="#22c55e" />
              <MetricCard label="Servicos solicitados/24h" value={o.servicosSolicitados24h} icon={Wrench} color="#3b82f6" />
              <MetricCard label="Servicos pendentes" value={o.servicosPendentes} icon={Clock} color="#f59e0b" />
              <MetricCard label="Servicos atrasados (+72h)" value={o.servicosAtrasados} icon={AlertTriangle} color={o.servicosAtrasados > 5 ? '#ef4444' : '#f59e0b'} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Planos ativos" value={o.planosAtivos} icon={Shield} color="#0891b2" />
              <MetricCard label="Gestores ativos" value={o.gestoresAtivos} icon={Users} color={o.gestoresAtivos === 0 ? '#ef4444' : '#22c55e'} />
              <MetricCard label="Acoes SuperAdmin/24h" value={o.acoesSuperAdmin24h} icon={Shield} color="#8b5cf6" />
              <MetricCard label="Obitos p/ validar" value={o.comunicadosObitoSemValidar} icon={AlertTriangle} color={o.comunicadosObitoSemValidar > 0 ? '#ef4444' : '#22c55e'} />
            </div>

            {chartHistory.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Servicos Pendentes — Historico</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hora" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="servicosPendentes" fill="#3b82f6" name="Servicos Pendentes" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* MEMORIAIS */}
        {activeTab === 'memorial' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Total de memoriais" value={m.totalMemoriais} icon={FileText} color="#8b5cf6" />
              <MetricCard label="Visitas hoje" value={m.visitasHoje} icon={Heart} color="#ec4899" sub={`${m.visitasSemana} na semana`} />
              <MetricCard label="Fotos adicionadas/7d" value={m.fotosAdicionadas7d} icon={TrendingUp} color="#22c55e" />
              <MetricCard label="Sem foto" value={m.memoriaisSemFoto} icon={FileText} color={m.memoriaisSemFoto > 10 ? '#f59e0b' : '#6b7280'} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricCard label="Sem atualizacao +30d" value={m.memoriaisSemAtualizacao30d} icon={Clock} color={m.memoriaisSemAtualizacao30d > 20 ? '#f59e0b' : '#6b7280'} />
              <MetricCard label="Jazigos s/ manutencao" value={m.jazigosSemManutencao90d} icon={Wrench} color={m.jazigosSemManutencao90d > 5 ? '#f59e0b' : '#22c55e'} sub="+90 dias" />
              <MetricCard label="Planos vencendo" value={m.planosFunerariosVencendo30d} icon={AlertTriangle} color={m.planosFunerariosVencendo30d > 0 ? '#f59e0b' : '#22c55e'} sub="nos proximos 30 dias" />
            </div>

            {chartHistory.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Visitas aos Memoriais — Historico</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartHistory}>
                    <defs>
                      <linearGradient id="visitasGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hora" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="visitasHoje" stroke="#ec4899" fill="url(#visitasGrad)" strokeWidth={2} name="Visitas" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ALERTAS */}
        {activeTab === 'alerts' && (
          <div className="space-y-3">
            {metrics.alertsOpen.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <CheckCircle className="mx-auto mb-3 text-green-400" size={40} />
                <p className="font-medium">Nenhum alerta aberto no momento</p>
                <p className="text-sm">Todos os sistemas operando normalmente.</p>
              </div>
            ) : (
              metrics.alertsOpen.map(alert => (
                <div
                  key={alert.id}
                  className="bg-white rounded-xl border p-4 shadow-sm"
                  style={{ borderLeftWidth: 4, borderLeftColor: SEVERITY_COLORS[alert.severity] }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <SeverityBadge severity={alert.severity} />
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {MODULE_LABELS[alert.module]}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-800 text-sm">{alert.title}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{alert.description}</p>
                    </div>
                    <p className="text-xs text-gray-400 flex-shrink-0">
                      {formatTimestamp(alert.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
