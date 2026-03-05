import React, { useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  Users, 
  Droplets, 
  ShieldCheck, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  X 
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function AdminDashboard() {
  const { selectedCemeteryId } = useAdmin();
  const navigate = useNavigate();
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  // Mock Data
  const stats = {
    revenue: 45000,
    occupancy: 85,
    alerts: 1,
    necroCheck: 'Pendente'
  };

  const occupancyData = [
    { name: 'Ocupado', value: 850, color: '#EF4444' },
    { name: 'Disponível', value: 150, color: '#10B981' },
    { name: 'Reservado', value: 200, color: '#F59E0B' },
  ];

  const insights = [
    { type: 'warning', text: 'Taxa de ocupação do Setor A atingiu 98%. Considere expansão.' },
    { type: 'success', text: 'Receita mensal superou a meta em 12%.' },
    { type: 'info', text: 'Checklist de necrochorume pendente há 3 dias.' },
  ];

  const handleSaveChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Persist InspectionRecord to Firestore
    setIsChecklistOpen(false);
    alert("Relatório salvo com sucesso!");
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Executivo</h1>
        <div className="text-sm text-slate-500">
          Unidade: <span className="font-medium text-slate-900">{selectedCemeteryId === 'all' ? 'Todas' : selectedCemeteryId}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          onClick={() => navigate('/admin/financeiro')}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 transition-colors">
              <DollarSign size={24} />
            </div>
            <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">+12%</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Receita Total</p>
          <h3 className="text-2xl font-bold text-slate-800">R$ {stats.revenue.toLocaleString()}</h3>
        </div>

        <div 
          onClick={() => navigate('/admin/inventario')}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
              <Users size={24} />
            </div>
            <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded-full">Crítico</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Taxa de Ocupação</p>
          <h3 className="text-2xl font-bold text-slate-800">{stats.occupancy}%</h3>
        </div>

        <div 
          onClick={() => setIsChecklistOpen(true)}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 transition-colors">
              <Droplets size={24} />
            </div>
            <span className="text-xs font-medium bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Ação Necessária</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Necrochorume</p>
          <h3 className="text-2xl font-bold text-slate-800">Verificar</h3>
        </div>

        <div 
          onClick={() => navigate('/admin/seguranca')}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-lg group-hover:bg-red-100 transition-colors">
              <ShieldCheck size={24} />
            </div>
            <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded-full">{stats.alerts} Alerta</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Segurança</p>
          <h3 className="text-2xl font-bold text-slate-800">Ativo</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Status de Vagas</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={occupancyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {occupancyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <TrendingUp size={18} className="text-purple-400" />
            </div>
            <h3 className="text-lg font-bold">Supervisora IA</h3>
          </div>
          
          <div className="space-y-4">
            {insights.map((insight, idx) => (
              <div key={idx} className="bg-white/5 p-4 rounded-lg border border-white/10 backdrop-blur-sm">
                <div className="flex gap-3">
                  {insight.type === 'warning' && <AlertTriangle size={18} className="text-yellow-400 shrink-0 mt-0.5" />}
                  {insight.type === 'success' && <CheckCircle size={18} className="text-green-400 shrink-0 mt-0.5" />}
                  {insight.type === 'info' && <TrendingUp size={18} className="text-blue-400 shrink-0 mt-0.5" />}
                  <p className="text-sm text-slate-200 leading-relaxed">{insight.text}</p>
                </div>
              </div>
            ))}
          </div>
          
          <button 
            onClick={() => navigate('/admin/ia')}
            className="w-full mt-6 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors shadow-lg shadow-purple-900/20"
          >
            Falar com a Supervisora
          </button>
        </div>
      </div>

      {/* Necrochorume Checklist Modal */}
      {isChecklistOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Droplets size={20} className="text-purple-600" /> Checklist Ambiental
              </h3>
              <button onClick={() => setIsChecklistOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveChecklist} className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-slate-300" />
                  <span className="text-slate-700 font-medium">Drenagem Superficial</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-slate-300" />
                  <span className="text-slate-700 font-medium">Verificação de Lóculos</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-slate-300" />
                  <span className="text-slate-700 font-medium">Integridade dos Filtros</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                <textarea 
                  className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none h-24 text-sm"
                  placeholder="Relate qualquer anomalia encontrada..."
                ></textarea>
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-purple-200 transition-all hover:scale-[1.02]">
                  Salvar & Enviar Relatório
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
