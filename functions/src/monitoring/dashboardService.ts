// ============================================================
// MemorialOS Monitor — Servico de Dashboard
// Persiste metricas no Firestore para o dashboard React
// Coleta: monitor_metrics (atual) + monitor_history (historico)
// ============================================================

import { getFirestore } from 'firebase-admin/firestore';
import type {
  TechnicalSnapshot,
  OperationalSnapshot,
  MemorialSnapshot,
  DashboardMetrics,
  Alert,
} from './types';

const db = () => getFirestore();

// ── Calcula health score de 0 a 100 ─────────────────────────
function calculateHealthScore(
  technical: TechnicalSnapshot,
  operational: OperationalSnapshot,
  memorial: MemorialSnapshot
): number {
  let score = 100;

  // Tecnico (peso 50)
  if (technical.appStatus === 'offline') score -= 50;
  else if (technical.appStatus === 'degraded') score -= 20;
  if (technical.firestoreLatencyMs === -1) score -= 15;
  else if (technical.firestoreLatencyMs > 2000) score -= 5;
  if (technical.failedLogins24h > 20) score -= 10;
  if (technical.functionsErrors24h > 10) score -= 5;

  // Operacional (peso 30)
  if (operational.servicosAtrasados > 10) score -= 15;
  else if (operational.servicosAtrasados > 5) score -= 8;
  if (operational.comunicadosObitoSemValidar > 5) score -= 10;
  else if (operational.comunicadosObitoSemValidar > 0) score -= 5;
  if (operational.gestoresAtivos === 0) score -= 10;

  // Memorial (peso 20)
  if (memorial.jazigosSemManutencao90d > 20) score -= 10;
  else if (memorial.jazigosSemManutencao90d > 5) score -= 5;
  if (memorial.planosFunerariosVencendo30d > 10) score -= 5;

  return Math.max(0, Math.min(100, score));
}

// ── Consolida todos os alertas abertos ──────────────────────
function consolidateAlerts(
  technical: TechnicalSnapshot,
  operational: OperationalSnapshot,
  memorial: MemorialSnapshot
): Alert[] {
  return [
    ...technical.alerts,
    ...operational.alerts,
    ...memorial.alerts,
  ].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// ── Salva snapshot atual (substituicao) ─────────────────────
export async function saveCurrentMetrics(
  technical: TechnicalSnapshot,
  operational: OperationalSnapshot,
  memorial: MemorialSnapshot
): Promise<DashboardMetrics> {
  const alertsOpen = consolidateAlerts(technical, operational, memorial);
  const systemHealthScore = calculateHealthScore(technical, operational, memorial);

  const metrics: DashboardMetrics = {
    updatedAt: new Date().toISOString(),
    technical,
    operational,
    memorial,
    alertsOpen,
    systemHealthScore,
  };

  try {
    await db().collection('monitor_metrics').doc('current').set(metrics);
    console.log(
      `[DashboardService] Metricas salvas. Health Score: ${systemHealthScore}/100 | Alertas: ${alertsOpen.length}`
    );
  } catch (err) {
    console.error('[DashboardService] Erro ao salvar metricas:', err);
  }

  return metrics;
}

// ── Salva ponto historico para graficos de tendencia ────────
export async function saveHistoricalPoint(metrics: DashboardMetrics): Promise<void> {
  const timestamp = new Date().toISOString();

  const historicalPoint = {
    timestamp,
    healthScore: metrics.systemHealthScore,
    appStatus: metrics.technical.appStatus,
    responseTimeMs: metrics.technical.responseTimeMs,
    activeUsers24h: metrics.technical.activeUsers24h,
    servicosPendentes: metrics.operational.servicosPendentes,
    comunicadosObitoSemValidar: metrics.operational.comunicadosObitoSemValidar,
    visitasHoje: metrics.memorial.visitasHoje,
    alertsCritical: metrics.alertsOpen.filter(a => a.severity === 'critical').length,
    alertsWarning: metrics.alertsOpen.filter(a => a.severity === 'warning').length,
  };

  try {
    await db().collection('monitor_history').add(historicalPoint);
    await cleanOldHistory();
  } catch (err) {
    console.error('[DashboardService] Erro ao salvar historico:', err);
  }
}

// ── Limpa historico antigo (>30 dias) ───────────────────────
async function cleanOldHistory(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('monitor_history')
      .where('timestamp', '<=', thirtyDaysAgo.toISOString())
      .limit(100)
      .get();

    if (snap.empty) return;

    const batch = db().batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[DashboardService] ${snap.size} pontos historicos antigos removidos.`);
  } catch {
    // Silencioso
  }
}

// ── Busca metricas atuais (para o componente React via callable) ─
export async function getCurrentMetrics(): Promise<DashboardMetrics | null> {
  try {
    const doc = await db().collection('monitor_metrics').doc('current').get();
    if (!doc.exists) return null;
    return doc.data() as DashboardMetrics;
  } catch (err) {
    console.error('[DashboardService] Erro ao buscar metricas:', err);
    return null;
  }
}

// ── Busca historico dos ultimos N dias para graficos ────────
export async function getHistory(days = 7): Promise<Record<string, unknown>[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  try {
    const snap = await db()
      .collection('monitor_history')
      .where('timestamp', '>=', since)
      .orderBy('timestamp', 'asc')
      .get();

    return snap.docs.map(d => d.data());
  } catch {
    return [];
  }
}
