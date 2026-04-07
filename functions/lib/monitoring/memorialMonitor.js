"use strict";
// ============================================================
// MemorialOS Monitor — Monitoramento de Memoriais
// Verifica: memoriais desatualizados, jazigos, planos, visitas
// Frequencia: diariamente as 7h
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMemorialMonitor = runMemorialMonitor;
const firestore_1 = require("firebase-admin/firestore");
const db = () => (0, firestore_1.getFirestore)();
// ── Total de memoriais (falecidos) cadastrados ──────────────
async function countTotalMemoriais() {
    try {
        const snap = await db().collection('deceaseds').count().get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// ── Memoriais sem nenhuma atualizacao ha mais de N dias ──────
async function countMemoriaisSemAtualizacao(dias) {
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    try {
        const snap = await db()
            .collection('deceaseds')
            .where('updatedAt', '<=', firestore_1.Timestamp.fromDate(limite))
            .orderBy('updatedAt', 'asc')
            .limit(10)
            .get();
        const exemplos = snap.docs.map(d => {
            var _a, _b, _c, _d;
            const data = d.data();
            const updatedAt = (_c = (_b = (_a = data.updatedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : new Date(0);
            const diasSemAtualizar = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
            return {
                id: d.id,
                nome: (_d = data.name) !== null && _d !== void 0 ? _d : 'Desconhecido',
                diasSemAtualizar,
            };
        });
        const totalSnap = await db()
            .collection('deceaseds')
            .where('updatedAt', '<=', firestore_1.Timestamp.fromDate(limite))
            .count()
            .get();
        return { count: totalSnap.data().count, exemplos };
    }
    catch (_a) {
        return { count: 0, exemplos: [] };
    }
}
// ── Memoriais sem foto principal ─────────────────────────────
async function countMemoriaisSemFoto() {
    try {
        const snap = await db()
            .collection('deceaseds')
            .where('photoURL', '==', null)
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        try {
            const snap2 = await db()
                .collection('deceaseds')
                .where('photoURL', '==', '')
                .count()
                .get();
            return snap2.data().count;
        }
        catch (_b) {
            return 0;
        }
    }
}
// ── Jazigos sem manutencao registrada ha mais de N dias ──────
async function countJazigosSemManutencao(dias) {
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    try {
        const snap = await db()
            .collection('plots')
            .where('lastMaintenanceAt', '<=', firestore_1.Timestamp.fromDate(limite))
            .orderBy('lastMaintenanceAt', 'asc')
            .limit(10)
            .get();
        const exemplos = snap.docs.map(d => {
            var _a, _b, _c, _d, _e;
            const data = d.data();
            const ultimaManutencao = (_c = (_b = (_a = data.lastMaintenanceAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : new Date(0);
            const diasSemManutencao = Math.floor((Date.now() - ultimaManutencao.getTime()) / (1000 * 60 * 60 * 24));
            return {
                jazigo: (_d = data.identifier) !== null && _d !== void 0 ? _d : d.id,
                cemiterio: (_e = data.cemeteryId) !== null && _e !== void 0 ? _e : 'Nao informado',
                diasSemManutencao,
            };
        });
        const totalSnap = await db()
            .collection('plots')
            .where('lastMaintenanceAt', '<=', firestore_1.Timestamp.fromDate(limite))
            .count()
            .get();
        return { count: totalSnap.data().count, exemplos };
    }
    catch (_a) {
        return { count: 0, exemplos: [] };
    }
}
// ── Planos funerarios vencendo em N dias ─────────────────────
async function countPlanosFunerariosVencendo(dias) {
    const agora = new Date();
    const futuro = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    try {
        const snap = await db()
            .collection('funeral_plans')
            .where('status', '==', 'ativo')
            .where('expiresAt', '>=', firestore_1.Timestamp.fromDate(agora))
            .where('expiresAt', '<=', firestore_1.Timestamp.fromDate(futuro))
            .orderBy('expiresAt', 'asc')
            .limit(10)
            .get();
        const exemplos = snap.docs.map(d => {
            var _a, _b, _c, _d, _e;
            const data = d.data();
            return {
                id: d.id,
                titular: (_a = data.holderName) !== null && _a !== void 0 ? _a : 'Desconhecido',
                vencimentoEm: (_e = (_d = (_c = (_b = data.expiresAt) === null || _b === void 0 ? void 0 : _b.toDate) === null || _c === void 0 ? void 0 : _c.call(_b)) === null || _d === void 0 ? void 0 : _d.toLocaleDateString('pt-BR')) !== null && _e !== void 0 ? _e : '',
            };
        });
        const totalSnap = await db()
            .collection('funeral_plans')
            .where('status', '==', 'ativo')
            .where('expiresAt', '>=', firestore_1.Timestamp.fromDate(agora))
            .where('expiresAt', '<=', firestore_1.Timestamp.fromDate(futuro))
            .count()
            .get();
        return { count: totalSnap.data().count, exemplos };
    }
    catch (_a) {
        return { count: 0, exemplos: [] };
    }
}
// ── Visitas aos memoriais hoje e na semana ───────────────────
async function countVisitas() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
        const [hojeSnap, semanaSnap] = await Promise.all([
            db()
                .collection('memorial_visits')
                .where('visitedAt', '>=', firestore_1.Timestamp.fromDate(startOfDay))
                .count()
                .get(),
            db()
                .collection('memorial_visits')
                .where('visitedAt', '>=', firestore_1.Timestamp.fromDate(startOfWeek))
                .count()
                .get(),
        ]);
        return {
            hoje: hojeSnap.data().count,
            semana: semanaSnap.data().count,
        };
    }
    catch (_a) {
        return { hoje: 0, semana: 0 };
    }
}
// ── Fotos adicionadas nos ultimos 7 dias ─────────────────────
async function countFotosAdicionadas7d() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
        const snap = await db()
            .collection('memorial_photos')
            .where('addedAt', '>=', firestore_1.Timestamp.fromDate(since))
            .count()
            .get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// ── Gera alertas de memorial ─────────────────────────────────
function generateAlerts(data, config, extra) {
    const alerts = [];
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
async function runMemorialMonitor(config) {
    console.log('[MemorialMonitor] Iniciando verificacao diaria...');
    const [totalMemoriais, semAtualizacaoResult, memoriaisSemFoto, jazigosSemManutencaoResult, planosVencendoResult, visitas, fotosAdicionadas7d,] = await Promise.all([
        countTotalMemoriais(),
        countMemoriaisSemAtualizacao(config.thresholds.memoriaisSemAtualizacaoDias),
        countMemoriaisSemFoto(),
        countJazigosSemManutencao(config.thresholds.jazigosSemManutencaoDias),
        countPlanosFunerariosVencendo(config.thresholds.planoVencendoDias),
        countVisitas(),
        countFotosAdicionadas7d(),
    ]);
    const base = {
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
    console.log(`[MemorialMonitor] Total memoriais: ${totalMemoriais} | Alertas: ${alerts.length}`);
    return Object.assign(Object.assign({}, base), { alerts });
}
//# sourceMappingURL=memorialMonitor.js.map