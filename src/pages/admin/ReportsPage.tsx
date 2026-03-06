import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileBarChart2, Plus } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { createAutomaticReport, listSCIReports } from '@/services/sciService';

const reportTypes = [
  { id: 'operational', label: 'Operacional' },
  { id: 'sanitary', label: 'Sanitario' },
  { id: 'environmental', label: 'Ambiental' },
  { id: 'administrative', label: 'Administrativo' },
  { id: 'legal', label: 'Juridico' },
  { id: 'financial', label: 'Financeiro (opcional)' }
];

export default function ReportsPage() {
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();
  const [reports, setReports] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState('operational');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const scopedReports = useMemo(
    () =>
      reports.filter(
        (report) =>
          (selectedCemeteryId === 'all' || report.cemeteryId === selectedCemeteryId) &&
          report.type
      ),
    [reports, selectedCemeteryId]
  );

  const selectedReport = scopedReports.find((report) => report.id === selectedReportId) || scopedReports[0] || null;

  const loadReports = async () => {
    if (!tenantId) return;
    try {
      const data = await listSCIReports(tenantId);
      setReports(data);
      if (!selectedReportId && data.length > 0) {
        setSelectedReportId(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar relatorios SCI:', error);
    }
  };

  useEffect(() => {
    loadReports();
  }, [tenantId, selectedCemeteryId]);

  const handleGenerateReport = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await createAutomaticReport(tenantId, type as any, selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId);
      await loadReports();
    } catch (error) {
      console.error('Erro ao gerar relatorio automatico:', error);
    } finally {
      setSaving(false);
    }
  };

  const downloadReport = (report: any) => {
    if (!report?.summary) return;
    const blob = new Blob([report.summary], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-${report.type}-${report.id}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Relatorios automaticos</h1>
        <p className="text-sm text-slate-500">
          Geracao automatica de relatorios operacionais, sanitarios, ambientais, administrativos, juridicos e financeiros.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <select value={type} onChange={(e) => setType(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
          {reportTypes.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <button onClick={handleGenerateReport} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
          <Plus size={14} /> {saving ? 'Gerando...' : 'Gerar relatorio'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
            Historico de relatorios
          </div>
          <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
            {scopedReports.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedReportId(report.id)}
                className={`w-full text-left p-4 hover:bg-slate-50 ${selectedReportId === report.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900 capitalize">{report.type}</p>
                  <FileBarChart2 size={15} className="text-slate-500" />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {report.generatedAt?.seconds
                    ? new Date(report.generatedAt.seconds * 1000).toLocaleString('pt-BR')
                    : 'Sem data'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Cemiterio: {report.cemeteryId}</p>
              </button>
            ))}
            {scopedReports.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">Nenhum relatorio gerado ainda.</div>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          {selectedReport ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 capitalize">Relatorio {selectedReport.type}</h2>
                <button onClick={() => downloadReport(selectedReport)} className="text-sm bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2">
                  <Download size={14} /> Download TXT
                </button>
              </div>
              <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {selectedReport.summary}
              </pre>
            </div>
          ) : (
            <div className="h-full min-h-[220px] flex items-center justify-center text-slate-500 text-sm">
              Selecione um relatorio para visualizar o conteudo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
