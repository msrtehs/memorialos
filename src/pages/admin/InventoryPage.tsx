import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Filter, Info, List, Map as MapIcon, Plus, Save, Search } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  createPlot,
  getCemeteryPlots,
  getSectors,
  getTenantPlots,
  Plot,
  Sector,
  updatePlot
} from '@/services/cemeteryService';
import { getSciExecutiveSnapshot } from '@/services/sciService';

type ViewMode = 'map' | 'list' | 'ai';

const statusClass: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  occupied: 'bg-rose-100 text-rose-700 border-rose-200',
  reserved: 'bg-amber-100 text-amber-700 border-amber-200',
  blocked: 'bg-slate-200 text-slate-700 border-slate-300'
};

export default function InventoryPage() {
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();

  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [plots, setPlots] = useState<Plot[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [inspectStatus, setInspectStatus] = useState<Plot['status']>('available');

  const [newPlot, setNewPlot] = useState({
    sectorId: '',
    code: '',
    type: 'Jazigo' as Plot['type'],
    status: 'available' as Plot['status'],
    row: '',
    column: '',
    latitude: '',
    longitude: '',
    sanitaryRisk: 'low' as Plot['sanitaryRisk'],
    environmentalRisk: 'low' as Plot['environmentalRisk'],
    structuralStatus: 'ok' as Plot['structuralStatus'],
    documentStatus: 'regular' as Plot['documentStatus'],
    burialDate: '',
    exhumationDeadlineYears: 3,
    concessionHolder: '',
    concessionType: 'perpetual' as 'temporary' | 'perpetual',
    concessionStartDate: '',
    concessionEndDate: ''
  });

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [plotsData, sectorsData, execSnapshot] = await Promise.all([
        selectedCemeteryId === 'all' ? getTenantPlots(tenantId) : getCemeteryPlots(selectedCemeteryId),
        selectedCemeteryId === 'all' ? Promise.resolve([]) : getSectors(selectedCemeteryId),
        getSciExecutiveSnapshot(tenantId, selectedCemeteryId)
      ]);
      setPlots(plotsData);
      setSectors(sectorsData);
      setSnapshot(execSnapshot);
      if (selectedCemeteryId !== 'all' && sectorsData.length > 0 && !newPlot.sectorId) {
        setNewPlot((prev) => ({ ...prev, sectorId: sectorsData[0].id || '' }));
      }
    } catch (error) {
      console.error('Erro ao carregar inventario:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, selectedCemeteryId]);

  const filteredPlots = useMemo(() => {
    return plots.filter((plot) => {
      const searchMatch = `${plot.code} ${plot.sectorName || ''} ${plot.occupantName || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const statusMatch = statusFilter === 'all' || plot.status === statusFilter;
      const riskMatch =
        riskFilter === 'all' ||
        plot.sanitaryRisk === riskFilter ||
        plot.environmentalRisk === riskFilter ||
        plot.structuralStatus === (riskFilter === 'high' ? 'critical' : riskFilter === 'medium' ? 'attention' : 'ok');
      const sectorMatch = sectorFilter === 'all' || plot.sectorId === sectorFilter || plot.sectorName === sectorFilter;
      return searchMatch && statusMatch && riskMatch && sectorMatch;
    });
  }, [plots, search, statusFilter, riskFilter, sectorFilter]);

  const geoBounds = useMemo(() => {
    const valid = filteredPlots.filter((plot) => Number.isFinite(plot.latitude) && Number.isFinite(plot.longitude));
    if (!valid.length) return null;
    const lats = valid.map((plot) => Number(plot.latitude));
    const lngs = valid.map((plot) => Number(plot.longitude));
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs)
    };
  }, [filteredPlots]);

  const sectorCenters = useMemo<Record<string, { name: string; left: string; top: string }>>(() => {
    const map: Record<string, { name: string; left: string; top: string }> = {};
    if (!geoBounds) return map;
    const byId: Record<string, Plot[]> = {};
    filteredPlots.forEach((p) => {
      if (p.sectorId && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) {
        if (!byId[p.sectorId]) byId[p.sectorId] = [];
        byId[p.sectorId].push(p);
      }
    });
    const latSpan = geoBounds.maxLat - geoBounds.minLat || 0.0001;
    const lngSpan = geoBounds.maxLng - geoBounds.minLng || 0.0001;
    Object.entries(byId).forEach(([id, ps]) => {
      const avgLat = ps.reduce((s, p) => s + Number(p.latitude), 0) / ps.length;
      const avgLng = ps.reduce((s, p) => s + Number(p.longitude), 0) / ps.length;
      map[id] = {
        name: ps[0].sectorName || id,
        left: `${((avgLng - geoBounds.minLng) / lngSpan) * 100}%`,
        top: `${100 - ((avgLat - geoBounds.minLat) / latSpan) * 100}%`
      };
    });
    return map;
  }, [filteredPlots, geoBounds]);

  const getMapPosition = (plot: Plot) => {
    if (!geoBounds || !plot.latitude || !plot.longitude) return { left: '50%', top: '50%' };
    const latSpan = geoBounds.maxLat - geoBounds.minLat || 0.0001;
    const lngSpan = geoBounds.maxLng - geoBounds.minLng || 0.0001;
    const left = ((Number(plot.longitude) - geoBounds.minLng) / lngSpan) * 100;
    const top = 100 - ((Number(plot.latitude) - geoBounds.minLat) / latSpan) * 100;
    return { left: `${left}%`, top: `${top}%` };
  };

  const handleStatusChange = async (plotId: string, status: Plot['status']) => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await updatePlot(plotId, tenantId, { status });
      await loadData();
    } catch (error) {
      console.error('Erro ao atualizar status do jazigo:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || selectedCemeteryId === 'all') return;
    const selectedSector = sectors.find((item) => item.id === newPlot.sectorId);
    if (!selectedSector) return;

    setSaving(true);
    try {
      await createPlot(tenantId, {
        cemeteryId: selectedCemeteryId,
        sectorId: newPlot.sectorId,
        sectorName: selectedSector.name,
        code: newPlot.code,
        type: newPlot.type,
        status: newPlot.status,
        row: Number(newPlot.row) || undefined,
        column: Number(newPlot.column) || undefined,
        latitude: Number(newPlot.latitude) || undefined,
        longitude: Number(newPlot.longitude) || undefined,
        sanitaryRisk: newPlot.sanitaryRisk,
        environmentalRisk: newPlot.environmentalRisk,
        structuralStatus: newPlot.structuralStatus,
        documentStatus: newPlot.documentStatus,
        burialDate: newPlot.burialDate || undefined,
        exhumationDeadlineYears: newPlot.exhumationDeadlineYears || undefined,
        concessionHolder: newPlot.concessionHolder || undefined,
        concessionType: newPlot.concessionHolder ? newPlot.concessionType : undefined,
        concessionStartDate: newPlot.concessionStartDate || undefined,
        concessionEndDate: newPlot.concessionEndDate || undefined
      });
      setIsModalOpen(false);
      setNewPlot((prev) => ({
        ...prev,
        code: '',
        row: '',
        column: '',
        latitude: '',
        longitude: '',
        burialDate: '',
        concessionHolder: '',
        concessionStartDate: '',
        concessionEndDate: ''
      }));
      await loadData();
    } catch (error) {
      console.error('Erro ao criar jazigo:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventario georreferenciado</h1>
          <p className="text-sm text-slate-500">
            Mapa interativo, cadastro detalhado e indicadores de risco por jazigo/setor.
          </p>
        </div>
        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
          <button
            onClick={() => setViewMode('map')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${viewMode === 'map' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <MapIcon size={16} /> Mapa
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <List size={16} /> Lista
          </button>
          <button
            onClick={() => setViewMode('ai')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${viewMode === 'ai' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Bot size={16} /> IA
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
            placeholder="Buscar por codigo, setor ou ocupante"
          />
        </div>

        <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
          <option value="all">Todos os setores</option>
          {Array.from(new Set(plots.map((plot) => plot.sectorId || plot.sectorName).filter(Boolean))).map((sector) => (
            <option key={String(sector)} value={String(sector)}>{String(sector)}</option>
          ))}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
          <option value="all">Todos os status</option>
          <option value="available">Disponivel</option>
          <option value="occupied">Ocupado</option>
          <option value="reserved">Reservado</option>
          <option value="blocked">Bloqueado</option>
        </select>

        <div className="flex gap-2">
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
            <option value="all">Risco geral</option>
            <option value="high">Alto</option>
            <option value="medium">Medio</option>
            <option value="low">Baixo</option>
          </select>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={selectedCemeteryId === 'all'}
            className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Plus size={15} /> Jazigo
          </button>
        </div>
      </div>

      {selectedCemeteryId === 'all' && viewMode === 'map' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-center gap-2 text-sm">
          <Info size={16} />
          Selecione uma unidade especifica no topo para visualizar o mapa georreferenciado.
        </div>
      )}

      {viewMode === 'map' && selectedCemeteryId !== 'all' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Mapa digital interativo (GIS)</h2>
            <span className="text-xs text-slate-500">{filteredPlots.length} jazigos visiveis</span>
          </div>
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-5 text-xs text-slate-600">
            {([['bg-emerald-400', 'Disponivel'], ['bg-rose-400', 'Ocupado'], ['bg-amber-400', 'Reservado'], ['bg-slate-400', 'Bloqueado']] as [string, string][]).map(([color, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-full ${color}`}></span>{label}
              </span>
            ))}
          </div>
          <div className="p-5">
            {filteredPlots.length === 0 && (
              <div className="h-72 rounded-lg border border-dashed border-slate-300 text-slate-400 flex items-center justify-center">
                Sem dados para os filtros atuais.
              </div>
            )}
            {filteredPlots.length > 0 && (
              <div className="relative h-[420px] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(100,116,139,0.18)_1px,_transparent_1px)] bg-[length:20px_20px]" />
                {(Object.values(sectorCenters) as { name: string; left: string; top: string }[]).map((sc) => (
                  <span
                    key={sc.name}
                    style={{ left: sc.left, top: sc.top }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-slate-700 bg-white/80 px-2 py-1 rounded shadow-sm pointer-events-none z-10"
                  >
                    {sc.name}
                  </span>
                ))}
                {filteredPlots.map((plot) => {
                  const point = getMapPosition(plot);
                  const dotSize = plot.status === 'occupied' ? 'w-5 h-5' : plot.status === 'blocked' ? 'w-4 h-4' : 'w-3.5 h-3.5';
                  return (
                    <button
                      key={plot.id}
                      style={point}
                      title={`${plot.code} — ${plot.status}${plot.occupantName ? ` — ${plot.occupantName}` : ''}`}
                      onClick={() => { setSelectedPlot(plot); setInspectStatus(plot.status); }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 ${dotSize} rounded-full border hover:scale-125 transition-transform ${statusClass[plot.status] || statusClass.available}`}
                    />
                  );
                })}
              </div>
            )}
            <div className="flex gap-5 text-xs text-slate-500 mt-3">
              <span><strong className="text-slate-700">{plots.filter((p) => p.status === 'occupied').length}</strong> ocupados</span>
              <span><strong className="text-slate-700">{plots.filter((p) => p.status === 'available').length}</strong> disponiveis</span>
              <span><strong className="text-slate-700">{plots.filter((p) => p.status === 'reserved').length}</strong> reservados</span>
              <span><strong className="text-slate-700">{plots.filter((p) => p.status === 'blocked').length}</strong> bloqueados</span>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Codigo</th>
                <th className="px-4 py-3">Setor</th>
                <th className="px-4 py-3">Lat / Lng</th>
                <th className="px-4 py-3">Risco</th>
                <th className="px-4 py-3">Documentos</th>
                <th className="px-4 py-3">Titular</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPlots.map((plot) => (
                <tr key={plot.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{plot.code}</td>
                  <td className="px-4 py-3 text-slate-600">{plot.sectorName || plot.sectorId}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {plot.latitude ? Number(plot.latitude).toFixed(6) : '-'} / {plot.longitude ? Number(plot.longitude).toFixed(6) : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    Sanitario: {plot.sanitaryRisk || 'low'}<br />
                    Ambiental: {plot.environmentalRisk || 'low'}<br />
                    Estrutural: {plot.structuralStatus || 'ok'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`px-2 py-1 rounded-full border ${plot.documentStatus === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                      {plot.documentStatus === 'pending' ? 'Pendente' : 'Regular'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{(plot as any).concessionHolder || '-'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={plot.status}
                      onChange={(e) => handleStatusChange(plot.id!, e.target.value as Plot['status'])}
                      className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-white"
                      disabled={saving}
                    >
                      <option value="available">Disponivel</option>
                      <option value="occupied">Ocupado</option>
                      <option value="reserved">Reservado</option>
                      <option value="blocked">Bloqueado</option>
                    </select>
                  </td>
                </tr>
              ))}
              {!loading && filteredPlots.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Nenhum jazigo encontrado para os filtros selecionados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3">Diagnostico IA do inventario</h2>
            {snapshot ? (
              <div className="space-y-3 text-sm">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  Saturacao atual: <span className="font-semibold">{snapshot.occupancyRate}%</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  Riscos sanitarios: <span className="font-semibold">{snapshot.sanitaryAlerts}</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  Riscos ambientais: <span className="font-semibold">{snapshot.environmentalAlerts}</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  Falhas estruturais: <span className="font-semibold">{snapshot.structuralFailures}</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  Pendencias documentais: <span className="font-semibold">{snapshot.pendingDocuments}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Sem dados consolidados para exibir.</p>
            )}
          </div>
          <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-xl p-6 text-white">
            <h3 className="font-bold flex items-center gap-2"><Bot size={16} /> Acoes recomendadas</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="bg-white/10 rounded-lg p-3">Priorizar setores com risco alto e status estrutural critico.</li>
              <li className="bg-white/10 rounded-lg p-3">Liberar jazigos reservados sem uso com mais de 30 dias.</li>
              <li className="bg-white/10 rounded-lg p-3">Regularizar pendencias documentais para reduzir passivo juridico.</li>
            </ul>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Novo jazigo georreferenciado</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-sm text-slate-600 hover:text-slate-900">Fechar</button>
            </div>
            <form onSubmit={handleSavePlot} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Setor</label>
                  <select
                    value={newPlot.sectorId}
                    onChange={(e) => setNewPlot((prev) => ({ ...prev, sectorId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                    required
                  >
                    {sectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>{sector.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Codigo</label>
                  <input
                    value={newPlot.code}
                    onChange={(e) => setNewPlot((prev) => ({ ...prev, code: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2.5"
                    placeholder="QDA-0001"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Tipo</label>
                  <select value={newPlot.type} onChange={(e) => setNewPlot((prev) => ({ ...prev, type: e.target.value as Plot['type'] }))} className="w-full border border-slate-300 rounded-lg p-2.5 bg-white">
                    <option value="Jazigo">Jazigo</option>
                    <option value="Mausoleu">Mausoleu</option>
                    <option value="Ossuario">Ossuario</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Status</label>
                  <select value={newPlot.status} onChange={(e) => setNewPlot((prev) => ({ ...prev, status: e.target.value as Plot['status'] }))} className="w-full border border-slate-300 rounded-lg p-2.5 bg-white">
                    <option value="available">Disponivel</option>
                    <option value="reserved">Reservado</option>
                    <option value="occupied">Ocupado</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Linha</label>
                  <input type="number" value={newPlot.row} onChange={(e) => setNewPlot((prev) => ({ ...prev, row: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Coluna</label>
                  <input type="number" value={newPlot.column} onChange={(e) => setNewPlot((prev) => ({ ...prev, column: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Latitude</label>
                  <input value={newPlot.latitude} onChange={(e) => setNewPlot((prev) => ({ ...prev, latitude: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2.5" placeholder="-23.550520" />
                </div>
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Longitude</label>
                  <input value={newPlot.longitude} onChange={(e) => setNewPlot((prev) => ({ ...prev, longitude: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2.5" placeholder="-46.633308" />
                </div>
              </div>

              {newPlot.status === 'occupied' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-600 block mb-1">Data sepultamento</label>
                    <input type="date" value={newPlot.burialDate} onChange={(e) => setNewPlot((prev) => ({ ...prev, burialDate: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2.5" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 block mb-1">Prazo exumacao (anos)</label>
                    <input type="number" value={newPlot.exhumationDeadlineYears} min={1} max={99} onChange={(e) => setNewPlot((prev) => ({ ...prev, exhumationDeadlineYears: Number(e.target.value) }))} className="w-full border border-slate-300 rounded-lg p-2.5" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Titular da concessao</label>
                  <input value={newPlot.concessionHolder} onChange={(e) => setNewPlot((prev) => ({ ...prev, concessionHolder: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2.5" placeholder="Nome completo" />
                </div>
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Tipo concessao</label>
                  <select value={newPlot.concessionType} onChange={(e) => setNewPlot((prev) => ({ ...prev, concessionType: e.target.value as any }))} className="w-full border border-slate-300 rounded-lg p-2.5 bg-white">
                    <option value="perpetual">Perpetua</option>
                    <option value="temporary">Temporaria</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Inicio concessao</label>
                  <input type="date" value={newPlot.concessionStartDate} onChange={(e) => setNewPlot((prev) => ({ ...prev, concessionStartDate: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Vencimento concessao</label>
                  <input type="date" value={newPlot.concessionEndDate} onChange={(e) => setNewPlot((prev) => ({ ...prev, concessionEndDate: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Risco sanitario</label>
                  <select value={newPlot.sanitaryRisk} onChange={(e) => setNewPlot((prev) => ({ ...prev, sanitaryRisk: e.target.value as any }))} className="w-full border border-slate-300 rounded-lg p-2.5 bg-white">
                    <option value="low">Baixo</option>
                    <option value="medium">Medio</option>
                    <option value="high">Alto</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Risco ambiental</label>
                  <select value={newPlot.environmentalRisk} onChange={(e) => setNewPlot((prev) => ({ ...prev, environmentalRisk: e.target.value as any }))} className="w-full border border-slate-300 rounded-lg p-2.5 bg-white">
                    <option value="low">Baixo</option>
                    <option value="medium">Medio</option>
                    <option value="high">Alto</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Estrutural</label>
                  <select value={newPlot.structuralStatus} onChange={(e) => setNewPlot((prev) => ({ ...prev, structuralStatus: e.target.value as any }))} className="w-full border border-slate-300 rounded-lg p-2.5 bg-white">
                    <option value="ok">OK</option>
                    <option value="attention">Atencao</option>
                    <option value="critical">Critico</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-600 block mb-1">Doc. status</label>
                  <select value={newPlot.documentStatus} onChange={(e) => setNewPlot((prev) => ({ ...prev, documentStatus: e.target.value as any }))} className="w-full border border-slate-300 rounded-lg p-2.5 bg-white">
                    <option value="regular">Regular</option>
                    <option value="pending">Pendente</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
                  <Save size={15} /> {saving ? 'Salvando...' : 'Salvar jazigo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPlot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Jazigo {selectedPlot.code}</h3>
              <button onClick={() => setSelectedPlot(null)} className="text-sm text-slate-600 hover:text-slate-900">Fechar</button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Setor</p>
                  <p className="font-medium text-slate-800">{selectedPlot.sectorName || selectedPlot.sectorId || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Tipo</p>
                  <p className="font-medium text-slate-800">{selectedPlot.type}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ocupante</p>
                  <p className="font-medium text-slate-800">{selectedPlot.occupantName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Titular</p>
                  <p className="font-medium text-slate-800">{(selectedPlot as any).concessionHolder || '-'}</p>
                </div>
                {(selectedPlot as any).burialDate && (
                  <div>
                    <p className="text-xs text-slate-500">Data sepultamento</p>
                    <p className="font-medium text-slate-800">{(selectedPlot as any).burialDate}</p>
                  </div>
                )}
                {(selectedPlot as any).exhumationDeadlineYears && (
                  <div>
                    <p className="text-xs text-slate-500">Prazo exumacao</p>
                    <p className="font-medium text-slate-800">{(selectedPlot as any).exhumationDeadlineYears} anos</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <span className={`px-2 py-1 rounded-full text-center border ${selectedPlot.sanitaryRisk === 'high' ? 'bg-rose-100 text-rose-700 border-rose-200' : selectedPlot.sanitaryRisk === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  Sanitario: {selectedPlot.sanitaryRisk || 'low'}
                </span>
                <span className={`px-2 py-1 rounded-full text-center border ${selectedPlot.environmentalRisk === 'high' ? 'bg-rose-100 text-rose-700 border-rose-200' : selectedPlot.environmentalRisk === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  Ambiental: {selectedPlot.environmentalRisk || 'low'}
                </span>
                <span className={`px-2 py-1 rounded-full text-center border ${selectedPlot.structuralStatus === 'critical' ? 'bg-rose-100 text-rose-700 border-rose-200' : selectedPlot.structuralStatus === 'attention' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  Estrutural: {selectedPlot.structuralStatus || 'ok'}
                </span>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <label className="text-xs text-slate-500 shrink-0">Alterar status:</label>
                <select
                  value={inspectStatus}
                  onChange={(e) => setInspectStatus(e.target.value as Plot['status'])}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white flex-1"
                >
                  <option value="available">Disponivel</option>
                  <option value="occupied">Ocupado</option>
                  <option value="reserved">Reservado</option>
                  <option value="blocked">Bloqueado</option>
                </select>
                <button
                  onClick={async () => {
                    await handleStatusChange(selectedPlot.id!, inspectStatus);
                    setSelectedPlot(null);
                  }}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(loading || saving) && (
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Filter size={14} className="animate-pulse" /> Processando dados do inventario...
        </div>
      )}
    </div>
  );
}
