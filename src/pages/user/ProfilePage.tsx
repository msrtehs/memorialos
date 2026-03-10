import React, { useEffect, useState } from 'react';
import { Camera, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, saveUserProfile, UserProfile } from '@/services/userProfileService';

export default function ProfilePage() {
  const { user, tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [form, setForm] = useState<Partial<UserProfile>>({
    displayName: '',
    phone: '',
    city: '',
    state: '',
    address: '',
    emergencyContact: '',
    preferredContact: '',
    notes: ''
  });

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      setLoading(true);
      try {
        const profile = await getUserProfile(user.uid);
        if (profile) {
          setForm({
            displayName: profile.displayName || user.displayName || '',
            phone: profile.phone || '',
            city: profile.city || '',
            state: profile.state || '',
            address: profile.address || '',
            emergencyContact: profile.emergencyContact || '',
            preferredContact: profile.preferredContact || '',
            notes: profile.notes || '',
            photoUrl: profile.photoUrl || user.photoURL || ''
          });
          setPreviewUrl(profile.photoUrl || user.photoURL || '');
        } else {
          setForm((prev) => ({
            ...prev,
            displayName: user.displayName || ''
          }));
          setPreviewUrl(user.photoURL || '');
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  const handlePhotoChange = (file?: File) => {
    if (!file) return;
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await saveUserProfile(
        user.uid,
        {
          ...form
        },
        { photoFile: photoFile || undefined, tenantId }
      );
      setPhotoFile(null);
      alert('Perfil atualizado com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      alert('Nao foi possivel atualizar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-slate-500">
        Carregando perfil...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-blue-900">Meu perfil</h1>
        <p className="text-slate-500 mt-2">
          Atualize seus dados e preferencias para um atendimento mais personalizado.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
              {previewUrl ? (
                <img src={previewUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                  Sem foto
                </div>
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center cursor-pointer hover:bg-blue-700">
              <Camera size={14} />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoChange(e.target.files?.[0])}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <p className="font-semibold text-slate-900">{user?.email}</p>
            <p className="text-sm text-slate-500">Use uma foto clara para facilitar identificacao.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome de exibicao</label>
            <input
              value={form.displayName || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
            <input
              value={form.phone || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
            <input
              value={form.city || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
            <input
              value={form.state || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Endereco</label>
            <input
              value={form.address || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contato de emergencia</label>
            <input
              value={form.emergencyContact || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, emergencyContact: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Canal preferencial</label>
            <select
              value={form.preferredContact || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, preferredContact: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Selecione...</option>
              <option value="email">Email</option>
              <option value="telefone">Telefone</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Observacoes uteis para atendimento</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 h-24"
              placeholder="Ex: horario preferido para contato, necessidades especiais, etc."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </div>
      </form>
    </div>
  );
}
