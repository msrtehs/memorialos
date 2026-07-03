import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';

// Monitoring imports
import { runTechnicalMonitor } from './monitoring/technicalMonitor';
import { runOperationalMonitor } from './monitoring/operationalMonitor';
import { runMemorialMonitor } from './monitoring/memorialMonitor';
import { dispatchAlerts, sendDailyReport } from './monitoring/alertService';
import {
  saveCurrentMetrics,
  saveHistoricalPoint,
  getCurrentMetrics,
  getHistory,
} from './monitoring/dashboardService';
import type { MonitorConfig } from './monitoring/types';

initializeApp();

const geminiApiKey = defineSecret('GEMINI_API_KEY');

function generateTenantId(name: string): string {
  return `tenant_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
}

// ─── createManagerAccount ─────────────────────────────────────────────────────
// Creates the FIRST manager user for a brand-new tenant (prefecture).
// Generates tenantId, creates Auth user, sets custom claims, writes
// tenant + profile documents.
export const createManagerAccount = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { prefectureName, managerEmail, temporaryPassword } = request.data as {
    prefectureName: string;
    managerEmail: string;
    temporaryPassword: string;
  };

  if (!prefectureName || !managerEmail || !temporaryPassword) {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  const tenantId = generateTenantId(prefectureName);

  const user = await auth.createUser({
    email: managerEmail,
    password: temporaryPassword,
  });

  await auth.setCustomUserClaims(user.uid, {
    role: 'manager',
    tenantId,
  });

  await db.collection('tenants').doc(tenantId).set({
    name: prefectureName,
    active: true,
    managerEmail,
    managerUid: user.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.collection('profiles').doc(user.uid).set({
    email: managerEmail,
    role: 'manager',
    tenantId,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// ─── addUserToTenant ──────────────────────────────────────────────────────────
// Adds an additional manager login to an EXISTING tenant (prefecture).
// Does NOT create a new tenant document — only creates Auth user + profile.
export const addUserToTenant = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { tenantId, email, password } = request.data as {
    tenantId: string;
    email: string;
    password: string;
  };

  if (!tenantId || !email || !password) {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  const tenantDoc = await db.collection('tenants').doc(tenantId).get();
  if (!tenantDoc.exists) {
    throw new HttpsError('not-found', 'Prefeitura não encontrada');
  }

  const user = await auth.createUser({ email, password });

  await auth.setCustomUserClaims(user.uid, {
    role: 'manager',
    tenantId,
  });

  await db.collection('profiles').doc(user.uid).set({
    email,
    role: 'manager',
    tenantId,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true, uid: user.uid };
});

// ─── toggleManagerStatus ──────────────────────────────────────────────────────
// Disables or re-enables the PRIMARY manager's Auth account and updates
// the tenant's active flag. Used for whole-tenant activation / deactivation.
export const toggleManagerStatus = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { managerUid, disabled } = request.data as {
    managerUid: string;
    disabled: boolean;
  };

  if (!managerUid || typeof disabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  await auth.updateUser(managerUid, { disabled });

  const profileSnap = await db.collection('profiles').doc(managerUid).get();
  if (profileSnap.exists) {
    const tenantId = profileSnap.data()?.tenantId as string | undefined;
    if (tenantId) {
      await db.collection('tenants').doc(tenantId).update({ active: !disabled });
    }
  }

  return { success: true };
});

// ─── disableTenantUser ────────────────────────────────────────────────────────
// Toggles a single user's Auth disabled flag and mirrors the active field
// in their profile. Does NOT affect the tenant document.
export const disableTenantUser = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { uid, disabled } = request.data as { uid: string; disabled: boolean };

  if (!uid || typeof disabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  await auth.updateUser(uid, { disabled });
  await db.collection('profiles').doc(uid).update({ active: !disabled });

  return { success: true };
});

// ─── deleteManagerAccount ─────────────────────────────────────────────────────
// Removes the PRIMARY manager from Firebase Auth and deletes the associated
// profile AND tenant documents. Use to delete an entire prefecture.
export const deleteManagerAccount = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { managerUid, tenantId } = request.data as {
    managerUid: string;
    tenantId: string;
  };

  if (!managerUid || !tenantId) {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  // Delete all profiles that belong to this tenant
  const profilesSnap = await db
    .collection('profiles')
    .where('tenantId', '==', tenantId)
    .get();

  const deleteProfiles = profilesSnap.docs.map(async (doc) => {
    try {
      await auth.deleteUser(doc.id);
    } catch (_) {
      // User may already be deleted; continue
    }
    await doc.ref.delete();
  });

  await Promise.all(deleteProfiles);

  await db.collection('tenants').doc(tenantId).delete();

  return { success: true };
});

// ─── deleteTenantUser ─────────────────────────────────────────────────────────
// Removes a SINGLE user from a tenant. Deletes only Auth user + profile.
// The tenant document and other users are NOT affected.
export const deleteTenantUser = onCall(async (request) => {
  if (!request.auth || request.auth.token['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado');
  }

  const { uid } = request.data as { uid: string };

  if (!uid) {
    throw new HttpsError('invalid-argument', 'Dados inválidos');
  }

  const auth = getAuth();
  const db = getFirestore();

  await auth.deleteUser(uid);
  await db.collection('profiles').doc(uid).delete();

  return { success: true };
});

// ─── AI Functions (Gemini) ───────────────────────────────────────────────────

function getAI(): GoogleGenAI {
  const key = geminiApiKey.value();
  if (!key) throw new HttpsError('failed-precondition', 'Gemini API key not configured');
  return new GoogleGenAI({ apiKey: key });
}

// Generate obituary text
export const generateObituary = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario');

  const data = request.data as Record<string, string>;
  const ai = getAI();

  const prompt = `
    Escreva um obituario respeitoso, acolhedor e emocionante para:
    Nome: ${data.name || ''}
    Data de Nascimento: ${data.dateOfBirth || ''}
    Data de Falecimento: ${data.dateOfDeath || ''}
    Cidade: ${data.city || ''} - ${data.state || ''}
    Profissao: ${data.profession || ''}
    Hobbies/Paixoes: ${data.hobbies || ''}
    Familia: ${data.familyMembers || ''}
    Realizacoes: ${data.achievements || ''}
    Relacao com quem comunica: ${data.relationshipType || 'Nao informado'}
    Subtitulo de homenagem: ${data.relationshipLabel || 'Nao informado'}

    O tom deve ser sereno, humano e confortante para a familia.
    Escreva em portugues do Brasil. Maximo de 3 paragrafos.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return { text: response.text || '' };
});

