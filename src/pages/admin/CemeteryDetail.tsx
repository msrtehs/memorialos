import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Grid } from 'lucide-react';
import { getSectors, createSector, Sector } from '@/services/cemeteryService';
import { useAuth } from '@/contexts/AuthContext';

export default function CemeteryDetail() {
  const { id } = useParams();
  const { tenantId } = useAuth();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSectorName, setNewSectorName] = useState('');
  const [newSectorCapacity, setNewSectorCapacity] = useState(100);

  const fetchSectors = async () => {
    if (id) {
      const data = await getSectors(id);
      setSectors(data);
    }
  };

  useEffect(() => {
    fetchSectors();
  }, [id]);

  const handleCreateSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !id) return;
    
    try {
      await createSector(tenantId, id, {
        name: newSectorName,
        capacity: newSectorCapacity,
        type: 'ground'
      });
      setIsModalOpen(false);
      setNewSectorName('');
      fetchSectors();
    } catch (error) {
      console.error(error);
      alert("Erro ao criar setor");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/cemiterios" className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Detalhes do Cemitério</h1>
          <p className="text-slate-500">Gerencie quadras, setores e jazigos.</p>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Setores / Quadras</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm hover:bg-slate-800"
        >
          <Plus size={16} /> Adicionar Setor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sectors.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Nenhum setor cadastrado neste cemitério.
          </div>
        ) : (
          sectors.map((sector) => (
            <div key={sector.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Grid size={20} />
                </div>
                <h3 className="font-bold text-slate-900">{sector.name}</h3>
              </div>
              <div className="text-sm text-slate-500 space-y-1">
                <p>Capacidade: {sector.capacity} jazigos</p>
                <p>Tipo: {sector.type === 'ground' ? 'Térreo' : 'Vertical'}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-50">
                <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                  <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                </div>
                <p className="text-xs text-right text-slate-400">45% Ocupado</p>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Novo Setor</h2>
            <form onSubmit={handleCreateSector} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome (ex: Quadra A)</label>
                <input 
                  value={newSectorName}
                  onChange={e => setNewSectorName(e.target.value)}
                  className="w-full border p-2 rounded" 
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Capacidade de Jazigos</label>
                <input 
                  type="number"
                  value={newSectorCapacity}
                  onChange={e => setNewSectorCapacity(Number(e.target.value))}
                  className="w-full border p-2 rounded" 
                  required
                />
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
