import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Grid, Plus, Pencil, Trash2, Eye, X } from 'lucide-react';
import {
  createSector, updateSector, deleteSector,
  getCemeteryPlots, getSectors, getPlots,
  createPlot, updatePlot, deletePlot,
  Sector, Plot,
} from '@/services/cemeteryService';
import { useAuth } from '@/contexts/AuthContext';

// --- Sector Form Modal ---
function SectorModal({ sector, saving, onSave, onClose }: {
  sector: Sector | null;
  saving: boolean;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const isEdit = !!sector;
  const [form, setForm] = useState({
    name: sector?.name || '',
    capacity: sector?.capacity || 100,
    type: sector?.type || 'ground',
    centerLat: sector?.centerLat ? String(sector.centerLat) : '',
    centerLng: sector?.centerLng ? String(sector.centerLng) : '',
    gridRows: sector?.gridRows || 10,
    gridCols: sector?.gridCols || 10,
    plotType: 'Jazigo',
    generatePlots: !isEdit,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{isEdit ? 'Editar setor' : 'Novo setor'}</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome (ex: Quadra A)</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full border border-slate-300 p-2 rounded" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="w-full border border-slate-300 p-2 rounded bg-white">
                <option value="ground">Terreo</option>
                <option value="vertical">Vertical</option>
                <option value="ossuary">Ossuario</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Capacidade de jazigos</label>
              <input type="number" value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: Number(e.target.value) }))} className="w-full border border-slate-300 p-2 rounded" required />
            </div>
            {!isEdit && (
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de jazigo gerado</label>
                <select value={form.plotType} onChange={(e) => setForm((p) => ({ ...p, plotType: e.target.value }))} className="w-full border border-slate-300 p-2 rounded bg-white">
                  <option value="Jazigo">Jazigo</option>
                  <option value="Mausoleu">Mausoleu</option>
                  <option value="Ossuario">Ossuario</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Latitude centro</label>
              <input value={form.centerLat} onChange={(e) => setForm((p) => ({ ...p, centerLat: e.target.value }))} className="w-full border border-slate-300 p-2 rounded" placeholder="-23.550520" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Longitude centro</label>
              <input value={form.centerLng} onChange={(e) => setForm((p) => ({ ...p, centerLng: e.target.value }))} className="w-full border border-slate-300 p-2 rounded" placeholder="-46.633308" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Linhas da grade</label>
              <input type="number" value={form.gridRows} onChange={(e) => setForm((p) => ({ ...p, gridRows: Number(e.target.value) }))} className="w-full border border-slate-300 p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Colunas da grade</label>
              <input type="number" value={form.gridCols} onChange={(e) => setForm((p) => ({ ...p, gridCols: Number(e.target.value) }))} className="w-full border border-slate-300 p-2 rounded" />
            </div>
          </div>

          {!isEdit && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.generatePlots} onChange={(e) => setForm((p) => ({ ...p, generatePlots: e.target.checked }))} />
              Gerar jazigos automaticamente ao criar setor
            </label>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 text-white rounded disabled:opacity-60">
              {saving ? 'Salvando...' : isEdit ? 'Atualizar setor' : 'Salvar setor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Plot/Tomb Form Modal ---
function PlotModal({ plot, sectorId, cemeteryId, saving, onSave, onClose }: {
  plot: Plot | null;
  sectorId: string;
  cemeteryId: string;
  saving: boolean;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const isEdit = !!plot;
  const [form, setForm] = useState({
    code: plot?.code || '',
    type: plot?.type || 'Jazigo',
    status: plot?.status || 'available',
    occupantName: plot?.occupantName || '',
    burialDate: plot?.burialDate || '',
    exhumationDeadlineYears: plot?.exhumationDeadlineYears || 3,
    notes: (plot as any)?.notes || '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{isEdit ? 'Editar tumulo' : 'Novo tumulo'}</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Numero do tumulo</label>
              <input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} className="w-full border p-2 rounded" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as any }))} className="w-full border p-2 rounded bg-white">
                <option value="Jazigo">Jazigo</option>
                <option value="Mausoleu">Mausoleu</option>
                <option value="Ossuario">Ossuario</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as any }))} className="w-full border p-2 rounded bg-white">
              <option value="available">Disponivel</option>
              <option value="occupied">Ocupado</option>
              <option value="reserved">Reservado</option>
              <option value="blocked">Bloqueado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nome do falecido</label>
            <input value={form.occupantName} onChange={(e) => setForm((p) => ({ ...p, occupantName: e.target.value }))} className="w-full border p-2 rounded" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data do enterro</label>
              <input type="date" value={form.burialDate} onChange={(e) => setForm((p) => ({ ...p, burialDate: e.target.value }))} className="w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Exumacao (anos)</label>
              <input type="number" value={form.exhumationDeadlineYears} onChange={(e) => setForm((p) => ({ ...p, exhumationDeadlineYears: Number(e.target.value) }))} className="w-full border p-2 rounded" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observacoes</label>
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="w-full border p-2 rounded" rows={3} />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 text-white rounded disabled:opacity-60">
              {saving ? 'Salvando...' : isEdit ? 'Atualizar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Status badge ---
const STATUS_COLORS: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  occupied: 'bg-rose-100 text-rose-700',
  reserved: 'bg-amber-100 text-amber-700',
  blocked: 'bg-slate-200 text-slate-600',
};
const STATUS_LABELS: Record<string, string> = {
  available: 'Disponivel',
  occupied: 'Ocupado',
  reserved: 'Reservado',
  blocked: 'Bloqueado',
};

