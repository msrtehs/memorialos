import React from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Shield, AlertTriangle, CheckCircle, Video, Eye } from 'lucide-react';

export default function SecurityPage() {
  const { selectedCemeteryId } = useAdmin();

  const alerts = [
    { id: 1, location: 'Portão Principal', status: 'active', timestamp: '10:42 - Hoje', type: 'Movimento Detectado' },
    { id: 2, location: 'Setor B - Fundos', status: 'resolved', timestamp: '08:15 - Hoje', type: 'Portão Aberto' },
    { id: 3, location: 'Estacionamento', status: 'resolved', timestamp: '22:30 - Ontem', type: 'Veículo Suspeito' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Segurança</h1>
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Sistema Online
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Camera Feed (Placeholder) */}
        <div className="lg:col-span-2 bg-black rounded-xl overflow-hidden shadow-lg relative aspect-video group">
          <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1 z-10">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span> AO VIVO
          </div>
          <div className="absolute top-4 right-4 text-white/50 text-xs font-mono z-10">
            CAM-01 • {new Date().toLocaleTimeString()}
          </div>
          
          {/* Placeholder Content */}
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900">
            <Video size={48} className="mb-2 opacity-50" />
            <p className="text-sm font-mono">Conectando ao feed de vídeo...</p>
          </div>

          {/* Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="text-white text-sm font-medium">Câmera Principal - Entrada</div>
            <button className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg backdrop-blur-sm transition-colors">
              <Eye size={18} />
            </button>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Shield size={18} className="text-blue-600" /> Alertas Recentes
            </h3>
            <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {alerts.filter(a => a.status === 'active').length} Ativos
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {alerts.map(alert => (
              <div key={alert.id} className={`p-3 rounded-lg border ${alert.status === 'active' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-xs font-bold uppercase ${alert.status === 'active' ? 'text-red-700' : 'text-slate-500'}`}>
                    {alert.type}
                  </span>
                  <span className="text-[10px] text-slate-400">{alert.timestamp}</span>
                </div>
                <p className="text-sm font-medium text-slate-800 mb-2">{alert.location}</p>
                
                {alert.status === 'active' ? (
                  <button className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-1.5 rounded transition-colors shadow-sm">
                    Verificar Agora
                  </button>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircle size={12} /> Resolvido
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
