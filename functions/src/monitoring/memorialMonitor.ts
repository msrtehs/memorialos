// ============================================================
// MemorialOS Monitor — Monitoramento de Memoriais
// Verifica: memoriais desatualizados, jazigos, planos, visitas
// Frequencia: diariamente as 7h
// ============================================================

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { MemorialSnapshot, Alert, MonitorConfig } from './types';

const db = () => getFirestore();

// ── Total de memoriais (falecidos) cadastrados ──────────────
async function countTotalMemoriais(): Promise<number> {
  try {
    const snap = await db().collection('deceaseds').count().get();
    return snap.data().count;
  } catch { return 0; }
}

// ── Memoriais sem nenhuma atualizacao ha mais de N dias ──────
async function countMemoriaisSemAtualizacao(dias: number): Promise<{
  count: number;
  exemplos: { id: string; nome: string; diasSemAtualizar: number }[];
}> {
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('deceaseds')
      .where('updatedAt', '<=', Timestamp.fromDate(limite))
      .orderBy('updatedAt', 'asc')
      .limit(10)
      .get();

    const exemplos = snap.docs.map(d => {
      const data = d.data();
      const updatedAt: Date = data.updatedAt?.toDate?.() ?? new Date(0);
      const diasSemAtualizar = Math.floor(
        (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: d.id,
        nome: data.name ?? 'Desconhecido',
        diasSemAtualizar,
      };
    });

    const totalSnap = await db()
      .collection('deceaseds')
      .where('updatedAt', '<=', Timestamp.fromDate(limite))
      .count()
      .get();

    return { count: totalSnap.data().count, exemplos };
  } catch { return { count: 0, exemplos: [] }; }
}

// ── Memoriais sem foto principal ─────────────────────────────
async function countMemoriaisSemFoto(): Promise<number> {
  try {
    const snap = await db()
      .collection('deceaseds')
      .where('photoURL', '==', null)
      .count()
      .get();
    return snap.data().count;
  } catch {
    try {
      const snap2 = await db()
        .collection('deceaseds')
        .where('photoURL', '==', '')
        .count()
        .get();
      return snap2.data().count;
    } catch { return 0; }
  }
}

// ── Jazigos sem manutencao registrada ha mais de N dias ──────
async function countJazigosSemManutencao(dias: number): Promise<{
  count: number;
  exemplos: { jazigo: string; cemiterio: string; diasSemManutencao: number }[];
}> {
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('plots')
      .where('lastMaintenanceAt', '<=', Timestamp.fromDate(limite))
      .orderBy('lastMaintenanceAt', 'asc')
      .limit(10)
      .get();

    const exemplos = snap.docs.map(d => {
      const data = d.data();
      const ultimaManutencao: Date = data.lastMaintenanceAt?.toDate?.() ?? new Date(0);
      const diasSemManutencao = Math.floor(
        (Date.now() - ultimaManutencao.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        jazigo: data.identifier ?? d.id,
        cemiterio: data.cemeteryId ?? 'Nao informado',
        diasSemManutencao,
      };
    });

    const totalSnap = await db()
      .collection('plots')
      .where('lastMaintenanceAt', '<=', Timestamp.fromDate(limite))
      .count()
      .get();

    return { count: totalSnap.data().count, exemplos };
  } catch { return { count: 0, exemplos: [] }; }
}

// ── Planos funerarios vencendo em N dias ─────────────────────
async function countPlanosFunerariosVencendo(dias: number): Promise<{
  count: number;
  exemplos: { id: string; titular: string; vencimentoEm: string }[];
}> {
  const agora = new Date();
  const futuro = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('funeral_plans')
      .where('status', '==', 'ativo')
      .where('expiresAt', '>=', Timestamp.fromDate(agora))
      .where('expiresAt', '<=', Timestamp.fromDate(futuro))
      .orderBy('expiresAt', 'asc')
      .limit(10)
      .get();

    const exemplos = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        titular: data.holderName ?? 'Desconhecido',
        vencimentoEm: data.expiresAt?.toDate?.()?.toLocaleDateString('pt-BR') ?? '',
      };
    });

    const totalSnap = await db()
      .collection('funeral_plans')
      .where('status', '==', 'ativo')
      .where('expiresAt', '>=', Timestamp.fromDate(agora))
      .where('expiresAt', '<=', Timestamp.fromDate(futuro))
      .count()
      .get();

    return { count: totalSnap.data().count, exemplos };
  } catch { return { count: 0, exemplos: [] }; }
}

// ── Visitas aos memoriais hoje e na semana ───────────────────
async function countVisitas(): Promise<{ hoje: number; semana: number }> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [hojeSnap, semanaSnap] = await Promise.all([
      db()
        .collection('memorial_visits')
        .where('visitedAt', '>=', Timestamp.fromDate(startOfDay))
        .count()
        .get(),
      db()
        .collection('memorial_visits')
        .where('visitedAt', '>=', Timestamp.fromDate(startOfWeek))
        .count()
        .get(),
    ]);
    return {
      hoje: hojeSnap.data().count,
      semana: semanaSnap.data().count,
    };
  } catch { return { hoje: 0, semana: 0 }; }
}