// --- Main Page ---
export default function CemeteryDetail() {
  const { id } = useParams();
  const { tenantId } = useAuth();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [allPlots, setAllPlots] = useState<Plot[]>([]);
  const [saving, setSaving] = useState(false);

  // Sector modals
  const [sectorModal, setSectorModal] = useState<{ open: boolean; sector: Sector | null }>({ open: false, sector: null });
  // Plot modals
  const [plotModal, setPlotModal] = useState<{ open: boolean; plot: Plot | null; sectorId: string }>({ open: false, plot: null, sectorId: '' });
  // Expanded sector (shows plots)
  const [expandedSector, setExpandedSector] = useState<string | null>(null);
  const [sectorPlots, setSectorPlots] = useState<Plot[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      const [sectorData, plotData] = await Promise.all([getSectors(id), getCemeteryPlots(id)]);
      setSectors(sectorData);
      setAllPlots(plotData);
    } catch (error) {
      console.error('Erro ao carregar estrutura do cemiterio:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const occupancyBySector = useMemo(() => {
    const map: Record<string, { total: number; occupied: number }> = {};
    allPlots.forEach((plot) => {
      if (!map[plot.sectorId]) map[plot.sectorId] = { total: 0, occupied: 0 };
      map[plot.sectorId].total += 1;
      if (plot.status === 'occupied') map[plot.sectorId].occupied += 1;
    });
    return map;
  }, [allPlots]);

  // --- Sector CRUD ---
  const handleSaveSector = async (formData: any) => {
    if (!tenantId || !id) return;
    setSaving(true);
    try {
      if (sectorModal.sector) {
        await updateSector(tenantId, sectorModal.sector.id!, {
          name: formData.name,
          capacity: Number(formData.capacity),
          type: formData.type as any,
          centerLat: formData.centerLat ? Number(formData.centerLat) : undefined,
          centerLng: formData.centerLng ? Number(formData.centerLng) : undefined,
          gridRows: Number(formData.gridRows) || undefined,
          gridCols: Number(formData.gridCols) || undefined,
        });
      } else {
        await createSector(tenantId, id, {
          name: formData.name,
          capacity: Number(formData.capacity),
          type: formData.type as any,
          centerLat: formData.centerLat ? Number(formData.centerLat) : undefined,
          centerLng: formData.centerLng ? Number(formData.centerLng) : undefined,
          gridRows: Number(formData.gridRows) || undefined,
          gridCols: Number(formData.gridCols) || undefined,
          generatePlots: formData.generatePlots,
          plotType: formData.plotType as any,
        });
      }
      setSectorModal({ open: false, sector: null });
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar setor:', error);
      alert('Erro ao salvar setor.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSector = async (sectorId: string) => {
    if (!tenantId || !window.confirm('Excluir este setor? Os jazigos associados nao serao removidos automaticamente.')) return;
    try {
      await deleteSector(tenantId, sectorId);
      if (expandedSector === sectorId) setExpandedSector(null);
      await loadData();
    } catch (error) {
      console.error('Erro ao excluir setor:', error);
      alert('Erro ao excluir setor.');
    }
  };

  // --- Plot view ---
  const toggleSectorPlots = async (sectorId: string) => {
    if (expandedSector === sectorId) {
      setExpandedSector(null);
      return;
    }
    setExpandedSector(sectorId);
    setLoadingPlots(true);
    try {
      const plots = await getPlots(sectorId);
      setSectorPlots(plots);
    } catch (error) {
      console.error('Erro ao carregar tumulos:', error);
    } finally {
      setLoadingPlots(false);
    }
  };

  // --- Plot CRUD ---
  const handleSavePlot = async (formData: any) => {
    if (!tenantId || !id) return;
    setSaving(true);
    try {
      const payload: any = {
        code: formData.code,
        type: formData.type,
        status: formData.status,
        occupantName: formData.occupantName || '',
        burialDate: formData.burialDate || '',
        exhumationDeadlineYears: formData.exhumationDeadlineYears || 3,
        notes: formData.notes || '',
      };

      if (plotModal.plot) {
        await updatePlot(plotModal.plot.id!, tenantId, payload);
      } else {
        await createPlot(tenantId, {
          ...payload,
          cemeteryId: id,
          sectorId: plotModal.sectorId,
          sectorName: sectors.find(s => s.id === plotModal.sectorId)?.name || '',
        });
      }
      setPlotModal({ open: false, plot: null, sectorId: '' });
      // Refresh
      if (expandedSector) {
        const plots = await getPlots(expandedSector);
        setSectorPlots(plots);
      }
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar tumulo:', error);
      alert('Erro ao salvar tumulo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlot = async (plotId: string) => {
    if (!tenantId || !window.confirm('Excluir este tumulo?')) return;
    try {
      await deletePlot(tenantId, plotId);
      if (expandedSector) {
        const plots = await getPlots(expandedSector);
        setSectorPlots(plots);
      }
      await loadData();
    } catch (error) {
      console.error('Erro ao excluir tumulo:', error);
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
          <p className="text-slate-500">Gerencie quadras, tumulos e georreferenciamento.</p>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">Setores / quadras</h2>
        <button
          onClick={() => setSectorModal({ open: true, sector: null })}
          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm hover:bg-slate-800"
        >
          <Plus size={16} /> Novo setor
        </button>
      </div>

      <div className="space-y-4">
        {sectors.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            Nenhum setor cadastrado neste cemiterio.
          </div>
        ) : (
          sectors.map((sector) => {
            const occupancy = occupancyBySector[sector.id || ''] || { total: 0, occupied: 0 };
            const percent = occupancy.total > 0 ? Math.round((occupancy.occupied / occupancy.total) * 100) : 0;
            const isExpanded = expandedSector === sector.id;

            return (
              <div key={sector.id} className="bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Grid size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{sector.name}</h3>
                        <p className="text-xs text-slate-500">
                          Cap: {sector.capacity} | Gerados: {occupancy.total} | Tipo: {sector.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleSectorPlots(sector.id!)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full" title="Ver tumulos">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => setSectorModal({ open: true, sector })} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-full" title="Editar setor">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => handleDeleteSector(sector.id!)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full" title="Excluir setor">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                      <div className={`${percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'} h-2 rounded-full`} style={{ width: `${percent}%` }}></div>
                    </div>
                    <p className="text-xs text-right text-slate-500">{percent}% ocupado</p>
                  </div>
                </div>

                {/* Expanded plots section */}
                {isExpanded && (
                  <div className="border-t border-slate-200 p-5 bg-slate-50/50">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-slate-700">Tumulos da quadra: {sector.name}</h4>
                      <button
                        onClick={() => setPlotModal({ open: true, plot: null, sectorId: sector.id! })}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs hover:bg-indigo-700"
                      >
                        <Plus size={14} /> Novo tumulo
                      </button>
                    </div>

                    {loadingPlots ? (
                      <p className="text-sm text-slate-400">Carregando...</p>
                    ) : sectorPlots.length === 0 ? (
                      <p className="text-sm text-slate-400">Nenhum tumulo cadastrado nesta quadra.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-500 border-b border-slate-200">
                              <th className="pb-2 pr-4">Numero</th>
                              <th className="pb-2 pr-4">Tipo</th>
                              <th className="pb-2 pr-4">Status</th>
                              <th className="pb-2 pr-4">Falecido</th>
                              <th className="pb-2 pr-4">Data enterro</th>
                              <th className="pb-2">Acoes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sectorPlots.map((plot) => (
                              <tr key={plot.id} className="border-b border-slate-100">
                                <td className="py-2 pr-4 font-medium text-slate-800">{plot.code}</td>
                                <td className="py-2 pr-4 text-slate-600">{plot.type}</td>
                                <td className="py-2 pr-4">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[plot.status] || ''}`}>
                                    {STATUS_LABELS[plot.status] || plot.status}
                                  </span>
                                </td>
                                <td className="py-2 pr-4 text-slate-600">{plot.occupantName || '-'}</td>
                                <td className="py-2 pr-4 text-slate-600">{plot.burialDate || '-'}</td>
                                <td className="py-2">
                                  <div className="flex gap-1">
                                    <button onClick={() => setPlotModal({ open: true, plot, sectorId: sector.id! })} className="p-1 text-slate-400 hover:text-blue-500" title="Editar">
                                      <Pencil size={16} />
                                    </button>
                                    <button onClick={() => handleDeletePlot(plot.id!)} className="p-1 text-slate-400 hover:text-red-500" title="Excluir">
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sector Modal */}
      {sectorModal.open && (
        <SectorModal
          sector={sectorModal.sector}
          saving={saving}
          onSave={handleSaveSector}
          onClose={() => setSectorModal({ open: false, sector: null })}
        />
      )}

      {/* Plot/Tomb Modal */}
      {plotModal.open && (
        <PlotModal
          plot={plotModal.plot}
          sectorId={plotModal.sectorId}
          cemeteryId={id!}
          saving={saving}
          onSave={handleSavePlot}
          onClose={() => setPlotModal({ open: false, plot: null, sectorId: '' })}
        />
      )}
    </div>
  );
}
