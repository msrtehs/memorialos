import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Grid, Plus } from 'lucide-react';
import { createSector, getCemeteryPlots, getSectors, Sector } from '@/services/cemeteryService';
import { useAuth } from '@/contexts/AuthContext';

export default function CemeteryDetail() {
  const { id } = useParams();
  const { tenantId } = useAuth();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [plots, setPlots] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    capacity: 100,
    type: 'ground',
    centerLat: '',
    centerLng: '',
    gridRows: 10,
    gridCols: 10,
    plotType: 'Jazigo',
    generatePlots: true
  });

  const loadData = async () => {
    if (!id) return;
    try {
      const [sectorData, plotData] = await Promise.all([getSectors(id), getCemeteryPlots(id)]);
      setSectors(sectorData);
      setPlots(plotData);
    } catch (error) {
      console.error('Erro ao carregar estrutura do cemiterio:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const occupancyBySector = useMemo(() => {
    const map: Record<string, { total: number; occupied: number }> = {};
    plots.forEach((plot) => {
      if (!map[plot.sectorId]) {
        map[plot.sectorId] = { total: 0, occupied: 0 };
      }
      map[plot.sectorId].total += 1;
      if (plot.status === 'occupied') map[plot.sectorId].occupied += 1;
    });
    return map;
  }, [plots]);

  const handleCreateSector = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !id || !form.name) return;
    setSaving(true);
    try {
      await createSector(tenantId, id, {
        name: form.name,
        capacity: Number(form.capacity),
        type: form.type as any,
        centerLat: form.centerLat ? Number(form.centerLat) : undefined,
        centerLng: form.centerLng ? Number(form.centerLng) : undefined,
        gridRows: Number(form.gridRows) || undefined,
        gridCols: Number(form.gridCols) || undefined,
        generatePlots: form.generatePlots,
        plotType: form.plotType as any
      });
      setIsModalOpen(false);
      setForm({
        name: '',
        capacity: 100,
        type: 'ground',
        centerLat: '',
        centerLng: '',
        gridRows: 10,
        gridCols: 10,
        plotType: 'Jazigo',
        generatePlots: true
      });
      await loadData();
    } catch (error) {
      console.error('Erro ao criar setor:', error);
      alert('Erro ao criar setor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/cemiterios" className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estrutura do cemiterio</h1>
          <p className="text-slate-500">Gerencie quadras e gere jazigos com georreferenciamento automatico.</p>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">Setores / quadras</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm hover:bg-slate-800"
        >
          <Plus size={16} /> Novo setor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sectors.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            Nenhum setor cadastrado neste cemiterio.
          </div>
        ) : (
          sectors.map((sector) => {
            const occupancy = occupancyBySector[sector.id || ''] || { total: 0, occupied: 0 };
            const percent = occupancy.total > 0 ? Math.round((occupancy.occupied / occupancy.total) * 100) : 0;
            return (
              <div key={sector.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Grid size={20} />
                  </div>
                  <h3 className="font-bold text-slate-900">{sector.name}</h3>
                </div>
                <div className="text-sm text-slate-500 space-y-1">
                  <p>Capacidade planejada: {sector.capacity} jazigos</p>
                  <p>Jazigos gerados: {occupancy.total}</p>
                  <p>Tipo: {sector.type}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                    <div className={`${percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'} h-2 rounded-full`} style={{ width: `${percent}%` }}></div>
                  </div>
                  <p className="text-xs text-right text-slate-500">{percent}% ocupado</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">Novo setor</h2>
            <form onSubmit={handleCreateSector} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome (ex: Quadra A)</label>
                  <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full border border-slate-300 p-2 rounded" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))} className="w-full border border-slate-300 p-2 rounded bg-white">
                    <option value="ground">Terreo</option>
                    <option value="vertical">Vertical</option>
                    <option value="ossuary">Ossuario</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Capacidade de jazigos</label>
                  <input type="number" value={form.capacity} onChange={(e) => setForm((prev) => ({ ...prev, capacity: Number(e.target.value) }))} className="w-full border border-slate-300 p-2 rounded" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de jazigo gerado</label>
                  <select value={form.plotType} onChange={(e) => setForm((prev) => ({ ...prev, plotType: e.target.value }))} className="w-full border border-slate-300 p-2 rounded bg-white">
                    <option value="Jazigo">Jazigo</option>
                    <option value="Mausoleu">Mausoleu</option>
                    <option value="Ossuario">Ossuario</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Latitude centro</label>
                  <input value={form.centerLat} onChange={(e) => setForm((prev) => ({ ...prev, centerLat: e.target.value }))} className="w-full border border-slate-300 p-2 rounded" placeholder="-23.550520" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Longitude centro</label>
                  <input value={form.centerLng} onChange={(e) => setForm((prev) => ({ ...prev, centerLng: e.target.value }))} className="w-full border border-slate-300 p-2 rounded" placeholder="-46.633308" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Linhas da grade</label>
                  <input type="number" value={form.gridRows} onChange={(e) => setForm((prev) => ({ ...prev, gridRows: Number(e.target.value) }))} className="w-full border border-slate-300 p-2 rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Colunas da grade</label>
                  <input type="number" value={form.gridCols} onChange={(e) => setForm((prev) => ({ ...prev, gridCols: Number(e.target.value) }))} className="w-full border border-slate-300 p-2 rounded" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.generatePlots} onChange={(e) => setForm((prev) => ({ ...prev, generatePlots: e.target.checked }))} />
                Gerar jazigos automaticamente ao criar setor
              </label>

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 text-white rounded disabled:opacity-60">
                  {saving ? 'Salvando...' : 'Salvar setor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