// ── Fotos adicionadas nos ultimos 7 dias ─────────────────────
async function countFotosAdicionadas7d(): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    const snap = await db()
      .collection('memorial_photos')
      .where('addedAt', '>=', Timestamp.fromDate(since))
      .count()
      .get();
    return snap.data().count;
  } catch { return 0; }
}

// ── Gera alertas de memorial ─────────────────────────────────
function generateAlerts(
  data: Omit<MemorialSnapshot, 'alerts'>,
  config: MonitorConfig,
  extra: {
    memoriaisDesatualizados: { id: string; nome: string; diasSemAtualizar: number }[];
    jazigosVencidos: { jazigo: string; cemiterio: string; diasSemManutencao: number }[];
    planosVencendo: { id: string; titular: string; vencimentoEm: string }[];
  }
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  if (data.memoriaisSemAtualizacao30d > 0) {
    const exemplosTexto = extra.memoriaisDesatualizados
      .slice(0, 3)
      .map(m => `${m.nome} (${m.diasSemAtualizar} dias)`)
      .join(', ');
    alerts.push({
      id: crypto.randomUUID(),
      module: 'memorial',
      severity: data.memoriaisSemAtualizacao30d > 20 ? 'warning' : 'info',
      title: `${data.memoriaisSemAtualizacao30d} memorial(is) sem atualizacao`,
      description: `Memoriais sem atividade ha mais de ${config.thresholds.memoriaisSemAtualizacaoDias} dias. Exemplos: ${exemplosTexto}.`,
      metadata: { memoriais: extra.memoriaisDesatualizados },
      createdAt: now,
    });
  }

  if (data.jazigosSemManutencao90d > 0) {
    const exemplosTexto = extra.jazigosVencidos
      .slice(0, 3)
      .map(j => `${j.jazigo} em ${j.cemiterio} (${j.diasSemManutencao} dias)`)
      .join('; ');
    alerts.push({
      id: crypto.randomUUID(),
      module: 'memorial',
      severity: 'warning',
      title: `${data.jazigosSemManutencao90d} jazigo(s) sem manutencao`,
      description: `Jazigos sem registro de manutencao ha mais de ${config.thresholds.jazigosSemManutencaoDias} dias. Exemplos: ${exemplosTexto}.`,
      metadata: { jazigos: extra.jazigosVencidos },
      createdAt: now,
    });
  }

  if (data.planosFunerariosVencendo30d > 0) {
    const exemplosTexto = extra.planosVencendo
      .slice(0, 3)
      .map(p => `${p.titular} (vence ${p.vencimentoEm})`)
      .join(', ');
    alerts.push({
      id: crypto.randomUUID(),
      module: 'memorial',
      severity: 'warning',
      title: `${data.planosFunerariosVencendo30d} plano(s) funerario(s) vencendo`,
      description: `Planos que vencem nos proximos ${config.thresholds.planoVencendoDias} dias: ${exemplosTexto}.`,
      metadata: { planos: extra.planosVencendo },
      createdAt: now,
    });
  }

  if (data.memoriaisSemFoto > 10) {
    alerts.push({
      id: crypto.randomUUID(),
      module: 'memorial',
      severity: 'info',
      title: `${data.memoriaisSemFoto} memoriais sem foto`,
      description: 'Muitos memoriais ainda nao possuem foto do falecido. Considere notificar as familias.',
      createdAt: now,
    });
  }

  return alerts;
}

// ── Funcao principal exportada ───────────────────────────────
export async function runMemorialMonitor(
  config: MonitorConfig
): Promise<MemorialSnapshot> {
  console.log('[MemorialMonitor] Iniciando verificacao diaria...');

  const [
    totalMemoriais,
    semAtualizacaoResult,
    memoriaisSemFoto,
    jazigosSemManutencaoResult,
    planosVencendoResult,
    visitas,
    fotosAdicionadas7d,
  ] = await Promise.all([
    countTotalMemoriais(),
    countMemoriaisSemAtualizacao(config.thresholds.memoriaisSemAtualizacaoDias),
    countMemoriaisSemFoto(),
    countJazigosSemManutencao(config.thresholds.jazigosSemManutencaoDias),
    countPlanosFunerariosVencendo(config.thresholds.planoVencendoDias),
    countVisitas(),
    countFotosAdicionadas7d(),
  ]);

  const base: Omit<MemorialSnapshot, 'alerts'> = {
    timestamp: new Date().toISOString(),
    totalMemoriais,
    memoriaisSemAtualizacao30d: semAtualizacaoResult.count,
    memoriaisSemFoto,
    jazigosSemManutencao90d: jazigosSemManutencaoResult.count,
    planosFunerariosVencendo30d: planosVencendoResult.count,
    visitasHoje: visitas.hoje,
    visitasSemana: visitas.semana,
    fotosAdicionadas7d,
  };

  const alerts = generateAlerts(base, config, {
    memoriaisDesatualizados: semAtualizacaoResult.exemplos,
    jazigosVencidos: jazigosSemManutencaoResult.exemplos,
    planosVencendo: planosVencendoResult.exemplos,
  });

  console.log(
    `[MemorialMonitor] Total memoriais: ${totalMemoriais} | Alertas: ${alerts.length}`
  );

  return { ...base, alerts };
}
