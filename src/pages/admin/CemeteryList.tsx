import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin, Layers, Trash2 } from 'lucide-react';
import { getCemeteries, createCemetery, deleteCemetery, Cemetery } from '@/services/cemeteryService';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  name: z.string().min(3, 'Nome é obrigatório'),
  address: z.string().min(5, 'Endereço é obrigatório'),
});

type CemeteryForm = z.infer<typeof schema>;

export default function CemeteryList() {
  const { tenantId } = useAuth();
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CemeteryForm>({
    resolver: zodResolver(schema)
  });

  const fetchCemeteries = async () => {
    if (tenantId) {
      const data = await getCemeteries(tenantId);
      setCemeteries(data);
    }
  };

  useEffect(() => {
    fetchCemeteries();
  }, [tenantId]);

  const onSubmit = async (data: CemeteryForm) => {
    if (!tenantId) return;
    try {
      await createCemetery(tenantId, data);
      setIsModalOpen(false);
      reset();
      fetchCemeteries();
    } catch (error: any) {
      console.error(error);
      if (error.code === 'permission-denied') {
        alert("Permissão negada. Verifique se você tem acesso para criar registros.");
      } else {
        alert("Erro ao criar cemitério: " + (error.message || "Erro desconhecido"));
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, cemeteryId: string) => {
    e.preventDefault(); // Prevent navigation if inside Link (though button is outside Link here)
    if (!tenantId) return;
    
    if (window.confirm("Tem certeza que deseja excluir este cemitério? Esta ação não pode ser desfeita.")) {
      try {
        await deleteCemetery(tenantId, cemeteryId);
        fetchCemeteries();
      } catch (error: any) {
        console.error("Error deleting cemetery:", error);
        alert("Erro ao excluir cemitério. Verifique se existem registros vinculados.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cemitérios</h1>
          <p className="text-slate-500">Gestão da estrutura física e capacidade.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-800 transition-colors"
        >
          <Plus size={18} /> Novo Cemitério
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cemeteries.map((cemetery) => (
          <div key={cemetery.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative group">
            <button 
              onClick={(e) => handleDelete(e, cemetery.id!)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Excluir Cemitério"
            >
              <Trash2 size={18} />
            </button>

            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                <MapPin size={24} />
              </div>
              <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-medium">Ativo</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1 pr-8">{cemetery.name}</h3>
            <p className="text-sm text-slate-500 mb-4 h-10 line-clamp-2">{cemetery.address}</p>
            
            <div className="flex items-center gap-4 text-sm text-slate-600 border-t border-slate-50 pt-4">
              <div className="flex items-center gap-1">
                <Layers size={16} />
                <span>Gestão de Setores</span>
              </div>
            </div>

            <Link 
              to={`/admin/cemiterios/${cemetery.id}`}
              className="mt-4 block w-full text-center py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium text-sm"
            >
              Gerenciar Estrutura
            </Link>
          </div>
        ))}
      </div>

      {/* Simple Modal for MVP */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Novo Cemitério</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input {...register('name')} className="w-full border p-2 rounded" />
                {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Endereço</label>
                <input {...register('address')} className="w-full border p-2 rounded" />
                {errors.address && <p className="text-red-500 text-xs">{errors.address.message}</p>}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
