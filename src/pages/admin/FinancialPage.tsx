import React, { useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { DollarSign, TrendingUp, FileText, CheckCircle, AlertTriangle, Plus } from 'lucide-react';

export default function FinancialPage() {
  const { selectedCemeteryId } = useAdmin();
  const [activeTab, setActiveTab] = useState<'transactions' | 'pricing' | 'projections'>('transactions');

  // Mock Data
  const transactions = [
    { id: 1, date: '2023-10-25', description: 'Venda Jazigo A-12', category: 'Venda', value: 5000, type: 'income', aiAudited: true },
    { id: 2, date: '2023-10-24', description: 'Manutenção Jardim', category: 'Serviço', value: -450, type: 'expense', aiAudited: true },
    { id: 3, date: '2023-10-23', description: 'Taxa de Sepultamento', category: 'Taxa', value: 800, type: 'income', aiAudited: false },
  ];

  const pricing = [
    { id: 1, item: 'Jazigo Perpétuo', description: 'Concessão de uso perpétuo', price: 5000 },
    { id: 2, item: 'Jazigo Temporário (3 anos)', description: 'Locação por período determinado', price: 1500 },
    { id: 3, item: 'Manutenção Anual', description: 'Taxa de conservação', price: 350 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Financeiro</h1>
        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'transactions' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Transações
          </button>
          <button 
            onClick={() => setActiveTab('pricing')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'pricing' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Tabela de Preços
          </button>
          <button 
            onClick={() => setActiveTab('projections')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'projections' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Projeções
          </button>
        </div>
      </div>

      {activeTab === 'transactions' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">Histórico de Transações</h3>
            <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Plus size={16} /> Nova Transação
            </button>
          </div>
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
              <tr>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Descrição</th>
                <th className="px-6 py-3">Categoria</th>
                <th className="px-6 py-3">Valor</th>
                <th className="px-6 py-3">Auditoria</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="bg-white border-b hover:bg-slate-50">
                  <td className="px-6 py-4">{t.date}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{t.description}</td>
                  <td className="px-6 py-4">{t.category}</td>
                  <td className={`px-6 py-4 font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'} R$ {Math.abs(t.value).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    {t.aiAudited && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        <CheckCircle size={12} /> Verificado
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'pricing' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pricing.map(p => (
            <div key={p.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <DollarSign size={24} />
                </div>
                <button className="text-slate-400 hover:text-blue-600 text-sm font-medium">Editar</button>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{p.item}</h3>
              <p className="text-slate-500 text-sm mb-4">{p.description}</p>
              <div className="text-2xl font-bold text-slate-900">R$ {p.price.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'projections' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <TrendingUp size={32} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Oportunidade Detectada</h2>
                <p className="text-indigo-100 mb-6 max-w-2xl">
                  Identificamos 12 jazigos temporários com contrato vencido há mais de 90 dias. 
                  A exumação e liberação destes espaços pode gerar uma receita potencial imediata.
                </p>
                <div className="flex items-center gap-8 mb-6">
                  <div>
                    <span className="block text-indigo-200 text-sm uppercase tracking-wider">Receita Potencial</span>
                    <span className="text-3xl font-bold">R$ 60.000,00</span>
                  </div>
                  <div>
                    <span className="block text-indigo-200 text-sm uppercase tracking-wider">Vagas Liberadas</span>
                    <span className="text-3xl font-bold">12</span>
                  </div>
                </div>
                <button className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-sm">
                  Gerar Ordens de Preparação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