// Chat with Memorial AI (citizen virtual assistant)
export const chatWithAI = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario');

  const { history, message, userContext } = request.data as {
    history: { role: string; parts: string }[];
    message: string;
    userContext?: string;
  };

  if (!message) throw new HttpsError('invalid-argument', 'Mensagem vazia');

  const ai = getAI();

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `Voce e o Memorial AI, um assistente virtual do sistema MemorialOS.
Seja sempre empatico, respeitoso e claro.
Voce pode ajudar com duvidas sobre comunicar obito, horarios, localizacao de jazigos e orientacoes gerais.
Nao de conselhos medicos ou juridicos definitivos.
Contexto emocional do usuario: ${userContext || 'Nao informado.'}`,
    },
    history: (history || []).map((item) => ({
      role: item.role as 'user' | 'model',
      parts: [{ text: item.parts }],
    })),
  });

  const result = await chat.sendMessage({ message });
  return { text: result.text || '' };
});

// Chat with Manager Agent (admin AI agents)
export const chatWithManagerAgent = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario');

  const { agent, history, message, contextSummary } = request.data as {
    agent: { name: string; objective: string; prompt: string; modules: string[] };
    history: { role: string; parts: string }[];
    message: string;
    contextSummary: string;
  };

  if (!message || !agent) throw new HttpsError('invalid-argument', 'Dados invalidos');

  const ai = getAI();

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `
        Voce e ${agent.name}, agente inteligente do Sistema Cemiterial Inteligente (SCI).
        Objetivo: ${agent.objective}
        Modulos autorizados: ${(agent.modules || []).join(', ') || 'todos'}
        Instrucoes especificas: ${agent.prompt}
        Contexto operacional atual: ${contextSummary || ''}

        Responda em portugues do Brasil, de forma executiva, clara e orientada a acao.
        Sempre aponte riscos sanitarios, ambientais e operacionais quando houver sinais no contexto.
      `,
    },
    history: (history || []).map((item) => ({
      role: item.role as 'user' | 'model',
      parts: [{ text: item.parts }],
    })),
  });

  const result = await chat.sendMessage({ message });
  return { text: result.text || '' };
});

// ─── Monitoring Agent ───────────────────────────────────────────────────────

function getMonitorConfig(): MonitorConfig {
  return {
    whatsapp: {
      enabled: process.env.WHATSAPP_ENABLED === 'true',
      evolutionApiUrl: process.env.EVOLUTION_API_URL ?? '',
      evolutionApiKey: process.env.EVOLUTION_API_KEY ?? '',
      instanceName: process.env.EVOLUTION_INSTANCE ?? 'memorialos',
      recipients: JSON.parse(process.env.WHATSAPP_RECIPIENTS ?? '[]'),
    },
    thresholds: {
      responseTimeMs: 3000,
      failedLoginsMax: 20,
      servicosAtrasadosMax: 5,
      memoriaisSemAtualizacaoDias: 30,
      jazigosSemManutencaoDias: 90,
      planoVencendoDias: 30,
    },
  };
}

