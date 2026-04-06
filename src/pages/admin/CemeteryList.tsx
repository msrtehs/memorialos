import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, MapPin, Plus, Trash2, Pencil } from 'lucide-react';
import { getCemeteries, createCemetery, updateCemetery, deleteCemetery, getTenantProfiles, Cemetery } from '@/services/cemeteryService';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import MapPicker from '@/components/MapPicker';

const schema = z.object({
  name: z.string().min(3, 'Nome obrigatorio'),
  address: z.string().min(5, 'Endereco obrigatorio'),
  capacity: z.string().optional(),
  type: z.enum(['publico', 'particular', 'concessao']),
  adminUid: z.string().optional(),
});

type CemeteryForm = z.infer<typeof schema>;

const TYPE_LABELS: Record<string, string> = {
  publico: 'Publico',
  particular: 'Particular',
  concessao: 'Concessao',
};

export default function CemeteryList() {
  const { tenantId } = useAuth();
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; email: string }>>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCemetery, setEditingCemetery] = useState<Cemetery | null>(null);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<CemeteryForm>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'publico' }
  });

  const fetchData = async () => {
    if (!tenantId) return;
    const [data, profs] = await Promise.all([
      getCemeteries(tenantId),
      getTenantProfiles(tenantId).catch(() => [])
    ]);
    setCemeteries(data);
    setProfiles(profs);
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  const openCreateModal = () => {
    setEditingCemetery(null);
    reset({ name: '', address: '', capacity: '', type: 'publico', adminUid: '' });
    setMapCoords({ lat: 0, lng: 0 });
    setIsModalOpen(true);
  };

  const openEditModal = (cemetery: Cemetery) => {
    setEditingCemetery(cemetery);
    reset({
      name: cemetery.name,
      address: cemetery.address,
      capacity: cemetery.capacity ? String(cemetery.capacity) : '',
      type: cemetery.type || 'publico',
      adminUid: cemetery.adminUid || '',
    });
    setMapCoords({
      lat: cemetery.coordinates?.lat || cemetery.latitude || 0,
      lng: cemetery.coordinates?.lng || cemetery.longitude || 0,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: CemeteryForm) => {
    if (!tenantId) return;
    try {
      const payload: any = {
        name: data.name,
        address: data.address,
        capacity: data.capacity ? Number(data.capacity) : undefined,
        type: data.type,
        adminUid: data.adminUid || undefined,
        latitude: mapCoords.lat || undefined,
        longitude: mapCoords.lng || undefined,
        coordinates: mapCoords.lat && mapCoords.lng ? { lat: mapCoords.lat, lng: mapCoords.lng } : undefined,
      };

      if (editingCemetery) {
        await updateCemetery(tenantId, editingCemetery.id!, payload);
      } else {
        await createCemetery(tenantId, payload);
      }
      setIsModalOpen(false);
      reset();
      setEditingCemetery(null);
      fetchData();
    } catch (error: any) {
      console.error('Erro ao salvar cemiterio:', error);
      alert(error?.message || 'Erro ao salvar cemiterio.');
    }
  };

  const handleDelete = async (event: React.MouseEvent, cemeteryId: string) => {
    event.preventDefault();
    if (!tenantId) return;
    if (!window.confirm('Confirmar exclusao deste cemiterio?')) return;
    try {
      await deleteCemetery(tenantId, cemeteryId);
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir cemiterio:', error);
      alert('Nao foi possivel excluir este cemiterio.');
    }
  };

  const getAdminEmail = (uid?: string) => {
    if (!uid) return null;
    return profiles.find(p => p.id === uid)?.email || null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cemiterios</h1>
          <p className="text-slate-500">Gestao da estrutura fisica e georreferenciamento das unidades.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-800 transition-colors"
        >
          <Plus size={18} /> Novo cemiterio
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cemeteries.map((cemetery) => (
          <div
            key={cemetery.id}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative group"
          >
            <div className="absolute top-4 right-4 flex gap-1">
              <button
                onClick={() => openEditModal(cemetery)}
                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                title="Editar cemiterio"
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={(e) => handleDelete(e, cemetery.id!)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="Excluir cemiterio"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                <MapPin size={24} />
              </div>
              <div className="flex gap-2">
                {cemetery.type && (
                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                    {TYPE_LABELS[cemetery.type] || cemetery.type}
                  </span>
                )}
                <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-medium">Ativo</span>
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1 pr-8">{cemetery.name}</h3>
            <p className="text-sm text-slate-500 mb-4 h-10 line-clamp-2">{cemetery.address}</p>
            <p className="text-xs text-slate-500">Capacidade: {cemetery.capacity || 'N/D'}</p>
            {cemetery.coordinates?.lat ? (
              <p className="text-xs text-slate-400 mt-1">
                Lat/Lng: {cemetery.coordinates.lat} / {cemetery.coordinates.lng}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-1">
                Lat/Lng: {cemetery.latitude ?? '-'} / {cemetery.longitude ?? '-'}
              </p>
            )}
            {getAdminEmail(cemetery.adminUid) && (
              <p className="text-xs text-indigo-500 mt-1">Admin: {getAdminEmail(cemetery.adminUid)}</p>
            )}

            <div className="flex items-center gap-4 text-sm text-slate-600 border-t border-slate-50 pt-4 mt-3">
              <div className="flex items-center gap-1">
                <Layers size={16} />
                <span>Gestao de setores</span>
              </div>
            </div>

            <Link
              to={`/admin/cemiterios/${cemetery.id}`}
              className="mt-4 block w-full text-center py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium text-sm"
            >
              Gerenciar estrutura
            </Link>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingCemetery ? 'Editar cemiterio' : 'Novo cemiterio'}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome</label>
                  <input {...register('name')} className="w-full border p-2 rounded" />
                  {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de cemiterio</label>
                  <select {...register('type')} className="w-full border p-2 rounded bg-white">
                    <option value="publico">Publico</option>
                    <option value="particular">Particular</option>
                    <option value="concessao">Concessao</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Endereco</label>
                <input {...register('address')} className="w-full border p-2 rounded" />
                {errors.address && <p className="text-red-500 text-xs">{errors.address.message}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Capacidade planejada</label>
                  <input type="number" {...register('capacity')} className="w-full border p-2 rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Administrador responsavel</label>
                  <select {...register('adminUid')} className="w-full border p-2 rounded bg-white">
                    <option value="">Nenhum</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Localizacao no mapa (clique para selecionar)</label>
                <MapPicker
                  lat={mapCoords.lat}
                  lng={mapCoords.lng}
                  onChange={(lat, lng) => setMapCoords({ lat, lng })}
                  height="250px"
                />
                {(mapCoords.lat !== 0 || mapCoords.lng !== 0) && (
                  <p className="text-xs text-slate-500 mt-1">
                    Coordenadas: {mapCoords.lat}, {mapCoords.lng}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingCemetery(null); }} className="px-4 py-2 text-slate-600">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded">
                  {editingCemetery ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
