// ============================================================
// MemorialOS Monitor — Monitoramento Tecnico
// Verifica: uptime do app, latencia, autenticacao, erros
// Frequencia: a cada 5 minutos
// ============================================================

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { TechnicalSnapshot, Alert, MonitorConfig } from './types';

const APP_URL = 'https://msrtehs.github.io/memorialos/';
const FIRESTORE_TEST_DOC = '_monitor_health_check';

// ── Verifica se o app esta acessivel e mede latencia HTTP ───
async function checkAppUptime(): Promise<{
  status: 'online' | 'degraded' | 'offline';
  responseTimeMs: number;
  httpStatusCode: number;
}> {
  const start = Date.now();
  try {
    const res = await fetch(APP_URL, { method: 'GET', signal: AbortSignal.timeout(10000) });
    const responseTimeMs = Date.now() - start;
    const httpStatusCode = res.status;
    const status = !res.ok
      ? 'offline'
      : responseTimeMs > 3000
      ? 'degraded'
      : 'online';
    return { status, responseTimeMs, httpStatusCode };
  } catch {
    return { status: 'offline', responseTimeMs: Date.now() - start, httpStatusCode: 0 };
  }
}

// ── Mede latencia do Firestore com uma leitura real ─────────
async function checkFirestoreLatency(): Promise<number> {
  const db = getFirestore();
  const start = Date.now();
  try {
    await db.collection('_monitor').doc(FIRESTORE_TEST_DOC).get();
    return Date.now() - start;
  } catch {
    return -1;
  }
}

// ── Conta usuarios ativos nas ultimas 24h via Firestore ─────
async function countActiveUsers24h(): Promise<number> {
  const db = getFirestore();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await db
      .collection('profiles')
      .where('lastLoginAt', '>=', Timestamp.fromDate(since))
      .count()
      .get();
    return snap.data().count;
  } catch {
    return -1;
  }
}

// ── Conta tentativas de login com falha (ultimas 24h) ───────
async function countFailedLogins24h(): Promise<number> {
  const db = getFirestore();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await db
      .collection('audit_logs')
      .where('action', '==', 'LOGIN_FAILED')
      .where('createdAt', '>=', Timestamp.fromDate(since))
      .count()
      .get();
    return snap.data().count;
  } catch {
    return 0;
  }
}

// ── Conta novos cadastros (ultimas 24h) ─────────────────────
async function countNewSignups24h(): Promise<number> {
  const db = getFirestore();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await db
      .collection('profiles')
      .where('createdAt', '>=', Timestamp.fromDate(since))
      .count()
      .get();
    return snap.data().count;
  } catch {
    return 0;
  }
}

// ── Conta erros de Functions nas ultimas 24h ────────────────
async function countFunctionsErrors24h(): Promise<number> {
  const db = getFirestore();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const snap = await db
      .collection('monitor_function_errors')
      .where('timestamp', '>=', Timestamp.fromDate(since))
      .count()
      .get();
    return snap.data().count;
  } catch {
    return 0;
  }
}

// ── Conta chamadas a API Gemini hoje ────────────────────────
async function countGeminiCallsToday(): Promise<number> {
  const db = getFirestore();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  try {
    const snap = await db
      .collection('audit_logs')
      .where('action', '==', 'GEMINI_API_CALL')
      .where('createdAt', '>=', Timestamp.fromDate(startOfDay))
      .count()
      .get();
    return snap.data().count;
  } catch {
    return 0;
  }
}

// ── Gera alertas baseados nos dados coletados ───────────────
function generateAlerts(
  data: Omit<TechnicalSnapshot, 'alerts'>,
  config: MonitorConfig
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  if (data.appStatus === 'offline') {
    alerts.push({
      id: crypto.randomUUID(),
      module: 'technical',
      severity: 'critical',
      title: 'App fora do ar',
      description: `O MemorialOS nao esta respondendo. Codigo HTTP: ${data.httpStatusCode}. Latencia: ${data.responseTimeMs}ms.`,
      createdAt: now,
    });
  } else if (data.appStatus === 'degraded') {
    alerts.push({
      id: crypto.randomUUID(),
      module: 'technical',
      severity: 'warning',
      title: 'App com desempenho degradado',
      description: `Tempo de resposta elevado: ${data.responseTimeMs}ms (limite: ${config.thresholds.responseTimeMs}ms).`,
      createdAt: now,
    });
  }

  if (data.firestoreLatencyMs === -1) {
    alerts.push({
      id: crypto.randomUUID(),
      module: 'technical',
      severity: 'critical',
      title: 'Firestore inacessivel',
      description: 'Nao foi possivel conectar ao Firestore. Dados do app podem estar indisponiveis.',
      createdAt: now,
    });
  } else if (data.firestoreLatencyMs > 2000) {
    alerts.push({
      id: crypto.randomUUID(),
      module: 'technical',
      severity: 'warning',
      title: 'Firestore lento',
      description: `Latencia do Firestore: ${data.firestoreLatencyMs}ms. Isso pode impactar a performance do app.`,
      createdAt: now,
    });
  }

  if (data.failedLogins24h >= config.thresholds.failedLoginsMax) {
    alerts.push({
      id: crypto.randomUUID(),
      module: 'technical',
      severity: 'critical',
      title: 'Possivel ataque de forca bruta',
      description: `${data.failedLogins24h} tentativas de login com falha nas ultimas 24h (limite: ${config.thresholds.failedLoginsMax}).`,
      metadata: { failedLogins: data.failedLogins24h },
      createdAt: now,
    });
  }

  if (data.functionsErrors24h > 10) {
    alerts.push({
      id: crypto.randomUUID(),
      module: 'technical',
      severity: 'warning',
      title: 'Erros nas Cloud Functions',
      description: `${data.functionsErrors24h} erros nas Cloud Functions nas ultimas 24h.`,
      createdAt: now,
    });
  }

  if (data.geminiApiCallsToday > 800) {
    alerts.push({
      id: crypto.randomUUID(),
      module: 'technical',
      severity: 'warning',
      title: 'Quota da API Gemini proxima do limite',
      description: `${data.geminiApiCallsToday} chamadas a API Gemini hoje. Monitore para evitar bloqueio.`,
      createdAt: now,
    });
  }

  return alerts;
}

// ── Funcao principal exportada ──────────────────────────────
export async function runTechnicalMonitor(
  config: MonitorConfig
): Promise<TechnicalSnapshot> {
  console.log('[TechnicalMonitor] Iniciando verificacao...');

  const [
    uptimeResult,
    firestoreLatencyMs,
    activeUsers24h,
    failedLogins24h,
    newSignups24h,
    functionsErrors24h,
    geminiApiCallsToday,
  ] = await Promise.all([
    checkAppUptime(),
    checkFirestoreLatency(),
    countActiveUsers24h(),
    countFailedLogins24h(),
    countNewSignups24h(),
    countFunctionsErrors24h(),
    countGeminiCallsToday(),
  ]);

  const base: Omit<TechnicalSnapshot, 'alerts'> = {
    timestamp: new Date().toISOString(),
    appStatus: uptimeResult.status,
    responseTimeMs: uptimeResult.responseTimeMs,
    httpStatusCode: uptimeResult.httpStatusCode,
    firestoreLatencyMs,
    activeUsers24h,
    failedLogins24h,
    newSignups24h,
    functionsErrors24h,
    geminiApiCallsToday,
  };

  const alerts = generateAlerts(base, config);

  console.log(
    `[TechnicalMonitor] Status: ${base.appStatus} | Alertas: ${alerts.length}`
  );

  return { ...base, alerts };
}