async function logFunctionError(functionName: string, error: unknown): Promise<void> {
  try {
    await getFirestore().collection('monitor_function_errors').add({
      function: functionName,
      error: String(error),
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch {
    console.error('[Monitor] Nao foi possivel registrar erro no Firestore');
  }
}

// 1. MONITORAMENTO TECNICO — a cada 5 minutos
export const monitorTechnical = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async () => {
    const config = getMonitorConfig();
    try {
      console.log('[monitorTechnical] Executando...');
      const snapshot = await runTechnicalMonitor(config);

      await getFirestore()
        .collection('monitor_metrics')
        .doc('current')
        .set({ technical: snapshot, updatedAt: new Date().toISOString() }, { merge: true });

      const criticalAlerts = snapshot.alerts.filter(a => a.severity === 'critical');
      if (criticalAlerts.length > 0) {
        await dispatchAlerts(criticalAlerts, config);
      }

      console.log(`[monitorTechnical] Concluido. Status: ${snapshot.appStatus}`);
    } catch (err) {
      console.error('[monitorTechnical] Erro:', err);
      await logFunctionError('monitorTechnical', err);
    }
  }
);

// 2. MONITORAMENTO OPERACIONAL — a cada 30 minutos
export const monitorOperational = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 120,
  },
  async () => {
    const config = getMonitorConfig();
    try {
      console.log('[monitorOperational] Executando...');
      const snapshot = await runOperationalMonitor(config);

      await getFirestore()
        .collection('monitor_metrics')
        .doc('current')
        .set({ operational: snapshot, updatedAt: new Date().toISOString() }, { merge: true });

      if (snapshot.alerts.length > 0) {
        await dispatchAlerts(snapshot.alerts, config);
      }

      console.log(`[monitorOperational] Concluido. Alertas: ${snapshot.alerts.length}`);
    } catch (err) {
      console.error('[monitorOperational] Erro:', err);
      await logFunctionError('monitorOperational', err);
    }
  }
);

// 3. MONITORAMENTO DE MEMORIAIS — diariamente as 07:00 BRT
export const monitorMemorials = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const config = getMonitorConfig();
    try {
      console.log('[monitorMemorials] Executando verificacao diaria...');
      const snapshot = await runMemorialMonitor(config);

      await getFirestore()
        .collection('monitor_metrics')
        .doc('current')
        .set({ memorial: snapshot, updatedAt: new Date().toISOString() }, { merge: true });

      if (snapshot.alerts.length > 0) {
        await dispatchAlerts(snapshot.alerts, config);
      }

      console.log(`[monitorMemorials] Concluido. Total memoriais: ${snapshot.totalMemoriais}`);
    } catch (err) {
      console.error('[monitorMemorials] Erro:', err);
      await logFunctionError('monitorMemorials', err);
    }
  }
);

// 4. RELATORIO DIARIO COMPLETO — diariamente as 07:30 BRT
export const dailyReport = onSchedule(
  {
    schedule: '30 7 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 120,
  },
  async () => {
    const config = getMonitorConfig();
    try {
      console.log('[dailyReport] Gerando relatorio diario...');

      const metrics = await getCurrentMetrics();
      if (!metrics) {
        console.warn('[dailyReport] Nenhuma metrica atual disponivel. Pulando relatorio.');
        return;
      }

      await saveHistoricalPoint(metrics);
      await sendDailyReport(metrics, config);

      console.log(`[dailyReport] Relatorio enviado. Health Score: ${metrics.systemHealthScore}/100`);
    } catch (err) {
      console.error('[dailyReport] Erro:', err);
      await logFunctionError('dailyReport', err);
    }
  }
);

// 5. TRIGGER MANUAL (HTTP) — para testes e forcar execucao
export const manualMonitorTrigger = onRequest(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async (req, res) => {
    const authHeader = req.headers.authorization ?? '';
    const token = process.env.MONITOR_TRIGGER_TOKEN ?? '';
    if (token && authHeader !== `Bearer ${token}`) {
      res.status(401).json({ error: 'Nao autorizado' });
      return;
    }

    const config = getMonitorConfig();
    const module = (req.query.module as string) ?? 'all';

    try {
      console.log(`[manualTrigger] Executando modulo: ${module}`);
      const results: Record<string, unknown> = {};

      if (module === 'technical' || module === 'all') {
        results.technical = await runTechnicalMonitor(config);
      }
      if (module === 'operational' || module === 'all') {
        results.operational = await runOperationalMonitor(config);
      }
      if (module === 'memorial' || module === 'all') {
        results.memorial = await runMemorialMonitor(config);
      }

      if (module === 'all' && results.technical && results.operational && results.memorial) {
        const metrics = await saveCurrentMetrics(
          results.technical as any,
          results.operational as any,
          results.memorial as any
        );
        results.systemHealthScore = metrics.systemHealthScore;
        results.alertsTotal = metrics.alertsOpen.length;

        await dispatchAlerts(metrics.alertsOpen, config);
      }

      res.status(200).json({ success: true, module, results });
    } catch (err) {
      console.error('[manualTrigger] Erro:', err);
      res.status(500).json({ error: String(err) });
    }
  }
);

// 6. CALLABLE — expoe metricas para o dashboard React
export const getMonitoringData = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuario nao autenticado');
    }

    const role = request.auth.token['role'] as string | undefined;
    if (role !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Apenas SuperAdmins podem ver o dashboard de monitoramento');
    }

    const { days = 7 } = request.data as { days?: number };

    const [current, history] = await Promise.all([
      getCurrentMetrics(),
      getHistory(days),
    ]);

    return { current, history };
  }
);
