import React, { useEffect, useMemo, useState } from 'react';
import { DollarSign, Plus, TrendingUp } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { createFinancialRecord, getSciExecutiveSnapshot, listFinancialRecords } from '@/services/sciService';

type Tab = 'transactions' | 'pricing' | 'projections';

const pricingTable = [
  { id: 'p1', item: 'Sepultamento padrao', description: 'Taxa operacional completa', price: 1200 },
  { id: 'p2', item: 'Exumacao', description: 'Procedimento regulamentar', price: 950 },
  { id: 'p3', item: 'Concessao jazigo', description: 'Concessao administrativa', price: 5000 },
  { id: 'p4', item: 'Manutencao anual', description: 'Conservacao programada', price: 350 }
];

export default function FinancialPage() {
  const { tenantId } = useAuth();
  const { selectedCemeteryId } = useAdmin();
  const [activeTab, setActiveTab] = useState<Tab>('transactions');
  const [records, setRecords] = useState<any[]>([]);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    description: '',
    category: 'income',
    referenceType: 'service',
    value: '',
    occurredAt: new Date().toISOString().slice(0, 10)
  });

  const scopedRecords = useMemo(
    () => records.filter((item) => selectedCemeteryId === 'all' || item.cemeteryId === selectedCemeteryId),
    [records, selectedCemeteryId]
  );

  const loadData = async () => {
    if (!tenantId) return;
    try {
      const [financialData, exec] = await Promise.all([
        listFinancialRecords(tenantId),
        getSciExecutiveSnapshot(tenantId, selectedCemeteryId)
      ]);
      setRecords(financialData);
      setSnapshot(exec);
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, selectedCemeteryId]);

  const handleCreateRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !form.description || !form.value) return;
    setSaving(true);
    try {
      await createFinancialRecord(tenantId, {
        cemeteryId: selectedCemeteryId === 'all' ? 'all' : selectedCemeteryId,
        description: form.description,
        category: form.category as any,
        referenceType: form.referenceType as any,
        value: Number(form.value),
        occurredAt: form.occurredAt,
        aiAudited: true
      });
      setForm({
        description: '',
        category: 'income',
        referenceType: 'service',
        value: '',
        occurredAt: new Date().toISOString().slice(0, 10)
      });
      await loadData();
    } catch (error) {
      console.error('Erro ao criar lancamento:', error);
    } finally {
      setSaving(false);
    }
  };

  const balance = (snapshot?.totalRevenue || 0) - (snapshot?.totalExpenses || 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Financeiro</h1>
        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1 overflow-x-auto whitespace-nowrap">
          <button onClick={() => setActiveTab('transactions')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'transactions' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>Transacoes</button>
          <button onClick={() => setActiveTab('pricing')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'pricing' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>Tabela de precos</button>
          <button onClick={() => setActiveTab('projections')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'projections' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>Projecoes</button>
        </div>
      </div>

      {activeTab === 'transactions' && (
        <div className="space-y-5">
          <form onSubmit={handleCreateRecord} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Descricao do lancamento" required />
            <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
            <select value={form.referenceType} onChange={(e) => setForm((prev) => ({ ...prev, referenceType: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="service">Servico</option>
              <option value="burial">Sepultamento</option>
              <option value="exhumation">Exumacao</option>
              <option value="maintenance">Manutencao</option>
              <option value="other">Outro</option>
            </select>
            <input value={form.value} onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))} type="number" step="0.01" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Valor" required />
            <div className="flex gap-2">
              <input value={form.occurredAt} onChange={(e) => setForm((prev) => ({ ...prev, occurredAt: e.target.value }))} type="date" className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1" required />
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1">
                <Plus size={14} /> Add
              </button>
            </div>
          </form>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm text-left">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Descricao</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Auditoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopedRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{item.occurredAt}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.description}</td>
                    <td className="px-4 py-3 text-slate-600">{item.referenceType}</td>
                    <td className={`px-4 py-3 font-semibold ${item.category === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {item.category === 'income' ? '+' : '-'} R$ {Number(item.value).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {item.aiAudited ? (
                        <span className="px-2 py-1 rounded-full text-xs border bg-blue-50 text-blue-700 border-blue-200">Validado IA</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs border bg-slate-100 text-slate-600 border-slate-200">Pendente</span>
                      )}
                    </td>
                  </tr>
                ))}
                {scopedRecords.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nenhum lancamento financeiro cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pricing' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {pricingTable.map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center"><DollarSign size={18} /></div>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">Referencial</span>
              </div>
              <h3 className="mt-4 font-bold text-slate-800">{item.item}</h3>
              <p className="text-sm text-slate-500 mt-1">{item.description}</p>
              <p className="text-2xl font-bold text-slate-900 mt-4">R$ {item.price.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'projections' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-500 to-blue-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <TrendingUp size={30} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Analise preditiva</h2>
                <p className="text-blue-100 max-w-2xl">
                  O SCI cruza ocupacao, fluxo operacional e passivos documentais para projetar capacidade e receita. Quanto maior a saturacao, maior a necessidade de expansao e priorizacao de exumacoes regulamentares.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wider text-blue-100">Receita total</p>
                    <p className="text-2xl font-bold mt-1">R$ {(snapshot?.totalRevenue || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wider text-blue-100">Despesas totais</p>
                    <p className="text-2xl font-bold mt-1">R$ {(snapshot?.totalExpenses || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wider text-blue-100">Saldo projetado</p>
                    <p className="text-2xl font-bold mt-1">R$ {balance.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
