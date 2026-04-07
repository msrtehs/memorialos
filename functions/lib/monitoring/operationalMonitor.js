"use strict";
// ============================================================
// MemorialOS Monitor — Monitoramento Operacional
// Verifica: servicos, planos, gestores, auditorias, obitos
// Frequencia: a cada 30 minutos
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOperationalMonitor = runOperationalMonitor;
const firestore_1 = require("firebase-admin/firestore");
const db = () => (0, firestore_1.getFirestore)();
// ── Memoriais criados nas ultimas 24h ───────────────────────
async function countMemoriaisCreados24h() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
        const snap = await db()
            .collection('deceaseds')
            .where('createdAt', '>=', firestore_1.Timestamp.fromDate(since))
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// ── Servicos solicitados nas ultimas 24h ────────────────────
async function countServicosSolicitados24h() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
        const snap = await db()
            .collection('requests')
            .where('createdAt', '>=', firestore_1.Timestamp.fromDate(since))
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// ── Servicos pendentes (nao concluidos) ─────────────────────
async function countServicosPendentes() {
    try {
        const snap = await db()
            .collection('requests')
            .where('status', 'in', ['pendente', 'aguardando_aprovacao'])
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// ── Servicos atrasados (pendentes ha mais de 72h) ───────────
async function countServicosAtrasados() {
    const limite = new Date(Date.now() - 72 * 60 * 60 * 1000);
    try {
        const snap = await db()
            .collection('requests')
            .where('status', 'in', ['pendente', 'aguardando_aprovacao'])
            .where('createdAt', '<=', firestore_1.Timestamp.fromDate(limite))
            .limit(50)
            .get();
        return {
            count: snap.size,
            ids: snap.docs.map(d => d.id),
        };
    }
    catch (_a) {
        return { count: 0, ids: [] };
    }
}
// ── Planos funerarios ativos ─────────────────────────────────
async function countPlanosAtivos() {
    try {
        const snap = await db()
            .collection('funeral_plans')
            .where('status', '==', 'ativo')
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// ── Gestores ativos (ultimo login < 30 dias) ─────────────────
async function countGestoresAtivos() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    try {
        const snap = await db()
            .collection('profiles')
            .where('role', 'in', ['gestor', 'manager'])
            .where('lastLoginAt', '>=', firestore_1.Timestamp.fromDate(since))
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// ── Acoes do SuperAdmin nas ultimas 24h ─────────────────────
async function countAcoesSuperAdmin24h() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
        const snap = await db()
            .collection('audit_logs')
            .where('userRole', '==', 'superadmin')
            .where('createdAt', '>=', firestore_1.Timestamp.fromDate(since))
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// ── Comunicados de obito aguardando validacao ────────────────
async function countComunicadosObitoSemValidar() {
    var _a, _b, _c;
    try {
        const snap = await db()
            .collection('death_notifications')
            .where('status', '==', 'aguardando_validacao')
            .orderBy('createdAt', 'asc')
            .limit(100)
            .get();
        if (snap.empty)
            return { count: 0 };
        const maisAntigo = (_c = (_b = (_a = snap.docs[0].data().createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString();
        return { count: snap.size, maisAntigo };
    }
    catch (_d) {
        return { count: 0 };
    }
}
// ── Gera alertas operacionais ────────────────────────────────
function generateAlerts(data, config, extra) {
    const alerts = [];
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
async function runOperationalMonitor(config) {
    console.log('[OperationalMonitor] Iniciando verificacao...');
    const [memoriaisCreados24h, servicosSolicitados24h, servicosPendentes, servicosAtrasadosResult, planosAtivos, gestoresAtivos, acoesSuperAdmin24h, comunicadosResult,] = await Promise.all([
        countMemoriaisCreados24h(),
        countServicosSolicitados24h(),
        countServicosPendentes(),
        countServicosAtrasados(),
        countPlanosAtivos(),
        countGestoresAtivos(),
        countAcoesSuperAdmin24h(),
        countComunicadosObitoSemValidar(),
    ]);
    const base = {
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
    console.log(`[OperationalMonitor] Servicos pendentes: ${base.servicosPendentes} | Alertas: ${alerts.length}`);
    return Object.assign(Object.assign({}, base), { alerts });
}
//# sourceMappingURL=operationalMonitor.js.map