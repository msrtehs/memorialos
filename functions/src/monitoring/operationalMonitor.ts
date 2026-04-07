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

// ── Servicos solicitados nas ultimas 24h ────────────────────
async function countServicosSolicitados24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('requests')
      .where('createdAt', '>=', Timestamp.fromDate(since))
      .count()
      .get();
    return snap.data().count;
  } catch { return 0; }
}

// ── Servicos pendentes (nao concluidos) ─────────────────────
async function countServicosPendentes(): Promise<number> {
  try {
    const snap = await db()
      .collection('requests')
      .where('status', 'in', ['pendente', 'aguardando_aprovacao'])
      .count()
      .get();
    return snap.data().count;
  } catch { return 0; }
}

// ── Servicos atrasados (pendentes ha mais de 72h) ───────────
async function countServicosAtrasados(): Promise<{ count: number; ids: string[] }> {
  const limite = new Date(Date.now() - 72 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('requests')
      .where('status', 'in', ['pendente', 'aguardando_aprovacao'])
      .where('createdAt', '<=', Timestamp.fromDate(limite))
      .limit(50)
      .get();
    return {
      count: snap.size,
      ids: snap.docs.map(d => d.id),
    };
  } catch { return { count: 0, ids: [] }; }
}

// ── Planos funerarios ativos ─────────────────────────────────
async function countPlanosAtivos(): Promise<number> {
  try {
    const snap = await db()
      .collection('funeral_plans')
      .where('status', '==', 'ativo')
      .count()
      .get();
    return snap.data().count;
  } catch { return 0; }
}

// ── Gestores ativos (ultimo login < 30 dias) ─────────────────
async function countGestoresAtivos(): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('profiles')
      .where('role', 'in', ['gestor', 'manager'])
      .where('lastLoginAt', '>=', Timestamp.fromDate(since))
      .count()
      .get();
    return snap.data().count;
  } catch { return 0; }
}

// ── Acoes do SuperAdmin nas ultimas 24h ─────────────────────
async function countAcoesSuperAdmin24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('audit_logs')
      .where('userRole', '==', 'superadmin')
      .where('createdAt', '>=', Timestamp.fromDate(since))
      .count()
      .get();
    return snap.data().count;
  } catch { return 0; }
}

// ── Comunicados de obito aguardando validacao ────────────────
async function countComunicadosObitoSemValidar(): Promise<{
  count: number;
  maisAntigo?: string;
}> {
  try {
    const snap = await db()
      .collection('death_notifications')
      .where('status', '==', 'aguardando_validacao')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();

    if (snap.empty) return { count: 0 };

    const maisAntigo = snap.docs[0].data().createdAt?.toDate?.()?.toISOString();
    return { count: snap.size, maisAntigo };
  } catch { return { count: 0 }; }
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
