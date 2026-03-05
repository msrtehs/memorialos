import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getTenantNotifications, 
  allocateNotification, 
  rejectNotification, 
  fixWrongTenantIdsForNotifications,
  DeathNotification 
} from '@/services/notificationService';
import { 
  getCemeteries, 
  getSectors, 
  getPlots, 
  Cemetery, 
  Sector, 
  Plot 
} from '@/services/cemeteryService';
import { Check, Clock, MapPin, User, X, AlertCircle, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function CommunicatedDeaths() {
  const { tenantId } = useAuth();
  const [notifications, setNotifications] = useState<DeathNotification[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedNotification, setSelectedNotification] = useState<DeathNotification | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Allocation Form State
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  
  const [selectedCemetery, setSelectedCemetery] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedPlot, setSelectedPlot] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionType, setActionType] = useState<'allocate' | 'reject' | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, [tenantId]);

  const fetchNotifications = async () => {
    if (!tenantId) return;
    console.log("Manager Tenant ID:", tenantId); // Debug
    try {
      const data = await getTenantNotifications(tenantId);
      console.log("Notifications found:", data.length); // Debug
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch cemeteries when opening allocation modal
  useEffect(() => {
    if (isModalOpen && actionType === 'allocate' && tenantId) {
      getCemeteries(tenantId).then(setCemeteries);
    }
  }, [isModalOpen, actionType, tenantId]);

  // Fetch sectors when cemetery changes
  useEffect(() => {
    if (selectedCemetery) {
      getSectors(selectedCemetery).then(setSectors);
      setSelectedSector('');
      setSelectedPlot('');
    }
  }, [selectedCemetery]);

  // Fetch plots when sector changes
  useEffect(() => {
    if (selectedSector) {
      getPlots(selectedSector).then(setPlots);
      setSelectedPlot('');
    }
  }, [selectedSector]);

  const handleOpenModal = (notification: DeathNotification, type: 'allocate' | 'reject') => {
    setSelectedNotification(notification);
    setActionType(type);
    setIsModalOpen(true);
    // Reset form
    setSelectedCemetery('');
    setSelectedSector('');
    setSelectedPlot('');
    setRejectionReason('');
  };

  const handleConfirmAllocation = async () => {
    if (!selectedNotification?.id || !selectedCemetery || !selectedSector || !selectedPlot) return;
    
    try {
      const plot = plots.find(p => p.id === selectedPlot);
      await allocateNotification(selectedNotification.id, {
        cemeteryId: selectedCemetery, // In real app, use name or ID depending on display needs
        sectorId: selectedSector,
        plotId: selectedPlot,
        plotCode: plot?.code
      });
      
      alert("Alocação realizada com sucesso!");
      setIsModalOpen(false);
      fetchNotifications();
    } catch (error) {
      console.error("Error allocating:", error);
      alert("Erro ao alocar. Tente novamente.");
    }
  };

  const handleConfirmRejection = async () => {
    if (!selectedNotification?.id || !rejectionReason) return;
    
    try {
      await rejectNotification(selectedNotification.id, rejectionReason);
      alert("Solicitação rejeitada.");
      setIsModalOpen(false);
      fetchNotifications();
    } catch (error) {
      console.error("Error rejecting:", error);
      alert("Erro ao rejeitar.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full flex items-center gap-1"><Clock size={12} /> Pendente</span>;
      case 'reviewing':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center gap-1"><Clock size={12} /> Em Análise</span>;
      case 'allocated':
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center gap-1"><Check size={12} /> Alocado</span>;
      case 'rejected':
        return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full flex items-center gap-1"><AlertCircle size={12} /> Rejeitado</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comunicações de Óbito</h1>
          <p className="text-slate-500">Gerencie as solicitações de sepultamento recebidas.</p>
        </div>
        <button 
          onClick={() => fixWrongTenantIdsForNotifications().then(() => fetchNotifications())}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded border border-slate-300"
          title="Corrigir IDs (Dev Only)"
        >
          Fix IDs
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Falecido</th>
              <th className="px-6 py-4">Data do Óbito</th>
              <th className="px-6 py-4">Solicitante</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center">Carregando...</td></tr>
            ) : notifications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                  Nenhuma solicitação encontrada.
                </td>
              </tr>
            ) : (
              notifications.map((notification) => (
                <tr key={notification.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                    {notification.photoUrl ? (
                      <img src={notification.photoUrl} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                        <User size={16} />
                      </div>
                    )}
                    <div>
                      <p>{notification.deceased.name}</p>
                      <p className="text-xs text-slate-400 font-normal">{notification.deceased.city} - {notification.deceased.state}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {notification.deceased.dateOfDeath && format(new Date(notification.deceased.dateOfDeath), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    ID: {notification.createdBy.substring(0, 8)}...
                    <br />
                    {notification.createdAt?.seconds && format(new Date(notification.createdAt.seconds * 1000), 'dd/MM/yy HH:mm')}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(notification.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {notification.status === 'submitted' || notification.status === 'reviewing' ? (
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleOpenModal(notification, 'reject')}
                          className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium"
                        >
                          Rejeitar
                        </button>
                        <button 
                          onClick={() => handleOpenModal(notification, 'allocate')}
                          className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium shadow-sm"
                        >
                          Alocar Jazigo
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Processado</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">
                {actionType === 'allocate' ? 'Definir Sepultamento' : 'Rejeitar Solicitação'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Deceased Info Summary */}
              <div className="bg-slate-50 p-4 rounded-xl mb-6 flex gap-4">
                {selectedNotification.photoUrl && (
                  <img src={selectedNotification.photoUrl} className="w-16 h-16 rounded-lg object-cover" />
                )}
                <div>
                  <h4 className="font-bold text-slate-900">{selectedNotification.deceased.name}</h4>
                  <p className="text-sm text-slate-500">
                    Nasc: {selectedNotification.deceased.dateOfBirth} • Falec: {selectedNotification.deceased.dateOfDeath}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {selectedNotification.documents.map((doc, idx) => (
                      <a 
                        key={idx} 
                        href={doc.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <FileText size={12} /> {doc.name}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {actionType === 'allocate' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cemitério</label>
                    <select 
                      value={selectedCemetery} 
                      onChange={(e) => setSelectedCemetery(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Selecione um cemitério...</option>
                      {cemeteries.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Setor / Quadra</label>
                      <select 
                        value={selectedSector} 
                        onChange={(e) => setSelectedSector(e.target.value)}
                        disabled={!selectedCemetery}
                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">Selecione...</option>
                        {sectors.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Jazigo / Lote</label>
                      <select 
                        value={selectedPlot} 
                        onChange={(e) => setSelectedPlot(e.target.value)}
                        disabled={!selectedSector}
                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">Selecione...</option>
                        {plots.filter(p => p.status === 'available').map(p => (
                          <option key={p.id} value={p.id}>{p.code}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {plots.length === 0 && selectedSector && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      Nenhum jazigo disponível neste setor. Cadastre novos jazigos em "Inventário".
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da Rejeição</label>
                  <textarea 
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none h-32"
                    placeholder="Explique o motivo da rejeição (ex: Documentação ilegível)..."
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              {actionType === 'allocate' ? (
                <button 
                  onClick={handleConfirmAllocation}
                  disabled={!selectedPlot}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Confirmar Alocação
                </button>
              ) : (
                <button 
                  onClick={handleConfirmRejection}
                  disabled={!rejectionReason}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Confirmar Rejeição
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
