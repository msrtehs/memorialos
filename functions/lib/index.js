"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMonitoringData = exports.manualMonitorTrigger = exports.dailyReport = exports.monitorMemorials = exports.monitorOperational = exports.monitorTechnical = exports.chatWithManagerAgent = exports.chatWithAI = exports.generateObituary = exports.deleteTenantUser = exports.deleteManagerAccount = exports.disableTenantUser = exports.toggleManagerStatus = exports.addUserToTenant = exports.createManagerAccount = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const genai_1 = require("@google/genai");
// Monitoring imports
const technicalMonitor_1 = require("./monitoring/technicalMonitor");
const operationalMonitor_1 = require("./monitoring/operationalMonitor");
const memorialMonitor_1 = require("./monitoring/memorialMonitor");
const alertService_1 = require("./monitoring/alertService");
const dashboardService_1 = require("./monitoring/dashboardService");
(0, app_1.initializeApp)();
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
function generateTenantId(name) {
    return `tenant_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
}
// ─── createManagerAccount ─────────────────────────────────────────────────────
// Creates the FIRST manager user for a brand-new tenant (prefecture).
// Generates tenantId, creates Auth user, sets custom claims, writes
// tenant + profile documents.
exports.createManagerAccount = (0, https_1.onCall)(async (request) => {
    if (!request.auth || request.auth.token['role'] !== 'superadmin') {
        throw new https_1.HttpsError('permission-denied', 'Acesso negado');
    }
    const { prefectureName, managerEmail, temporaryPassword } = request.data;
    if (!prefectureName || !managerEmail || !temporaryPassword) {
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos');
    }
    const auth = (0, auth_1.getAuth)();
    const db = (0, firestore_1.getFirestore)();
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
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await db.collection('profiles').doc(user.uid).set({
        email: managerEmail,
        role: 'manager',
        tenantId,
        active: true,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
// ─── addUserToTenant ──────────────────────────────────────────────────────────
// Adds an additional manager login to an EXISTING tenant (prefecture).
// Does NOT create a new tenant document — only creates Auth user + profile.
exports.addUserToTenant = (0, https_1.onCall)(async (request) => {
    if (!request.auth || request.auth.token['role'] !== 'superadmin') {
        throw new https_1.HttpsError('permission-denied', 'Acesso negado');
    }
    const { tenantId, email, password } = request.data;
    if (!tenantId || !email || !password) {
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos');
    }
    const auth = (0, auth_1.getAuth)();
    const db = (0, firestore_1.getFirestore)();
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
        throw new https_1.HttpsError('not-found', 'Prefeitura não encontrada');
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
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { success: true, uid: user.uid };
});
// ─── toggleManagerStatus ──────────────────────────────────────────────────────
// Disables or re-enables the PRIMARY manager's Auth account and updates
// the tenant's active flag. Used for whole-tenant activation / deactivation.
exports.toggleManagerStatus = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth || request.auth.token['role'] !== 'superadmin') {
        throw new https_1.HttpsError('permission-denied', 'Acesso negado');
    }
    const { managerUid, disabled } = request.data;
    if (!managerUid || typeof disabled !== 'boolean') {
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos');
    }
    const auth = (0, auth_1.getAuth)();
    const db = (0, firestore_1.getFirestore)();
    await auth.updateUser(managerUid, { disabled });
    const profileSnap = await db.collection('profiles').doc(managerUid).get();
    if (profileSnap.exists) {
        const tenantId = (_a = profileSnap.data()) === null || _a === void 0 ? void 0 : _a.tenantId;
        if (tenantId) {
            await db.collection('tenants').doc(tenantId).update({ active: !disabled });
        }
    }
    return { success: true };
});
// ─── disableTenantUser ────────────────────────────────────────────────────────
// Toggles a single user's Auth disabled flag and mirrors the active field
// in their profile. Does NOT affect the tenant document.
exports.disableTenantUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth || request.auth.token['role'] !== 'superadmin') {
        throw new https_1.HttpsError('permission-denied', 'Acesso negado');
    }
    const { uid, disabled } = request.data;
    if (!uid || typeof disabled !== 'boolean') {
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos');
    }
    const auth = (0, auth_1.getAuth)();
    const db = (0, firestore_1.getFirestore)();
    await auth.updateUser(uid, { disabled });
    await db.collection('profiles').doc(uid).update({ active: !disabled });
    return { success: true };
});
// ─── deleteManagerAccount ─────────────────────────────────────────────────────
// Removes the PRIMARY manager from Firebase Auth and deletes the associated
// profile AND tenant documents. Use to delete an entire prefecture.
exports.deleteManagerAccount = (0, https_1.onCall)(async (request) => {
    if (!request.auth || request.auth.token['role'] !== 'superadmin') {
        throw new https_1.HttpsError('permission-denied', 'Acesso negado');
    }
    const { managerUid, tenantId } = request.data;
    if (!managerUid || !tenantId) {
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos');
    }
    const auth = (0, auth_1.getAuth)();
    const db = (0, firestore_1.getFirestore)();
    // Delete all profiles that belong to this tenant
    const profilesSnap = await db
        .collection('profiles')
        .where('tenantId', '==', tenantId)
        .get();
    const deleteProfiles = profilesSnap.docs.map(async (doc) => {
        try {
            await auth.deleteUser(doc.id);
        }
        catch (_) {
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
exports.deleteTenantUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth || request.auth.token['role'] !== 'superadmin') {
        throw new https_1.HttpsError('permission-denied', 'Acesso negado');
    }
    const { uid } = request.data;
    if (!uid) {
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos');
    }
    const auth = (0, auth_1.getAuth)();
    const db = (0, firestore_1.getFirestore)();
    await auth.deleteUser(uid);
    await db.collection('profiles').doc(uid).delete();
    return { success: true };
});
// ─── AI Functions (Gemini) ───────────────────────────────────────────────────
function getAI() {
    const key = geminiApiKey.value();
    if (!key)
        throw new https_1.HttpsError('failed-precondition', 'Gemini API key not configured');
    return new genai_1.GoogleGenAI({ apiKey: key });
}
// Generate obituary text
exports.generateObituary = (0, https_1.onCall)({ secrets: [geminiApiKey] }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login necessario');
    const data = request.data;
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
exports.chatWithAI = (0, https_1.onCall)({ secrets: [geminiApiKey] }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login necessario');
    const { history, message, userContext } = request.data;
    if (!message)
        throw new https_1.HttpsError('invalid-argument', 'Mensagem vazia');
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
            role: item.role,
            parts: [{ text: item.parts }],
        })),
    });
    const result = await chat.sendMessage({ message });
    return { text: result.text || '' };
});
// Chat with Manager Agent (admin AI agents)
exports.chatWithManagerAgent = (0, https_1.onCall)({ secrets: [geminiApiKey] }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login necessario');
    const { agent, history, message, contextSummary } = request.data;
    if (!message || !agent)
        throw new https_1.HttpsError('invalid-argument', 'Dados invalidos');
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
            role: item.role,
            parts: [{ text: item.parts }],
        })),
    });
    const result = await chat.sendMessage({ message });
    return { text: result.text || '' };
});
// ─── Monitoring Agent ───────────────────────────────────────────────────────
function getMonitorConfig() {
    var _a, _b, _c, _d;
    return {
        whatsapp: {
            enabled: process.env.WHATSAPP_ENABLED === 'true',
            evolutionApiUrl: (_a = process.env.EVOLUTION_API_URL) !== null && _a !== void 0 ? _a : '',
            evolutionApiKey: (_b = process.env.EVOLUTION_API_KEY) !== null && _b !== void 0 ? _b : '',
            instanceName: (_c = process.env.EVOLUTION_INSTANCE) !== null && _c !== void 0 ? _c : 'memorialos',
            recipients: JSON.parse((_d = process.env.WHATSAPP_RECIPIENTS) !== null && _d !== void 0 ? _d : '[]'),
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
async function logFunctionError(functionName, error) {
    try {
        await (0, firestore_1.getFirestore)().collection('monitor_function_errors').add({
            function: functionName,
            error: String(error),
            timestamp: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (_a) {
        console.error('[Monitor] Nao foi possivel registrar erro no Firestore');
    }
}
// 1. MONITORAMENTO TECNICO — a cada 5 minutos
exports.monitorTechnical = (0, scheduler_1.onSchedule)({
    schedule: 'every 5 minutes',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
}, async () => {
    const config = getMonitorConfig();
    try {
        console.log('[monitorTechnical] Executando...');
        const snapshot = await (0, technicalMonitor_1.runTechnicalMonitor)(config);
        await (0, firestore_1.getFirestore)()
            .collection('monitor_metrics')
            .doc('current')
            .set({ technical: snapshot, updatedAt: new Date().toISOString() }, { merge: true });
        const criticalAlerts = snapshot.alerts.filter(a => a.severity === 'critical');
        if (criticalAlerts.length > 0) {
            await (0, alertService_1.dispatchAlerts)(criticalAlerts, config);
        }
        console.log(`[monitorTechnical] Concluido. Status: ${snapshot.appStatus}`);
    }
    catch (err) {
        console.error('[monitorTechnical] Erro:', err);
        await logFunctionError('monitorTechnical', err);
    }
});
// 2. MONITORAMENTO OPERACIONAL — a cada 30 minutos
exports.monitorOperational = (0, scheduler_1.onSchedule)({
    schedule: 'every 30 minutes',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 120,
}, async () => {
    const config = getMonitorConfig();
    try {
        console.log('[monitorOperational] Executando...');
        const snapshot = await (0, operationalMonitor_1.runOperationalMonitor)(config);
        await (0, firestore_1.getFirestore)()
            .collection('monitor_metrics')
            .doc('current')
            .set({ operational: snapshot, updatedAt: new Date().toISOString() }, { merge: true });
        if (snapshot.alerts.length > 0) {
            await (0, alertService_1.dispatchAlerts)(snapshot.alerts, config);
        }
        console.log(`[monitorOperational] Concluido. Alertas: ${snapshot.alerts.length}`);
    }
    catch (err) {
        console.error('[monitorOperational] Erro:', err);
        await logFunctionError('monitorOperational', err);
    }
});
// 3. MONITORAMENTO DE MEMORIAIS — diariamente as 07:00 BRT
exports.monitorMemorials = (0, scheduler_1.onSchedule)({
    schedule: '0 7 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
}, async () => {
    const config = getMonitorConfig();
    try {
        console.log('[monitorMemorials] Executando verificacao diaria...');
        const snapshot = await (0, memorialMonitor_1.runMemorialMonitor)(config);
        await (0, firestore_1.getFirestore)()
            .collection('monitor_metrics')
            .doc('current')
            .set({ memorial: snapshot, updatedAt: new Date().toISOString() }, { merge: true });
        if (snapshot.alerts.length > 0) {
            await (0, alertService_1.dispatchAlerts)(snapshot.alerts, config);
        }
        console.log(`[monitorMemorials] Concluido. Total memoriais: ${snapshot.totalMemoriais}`);
    }
    catch (err) {
        console.error('[monitorMemorials] Erro:', err);
        await logFunctionError('monitorMemorials', err);
    }
});
// 4. RELATORIO DIARIO COMPLETO — diariamente as 07:30 BRT
exports.dailyReport = (0, scheduler_1.onSchedule)({
    schedule: '30 7 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 120,
}, async () => {
    const config = getMonitorConfig();
    try {
        console.log('[dailyReport] Gerando relatorio diario...');
        const metrics = await (0, dashboardService_1.getCurrentMetrics)();
        if (!metrics) {
            console.warn('[dailyReport] Nenhuma metrica atual disponivel. Pulando relatorio.');
            return;
        }
        await (0, dashboardService_1.saveHistoricalPoint)(metrics);
        await (0, alertService_1.sendDailyReport)(metrics, config);
        console.log(`[dailyReport] Relatorio enviado. Health Score: ${metrics.systemHealthScore}/100`);
    }
    catch (err) {
        console.error('[dailyReport] Erro:', err);
        await logFunctionError('dailyReport', err);
    }
});
// 5. TRIGGER MANUAL (HTTP) — para testes e forcar execucao
exports.manualMonitorTrigger = (0, https_1.onRequest)({
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
}, async (req, res) => {
    var _a, _b, _c;
    const authHeader = (_a = req.headers.authorization) !== null && _a !== void 0 ? _a : '';
    const token = (_b = process.env.MONITOR_TRIGGER_TOKEN) !== null && _b !== void 0 ? _b : '';
    if (token && authHeader !== `Bearer ${token}`) {
        res.status(401).json({ error: 'Nao autorizado' });
        return;
    }
    const config = getMonitorConfig();
    const module = (_c = req.query.module) !== null && _c !== void 0 ? _c : 'all';
    try {
        console.log(`[manualTrigger] Executando modulo: ${module}`);
        const results = {};
        if (module === 'technical' || module === 'all') {
            results.technical = await (0, technicalMonitor_1.runTechnicalMonitor)(config);
        }
        if (module === 'operational' || module === 'all') {
            results.operational = await (0, operationalMonitor_1.runOperationalMonitor)(config);
        }
        if (module === 'memorial' || module === 'all') {
            results.memorial = await (0, memorialMonitor_1.runMemorialMonitor)(config);
        }
        if (module === 'all' && results.technical && results.operational && results.memorial) {
            const metrics = await (0, dashboardService_1.saveCurrentMetrics)(results.technical, results.operational, results.memorial);
            results.systemHealthScore = metrics.systemHealthScore;
            results.alertsTotal = metrics.alertsOpen.length;
            await (0, alertService_1.dispatchAlerts)(metrics.alertsOpen, config);
        }
        res.status(200).json({ success: true, module, results });
    }
    catch (err) {
        console.error('[manualTrigger] Erro:', err);
        res.status(500).json({ error: String(err) });
    }
});
// 6. CALLABLE — expoe metricas para o dashboard React
exports.getMonitoringData = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuario nao autenticado');
    }
    const role = request.auth.token['role'];
    if (role !== 'superadmin') {
        throw new https_1.HttpsError('permission-denied', 'Apenas SuperAdmins podem ver o dashboard de monitoramento');
    }
    const { days = 7 } = request.data;
    const [current, history] = await Promise.all([
        (0, dashboardService_1.getCurrentMetrics)(),
        (0, dashboardService_1.getHistory)(days),
    ]);
    return { current, history };
});
//# sourceMappingURL=index.js.map