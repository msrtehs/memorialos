import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { createDigitalDocument, listDigitalDocuments, updateSCIRecord } from '@/services/sciService';

export default function DocumentsCenterPage() {
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();
  const [docs, setDocs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | undefined>(undefined);
  const [form, setForm] = useState({
    title: '',
    documentType: 'administrative',
    relatedEntityId: '',
    status: 'pending',
    notes: '',
    issuedAt: new Date().toISOString().slice(0, 10),
    expiresAt: ''
  });

  const scopedDocs = useMemo(
    () => docs.filter((doc) => selectedCemeteryId === 'all' || doc.cemeteryId === selectedCemeteryId),
    [docs, selectedCemeteryId]
  );

  const loadDocs = async () => {
    if (!tenantId) return;
    try {
      const data = await listDigitalDocuments(tenantId);
      setDocs(data);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [tenantId, selectedCemeteryId]);

  const handleCreateDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !form.title) return;
    setSaving(true);
    try {
      await createDigitalDocument(
        tenantId,
        {
          cemeteryId: selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
          title: form.title,
          documentType: form.documentType as any,
          relatedEntityId: form.relatedEntityId || undefined,
          status: form.status as any,
          notes: form.notes || undefined,
          issuedAt: form.issuedAt || undefined,
          expiresAt: form.expiresAt || undefined
        },
        file
      );
      setForm({
        title: '',
        documentType: 'administrative',
        relatedEntityId: '',
        status: 'pending',
        notes: '',
        issuedAt: new Date().toISOString().slice(0, 10),
        expiresAt: ''
      });
      setFile(undefined);
      await loadDocs();
    } catch (error) {
      console.error('Erro ao registrar documento:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (!tenantId) return;
    try {
      await updateSCIRecord(tenantId, 'sci_documents', id, 'UPDATE_DOCUMENT_STATUS', { status });
      await loadDocs();
    } catch (error) {
      console.error('Erro ao atualizar status documental:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Digitalizacao documental</h1>
        <p className="text-sm text-slate-500">Cadastro, upload seguro e validacao de documentos administrativos, legais e sanitarios.</p>
      </div>

      <form onSubmit={handleCreateDocument} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Titulo do documento" required />
        <select value={form.documentType} onChange={(e) => setForm((prev) => ({ ...prev, documentType: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="administrative">Administrativo</option>
          <option value="legal">Juridico</option>
          <option value="sanitary">Sanitario</option>
          <option value="environmental">Ambiental</option>
          <option value="deceased">Falecido</option>
          <option value="financial">Financeiro</option>
        </select>
        <input value={form.relatedEntityId} onChange={(e) => setForm((prev) => ({ ...prev, relatedEntityId: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="ID relacionado (opcional)" />
        <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="pending">Pendente</option>
          <option value="validated">Validado</option>
          <option value="rejected">Rejeitado</option>
        </select>
        <button type="submit" disabled={saving} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1">
          <Upload size={14} /> Salvar
        </button>
        <div className="md:col-span-2">
          <input type="date" value={form.issuedAt} onChange={(e) => setForm((prev) => ({ ...prev, issuedAt: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="md:col-span-2">
          <input type="date" value={form.expiresAt} onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Validade" />
        </div>
        <div className="md:col-span-2">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0])} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1" />
        </div>
        <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className="md:col-span-6 border border-slate-300 rounded-lg px-3 py-2 text-sm h-20" placeholder="Observacoes (opcional)" />
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm text-left">
          <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Emissao</th>
              <th className="px-4 py-3">Validade</th>
              <th className="px-4 py-3">Arquivo</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scopedDocs.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{doc.title}</td>
                <td className="px-4 py-3 text-slate-600">{doc.documentType}</td>
                <td className="px-4 py-3 text-slate-600">{doc.issuedAt || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{doc.expiresAt || '-'}</td>
                <td className="px-4 py-3">
                  {doc.fileUrl ? (
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      <FileText size={14} /> Abrir
                    </a>
                  ) : (
                    <span className="text-slate-400 text-xs">Sem arquivo</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select value={doc.status} onChange={(e) => updateStatus(doc.id, e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                    <option value="pending">pending</option>
                    <option value="validated">validated</option>
                    <option value="rejected">rejected</option>
                  </select>
                </td>
              </tr>
            ))}
            {scopedDocs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum documento digital cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
