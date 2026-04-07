"use strict";
// ============================================================
// MemorialOS Monitor — Servico de Alertas WhatsApp
// Usa Evolution API (padrao brasileiro, open-source)
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchAlerts = dispatchAlerts;
exports.sendDailyReport = sendDailyReport;
const firestore_1 = require("firebase-admin/firestore");
// ── Prefixos por severidade ─────────────────────────────────
const SEVERITY_PREFIX = {
    critical: 'CRITICO',
    warning: 'ATENCAO',
    info: 'INFO',
};
// ── Monta mensagem de texto WhatsApp ─────────────────────────
function buildAlertMessage(alert) {
    const prefix = SEVERITY_PREFIX[alert.severity];
    const modulo = alert.module.toUpperCase();
    const hora = new Date(alert.createdAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
    });
    return [
        `${prefix} — MemorialOS`,
        ``,
        `${alert.title}`,
        `${hora} | Modulo: ${modulo}`,
        ``,
        `${alert.description}`,
        ``,
        `MemorialOS Monitor`,
    ].join('\n');
}
// ── Monta relatorio diario completo ─────────────────────────
function buildDailyReportMessage(metrics) {
    const { technical: t, operational: o, memorial: m } = metrics;
    const dataHoje = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        timeZone: 'America/Sao_Paulo',
    });
    const statusLabel = {
        online: 'ONLINE',
        degraded: 'DEGRADADO',
        offline: 'OFFLINE',
    }[t.appStatus];
    return [
        `Relatorio Diario — MemorialOS`,
        `${dataHoje}`,
        ``,
        `Health Score: ${metrics.systemHealthScore}/100`,
        ``,
        `--- TECNICO ---`,
        `App: ${statusLabel} (${t.responseTimeMs}ms)`,
        `Usuarios ativos/24h: ${t.activeUsers24h}`,
        `Novos cadastros/24h: ${t.newSignups24h}`,
        `Logins com falha/24h: ${t.failedLogins24h}`,
        `Chamadas Gemini hoje: ${t.geminiApiCallsToday}`,
        ``,
        `--- OPERACIONAL ---`,
        `Memoriais criados/24h: ${o.memoriaisCreados24h}`,
        `Servicos pendentes: ${o.servicosPendentes}`,
        `Servicos atrasados: ${o.servicosAtrasados}`,
        `Obitos p/ validar: ${o.comunicadosObitoSemValidar}`,
        `Planos ativos: ${o.planosAtivos}`,
        ``,
        `--- MEMORIAIS ---`,
        `Total de memoriais: ${m.totalMemoriais}`,
        `Visitas hoje / semana: ${m.visitasHoje} / ${m.visitasSemana}`,
        `Fotos adicionadas/7d: ${m.fotosAdicionadas7d}`,
        `Sem atualizacao/30d: ${m.memoriaisSemAtualizacao30d}`,
        `Jazigos s/ manutencao: ${m.jazigosSemManutencao90d}`,
        ``,
        metrics.alertsOpen.length > 0
            ? `${metrics.alertsOpen.length} alerta(s) aberto(s) — acesse o dashboard para detalhes.`
            : `Nenhum alerta critico no momento.`,
        ``,
        `MemorialOS Monitor • ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    ].join('\n');
}
// ── Envia mensagem via Evolution API ────────────────────────
async function sendWhatsAppMessage(config, phoneNumber, message) {
    const url = `${config.whatsapp.evolutionApiUrl}/message/sendText/${config.whatsapp.instanceName}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: config.whatsapp.evolutionApiKey,
            },
            body: JSON.stringify({
                number: phoneNumber,
                options: {
                    delay: 500,
                    presence: 'composing',
                },
                textMessage: {
                    text: message,
                },
            }),
        });
        if (!response.ok) {
            const body = await response.text();
            console.error(`[AlertService] Falha ao enviar WhatsApp para ${phoneNumber}: ${response.status} - ${body}`);
            return false;
        }
        console.log(`[AlertService] WhatsApp enviado com sucesso para ${phoneNumber}`);
        return true;
    }
    catch (err) {
        console.error(`[AlertService] Erro ao enviar WhatsApp:`, err);
        return false;
    }
}
// ── Salva alerta no Firestore ────────────────────────────────
async function persistAlert(alert) {
    const db = (0, firestore_1.getFirestore)();
    try {
        await db.collection('monitor_alerts').doc(alert.id).set(Object.assign(Object.assign({}, alert), { resolvedAt: null, notifiedViaWhatsApp: true }));
    }
    catch (err) {
        console.error('[AlertService] Erro ao persistir alerta:', err);
    }
}
// ── Dispatch de alertas: filtra destinatarios por severidade ─
async function dispatchAlerts(alerts, config) {
    if (!config.whatsapp.enabled || alerts.length === 0)
        return;
    for (const alert of alerts) {
        const message = buildAlertMessage(alert);
        const recipients = config.whatsapp.recipients.filter(r => {
            if (alert.severity === 'critical')
                return true;
            if (alert.severity === 'warning')
                return r.role === 'superadmin' || r.role === 'admin';
            return r.role === 'superadmin';
        });
        await Promise.all([
            ...recipients.map(r => sendWhatsAppMessage(config, r.number, message)),
            persistAlert(alert),
        ]);
    }
}
// ── Envia relatorio diario completo ─────────────────────────
async function sendDailyReport(metrics, config) {
    if (!config.whatsapp.enabled)
        return;
    const message = buildDailyReportMessage(metrics);
    const superadmins = config.whatsapp.recipients.filter(r => r.role === 'superadmin');
    await Promise.all(superadmins.map(r => sendWhatsAppMessage(config, r.number, message)));
    console.log(`[AlertService] Relatorio diario enviado para ${superadmins.length} superadmin(s).`);
}
//# sourceMappingURL=alertService.js.map