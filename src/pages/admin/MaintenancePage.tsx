import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, ClipboardList, Package, Plus } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  createOperationalRecord,
  createStockItem,
  listOperationalRecords,
  listStockItems,
  updateSCIRecord
} from '@/services/sciService';

type TabMode = 'tasks' | 'stock';

export default function MaintenancePage() {
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();
  const [tab, setTab] = useState<TabMode>('tasks');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    responsible: '',
    priority: 'medium',
    scheduledFor: new Date().toISOString().slice(0, 10)
  });

  const [stockForm, setStockForm] = useState({
    name: '',
    category: '',
    quantity: '',
    minQuantity: '',
    unit: ''
  });

  const scopedMaintenanceRecords = useMemo(
    () =>
      maintenanceRecords.filter(
        (item) =>
          item.type === 'maintenance' &&
          (selectedCemeteryId === 'all' || item.cemeteryId === selectedCemeteryId)
      ),
    [maintenanceRecords, selectedCemeteryId]
  );

  const scopedStockItems = useMemo(
    () =>
      stockItems.filter(
        (item) => selectedCemeteryId === 'all' || item.cemeteryId === selectedCemeteryId
      ),
    [stockItems, selectedCemeteryId]
  );

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [records, stock] = await Promise.all([
        listOperationalRecords(tenantId),
        listStockItems(tenantId)
      ]);
      setMaintenanceRecords(records);
      setStockItems(stock);
    } catch (error) {
      console.error('Erro ao carregar manutencao:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, selectedCemeteryId]);

  const handleCreateTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !taskForm.title) return;
    setSaving(true);
    try {
      await createOperationalRecord(tenantId, {
        cemeteryId: selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
        type: 'maintenance',
        title: taskForm.title,
        description: taskForm.description,
        status: 'planned',
        priority: taskForm.priority as any,
        scheduledFor: taskForm.scheduledFor,
        responsible: taskForm.responsible
      });
      setTaskForm({
        title: '',
        description: '',
        responsible: '',
        priority: 'medium',
        scheduledFor: new Date().toISOString().slice(0, 10)
      });
      await loadData();
    } catch (error) {
      console.error('Erro ao criar ordem de manutencao:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTaskStatus = async (id: string, status: string) => {
    if (!tenantId) return;
    try {
      await updateSCIRecord(tenantId, 'sci_operational_records', id, 'UPDATE_MAINTENANCE_STATUS', {
        status
      });
      await loadData();
    } catch (error) {
      console.error('Erro ao atualizar status de manutencao:', error);
    }
  };

  const handleCreateStockItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !stockForm.name || !stockForm.quantity || !stockForm.minQuantity) return;
    setSaving(true);
    try {
      await createStockItem(tenantId, {
        cemeteryId: selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
        name: stockForm.name,
        category: stockForm.category || 'Geral',
        quantity: Number(stockForm.quantity),
        minQuantity: Number(stockForm.minQuantity),
        unit: stockForm.unit || 'un'
      });
      setStockForm({ name: '', category: '', quantity: '', minQuantity: '', unit: '' });
      await loadData();
    } catch (error) {
      console.error('Erro ao criar item de estoque:', error);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'planned', label: 'Pendente', tone: 'bg-amber-400' },
    { key: 'in_progress', label: 'Em andamento', tone: 'bg-blue-400' },
    { key: 'done', label: 'Concluido', tone: 'bg-emerald-400' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Manutencao</h1>
        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
          <button onClick={() => setTab('tasks')} className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium ${tab === 'tasks' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><ClipboardList size={16} /> Ordens</button>
          <button onClick={() => setTab('stock')} className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium ${tab === 'stock' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Package size={16} /> Estoque</button>
        </div>
      </div>

      {tab === 'tasks' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateTask} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <input value={taskForm.title} onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Nova ordem de servico" required />
            <input value={taskForm.description} onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Descricao" />
            <input value={taskForm.responsible} onChange={(e) => setTaskForm((prev) => ({ ...prev, responsible: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Responsavel" />
            <div className="flex gap-2">
              <select value={taskForm.priority} onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))} className="border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white">
                <option value="low">Baixa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Critica</option>
              </select>
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1">
                <Plus size={14} /> Add
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {columns.map((column) => (
              <div key={column.key} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${column.tone}`}></span>
                  {column.label}
                </h3>
                <div className="space-y-3">
                  {scopedMaintenanceRecords.filter((item) => item.status === column.key).map((item) => (
                    <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                      <div className="flex justify-between items-start text-xs">
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">{item.priority}</span>
                        <span className="text-slate-400">{item.scheduledFor || '-'}</span>
                      </div>
                      <p className="font-medium text-slate-800 mt-2">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.description || 'Sem descricao'}</p>
                      <p className="text-xs text-slate-400 mt-2">Resp.: {item.responsible || 'Nao definido'}</p>
                      <div className="mt-3 flex gap-2">
                        {column.key !== 'in_progress' && (
                          <button onClick={() => handleTaskStatus(item.id, 'in_progress')} className="text-xs px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700">Iniciar</button>
                        )}
                        {column.key !== 'done' && (
                          <button onClick={() => handleTaskStatus(item.id, 'done')} className="text-xs px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center gap-1">
                            <CheckCircle size={12} /> Concluir
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!loading && scopedMaintenanceRecords.filter((item) => item.status === column.key).length === 0 && (
                    <div className="text-xs text-slate-500 text-center p-3 border border-dashed border-slate-300 rounded-lg">
                      Sem ordens nesta coluna.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'stock' && (
        <div className="space-y-5">
          <form onSubmit={handleCreateStockItem} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <input value={stockForm.name} onChange={(e) => setStockForm((prev) => ({ ...prev, name: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Item" required />
            <input value={stockForm.category} onChange={(e) => setStockForm((prev) => ({ ...prev, category: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Categoria" />
            <input value={stockForm.quantity} onChange={(e) => setStockForm((prev) => ({ ...prev, quantity: e.target.value }))} type="number" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Qtd atual" required />
            <input value={stockForm.minQuantity} onChange={(e) => setStockForm((prev) => ({ ...prev, minQuantity: e.target.value }))} type="number" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Qtd minima" required />
            <div className="flex gap-2">
              <input value={stockForm.unit} onChange={(e) => setStockForm((prev) => ({ ...prev, unit: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-20" placeholder="un" />
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1">
                <Plus size={14} /> Add
              </button>
            </div>
          </form>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Quantidade</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopedStockItems.map((item) => {
                  const critical = Number(item.quantity) < Number(item.minQuantity);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-slate-600">{item.category}</td>
                      <td className="px-4 py-3 text-slate-700">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs border ${critical ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                          {critical ? 'Critico' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!loading && scopedStockItems.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Nenhum item de estoque cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
