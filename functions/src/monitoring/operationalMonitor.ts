// ============================================================
// MemorialOS Monitor — Monitoramento Operacional
// Verifica: servicos, planos, gestores, auditorias, obitos
// Frequencia: a cada 30 minutos
// ============================================================

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { OperationalSnapshot, Alert, MonitorConfig } from './types';

const db = () => getFirestore();

// ── Memoriais criados nas ultimas 24h ───────────────────────
async function countMemoriaisCreados24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('deceaseds')
      .where('createdAt', '>=', Timestamp.fromDate(since))
      .count()
      .get();
    return snap.data().count;
  } catch { return 0; }
}

// W4-1: -1 = "sem fonte de dados" (distinto de 0). Coleções sem produtor no app
// atual (requests, funeral_plans) reportam -1 e a UI exibe "N/D".

// ── Servicos solicitados nas ultimas 24h (coleção `requests` sem produtor) ──
async function countServicosSolicitados24h(): Promise<number> {
  return -1; // sem fonte de dados nesta versão
}

// ── Servicos pendentes (coleção `requests` sem produtor) ────
async function countServicosPendentes(): Promise<number> {
  return -1;
}

// ── Servicos atrasados (coleção `requests` sem produtor) ────
async function countServicosAtrasados(): Promise<{ count: number; ids: string[] }> {
  return { count: -1, ids: [] };
}

// ── Planos funerarios ativos (coleção `funeral_plans` sem produtor) ──
async function countPlanosAtivos(): Promise<number> {
  return -1;
}

// ── Gestores ativos: lastLoginAt nunca é gravado. Proxy honesto: atores
//    distintos em audit_logs nas últimas 24h. ─────────────────
async function countGestoresAtivos(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('audit_logs')
      .where('timestamp', '>=', Timestamp.fromDate(since))
      .select('actorUid')
      .limit(1000)
      .get();
    return new Set(snap.docs.map((d) => d.data().actorUid)).size;
  } catch { return -1; }
}

// ── Acoes do SuperAdmin nas ultimas 24h (campos reais: userRole + timestamp) ──
async function countAcoesSuperAdmin24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('audit_logs')
      .where('userRole', '==', 'superadmin')            // gravado por logAiCall (W2-8)
      .where('timestamp', '>=', Timestamp.fromDate(since)) // campo REAL do audit.ts
      .count()
      .get();
    return snap.data().count;
  } catch { return -1; }
}

// ── Comunicados de obito aguardando validacao (status REAL: 'submitted') ──
async function countComunicadosObitoSemValidar(): Promise<{
  count: number;
  maisAntigo?: string;
}> {
  try {
    const snap = await db()
      .collection('death_notifications')
      .where('status', '==', 'submitted')       // valor real gravado por createDeathNotification
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();

    if (snap.empty) return { count: 0 };

    const maisAntigo = snap.docs[0].data().createdAt?.toDate?.()?.toISOString();
    return { count: snap.size, maisAntigo };
  } catch (err) {
    console.error('[countComunicados] falha (índice ausente?):', err); // NÃO engolir mais
    return { count: -1 }; // -1 = "sem dado", distinto de "zero pendências"
  }
}

// ── Gera alertas operacionais ────────────────────────────────
function generateAlerts(
  data: Omit<OperationalSnapshot, 'alerts'>,
  config: MonitorConfig,
  extra: {
    servicosAtrasadosIds: string[];
    comunicadoMaisAntigo?: string;
  }
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  if (data.servicosAtrasados >= config.thresholds.servicosAtrasadosMax) {
    alerts.push({
      id: crypto.randomUUID(),
      module: 'operational',
      severity: 'warning',
      title: 'Servicos com atraso critico',
      description: `${data.servicosAtrasados} servico(s) pendentes ha mais de 72h sem resolucao.`,
      metadata: { ids: extra.servicosAtrasadosIds.slice(0, 10) },
      createdAt: now,
    });
  }

  if (data.comunicadosObitoSemValidar > 0) {
    const idadeMsg = extra.comunicadoMaisAntigo
      ? ` O mais antigo data de ${new Date(extra.comunicadoMaisAntigo).toLocaleDateString('pt-BR')}.`
      : '';
    alerts.push({
      id: crypto.randomUUID(),
      module: 'operational',
      severity: data.comunicadosObitoSemValidar > 5 ? 'critical' : 'warning',
      title: 'Comunicados de obito pendentes',
      description: `${data.comunicadosObitoSemValidar} comunicado(s) de obito aguardando validacao de gestor.${idadeMsg}`,
      createdAt: now,
    });
  }

  if (data.gestoresAtivos === 0) {
    alerts.push({
      id: crypto.randomUUID(),
      module: 'operational',
      severity: 'critical',
      title: 'Nenhum gestor ativo',
      description: 'Nenhum gestor fez login nos ultimos 30 dias. Operacoes podem estar sem supervisao.',
      createdAt: now,
    });
  }

  if (data.acoesSuperAdmin24h > 50) {
    alerts.push({
      id: crypto.randomUUID(),
      module: 'operational',
      severity: 'warning',
      title: 'Volume alto de acoes SuperAdmin',
      description: `${data.acoesSuperAdmin24h} acoes de SuperAdmin registradas nas ultimas 24h. Verifique o log de auditoria.`,
      createdAt: now,
    });
  }

  return alerts;
}

// ── Funcao principal exportada ───────────────────────────────
export async function runOperationalMonitor(
  config: MonitorConfig
): Promise<OperationalSnapshot> {
  console.log('[OperationalMonitor] Iniciando verificacao...');

  const [
    memoriaisCreados24h,
    servicosSolicitados24h,
    servicosPendentes,
    servicosAtrasadosResult,
    planosAtivos,
    gestoresAtivos,
    acoesSuperAdmin24h,
    comunicadosResult,
  ] = await Promise.all([
    countMemoriaisCreados24h(),
    countServicosSolicitados24h(),
    countServicosPendentes(),
    countServicosAtrasados(),
    countPlanosAtivos(),
    countGestoresAtivos(),
    countAcoesSuperAdmin24h(),
    countComunicadosObitoSemValidar(),
  ]);

  const base: Omit<OperationalSnapshot, 'alerts'> = {
    timestamp: new Date().toISOString(),
    memoriaisCreados24h,
    servicosSolicitados24h,
    servicosPendentes,
    servicosAtrasados: servicosAtrasadosResult.count,
    planosAtivos,
    gestoresAtivos,
    acoesSuperAdmin24h,
    comunicadosObitoSemValidar: comunicadosResult.count,
  };

  const alerts = generateAlerts(base, config, {
    servicosAtrasadosIds: servicosAtrasadosResult.ids,
    comunicadoMaisAntigo: comunicadosResult.maisAntigo,
  });

  console.log(
    `[OperationalMonitor] Servicos pendentes: ${base.servicosPendentes} | Alertas: ${alerts.length}`
  );

  return { ...base, alerts };
}
