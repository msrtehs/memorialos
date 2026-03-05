import React, { useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { ClipboardList, Package, Plus, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

export default function MaintenancePage() {
  const { selectedCemeteryId } = useAdmin();
  const [activeTab, setActiveTab] = useState<'tasks' | 'stock'>('tasks');

  // Mock Data
  const tasks = [
    { id: 1, status: 'pending', priority: 'high', description: 'Reparo no muro lateral', plotId: 'Setor A', date: '2023-10-26' },
    { id: 2, status: 'in_progress', priority: 'medium', description: 'Limpeza de Jazigos', plotId: 'Setor B', date: '2023-10-25' },
    { id: 3, status: 'done', priority: 'low', description: 'Troca de lâmpadas', plotId: 'Entrada', date: '2023-10-24' },
  ];

  const stock = [
    { id: 1, name: 'Cimento', category: 'Construção', quantity: 5, minQuantity: 10, unit: 'sacos' },
    { id: 2, name: 'Tijolos', category: 'Construção', quantity: 500, minQuantity: 200, unit: 'unidades' },
    { id: 3, name: 'Luvas de Proteção', category: 'EPI', quantity: 2, minQuantity: 20, unit: 'pares' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Manutenção</h1>
        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
          <button 
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === 'tasks' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <ClipboardList size={16} /> Tarefas
          </button>
          <button 
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === 'stock' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Package size={16} /> Estoque & Compras
          </button>
        </div>
      </div>

      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-4">
            <input 
              type="text" 
              placeholder="Nova Ordem de Serviço..." 
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Plus size={18} /> Adicionar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pending Column */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-400 rounded-full"></span> Pendente
              </h3>
              <div className="space-y-3">
                {tasks.filter(t => t.status === 'pending').map(t => (
                  <div key={t.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${t.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {t.priority === 'high' ? 'Alta Prioridade' : 'Normal'}
                      </span>
                      <span className="text-xs text-slate-400">{t.date}</span>
                    </div>
                    <p className="font-medium text-slate-800 mb-1">{t.description}</p>
                    <p className="text-xs text-slate-500 mb-3">{t.plotId}</p>
                    <button className="w-full text-xs bg-slate-100 hover:bg-green-100 text-slate-600 hover:text-green-700 py-2 rounded transition-colors font-medium">
                      Iniciar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* In Progress Column */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-400 rounded-full"></span> Em Andamento
              </h3>
              <div className="space-y-3">
                {tasks.filter(t => t.status === 'in_progress').map(t => (
                  <div key={t.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${t.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {t.priority === 'high' ? 'Alta Prioridade' : 'Normal'}
                      </span>
                      <span className="text-xs text-slate-400">{t.date}</span>
                    </div>
                    <p className="font-medium text-slate-800 mb-1">{t.description}</p>
                    <p className="text-xs text-slate-500 mb-3">{t.plotId}</p>
                    <button className="w-full text-xs bg-green-600 hover:bg-green-700 text-white py-2 rounded transition-colors font-medium flex items-center justify-center gap-1">
                      <CheckCircle size={14} /> Concluir
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Done Column */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-green-400 rounded-full"></span> Concluído
              </h3>
              <div className="space-y-3">
                {tasks.filter(t => t.status === 'done').map(t => (
                  <div key={t.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 opacity-75">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                        Finalizado
                      </span>
                      <span className="text-xs text-slate-400">{t.date}</span>
                    </div>
                    <p className="font-medium text-slate-800 mb-1 line-through text-slate-500">{t.description}</p>
                    <p className="text-xs text-slate-400">{t.plotId}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">Controle de Estoque</h3>
            <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Plus size={16} /> Solicitar Compra
            </button>
          </div>
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
              <tr>
                <th className="px-6 py-3">Item</th>
                <th className="px-6 py-3">Categoria</th>
                <th className="px-6 py-3">Quantidade</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {stock.map(item => (
                <tr key={item.id} className="bg-white border-b hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                  <td className="px-6 py-4">{item.category}</td>
                  <td className="px-6 py-4 font-mono">{item.quantity} {item.unit}</td>
                  <td className="px-6 py-4">
                    {item.quantity < item.minQuantity ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                        <AlertTriangle size={12} /> Crítico
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                        <CheckCircle size={12} /> OK
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-blue-600 hover:text-blue-900 text-xs font-medium">
                      Solicitar Compra
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
