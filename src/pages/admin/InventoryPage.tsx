import React, { useState, useEffect } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Map as MapIcon, List, Bot, Search, Filter, Edit2, Info, ShieldCheck } from 'lucide-react';

// Mock data for now, will replace with Firestore later
const MOCK_PLOTS = Array.from({ length: 50 }).map((_, i) => ({
  id: `plot-${i}`,
  sector: i < 20 ? 'A' : 'B',
  number: i + 1,
  type: i % 5 === 0 ? 'Mausoléu' : 'Jazigo',
  status: i % 3 === 0 ? 'occupied' : i % 3 === 1 ? 'available' : 'reserved',
  occupant: i % 3 === 0 ? 'João Silva' : null,
}));

export default function InventoryPage() {
  const { selectedCemeteryId } = useAdmin();
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'ai'>('map');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [plots, setPlots] = useState(MOCK_PLOTS);

  useEffect(() => {
    // TODO: Load real plots from Firestore based on selectedCemeteryId
    console.log("Loading plots for", selectedCemeteryId);
  }, [selectedCemeteryId]);

  const filteredPlots = plots.filter(p => sectorFilter === 'all' || p.sector === sectorFilter);

  const handleStatusChange = (plotId: string, currentStatus: string) => {
    if (currentStatus === 'available') {
      // TODO: Persist to Firestore
      setPlots(prev => prev.map(p => p.id === plotId ? { ...p, status: 'reserved' } : p));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Inventário / Mapa de Vagas</h1>
        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
          <button 
            onClick={() => setViewMode('map')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${viewMode === 'map' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <MapIcon size={16} /> Mapa Digital
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <List size={16} /> Lista de Controle
          </button>
          <button 
            onClick={() => setViewMode('ai')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${viewMode === 'ai' ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Bot size={16} /> Auditor IA
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-4 items-center">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter size={18} />
          <span className="text-sm font-medium">Filtros:</span>
        </div>
        <select 
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
        >
          <option value="all">Todos os Setores</option>
          <option value="A">Setor A</option>
          <option value="B">Setor B</option>
        </select>
      </div>

      {selectedCemeteryId === 'all' && viewMode === 'map' ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg flex items-center gap-2">
          <Info size={20} />
          Selecione uma unidade específica no topo para visualizar o mapa digital.
        </div>
      ) : (
        <>
          {viewMode === 'map' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[500px]">
              <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
                {filteredPlots.map(plot => (
                  <div 
                    key={plot.id}
                    onClick={() => handleStatusChange(plot.id, plot.status)}
                    className={`
                      aspect-square rounded-md flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 relative group
                      ${plot.status === 'occupied' ? 'bg-red-100 border-2 border-red-200 text-red-700' : ''}
                      ${plot.status === 'available' ? 'bg-green-100 border-2 border-green-200 text-green-700 hover:bg-green-200' : ''}
                      ${plot.status === 'reserved' ? 'bg-yellow-100 border-2 border-yellow-200 text-yellow-700' : ''}
                    `}
                  >
                    <span className="text-xs font-bold">{plot.sector}-{plot.number}</span>
                    <span className="text-[10px] opacity-75">{plot.type[0]}</span>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-xs p-2 rounded z-10 w-32 text-center pointer-events-none">
                      <p className="font-bold">{plot.type}</p>
                      <p>Setor {plot.sector} - Nº {plot.number}</p>
                      <p className="capitalize text-slate-300">{plot.status === 'occupied' ? 'Ocupado' : plot.status === 'available' ? 'Disponível' : 'Reservado'}</p>
                      {plot.occupant && <p className="mt-1 border-t border-slate-700 pt-1">{plot.occupant}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-4 justify-center text-sm">
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 border-2 border-green-200 rounded"></div> Disponível</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-100 border-2 border-red-200 rounded"></div> Ocupado</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-200 rounded"></div> Reservado</div>
              </div>
            </div>
          )}

          {viewMode === 'list' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-sm text-left text-slate-500">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                  <tr>
                    <th className="px-6 py-3">Localização</th>
                    <th className="px-6 py-3">Tipo</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Ocupante</th>
                    <th className="px-6 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlots.map(plot => (
                    <tr key={plot.id} className="bg-white border-b hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        Setor {plot.sector} - {plot.number}
                      </td>
                      <td className="px-6 py-4">{plot.type}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium
                          ${plot.status === 'occupied' ? 'bg-red-100 text-red-800' : ''}
                          ${plot.status === 'available' ? 'bg-green-100 text-green-800' : ''}
                          ${plot.status === 'reserved' ? 'bg-yellow-100 text-yellow-800' : ''}
                        `}>
                          {plot.status === 'occupied' ? 'Ocupado' : plot.status === 'available' ? 'Disponível' : 'Reservado'}
                        </span>
                      </td>
                      <td className="px-6 py-4">{plot.occupant || '-'}</td>
                      <td className="px-6 py-4">
                        <button className="text-blue-600 hover:text-blue-900">
                          <Edit2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'ai' && (
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
              <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Auditoria de Vagas</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">
                Nossa IA analisa inconsistências entre o mapa digital e os registros de sepultamento.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full font-medium border border-green-100">
                <ShieldCheck size={16} />
                Sem anomalias detectadas
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
