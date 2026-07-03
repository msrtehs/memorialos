"use strict";
// ============================================================
// MemorialOS Monitor — Monitoramento Tecnico
// Verifica: uptime do app, latencia, autenticacao, erros
// Frequencia: a cada 5 minutos
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTechnicalMonitor = runTechnicalMonitor;
const firestore_1 = require("firebase-admin/firestore");
const APP_URL = 'https://msrtehs.github.io/memorialos/';
const FIRESTORE_TEST_DOC = '_monitor_health_check';
// ── Verifica se o app esta acessivel e mede latencia HTTP ───
async function checkAppUptime() {
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
    }
    catch (_a) {
        return { status: 'offline', responseTimeMs: Date.now() - start, httpStatusCode: 0 };
    }
}
// ── Mede latencia do Firestore com uma leitura real ─────────
async function checkFirestoreLatency() {
    const db = (0, firestore_1.getFirestore)();
    const start = Date.now();
    try {
        await db.collection('_monitor').doc(FIRESTORE_TEST_DOC).get();
        return Date.now() - start;
    }
    catch (_a) {
        return -1;
    }
}
// ── Conta usuarios ativos nas ultimas 24h via Firestore ─────
async function countActiveUsers24h() {
    const db = (0, firestore_1.getFirestore)();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
        const snap = await db
            .collection('profiles')
            .where('lastLoginAt', '>=', firestore_1.Timestamp.fromDate(since))
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        return -1;
    }
}
// ── Conta tentativas de login com falha (ultimas 24h) ───────
async function countFailedLogins24h() {
    const db = (0, firestore_1.getFirestore)();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
        const snap = await db
            .collection('audit_logs')
            .where('action', '==', 'LOGIN_FAILED')
            .where('createdAt', '>=', firestore_1.Timestamp.fromDate(since))
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// ── Conta novos cadastros (ultimas 24h) ─────────────────────
async function countNewSignups24h() {
    const db = (0, firestore_1.getFirestore)();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
        const snap = await db
            .collection('profiles')
            .where('createdAt', '>=', firestore_1.Timestamp.fromDate(since))
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// ── Conta erros de Functions nas ultimas 24h ────────────────
async function countFunctionsErrors24h() {
    const db = (0, firestore_1.getFirestore)();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
        const snap = await db
            .collection('monitor_function_errors')
            .where('timestamp', '>=', firestore_1.Timestamp.fromDate(since))
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// ── Conta chamadas a API Gemini hoje ────────────────────────
async function countGeminiCallsToday() {
    const db = (0, firestore_1.getFirestore)();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    try {
        const snap = await db
            .collection('audit_logs')
            .where('action', '==', 'GEMINI_API_CALL')
            .where('createdAt', '>=', firestore_1.Timestamp.fromDate(startOfDay))
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// ── Gera alertas baseados nos dados coletados ───────────────
function generateAlerts(data, config) {
    const alerts = [];
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
    }
    else if (data.appStatus === 'degraded') {
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
    }
    else if (data.firestoreLatencyMs > 2000) {
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
async function runTechnicalMonitor(config) {
    console.log('[TechnicalMonitor] Iniciando verificacao...');
    const [uptimeResult, firestoreLatencyMs, activeUsers24h, failedLogins24h, newSignups24h, functionsErrors24h, geminiApiCallsToday,] = await Promise.all([
        checkAppUptime(),
        checkFirestoreLatency(),
        countActiveUsers24h(),
        countFailedLogins24h(),
        countNewSignups24h(),
        countFunctionsErrors24h(),
        countGeminiCallsToday(),
    ]);
    const base = {
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
    console.log(`[TechnicalMonitor] Status: ${base.appStatus} | Alertas: ${alerts.length}`);
    return Object.assign(Object.assign({}, base), { alerts });
}
//# sourceMappingURL=technicalMonitor.js.map