// ============================================================
// MemorialOS Monitor — Tipos TypeScript
// ============================================================

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type MonitoringModule = 'technical' | 'operational' | 'memorial';

// ── Alerta ─────────────────────────────────────────────────
export interface Alert {
  id: string;
  module: MonitoringModule;
  severity: AlertSeverity;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  resolvedAt?: string | null;
  createdAt: string;
}

// ── Snapshot Tecnico ────────────────────────────────────────
export interface TechnicalSnapshot {
  timestamp: string;
  appStatus: 'online' | 'degraded' | 'offline';
  responseTimeMs: number;
  httpStatusCode: number;
  firestoreLatencyMs: number;
  activeUsers24h: number;
  failedLogins24h: number;
  newSignups24h: number;
  functionsErrors24h: number;
  geminiApiCallsToday: number;
  alerts: Alert[];
}

// ── Snapshot Operacional ────────────────────────────────────
export interface OperationalSnapshot {
  timestamp: string;
  memoriaisCreados24h: number;
  servicosSolicitados24h: number;
  servicosPendentes: number;
  servicosAtrasados: number;
  planosAtivos: number;
  gestoresAtivos: number;
  acoesSuperAdmin24h: number;
  comunicadosObitoSemValidar: number;
  alerts: Alert[];
}

// ── Snapshot de Memoriais ───────────────────────────────────
export interface MemorialSnapshot {
  timestamp: string;
  totalMemoriais: number;
  memoriaisSemAtualizacao30d: number;
  memoriaisSemFoto: number;
  jazigosSemManutencao90d: number;
  planosFunerariosVencendo30d: number;
  visitasHoje: number;
  visitasSemana: number;
  fotosAdicionadas7d: number;
  alerts: Alert[];
}

// ── Metricas consolidadas para o Dashboard ──────────────────
export interface DashboardMetrics {
  updatedAt: string;
  technical: TechnicalSnapshot;
  operational: OperationalSnapshot;
  memorial: MemorialSnapshot;
  alertsOpen: Alert[];
  systemHealthScore: number; // 0-100
}

// ── Config do agente ────────────────────────────────────────
export interface MonitorConfig {
  whatsapp: {
    enabled: boolean;
    evolutionApiUrl: string;
    evolutionApiKey: string;
    instanceName: string;
    recipients: { name: string; number: string; role: 'superadmin' | 'admin' }[];
  };
  thresholds: {
    responseTimeMs: number;
    failedLoginsMax: number;
    servicosAtrasadosMax: number;
    memoriaisSemAtualizacaoDias: number;
    jazigosSemManutencaoDias: number;
    planoVencendoDias: number;
  };
}
