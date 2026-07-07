import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Handshake, Phone, Mail, Plus, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { listPartners, createPartner, updatePartner, Partner } from '@/services/sciService';
import { reportError, reportLoadError } from '@/lib/errors';
import { useModal } from '@/hooks/useModal';

const TYPE_LABELS: Record<Partner['type'], string> = {
  floricultura: 'Floricultura',
  marmoraria: 'Marmoraria',
  funeraria: 'Funerária',
  seguros: 'Seguros',
  transporte: 'Transporte',
  outro: 'Outro',
};

const emptyForm = {
  name: '',
  type: 'floricultura' as Partner['type'],
  description: '',
  contact: '',
  email: '',
};

export default function PartnersPage() {
  const { tenantId } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const { containerRef: partnerModalRef } = useModal(modalOpen, () => setModalOpen(false));
  const [editing, setEditing] = useState<Partner | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      setPartners(await listPartners(tenantId));
    } catch (error) {
      reportLoadError('PartnersPage.load', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (partner: Partner) => {
    setEditing(partner);
    setForm({
      name: partner.name,
      type: partner.type,
      description: partner.description || '',
      contact: partner.contact || '',
      email: partner.email || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !form.name) return;
    setSaving(true);
    try {
      if (editing?.id) {
        await updatePartner(tenantId, editing.id, {
          name: form.name,
          type: form.type,
          description: form.description || undefined,
          contact: form.contact || undefined,
          email: form.email || undefined,
        });
        toast.success('Parceiro atualizado.');
      } else {
        await createPartner(tenantId, {
          name: form.name,
          type: form.type,
          description: form.description || undefined,
          contact: form.contact || undefined,
          email: form.email || undefined,
          active: true,
        });
        toast.success('Parceiro cadastrado.');
      }
      setModalOpen(false);
      await loadData();
    } catch (error) {
      reportError('PartnersPage.save', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (partner: Partner) => {
    if (!tenantId || !partner.id) return;
    try {
      await updatePartner(tenantId, partner.id, { active: !partner.active });
      toast.success(partner.active ? 'Parceiro desativado.' : 'Parceiro ativado.');
      await loadData();
    } catch (error) {
      reportError('PartnersPage.toggle', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Parceiros</h1>
          <p className="text-slate-500 text-sm">Diretório de floriculturas, marmorarias e funerárias credenciadas.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-200"
        >
          <Plus size={18} /> Novo Parceiro
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">Carregando...</div>
      ) : partners.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-4">Nenhum parceiro cadastrado — cadastre floriculturas, marmorarias e funerárias credenciadas.</p>
          <button
            onClick={openCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus size={18} /> Cadastrar o primeiro parceiro
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((partner) => (
            <div key={partner.id} className={`bg-white p-6 rounded-xl shadow-sm border flex flex-col ${partner.active ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <Handshake size={24} />
                </div>
                <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                  {TYPE_LABELS[partner.type] || partner.type}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-1">{partner.name}</h3>
              <p className="text-sm text-slate-500 mb-6 flex-1">{partner.description || 'Sem descrição.'}</p>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                {partner.contact && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={14} className="text-slate-400" /> {partner.contact}
                  </div>
                )}
                {partner.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail size={14} className="text-slate-400" /> {partner.email}
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openEdit(partner)}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2 rounded-lg transition-colors text-sm inline-flex items-center justify-center gap-1"
                >
                  <Pencil size={14} /> Editar
                </button>
                <button
                  onClick={() => toggleActive(partner)}
                  className={`flex-1 font-medium py-2 rounded-lg transition-colors text-sm ${partner.active ? 'border border-red-200 text-red-600 hover:bg-red-50' : 'border border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                >
                  {partner.active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div ref={partnerModalRef} role="dialog" aria-modal="true" aria-labelledby="partner-modal-title" className="bg-white p-6 rounded-xl w-full max-w-lg">
            <h2 id="partner-modal-title" className="text-xl font-bold mb-4">{editing ? 'Editar parceiro' : 'Novo parceiro'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select aria-label="Tipo" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as Partner['type'] }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descrição</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm h-20" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Contato</label>
                  <input value={form.contact} onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">E-mail</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-600">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60">
                  {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
